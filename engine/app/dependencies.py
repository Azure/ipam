import asyncio
import copy
import json
import random
import time

import aiohttp
import jwt
from cryptography.hazmat.primitives import serialization
from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.globals import globals
from app.logs.logs import ipam_logger as logger
from app.models import Error
from app.routers.common.helper import cosmos_query

# The OpenAPI spec requires that an `Authorization` header declared as a normal
# parameter be ignored, so the token has to be advertised as a security scheme for
# the Swagger UI "Authorize" button to attach it. `auto_error=False` keeps this
# declarative only: it never raises, so `validate_token` stays the sole gate.
ipam_security = HTTPBearer(
    scheme_name = "IPAM Token",
    description = "Azure IPAM access token. Retrieve one from the Azure IPAM UI by selecting <b>Token</b> in the user avatar menu, or see the <a href='https://azure.github.io/ipam/#/api/README?id=obtaining-an-azure-ad-token' target='_blank'>API documentation</a>. Paste the raw token value below, the 'Bearer' prefix is added for you.",
    auto_error = False
)

async def get_authorization(request: Request):
    """Return the raw Authorization header, without declaring an OpenAPI parameter."""

    return request.headers.get("Authorization")

# Documents the failure mode of the scheme above. Attached to every router that
# enforces authentication, so Swagger stops reporting these as "Undocumented".
# The shape is {"error": ...} because the global exception handler in main.py
# overrides FastAPI's default {"detail": ...} body.
UNAUTHORIZED = {
    401: {
        "model": Error,
        "description": "Access token is missing, malformed, expired, or otherwise invalid."
    }
}


_session = None

_JWKS_MAX_ATTEMPTS = 5
_JWKS_RETRY_STATUSES = (500, 502, 503, 504)

_JWKS_REFRESH_INTERVAL = 3600   # soft deadline; keys are re-fetched past this
_JWKS_REFRESH_JITTER = 300      # spreads refreshes so instances started together don't sync up
_JWKS_MAX_STALE = 86400         # hard deadline; cached keys are unusable past this
_JWKS_MIN_FETCH_INTERVAL = 300  # floor between fetch attempts, incl. unknown-kid refreshes

_jwks_keys = {}
_jwks_refresh_after = 0.0
_jwks_expires_after = 0.0
_jwks_attempted_at = None
_jwks_lock = asyncio.Lock()

async def _fetch_jwks_keys():
    global _session

    # aiohttp verifies against the OS trust store, so sovereign cloud roots injected
    # by WEBSITES_INCLUDE_CLOUD_CERTS are honored. `requests` uses the bundled certifi
    # roots instead and cannot validate those endpoints.
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))

    key_url = "https://" + globals.AUTHORITY_HOST + "/" + globals.TENANT_ID + "/discovery/v2.0/keys"

    for attempt in range(_JWKS_MAX_ATTEMPTS):
        final_attempt = attempt == _JWKS_MAX_ATTEMPTS - 1

        async with _session.get(key_url) as resp:
            if final_attempt or resp.status not in _JWKS_RETRY_STATUSES:
                resp.raise_for_status()

                # Sovereign clouds may label the response 'application/jwk-set+json'
                return await resp.json(content_type=None)

        await asyncio.sleep(0.1 * (2 ** attempt))

def _jwk_to_pem(key):
    rsa_key = {
        "kty": key["kty"],
        "kid": key["kid"],
        "use": key.get("use", "sig"),
        "n": key["n"],
        "e": key["e"]
    }

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(rsa_key))

    return public_key.public_bytes(
        encoding = serialization.Encoding.PEM,
        format = serialization.PublicFormat.SubjectPublicKeyInfo
    )

async def _refresh_jwks_cache():
    """Fetch and rebuild the signing key cache. Caller must hold _jwks_lock."""

    global _jwks_keys, _jwks_refresh_after, _jwks_expires_after, _jwks_attempted_at

    # Recorded before the fetch so a failing endpoint still throttles the next attempt
    _jwks_attempted_at = time.monotonic()

    jwks = await _fetch_jwks_keys()

    keys = {}

    for key in jwks.get("keys", []):
        if key.get("kty") != "RSA":
            continue

        try:
            keys[key["kid"]] = _jwk_to_pem(key)
        except Exception as e:
            logger.warning("Skipping unusable signing key {}: {}".format(key.get("kid"), e))

    if not keys:
        raise ValueError("JWKS response contained no usable RSA signing keys.")

    now = time.monotonic()

    # Replaced wholesale rather than mutated, so readers on the lock-free path always
    # observe a complete key set
    _jwks_keys = keys
    _jwks_refresh_after = now + _JWKS_REFRESH_INTERVAL + random.uniform(-_JWKS_REFRESH_JITTER, _JWKS_REFRESH_JITTER)
    _jwks_expires_after = now + _JWKS_MAX_STALE

async def get_signing_key(kid):
    """Return the PEM public key for `kid`, or None if the tenant doesn't publish it."""

    if kid in _jwks_keys and time.monotonic() < _jwks_refresh_after:
        return _jwks_keys[kid]

    async with _jwks_lock:
        # A concurrent request may have refreshed while this one waited for the lock
        if kid in _jwks_keys and time.monotonic() < _jwks_refresh_after:
            return _jwks_keys[kid]

        last_attempt = _jwks_attempted_at
        throttled = last_attempt is not None and (time.monotonic() - last_attempt) < _JWKS_MIN_FETCH_INTERVAL

        if not throttled:
            try:
                await _refresh_jwks_cache()
            except Exception as e:
                logger.warning("Unable to refresh signing keys: {}".format(e))

        if not _jwks_keys or time.monotonic() >= _jwks_expires_after:
            raise RuntimeError("No usable token signing keys available.")

        return _jwks_keys.get(kid)

async def get_token_auth_header(request: Request):
    auth = request.headers.get("Authorization", None)

    if not auth:
        raise HTTPException(status_code=401, detail="Authorization header is missing.")

    parts = auth.split()

    if parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authorization header must start with 'Bearer'.")
    elif len(parts) == 1:
        raise HTTPException(status_code=401, detail="Token not found.")
    elif len(parts) > 2:
        raise HTTPException(status_code=401, detail="Authorization header must be of type Bearer token.")

    token = parts[1]

    return token

async def validate_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(ipam_security)
):
    # `credentials` is unused: the header is parsed by `get_token_auth_header` below.
    # Declaring it attaches the security scheme to every operation that depends on
    # this function, so the documented auth and the enforced auth cannot drift apart.
    try:
        token = await get_token_auth_header(request)
        unverified_header = jwt.get_unverified_header(token)
        rsa_pem_key_bytes = await get_signing_key(unverified_header.get("kid"))
    except Exception as e:
        logger.error("Unable to parse authorization token.")
        logger.error(e)
        raise HTTPException(status_code=401, detail="Unable to parse authorization token.")

    try:
        token_version = int(jwt.decode(token, options={"verify_signature": False})["ver"].split(".")[0])
    except Exception:
        raise HTTPException(status_code=401, detail="Unable to decode token version.")

    if token_version == 1:
        logger.error("Microsoft Identity v1.0 access tokens are not supported!")
        logger.error("https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens#token-formats")
        raise HTTPException(status_code=401, detail="Microsoft Identity v1.0 access tokens are not supported.")

    if rsa_pem_key_bytes:
        try:
            payload = jwt.decode(
                token,
                key=rsa_pem_key_bytes,
                verify=True,
                algorithms=["RS256"],
                audience=globals.CLIENT_ID,
                issuer="https://" + globals.AUTHORITY_HOST + "/" + globals.TENANT_ID + "/v2.0"
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired.")
        except jwt.MissingRequiredClaimError:
            raise HTTPException(status_code=401, detail="Incorrect token claims, please check the audience and issuer.")
        except jwt.InvalidSignatureError:
            raise HTTPException(status_code=401, detail="Invalid token signature.")
        except Exception:
            raise HTTPException(status_code=401, detail="Unable to decode authorization token.")
    else:
        raise HTTPException(status_code=401, detail="Unable to find appropriate signing key.")

    request.state.tenant_id = payload['tid']

    return payload

async def check_admin(request: Request, user_oid: str, user_tid: str):
    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", user_tid)

    if admin_query:
        admin_data = copy.deepcopy(admin_query[0])

        if admin_data['admins']:
            is_admin = next((x for x in admin_data['admins'] if user_oid == x['id']), None)
        else:
            is_admin = True
    else:
        is_admin = True

    request.state.admin = True if is_admin else False

async def api_auth_checks(request: Request, token_payload: dict = Depends(validate_token)):
    await check_admin(request, token_payload['oid'], token_payload['tid'])

async def get_admin(request: Request):
    return request.state.admin

async def get_tenant_id(request: Request):
    return request.state.tenant_id
