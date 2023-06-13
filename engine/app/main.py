from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi_restful.tasks import repeat_every
from fastapi.encoders import jsonable_encoder

from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
from azure.cosmos.exceptions import CosmosResourceExistsError, CosmosResourceNotFoundError

from app.routers import (
    azure,
    internal,
    admin,
    user,
    space,
    tool
)

from app.logs.logs import ipam_logger as logger

import os
import re
import uuid
import copy
from pathlib import Path
from urllib.parse import urlparse

from app.globals import globals

from app.routers.common.helper import (
    cosmos_query,
    cosmos_upsert,
    cosmos_replace
)

BUILD_DIR = os.path.join(os.getcwd(), "app", "build")

description = """
Azure IPAM is a lightweight solution developed on top of the Azure platform designed to help Azure customers manage their enterprise IP Address space easily and effectively.
"""

app = FastAPI(
    title = "Azure IPAM",
    description = description,
    version = "1.0.0",
    contact = {
        "name": "Azure IPAM Team",
        "url": "https://github.com/azure/ipam",
        "email": "ipam@microsoft.com",
    },
    openapi_url = "/api/openapi.json",
    docs_url = "/api/docs",
    redoc_url = "/api/docs"
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

if os.path.isdir(BUILD_DIR):
    app.mount(
        "/static/",
        StaticFiles(directory = Path(BUILD_DIR) / "static"),
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

        # print('look for: ', full_path, target_file)
        if os.path.exists(target_file):
            return FileResponse(target_file)

        return FileResponse(BUILD_DIR + "/index.html")

async def db_upgrade():
    cosmos_client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = "ipam-db"
    database = cosmos_client.get_database_client(database_name)

    container_name = "ipam-container"
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

    vhub_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks JOIN vnet in block.vnets WHERE (c.type = 'space' AND RegexMatch (vnet.id, '/Microsoft.Network/virtualHubs/', ''))", globals.TENANT_ID)

    if vhub_fixup_query:
        for space in vhub_fixup_query:
            space_data = copy.deepcopy(space)

            new_blocks = []

            for block in space_data['blocks']:
                vnets = [x for x in block['vnets'] if re.match(".*/Microsoft.Network/virtualNetworks/.*", x['id'])]
                vhubs = [x for x in block['vnets'] if re.match(".*/Microsoft.Network/virtualHubs/.*", x['id'])]

                new_block = {
                    "name": block['name'],
                    "cidr": block['cidr'],
                    "vnets": vnets,
                    "vhubs": vhubs,
                    "external": [],
                    "resv": block['resv']
                }

                new_blocks.append(new_block)

            space_data['blocks'] = new_blocks

            # await cosmos_replace(space, space_data)

        logger.warning('Virtual Hub patching complete!')
    else:
        logger.info("No existing Virtual Hubs to patch...")

    await cosmos_client.close()

@app.on_event("startup")
async def set_globals():
    client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = globals.DATABASE_NAME

    try:
        logger.info('Creating Database...')
        database = await client.create_database(
            id = database_name
        )
    except CosmosResourceExistsError:
        logger.warning('Database exists! Using existing database...')
        database = client.get_database_client(database_name)

    container_name = globals.CONTAINER_NAME

    try:
        logger.info('Creating Container...')
        container = await database.create_container(
            id = container_name,
            partition_key = PartitionKey(path = "/tenant_id")
        )
    except CosmosResourceExistsError:
        logger.warning('Container exists! Using existing container...')
        container = database.get_container_client(container_name)

    await client.close()

    await db_upgrade()

# https://github.com/yuval9313/FastApi-RESTful/issues/138
@app.on_event("startup")
@repeat_every(seconds = 60, wait_first = True) # , wait_first=True
async def find_reservations() -> None:
    if not os.environ.get("FUNCTIONS_WORKER_RUNTIME"):
        try:
            await azure.match_resv_to_vnets()
        except Exception as e:
            logger.error('Error running network check loop!')
            raise e

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)
