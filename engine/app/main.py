from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.encoders import jsonable_encoder

from azure.identity.aio import ManagedIdentityCredential

from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
from azure.cosmos.exceptions import CosmosResourceExistsError, CosmosResourceNotFoundError, CosmosHttpResponseError

from app.routers import (
    azure,
    internal,
    admin,
    user,
    space,
    tool,
    status
)

from app.logs.logs import ipam_logger as logger

import os
import re
import uuid
import copy
import json
import shutil
import tempfile
import traceback
import requests
from pathlib import Path
from urllib.parse import urlparse
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.globals import globals

from app.routers.common.helper import (
    cosmos_query,
    cosmos_upsert,
    cosmos_replace
)

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(os.getcwd(), "dist")

try:
    UI_APP_ID = uuid.UUID(os.environ.get('UI_APP_ID'))
    VALID_APP_ID = UI_APP_ID != uuid.UUID(int=0)
except:
    UI_APP_ID = None
    VALID_APP_ID = False

description = """
Azure IPAM is a lightweight solution developed on top of the Azure platform designed to help Azure customers manage their enterprise IP Address space easily and effectively.
"""

async def ipam_init():
    global BUILD_DIR

    release_data = {}

    path = '/etc/os-release' if os.path.exists('/etc/os-release') else '/usr/lib/os-release'

    release_info = open(path, 'r')
    release_values = release_info.read().splitlines()
    cleaned_values = [i for i in release_values if i]

    for value in cleaned_values:
        clean_value = value.strip()
        value_parts = clean_value.split('=')
        release_data[value_parts[0]] = value_parts[1].replace('"', '')

    os.environ['VITE_CONTAINER_IMAGE_ID'] = release_data['ID']
    os.environ['VITE_CONTAINER_IMAGE_VERSION'] = release_data['VERSION_ID']
    os.environ['VITE_CONTAINER_IMAGE_CODENAME'] = release_data['VERSION'].split(" ")[1][1:-1].lower() if "VERSION" in release_data else "N/A"
    os.environ['VITE_CONTAINER_IMAGE_PRETTY_NAME'] = release_data['PRETTY_NAME']

    if os.path.exists(BUILD_DIR):
        if(os.environ.get('FUNCTIONS_WORKER_RUNTIME') or (not os.access(BUILD_DIR, os.W_OK))):
            new_build_dir = os.path.join(tempfile.gettempdir(), "dist")

            shutil.copytree(BUILD_DIR, new_build_dir)

            BUILD_DIR = new_build_dir

        env_data = {
            'VITE_AZURE_ENV': os.environ.get('AZURE_ENV'),
            'VITE_UI_ID': os.environ.get('UI_APP_ID'),
            'VITE_ENGINE_ID': os.environ.get('ENGINE_APP_ID'),
            'VITE_TENANT_ID': os.environ.get('TENANT_ID'),
            'VITE_OS_NAME': release_data['PRETTY_NAME']
        }

        env_data_js = "window.env = " + json.dumps(env_data, indent=4) + "\n"

        env_file = os.path.join(BUILD_DIR, "env.js")

        with open(env_file, "w") as env_file:
            env_file.write(env_data_js)

    managed_identity_credential = ManagedIdentityCredential(
        client_id = globals.MANAGED_IDENTITY_ID
    )

    cosmos_client = CosmosClient(
        globals.COSMOS_URL,
        credential=globals.COSMOS_KEY if globals.COSMOS_KEY else managed_identity_credential,
        transport=globals.SHARED_TRANSPORT
    )

    database_name = globals.DATABASE_NAME

    try:
        logger.info('Verifying Database Exists...')
        database = await cosmos_client.create_database_if_not_exists(
            id = database_name
        )
    except CosmosHttpResponseError as e:
        logger.error('Cosmos database does not exist, error initializing Azure IPAM!')
        raise e
        
    
    database = cosmos_client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME

    try:
        logger.info('Verifying Container Exists...')
        container = await database.create_container_if_not_exists(
            id = container_name,
            partition_key = PartitionKey(path = "/tenant_id")
        )
    except CosmosHttpResponseError as e:
        logger.error('Cosmos container does not exist, error initializing Azure IPAM!')
        raise e
    
    container = database.get_container_client(container_name)

    await cosmos_client.close()
    await managed_identity_credential.close()

    hb_message = {
        "tenantId": globals.TENANT_ID,
        "version": globals.IPAM_VERSION,
        "type": globals.DEPLOYMENT_STACK,
        "env": globals.AZURE_ENV
    }

    try:
        requests.post(url = "https://azureipammetrics.azurewebsites.net/api/heartbeat", json = hb_message)
    except Exception:
        pass

async def upgrade_db():
    managed_identity_credential = ManagedIdentityCredential(
        client_id = globals.MANAGED_IDENTITY_ID
    )

    cosmos_client = CosmosClient(
        globals.COSMOS_URL,
        credential=globals.COSMOS_KEY if globals.COSMOS_KEY else managed_identity_credential,
        transport=globals.SHARED_TRANSPORT
    )

    database_name = globals.DATABASE_NAME
    database = cosmos_client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME
    container = database.get_container_client(container_name)

    try:
        spaces_query = await container.read_item("spaces", partition_key="spaces")

        for space in spaces_query['spaces']:
            if 'vnets' in space:
                del space['vnets']

            new_space = {
                "id": uuid.uuid4(),
                "type": "space",
                "tenant_id": globals.TENANT_ID,
                **space
            }

            await cosmos_upsert(jsonable_encoder(new_space))

        await container.delete_item("spaces", partition_key = "spaces")

        logger.warning('Spaces database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing spaces to convert...')
        pass

    try:
        users_query = await container.read_item("users", partition_key="users")

        for user in users_query['users']:
            new_user = {
                "id": uuid.uuid4(),
                "type": "user",
                "tenant_id": globals.TENANT_ID,
                "data": user
            }

            await cosmos_upsert(jsonable_encoder(new_user))

        await container.delete_item("users", partition_key = "users")

        logger.warning('Users database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing users to convert...')
        pass

    try:
        admins_query = await container.read_item("admins", partition_key="admins")

        admin_data = {
            "id": uuid.uuid4(),
            "type": "admin",
            "tenant_id": globals.TENANT_ID,
            "admins": admins_query['admins'],
            "exclusions": []
        }

        await cosmos_upsert(jsonable_encoder(admin_data))

        await container.delete_item("admins", partition_key = "admins")

        logger.warning('Admins database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing admins to convert...')
        pass

    user_fixup_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND (NOT IS_DEFINED(c['data']['darkMode']) OR NOT IS_DEFINED(c['data']['views'])))", globals.TENANT_ID)

    if user_fixup_query:
        for user in user_fixup_query:
            user_data = copy.deepcopy(user)

            if 'darkMode' not in user_data['data']:
                user_data['data']['darkMode'] = False

            if 'views' not in user_data['data']:
                user_data['data']['views'] = {}

            await cosmos_replace(user, user_data)

        logger.warning('User object patching complete!')
    else:
        logger.info("No existing user objects to patch...")

    admin_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN admin IN c.admins WHERE (c.type = 'admin' AND NOT IS_DEFINED(admin.type))", globals.TENANT_ID)

    if admin_fixup_query:
        admin_data = copy.deepcopy(admin_fixup_query[0])

        for i, admin in enumerate(admin_data['admins']):
            if 'type' not in admin:
                admin_data['admins'][i] = {
                    "type": "User",
                    "name": admin['name'],
                    "email": admin['email'],
                    "id": admin['id']
                }

        await cosmos_replace(admin_fixup_query[0], admin_data)

        logger.warning('Admin object patching complete!')
    else:
        logger.info("No existing admin objects to patch...")

    resv_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks JOIN resv in block.resv WHERE (c.type = 'space' AND NOT IS_DEFINED(resv.settledOn))", globals.TENANT_ID)

    if resv_fixup_query:
        for space in resv_fixup_query:
            space_data = copy.deepcopy(space)

            for block in space_data['blocks']:
                for i, resv in enumerate(block['resv']):
                    if 'settledOn' not in resv:
                        block['resv'][i] = {
                            "id": resv['id'],
                            "cidr": resv['cidr'],
                            "desc": resv['desc'] if 'desc' in resv else None,
                            "createdOn": resv['createdOn'],
                            "createdBy": resv['userId'],
                            "settledOn": None,
                            "settledBy": None,
                            "status": resv['status']
                        }

            await cosmos_replace(space, space_data)

        logger.warning('Reservation patching complete!')
    else:
        logger.info("No existing reservations to patch...")

    external_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks WHERE (c.type = 'space' AND NOT IS_DEFINED(block.externals))", globals.TENANT_ID)

    if external_fixup_query:
        for space in external_fixup_query:
            space_data = copy.deepcopy(space)

            new_blocks = []

            for block in space_data['blocks']:
                new_block = {
                    "name": block['name'],
                    "cidr": block['cidr'],
                    "vnets": block['vnets'],
                    "externals": [],
                    "resv": block['resv']
                }

                new_blocks.append(new_block)

            space_data['blocks'] = new_blocks

            await cosmos_replace(space, space_data)

        logger.warning('External networks patching complete!')
    else:
        logger.info("No existing external networks to patch...")

    subnet_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks JOIN ext in block.externals WHERE (c.type = 'space' AND NOT IS_DEFINED(ext.subnets))", globals.TENANT_ID)

    if subnet_fixup_query:
        for space in subnet_fixup_query:
            space_data = copy.deepcopy(space)

            for block in space_data['blocks']:
                new_externals = []

                for external in block['externals']:

                    new_external = {
                        "name": external['name'],
                        "desc": external['desc'],
                        "cidr": external['cidr'],
                        "subnets": []
                    }

                    new_externals.append(new_external)

                block['externals'] = new_externals

            await cosmos_replace(space, space_data)

        logger.warning('External subnet patching complete!')
    else:
        logger.info("No existing external subnets to patch...")

    # vhub_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks JOIN vnet in block.vnets WHERE (c.type = 'space' AND RegexMatch (vnet.id, '/Microsoft.Network/virtualHubs/', ''))", globals.TENANT_ID)

    # if vhub_fixup_query:
    #     for space in vhub_fixup_query:
    #         space_data = copy.deepcopy(space)

    #         new_blocks = []

    #         for block in space_data['blocks']:
    #             vnets = [x for x in block['vnets'] if re.match(".*/Microsoft.Network/virtualNetworks/.*", x['id'])]
    #             vhubs = [x for x in block['vnets'] if re.match(".*/Microsoft.Network/virtualHubs/.*", x['id'])]

    #             new_block = {
    #                 "name": block['name'],
    #                 "cidr": block['cidr'],
    #                 "vnets": vnets,
    #                 "vhubs": vhubs,
    #                 "external": block['external'],
    #                 "resv": block['resv']
    #             }

    #             new_blocks.append(new_block)

    #         space_data['blocks'] = new_blocks

    #         await cosmos_replace(space, space_data)

    #     logger.warning('Virtual Hub patching complete!')
    # else:
    #     logger.info("No existing Virtual Hubs to patch...")

    await cosmos_client.close()
    await managed_identity_credential.close()

async def find_reservations():
    if not os.environ.get("FUNCTIONS_WORKER_RUNTIME"):
        try:
            await azure.match_resv_to_vnets()
        except Exception as e:
            logger.error('Error running network check loop!')
            tb = traceback.format_exc()
            logger.debug(tb)
            raise e

@asynccontextmanager
async def lifespan(app: FastAPI):
    # IPAM Startup Tasks
    await ipam_init()
    await upgrade_db()

    # Schedule Recurring Tasks
    scheduler = AsyncIOScheduler()
    scheduler.add_job(func=find_reservations, trigger='interval', minutes=1)
    scheduler.start()

    yield

    # IPAM Shutdown Tasks
    scheduler.shutdown()

app = FastAPI(
    title = "Azure IPAM",
    description = description,
    version = globals.IPAM_VERSION,
    contact = {
        "name": "Azure IPAM Team",
        "url": "https://github.com/azure/ipam",
        "email": "ipam@microsoft.com",
    },
    openapi_url = "/api/openapi.json",
    docs_url = "/api/docs",
    redoc_url = "/api/redoc",
    lifespan = lifespan
)

app.logger = logger

app.include_router(
    azure.router,
    prefix = "/api",
    include_in_schema = False
)

app.include_router(
    internal.router,
    prefix = "/api",
    include_in_schema = False
)

app.include_router(
    admin.router,
    prefix = "/api"
)

app.include_router(
    user.router,
    prefix = "/api"
)

app.include_router(
    tool.router,
    prefix = "/api"
)

app.include_router(
    space.router,
    prefix = "/api"
)

app.include_router(
    status.router,
    prefix = "/api"
)

@app.get(
    "/api/{full_path:path}",
    include_in_schema = False
)
async def serve_react_app(request: Request):
    """
    Catch-All Path for /api Route
    """

    raise HTTPException(status_code=404, detail="Invalid API path.")

origins = [
    "http://localhost:3000"
]

if os.environ.get('WEBSITE_HOSTNAME'):
    origins.append("https://" + os.environ.get('WEBSITE_HOSTNAME'))

if os.environ.get('IPAM_UI_URL'):
    ui_url = urlparse(os.environ.get('IPAM_UI_URL'))

    if (ui_url.scheme and ui_url.netloc):
        origins.append(ui_url.scheme + "://" + ui_url.netloc)

app.add_middleware(
    CORSMiddleware,
    allow_origins = origins,
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

app.add_middleware(
    GZipMiddleware,
    minimum_size = 500
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)

if os.path.isdir(BUILD_DIR) and UI_APP_ID and VALID_APP_ID:
    app.mount(
        "/assets/",
        StaticFiles(directory = Path(BUILD_DIR) / "assets"),
        name = "static"
    )

    @app.get(
        "/",
        response_class = FileResponse,
        include_in_schema = False
    )
    def read_index(request: Request):
        return FileResponse(BUILD_DIR + "/index.html")

    @app.get(
        "/{full_path:path}",
        response_class = FileResponse,
        include_in_schema = False
    )
    def read_index(request: Request, full_path: str):
        target_file = BUILD_DIR + "/" + full_path

        print('look for: ', full_path, target_file)
        if os.path.exists(target_file):
            return FileResponse(target_file)

        return FileResponse(BUILD_DIR + "/index.html")
