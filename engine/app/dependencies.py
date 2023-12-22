from fastapi import Request, HTTPException

from requests import Session, adapters
from urllib3.util.retry import Retry
from cryptography.hazmat.primitives import serialization

import jwt
import copy
import json

from app.routers.common.helper import (
    cosmos_query
)

from app.globals import globals

_session = None

async def fetch_jwks_keys():
    global _session

    if _session is None:  
        _session = Session()

        retries = Retry(
            total=5,
            backoff_factor=0.1,
            status_forcelist=[ 500, 502, 503, 504 ]
        )

        _session.mount('https://', adapters.HTTPAdapter(max_retries=retries))
        _session.mount('http://', adapters.HTTPAdapter(max_retries=retries))

    key_url = "https://" + globals.AUTHORITY_HOST + "/" + globals.TENANT_ID + "/discovery/v2.0/keys"

    jwks = _session.get(key_url).json()

    return jwks

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

async def validate_token(request: Request):
    try:
        token = await get_token_auth_header(request)
        jwks = await fetch_jwks_keys()
        unverified_header = jwt.get_unverified_header(token)

        rsa_key = {}

        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
    except Exception:
        raise HTTPException(status_code=401, detail="Unable to parse authorization token.")

    if rsa_key:
        rsa_pem_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(rsa_key))
        rsa_pem_key_bytes = rsa_pem_key.public_bytes(
            encoding=serialization.Encoding.PEM, 
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

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
            raise HTTPException(status_code=401, detail="Unable to parse authorization token.")
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

async def api_auth_checks(request: Request):
    token_payload = await validate_token(request)
    await check_admin(request, token_payload['oid'], token_payload['tid'])

async def get_admin(request: Request):
    return request.state.admin

async def get_tenant_id(request: Request):
    return request.state.tenant_id
