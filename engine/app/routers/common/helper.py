from fastapi import HTTPException
from fastapi.responses import JSONResponse

from azure.identity.aio import OnBehalfOfCredential, ClientSecretCredential

from azure.core import MatchConditions
from azure.core.exceptions import ClientAuthenticationError, HttpResponseError, ServiceRequestError

from azure.mgmt.resourcegraph.aio import ResourceGraphClient
from azure.mgmt.resourcegraph.models import *
from azure.mgmt.managementgroups.aio import ManagementGroupsAPI

from azure.cosmos.aio import CosmosClient
import azure.cosmos.exceptions as exceptions

import os
import jwt
from netaddr import IPNetwork
from functools import wraps

from requests import options

from app.globals import globals

# SCOPE = "https://management.azure.com/user_impersonation"

def valid_ipv4(addr):
    try:
        ip_net = IPNetwork(addr, version=4)
    except:
        return False

    return True

def valid_ipv6(addr):
    try:
        ip_net = IPNetwork(addr, version=6)
    except:
        return False

    return True

def vnet_fixup(vnet_list):
    for vnet in vnet_list:
        # Filter out IPv4 & IPv6 prefixes
        ipv4_prefixes = list(filter(lambda x: valid_ipv4(x), vnet['prefixes']))
        # ipv6_prefixes = list(filter(lambda x: valid_ipv6(x), vnet['prefixes']))

        vnet['prefixes'] = ipv4_prefixes
        # vnet['prefixes_v6'] = ipv6_prefixes

        for subnet in vnet['subnets']:
            # Subnet IPv4 & IPv6 prefix
            ipv4_prefix = subnet['prefix'][0]
            # ipv6_prefix = subnet['prefix'][1] if len(subnet['prefix']) > 1 else None

            subnet['prefix'] = ipv4_prefix
            # subnet['prefix_v6'] = ipv6_prefix

    return vnet_list

def subnet_fixup(subnet_list):
    for subnet in subnet_list:
        # Subnet IPv4 & IPv6 prefix
        ipv4_prefix = subnet['prefix'][0]
        # ipv6_prefix = subnet['prefix'][1] if len(subnet['prefix']) > 1 else None

        subnet['prefix'] = ipv4_prefix
        # subnet['prefix_v6'] = ipv6_prefix

    return subnet_list

def get_tenant_from_jwt(token):
    """DOCSTRING"""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['tid']

def get_username_from_jwt(token):
    """DOCSTRING"""

    decoded = jwt.decode(token, options={"verify_signature": False})

    if "preferred_username" in decoded:
        return decoded["preferred_username"]
    else:
        return f"spn:{decoded['oid']}"

def get_user_id_from_jwt(token):
    """DOCSTRING"""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['oid']

async def get_obo_token(assertion):
    """DOCSTRING"""

    azure_arm_url = 'https://{}/user_impersonation'.format(globals.AZURE_ARM_URL)

    credential = OnBehalfOfCredential(globals.TENANT_ID, globals.CLIENT_ID, client_secret=globals.CLIENT_SECRET, user_assertion=assertion)
    obo_token = await credential.get_token(azure_arm_url)
    await credential.close()

    return obo_token

async def get_client_credentials():
    """DOCSTRING"""

    credential = ClientSecretCredential(globals.TENANT_ID, globals.CLIENT_ID, globals.CLIENT_SECRET, authority=globals.AUTHORITY_HOST)

    return credential

async def get_obo_credentials(assertion):
    """DOCSTRING"""

    credential = OnBehalfOfCredential(globals.TENANT_ID, globals.CLIENT_ID, client_secret=globals.CLIENT_SECRET, user_assertion=assertion, authority=globals.AUTHORITY_HOST)

    return credential

async def get_mgmt_group_name(tenant_id):
    """DOCSTRING"""

    client_creds = await get_client_credentials()
    mgmt_group_api = ManagementGroupsAPI(client_creds)

    try:
        result = await mgmt_group_api.management_groups.get(tenant_id)
    except HttpResponseError:
        raise HTTPException(status_code=500, detail="Error fetching management group name.")
    finally:
        await mgmt_group_api.close()
        await client_creds.close()

    return results

async def cosmos_query(query: str, tenant_id: str):
    """DOCSTRING"""

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = cosmos_client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    query_results = container.query_items(
        query = query,
        # enable_cross_partition_query=True,
        partition_key = tenant_id
    )

    result_array = [result async for result in query_results]

    await cosmos_client.close()

    return result_array

async def cosmos_upsert(data):
    """DOCSTRING"""

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = cosmos_client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    try:
        res = await container.upsert_item(data)
    except:
        raise
    finally:
        await cosmos_client.close()

    await cosmos_client.close()

    return res

async def cosmos_replace(old, new):
    """DOCSTRING"""

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = cosmos_client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    try:
        await container.replace_item(
            item = old,
            body = new,
            match_condition = MatchConditions.IfNotModified,
            etag = old['_etag']
        )
    except:
        raise
    finally:
        await cosmos_client.close()

    await cosmos_client.close()

    return

async def cosmos_delete(item, tenant_id: str):
    """DOCSTRING"""

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = cosmos_client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    try:
        await container.delete_item(
            item = item,
            partition_key = tenant_id
        )
    except:
        raise
    finally:
        await cosmos_client.close()

    await cosmos_client.close()

    return

def cosmos_retry(error_msg, max_retry = 5):
    """DOCSTRING"""

    def cosmos_retry_decorator(func):
        @wraps(func)
        async def func_with_retries(*args, **kwargs):
            _tries = max_retry

            while _tries > 0:
                try:
                    return await func(*args, **kwargs)
                except exceptions.CosmosAccessConditionFailedError:
                    _tries -= 1

                    if _tries == 0:
                        raise HTTPException(status_code=500, detail=error_msg)
                    
        return func_with_retries
    return cosmos_retry_decorator

async def arg_query(auth, admin, query):
    """DOCSTRING"""

    if admin:
        creds = await get_client_credentials()
        tenant_id = globals.TENANT_ID
    else:
        user_assertion=auth.split(' ')[1]
        creds = await get_obo_credentials(user_assertion)
        tenant_id = get_tenant_from_jwt(user_assertion)

    exclusions_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if exclusions_query:
        exclusions_array = exclusions_query[0]['exclusions']

        if exclusions_array:
            exclusions = "(" + str(exclusions_array)[1:-1] + ")"
        else:
            exclusions = "('')"
    else:
        exclusions = "('')"

    try:
        results = await arg_query_helper(creds, query.format(exclusions))
    except ClientAuthenticationError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except HttpResponseError as e:
        print(e)
        raise HTTPException(status_code=403, detail="Access denied.")
    finally:
        await creds.close()

    return results

async def arg_query_client(query):
    """DOCSTRING"""

    client_creds = await get_client_credentials()

    try:
        results = await arg_query_helper(client_creds, query)
    except ClientAuthenticationError:
        await client_creds.close()
        raise HTTPException(status_code=401, detail="Token has expired.")
    finally:
        await client_creds.close()

    return results

async def arg_query_obo(auth, query):
    """DOCSTRING"""

    user_assertion=auth.split(' ')[1]

    obo_creds = await get_obo_credentials(user_assertion)

    try:
        results = await arg_query_helper(obo_creds, query)
    except ClientAuthenticationError:
        await obo_creds.close()
        raise HTTPException(status_code=401, detail="Token has expired.")
    finally:
        await obo_creds.close()

    return results

async def arg_query_helper(credentials, query):
    """DOCSTRING"""

    results = []

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    resource_graph_client = ResourceGraphClient(
        credential=credentials,
        base_url=azure_arm_url,
        credential_scopes=[azure_arm_scope]
    )

    try:
        skip_token = None

        while True:
            query_request = QueryRequest(
                query=query,
                # management_groups=[globals.TENANT_ID],
                options=QueryRequestOptions(
                    result_format=ResultFormat.object_array,
                    skip_token=skip_token
                )
            )

            poll = await resource_graph_client.resources(query_request)
            results = results + poll.data

            if poll.skip_token:
                skip_token = poll.skip_token
            else:
                break
    except ServiceRequestError as e:
        print(e)
        raise HTTPException(status_code=500, detail="Error communicating with Azure.")
    except HttpResponseError as e:
        print(e)
        raise HTTPException(status_code=403, detail="Access denied.")
    finally:
        await resource_graph_client.close()

    return results
