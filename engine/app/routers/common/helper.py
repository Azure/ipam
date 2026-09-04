import asyncio
import random
from functools import wraps

import azure.cosmos.exceptions as exceptions
import jwt
from azure.core import MatchConditions
from azure.core.exceptions import (
    ClientAuthenticationError,
    HttpResponseError,
    ServiceRequestError,
)
from azure.cosmos.aio import CosmosClient
from azure.identity.aio import (
    ClientSecretCredential,
    ManagedIdentityCredential,
    OnBehalfOfCredential,
)
from azure.mgmt.managementgroups.aio import ManagementGroupsMgmtClient
from azure.mgmt.resourcegraph.aio import ResourceGraphClient
from azure.mgmt.resourcegraph.models import (
    QueryRequest,
    QueryRequestOptions,
    ResultFormat,
)
from fastapi import HTTPException
from netaddr import IPNetwork

from app.globals import globals
from app.logs.logs import ipam_logger as logger

# Azure Resource Graph enforces a short per-caller quota window, so brief throttles are absorbed
# here while longer ones are reported to the caller rather than held open.
ARG_MAX_ATTEMPTS = 3
ARG_MAX_BACKOFF_SECONDS = 3
# Every paged query spends one unit of that quota, so warn before a large result set exhausts it.
ARG_QUOTA_WARN_THRESHOLD = 2

_cosmos_client = None

def get_cosmos_client():
    # Created lazily so the shared aiohttp transport is built within a running event loop. Newer
    # aiohttp requires a running loop when its ClientSession/TCPConnector are created; building the
    # client (and thus accessing globals.SHARED_TRANSPORT) at import time raised "no running event
    # loop" and crash-looped the engine on startup.
    global _cosmos_client

    if _cosmos_client is None:
        managed_identity_credential = ManagedIdentityCredential(
            client_id = globals.MANAGED_IDENTITY_ID
        )

        _cosmos_client = CosmosClient(
            url=globals.COSMOS_URL,
            credential=(globals.COSMOS_KEY if globals.COSMOS_KEY else managed_identity_credential),
            transport=globals.SHARED_TRANSPORT
        )

    return _cosmos_client

def valid_ipv4(addr):
    try:
        IPNetwork(addr, version=4)
    except Exception:
        return False

    return True

def valid_ipv6(addr):
    try:
        IPNetwork(addr, version=6)
    except Exception:
        return False

    return True

def vnet_fixup(vnet_list):
    for vnet in vnet_list:
        # Filter out IPv4 & IPv6 prefixes
        ipv4_prefixes = list(filter(lambda x: valid_ipv4(x), vnet['prefixes']))
        # ipv6_prefixes = list(filter(lambda x: valid_ipv6(x), vnet['prefixes']))

        vnet['prefixes'] = ipv4_prefixes
        # vnet['prefixes_v6'] = ipv6_prefixes

        if 'subnets' in vnet:
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
    """Return the tenant ID (``tid`` claim) from an unverified decode of the given JWT."""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['tid']

def get_username_from_jwt(token):
    """Return the caller's username from a JWT, falling back to ``spn:<oid>`` for service principals."""

    decoded = jwt.decode(token, options={"verify_signature": False})

    if "preferred_username" in decoded:
        return decoded["preferred_username"]
    else:
        return f"spn:{decoded['oid']}"

def get_user_id_from_jwt(token):
    """Return the caller's object ID (``oid`` claim) from an unverified decode of the given JWT."""

    decoded = jwt.decode(token, options={"verify_signature": False})

    return decoded['oid']

async def get_obo_token(assertion):
    """Exchange a user assertion for an on-behalf-of access token scoped to Azure Resource Manager."""

    azure_arm_url = 'https://{}/user_impersonation'.format(globals.AZURE_ARM_URL)

    credential = OnBehalfOfCredential(
        tenant_id=globals.TENANT_ID,
        client_id=globals.CLIENT_ID,
        client_secret=globals.CLIENT_SECRET,
        user_assertion=assertion
    )
    obo_token = await credential.get_token(azure_arm_url)
    await credential.close()

    return obo_token

async def get_client_credentials():
    """Return a client-secret credential for the IPAM service principal (app-only auth)."""

    credential = ClientSecretCredential(
        tenant_id=globals.TENANT_ID,
        client_id=globals.CLIENT_ID,
        client_secret=globals.CLIENT_SECRET,
        authority=globals.AUTHORITY_HOST
    )

    return credential

async def get_obo_credentials(assertion):
    """Return an on-behalf-of credential built from the given user assertion (delegated auth)."""

    credential = OnBehalfOfCredential(
        tenant_id=globals.TENANT_ID,
        client_id=globals.CLIENT_ID,
        client_secret=globals.CLIENT_SECRET,
        user_assertion=assertion,
        authority=globals.AUTHORITY_HOST
    )

    return credential

async def get_mgmt_group_name(tenant_id):
    """Fetch the root management group for the given tenant using app-only credentials."""

    client_creds = await get_client_credentials()
    mgmt_group_api = ManagementGroupsMgmtClient(client_creds)

    try:
        result = await mgmt_group_api.management_groups.get(tenant_id)
    except HttpResponseError:
        raise HTTPException(status_code=500, detail="Error fetching management group name.")
    finally:
        await mgmt_group_api.close()
        await client_creds.close()

    return result

# Needs a try/except block for aiohttp.client_exceptions.ServerTimeoutError
async def cosmos_query(query: str, tenant_id: str):
    """Run a Cosmos DB query within the tenant's partition and return all matching items."""

    # cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = get_cosmos_client().get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    query_results = container.query_items(
        query = query,
        # enable_cross_partition_query=True,
        partition_key = tenant_id
    )

    result_array = [result async for result in query_results]

    # await cosmos_client.close()

    return result_array

async def cosmos_upsert(data):
    """Insert or replace a document in the IPAM Cosmos DB container."""

    # cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = get_cosmos_client().get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    try:
        res = await container.upsert_item(data)
    except:
        raise
    # finally:
    #     await cosmos_client.close()

    # await cosmos_client.close()

    return res

async def cosmos_replace(old, new):
    """Replace an existing Cosmos DB document using optimistic concurrency (ETag match)."""

    # cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = get_cosmos_client().get_database_client(database_name)

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
    # finally:
    #     await cosmos_client.close()

    # await cosmos_client.close()

    return

async def cosmos_delete(item, tenant_id: str):
    """Delete a document from the tenant's partition in the IPAM Cosmos DB container."""

    # cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME
    database = get_cosmos_client().get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    try:
        await container.delete_item(
            item = item,
            partition_key = tenant_id
        )
    except:
        raise
    # finally:
    #     await cosmos_client.close()

    # await cosmos_client.close()

    return

def cosmos_retry(error_msg, max_retry = 5):
    """Decorator that retries a Cosmos DB operation on optimistic-concurrency conflicts, raising HTTP 500 with ``error_msg`` once retries are exhausted."""

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
    """Run an Azure Resource Graph query (as admin or on-behalf-of the caller), injecting the tenant's subscription exclusions."""

    app_only = bool(admin)

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
        results = await arg_query_helper(creds, query.format(exclusions), app_only=app_only)
    finally:
        await creds.close()

    return results

async def arg_query_client(query):
    """Run an Azure Resource Graph query using app-only (client secret) credentials."""

    client_creds = await get_client_credentials()

    try:
        results = await arg_query_helper(client_creds, query, app_only=True)
    finally:
        await client_creds.close()

    return results

async def arg_query_obo(auth, query):
    """Run an Azure Resource Graph query on-behalf-of the caller using their bearer token."""

    user_assertion=auth.split(' ')[1]

    obo_creds = await get_obo_credentials(user_assertion)

    try:
        results = await arg_query_helper(obo_creds, query, app_only=False)
    finally:
        await obo_creds.close()

    return results

def arg_header_value(headers, name):
    """Look up a header case-insensitively, since header casing varies by transport."""

    for key, value in (headers or {}).items():
        if str(key).lower() == name:
            return value

    return None

def arg_error_headers(error):
    """Response headers carried by an Azure SDK error, if any."""

    return getattr(getattr(error, 'response', None), 'headers', None)

def arg_retry_after(headers):
    """Seconds Azure Resource Graph asked us to wait, or None if it didn't say."""

    retry_after = arg_header_value(headers, 'retry-after')

    if retry_after:
        try:
            return float(retry_after)
        except ValueError:
            pass

    # ARG reports its remaining quota window as hh:mm:ss.
    quota_reset = arg_header_value(headers, 'x-ms-user-quota-resets-after')

    if quota_reset:
        try:
            hours, minutes, seconds = quota_reset.split(':')

            return (int(hours) * 3600) + (int(minutes) * 60) + float(seconds)
        except ValueError:
            pass

    return None

def arg_quota_remaining(headers):
    """Queries left in the caller's Azure Resource Graph quota window, or None if not reported."""

    remaining = arg_header_value(headers, 'x-ms-user-quota-remaining')

    if remaining is not None:
        try:
            return int(remaining)
        except (TypeError, ValueError):
            pass

    return None

def arg_capture_headers(pipeline_response, deserialized, _):
    """SDK ``cls`` hook that keeps the raw response headers alongside the deserialized page."""

    return deserialized, pipeline_response.http_response.headers

async def arg_resources_with_retry(resource_graph_client, query_request):
    """Request one page of Azure Resource Graph results, retrying only while throttling clears quickly.

    Returns the page alongside its response headers so the caller can track quota consumption.
    """

    attempt = 0

    while True:
        attempt += 1

        try:
            return await resource_graph_client.resources(query_request, cls=arg_capture_headers)
        except HttpResponseError as e:
            if e.status_code != 429 or attempt >= ARG_MAX_ATTEMPTS:
                raise

            retry_after = arg_retry_after(arg_error_headers(e))

            # Waiting out a long quota window would stall the caller, so hand the 429 back instead.
            if retry_after is not None and retry_after > ARG_MAX_BACKOFF_SECONDS:
                raise

            backoff = retry_after if retry_after is not None else min(2 ** (attempt - 1), ARG_MAX_BACKOFF_SECONDS)

            # Jittered so concurrent vNET/vHUB queries don't retry in lockstep and re-trip the quota.
            await asyncio.sleep(backoff + random.uniform(0, 0.5))

async def arg_query_helper(credentials, query, app_only = False):
    """Execute an Azure Resource Graph query with the given credentials, paging through all results via skip tokens.

    Set ``app_only`` when ``credentials`` belong to the IPAM service principal rather than the caller,
    so an authentication failure is reported as a server fault instead of blaming the caller's token.
    """

    results = []

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    resource_graph_client = ResourceGraphClient(
        credential=credentials,
        base_url=azure_arm_url,
        credential_scopes=[azure_arm_scope],
        transport=globals.SHARED_TRANSPORT
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

            # Only the page request is retried, so already-collected results are never re-appended.
            poll, response_headers = await arg_resources_with_retry(resource_graph_client, query_request)
            results = results + poll.data

            remaining = arg_quota_remaining(response_headers)

            if remaining is not None and remaining <= ARG_QUOTA_WARN_THRESHOLD:
                logger.warning(
                    "Azure Resource Graph quota nearly exhausted: {} queries remaining, resets in {}s ({} of {} records collected)",
                    remaining, arg_retry_after(response_headers), len(results), poll.total_records
                )

            if poll.skip_token:
                skip_token = poll.skip_token
            else:
                break
    except ServiceRequestError as e:
        logger.error("Error communicating with Azure: {}", e)
        raise HTTPException(status_code=500, detail="Error communicating with Azure.")
    # Must precede HttpResponseError: ClientAuthenticationError is a subclass of it.
    except ClientAuthenticationError as e:
        logger.error("Azure authentication failed (app_only={}): {}", app_only, e)

        if app_only:
            raise HTTPException(status_code=500, detail="Azure IPAM could not authenticate to Azure, its service principal credentials may be expired or invalid.")

        raise HTTPException(status_code=401, detail="Azure authentication failed, your credentials may be expired or invalid.")
    except HttpResponseError as e:
        logger.error("Azure Resource Graph query failed: {}", e)

        if e.status_code == 429:
            retry_after = arg_retry_after(arg_error_headers(e))

            raise HTTPException(
                status_code=429,
                detail="Azure Resource Graph is throttling requests, please retry shortly.",
                headers={"Retry-After": str(max(1, int(retry_after)))} if retry_after else None
            )

        if e.status_code and e.status_code >= 500:
            raise HTTPException(status_code=502, detail="Azure Resource Graph is unavailable, please retry shortly.")

        # The SDK maps an ARG 401 to ClientAuthenticationError, so only 403 reaches here.
        if e.status_code == 403:
            raise HTTPException(status_code=403, detail="Access denied.")

        # Any other upstream status reflects an ARG-side or query fault rather than a caller error,
        # so the real status is logged instead of being relayed and blamed on the caller.
        raise HTTPException(status_code=502, detail="Azure Resource Graph query failed.")
    finally:
        await resource_graph_client.close()

    return results
