from fastapi import HTTPException
from fastapi.responses import JSONResponse

from azure.identity.aio import OnBehalfOfCredential, ClientSecretCredential
from azure.core.exceptions import ClientAuthenticationError, HttpResponseError, ServiceRequestError
from azure.mgmt.resourcegraph.aio import ResourceGraphClient
from azure.mgmt.resourcegraph.models import *

from azure.core import MatchConditions
from azure.cosmos.aio import CosmosClient
import azure.cosmos.exceptions as exceptions

import os
import jwt
from functools import wraps

from requests import options

from app.globals import globals

SCOPE = "https://management.azure.com/user_impersonation"

def get_tenant_from_jwt(token):
    """DOCSTRING"""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['tid']

def get_username_from_jwt(token):
    """DOCSTRING"""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['preferred_username']

def get_user_id_from_jwt(token):
    """DOCSTRING"""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['oid']

async def get_obo_token(assertion):
    """DOCSTRING"""

    credential = OnBehalfOfCredential(globals.TENANT_ID, globals.CLIENT_ID, client_secret=globals.CLIENT_SECRET, user_assertion=assertion)
    obo_token = await credential.get_token(SCOPE)
    await credential.close()

    return obo_token

async def get_client_credentials():
    """DOCSTRING"""

    credential = ClientSecretCredential(globals.TENANT_ID, globals.CLIENT_ID, globals.CLIENT_SECRET)

    return credential

async def get_obo_credentials(assertion):
    """DOCSTRING"""

    credential = OnBehalfOfCredential(globals.TENANT_ID, globals.CLIENT_ID, client_secret=globals.CLIENT_SECRET, user_assertion=assertion)

    return credential

# async def cosmos_query(target: str):
#     """DOCSTRING"""
#     cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

#     database_name = "ipam-db"
#     database = cosmos_client.get_database_client(database_name)

#     container_name = "ipam-container"
#     container = database.get_container_client(container_name)

#     item = await container.read_item(target, partition_key=target)

#     await cosmos_client.close()

#     return item

# async def cosmos_upsert(target: str, data):
#     """DOCSTRING"""

#     cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

#     database_name = "ipam-db"
#     database = cosmos_client.get_database_client(database_name)

#     container_name = "ipam-container"
#     container = database.get_container_client(container_name)

#     try:
#         await container.upsert_item(
#             data,
#             match_condition=MatchConditions.IfNotModified,
#             etag=data['_etag']
#         )
#     except:
#         raise
#     finally:
#         await cosmos_client.close()

#     return

async def cosmos_query(query: str, tenant_id: str):
    """DOCSTRING"""

    result_array = []

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-ctr"
    container = database.get_container_client(container_name)

    query_results = container.query_items(
        query = query,
        # enable_cross_partition_query=True,
        partition_key = tenant_id
    )

    async for result in query_results:
        result_array.append(result)

    await cosmos_client.close()

    return result_array

async def cosmos_upsert(data):
    """DOCSTRING"""

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-ctr"
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

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-ctr"
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

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-ctr"
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
        print(exclusions)
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

    resource_graph_client = ResourceGraphClient(credentials)

    try:
        skip_token = None

        while True:
            query = QueryRequest(
                query=query,
                management_groups=[globals.TENANT_ID],
                options=QueryRequestOptions(
                    result_format=ResultFormat.object_array,
                    skip_token=skip_token
                )
            )

            poll = await resource_graph_client.resources(query)
            results = results + poll.data

            if poll.skip_token:
                skip_token = poll.skip_token
            else:
                break
    except ServiceRequestError:
        raise HTTPException(status_code=500, detail="Error communicating with Azure.")
    finally:
        await resource_graph_client.close()

    return results
