from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
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

        logger.info('Spaces database conversion complete!')
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

        logger.info('Users database conversion complete!')
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

        logger.info('Admins database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing admins to convert...')
        pass

    users_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND NOT IS_DEFINED(c['data']['darkMode']))", globals.TENANT_ID)

    if users_query:
        for user in users_query:
            user_data = copy.deepcopy(user)
            user_data['data']['darkMode'] = False

            await cosmos_replace(user, user_data)

        logger.info('User object patching complete!')
    else:
        logger.info("No existing user objects to patch...")

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
