import azure.functions as func
from azure.functions._http_asgi import AsgiResponse, AsgiRequest

# https://github.com/Azure-Samples/fastapi-on-azure-functions/issues/4
# https://github.com/Azure/azure-functions-python-library/pull/143
# import nest_asyncio

from app.main import app as ipam

IS_INITED = False

# https://github.com/Azure-Samples/fastapi-on-azure-functions/issues/4
# https://github.com/Azure/azure-functions-python-library/pull/143
# nest_asyncio.apply()

async def run_setup(app):
    """Workaround to run Starlette startup events on Azure Function Workers."""

    global IS_INITED

    if not IS_INITED:
        await app.router.startup()
        IS_INITED = True

async def handle_asgi_request(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    asgi_request = AsgiRequest(req, context)
    scope = asgi_request.to_asgi_http_scope()
    asgi_response = await AsgiResponse.from_app(ipam, scope, req.get_body())

    return asgi_response.to_func_response()

async def main(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    await run_setup(ipam)

    return await handle_asgi_request(req, context)

# Current issue where FastAPI startup is ignored:
# https://github.com/Azure/azure-functions-python-worker/issues/911
#
# Target function format after fix:
#
# async def main(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
#     """Each request is redirected to the ASGI handler."""
#     return await func.AsgiMiddleware(ipam).handle_async(req, context)

# Keeping an eye on this fix as well:
# https://github.com/Azure/azure-functions-python-library/pull/148
