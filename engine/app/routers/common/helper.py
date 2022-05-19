from fastapi import HTTPException
from fastapi.responses import JSONResponse

from azure.identity.aio import OnBehalfOfCredential, ClientSecretCredential
from azure.core.exceptions import ClientAuthenticationError, HttpResponseError
from azure.mgmt.resourcegraph.aio import ResourceGraphClient
from azure.mgmt.resourcegraph.models import *

from azure.core import MatchConditions
from azure.cosmos.aio import CosmosClient
import azure.cosmos.exceptions as exceptions

import os
import jwt

import app.globals as globals

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

async def cosmos_query(target: str):
    """DOCSTRING"""
    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-container"
    container = database.get_container_client(container_name)

    item = await container.read_item(target, partition_key=target)

    await cosmos_client.close()

    return item

async def cosmos_upsert(target: str, data):
    """DOCSTRING"""

    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-container"
    container = database.get_container_client(container_name)

    try:
        await container.upsert_item(
            data,
            match_condition=MatchConditions.IfNotModified,
            etag=data['_etag']
        )
    except:
        raise
    finally:
        await cosmos_client.close()

    await cosmos_client.close()

    return

async def arg_query(auth, admin, query):
    """DOCSTRING"""

    if admin:
        creds = await get_client_credentials()
    else:
        user_assertion=auth.split(' ')[1]
        creds = await get_obo_credentials(user_assertion)

    try:
        results = await arg_query_helper(creds, query)
    except ClientAuthenticationError:
        await creds.close()
        raise HTTPException(status_code=401, detail="Token has expired.")
    except HttpResponseError as e:
        await creds.close()
        raise HTTPException(status_code=403, detail="Access denied.")

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

    await obo_creds.close()

    return results

async def arg_query_helper(credentials, query):
    """DOCSTRING"""

    resource_graph_client = ResourceGraphClient(credentials)

    query = QueryRequest(
        query=query,
        management_groups=[globals.TENANT_ID],
        options=QueryRequestOptions(
            result_format=ResultFormat.object_array
        )
    )

    poll = await resource_graph_client.resources(query)

    await resource_graph_client.close()

    return poll.data
