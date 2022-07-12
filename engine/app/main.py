from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi_restful.tasks import repeat_every

from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
from azure.cosmos.exceptions import CosmosResourceExistsError

from app.routers import azure, admin, user, space

import os
import logging
from pathlib import Path

import app.globals as globals

BUILD_DIR = os.path.join(os.getcwd(), "app", "build")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
console = logging.StreamHandler()
logger.addHandler(console)

description = """
Azure IPAM is a lightweight solution developed on top of the Azure platform designed to help Azure customers manage their enterprise IP Address space easily and effectively.
"""

app = FastAPI(
    title = "Azure IPAM",
    description = description,
    version = "0.1.0",
    contact = {
        "name": "Azure IPAM Team",
        "url": "https://github.com/azure/ipam",
        "email": "ipam@microsoft.com",
    },
    openapi_url = "/api/openapi.json",
    docs_url = "/api/docs",
    redoc_url = "/api/docs"
)

app.include_router(
    azure.router,
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

        print('look for: ', full_path, target_file)
        if os.path.exists(target_file):
            return FileResponse(target_file)

        return FileResponse(BUILD_DIR + "/index.html")

@app.on_event("startup")
async def set_globals():
    globals.CLIENT_ID = os.environ.get('CLIENT_ID')
    globals.CLIENT_SECRET = os.environ.get('CLIENT_SECRET')
    globals.TENANT_ID = os.environ.get('TENANT_ID')
    globals.COSMOS_URL = os.environ.get('COSMOS_URL')
    globals.COSMOS_KEY = os.environ.get('COSMOS_KEY')
    globals.KEYVAULT_URL = os.environ.get('KEYVAULT_URL')

    client = CosmosClient(globals.COSMOS_URL, credential=globals.COSMOS_KEY)

    database_name = 'ipam-db'

    try:
        logger.info('Creating Database...')
        database = await client.create_database(
            id = database_name
        )
    except CosmosResourceExistsError:
        logger.warning('Database exists! Using existing database...')
        database = client.get_database_client(database_name)

    container_name = 'ipam-container'

    try:
        logger.info('Creating Container...')
        container = await database.create_container(
            id = container_name,
            partition_key = PartitionKey(path = "/id")
        )

        logger.info('Creating Spaces Item...')
        await container.upsert_item(
            {
                'id': 'spaces',
                'spaces': []
            }
        )

        logger.info('Creating Admins Item...')
        await container.upsert_item(
            {
                'id': 'admins',
                'admins': []
            }
        )

        logger.info('Creating Users Item...')
        await container.upsert_item(
            {
                'id': 'users',
                'users': []
            }
        )
    except CosmosResourceExistsError:
        logger.warning('Container exists! Using existing container...')
        container = database.get_container_client(container_name)

    await client.close()

# https://github.com/yuval9313/FastApi-RESTful/issues/138
@app.on_event("startup")
@repeat_every(seconds = 60, wait_first = True) # , wait_first=True
async def find_reservations() -> None:
    await azure.match_resv_to_vnets()

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)
