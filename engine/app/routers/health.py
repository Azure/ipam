import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.dependencies import validate_token
from app.globals import globals
from app.routers.common.helper import arg_query_helper, get_client_credentials
from app.schema.control import read_schema_doc

router = APIRouter(
    prefix="/health",
    tags=["health"]
)

# Bound each dependency probe so a hung dependency can't stall the whole report.
HEALTH_CHECK_TIMEOUT = 10

# Settings/secrets that must be present for the engine to function. A missing
# value usually means an unresolved Key Vault reference or a misconfigured
# deployment. Only NAMES are ever reported, never values.
REQUIRED_SETTINGS = (
    "COSMOS_URL",
    "DATABASE_NAME",
    "CONTAINER_NAME",
    "TENANT_ID",
    "CLIENT_ID",
    "CLIENT_SECRET",
)


async def _check_config():
    """Verify required settings resolved (no network)."""

    missing = [name for name in REQUIRED_SETTINGS if not getattr(globals, name, None)]

    # Cosmos auth needs either a managed identity or an account key.
    if not globals.MANAGED_IDENTITY_ID and not globals.COSMOS_KEY:
        missing.append("MANAGED_IDENTITY_ID|COSMOS_KEY")

    if missing:
        raise RuntimeError("Missing required settings: " + ", ".join(missing))


async def _check_cosmos():
    """Point-read the schema document: proves reachability + identity + read access."""

    await read_schema_doc()


async def _check_arm():
    """Minimal Resource Graph query: proves engine SP token + ARM reachability + RBAC."""

    creds = await get_client_credentials()

    try:
        await arg_query_helper(creds, "Resources | project id | limit 1")
    finally:
        await creds.close()


async def _run_check(check):
    """Run one dependency check, bounded by a timeout, and normalize the result."""

    try:
        await asyncio.wait_for(check(), timeout=HEALTH_CHECK_TIMEOUT)

        return {"ok": True}
    except asyncio.TimeoutError:
        return {"ok": False, "detail": f"Timed out after {HEALTH_CHECK_TIMEOUT}s."}
    except HTTPException as e:
        return {"ok": False, "detail": str(e.detail)}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


async def _evaluate_schema():
    """
    Report code-vs-data schema compatibility as its own check (distinct from
    ``cosmos`` so a version mismatch isn't misread as a connectivity failure).

    Mode-aware: "convergence pending" (data behind this build) is a real problem
    in production but is EXPECTED on a staging slot, which never converges until
    after the swap. Always carries the version numbers in ``detail``.
    """

    try:
        doc = await asyncio.wait_for(read_schema_doc(), timeout=HEALTH_CHECK_TIMEOUT)
    except Exception as e:
        return {"ok": False, "detail": f"Unable to read schema version (Cosmos error): {e}"}

    current = doc["current"] if doc else 0
    min_readable = doc["minReadable"] if doc else 0
    code = globals.SCHEMA_VERSION

    versions = f"code v{code}, current v{current}, minReadable v{min_readable}"

    if code < min_readable:
        return {"ok": False, "detail": f"Incompatible — this build is older than the data ({versions})."}

    if current < code:
        if globals.IS_PRODUCTION_SLOT:
            return {"ok": False, "detail": f"Convergence pending — data is behind this build ({versions})."}

        return {"ok": True, "detail": f"Convergence pending, expected pre-swap in staging ({versions})."}

    return {"ok": True, "detail": versions}


@router.get(
    "",
    summary="Azure IPAM Dependency Health Check",
    dependencies=[Depends(validate_token)],
    status_code=200
)
async def get_health():
    """
    Live checklist of the engine's dependencies and internal state (config,
    Cosmos, ARM, schema compatibility).

    Always returns HTTP 200 when the request itself is authenticated and served;
    the ``ok`` flag and per-check results convey whether anything is wrong.
    Requires a valid token but not admin, and is intentionally Cosmos-independent
    to run (so it can still report a Cosmos outage).
    """

    dep_names = ("config", "cosmos", "arm")
    dep_checks = (_check_config, _check_cosmos, _check_arm)

    dep_results = await asyncio.gather(*(_run_check(check) for check in dep_checks))

    report = dict(zip(dep_names, dep_results))
    report["schema"] = await _evaluate_schema()

    overall = all(result["ok"] for result in report.values())

    return JSONResponse({"ok": overall, "checks": report}, status_code=200)
