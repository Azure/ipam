import json
import os
import shutil
import tempfile
import traceback
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

import requests
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from azure.cosmos import PartitionKey
from azure.cosmos.aio import CosmosClient
from azure.cosmos.exceptions import CosmosHttpResponseError
from azure.identity.aio import ManagedIdentityCredential
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.globals import globals
from app.logs.logs import ipam_logger as logger
from app.schema import check_compatibility, run_convergence
from app.routers import admin, azure, health, internal, service, space, status, tool, user

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(os.getcwd(), "dist")

try:
    UI_APP_ID = uuid.UUID(os.environ.get('UI_APP_ID'))
    VALID_APP_ID = UI_APP_ID != uuid.UUID(int=0)
except Exception:
    UI_APP_ID = None
    VALID_APP_ID = False

description = """
Azure IPAM is a lightweight solution developed on top of the Azure platform designed to help Azure customers manage their enterprise IP Address space easily and effectively.
"""

# Operational modes set during startup and enforced by the service-mode gate.
SERVICE_MODE_PRODUCTION = "production"
SERVICE_MODE_STAGING = "staging"
SERVICE_MODE_INCOMPATIBLE = "incompatible"

# API paths that remain reachable even when the engine is not in production mode
# (so a deploy pipeline can verify health/version on the staging slot).
ALLOWED_API_PATHS = {"/api/status", "/api/health"}

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
        await database.create_container_if_not_exists(
            id = container_name,
            partition_key = PartitionKey(path = "/tenant_id")
        )
    except CosmosHttpResponseError as e:
        logger.error('Cosmos container does not exist, error initializing Azure IPAM!')
        raise e

    await cosmos_client.close()
    await managed_identity_credential.close()

    hb_message = {
        "tenantId": globals.TENANT_ID,
        "version": globals.IPAM_VERSION,
        "type": globals.DEPLOYMENT_STACK,
        "env": globals.AZURE_ENV
    }

    # Only the production slot phones home; a staging slot stays inert.
    if globals.IS_PRODUCTION_SLOT:
        try:
            requests.post(url = "https://metrics.azureipam.com/api/heartbeat", json = hb_message, timeout = 15)
        except Exception:
            pass

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
    # IPAM Startup Tasks (also acts as a Cosmos / managed-identity connectivity probe).
    await ipam_init()

    # Compatibility gate (runs in every slot): refuse to serve if this build is
    # older than the database's minimum readable schema.
    compat = await check_compatibility()
    app.state.compat = compat

    scheduler = None

    if not compat.compatible:
        app.state.service_mode = SERVICE_MODE_INCOMPATIBLE
        logger.error("Engine starting in INCOMPATIBLE mode; API disabled. %s", compat.detail)
    elif not globals.IS_PRODUCTION_SLOT:
        app.state.service_mode = SERVICE_MODE_STAGING
        logger.warning(
            "Engine starting in the '%s' slot; API disabled until swap to production.",
            globals.SLOT_NAME,
        )
    else:
        app.state.service_mode = SERVICE_MODE_PRODUCTION

        # Production slot only: bring the data up to this build's schema, then
        # start background work. Staging never mutates the shared database.
        await run_convergence()

        scheduler = AsyncIOScheduler()
        scheduler.add_job(func=find_reservations, trigger='interval', minutes=1)
        scheduler.start()

    yield

    # IPAM Shutdown Tasks
    if scheduler:
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
    service.router,
    prefix = "/api",
    include_in_schema = service.STANDARD_DEPLOYMENT
)

app.include_router(
    health.router,
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

@app.middleware("http")
async def service_mode_gate(request: Request, call_next):
    """
    When the engine is not in production mode (running in a staging slot, or
    incompatible with the database schema), short-circuit all /api requests
    except the status endpoint. Static UI paths are unaffected.
    """

    mode = getattr(request.app.state, "service_mode", SERVICE_MODE_PRODUCTION)

    if mode != SERVICE_MODE_PRODUCTION:
        path = request.url.path

        if path.startswith("/api") and path not in ALLOWED_API_PATHS:
            if mode == SERVICE_MODE_INCOMPATIBLE:
                compat = getattr(request.app.state, "compat", None)

                return JSONResponse(
                    {
                        "error": "Azure IPAM is running code incompatible with the current database schema.",
                        "detail": compat.detail if compat else None,
                    },
                    status_code=503,
                )

            return JSONResponse(
                {"error": "Azure IPAM is currently in staging mode."},
                status_code=503,
            )

    return await call_next(request)

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
    def read_root(request: Request):
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
