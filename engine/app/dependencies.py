from fastapi import Request, HTTPException

from azure.cosmos.aio import CosmosClient

import jwt
import time

from app.routers.common.helper import (
    cosmos_query
)

async def check_token_expired(request: Request):
    now = int(time.time()) + 10
    auth = request.headers.get('authorization')

    if not auth:
        raise HTTPException(status_code=401, detail="Authorization header missing.")

    user_assertion=auth.split(' ')[1]

    try:
        decoded = jwt.decode(user_assertion, options={"verify_signature": False})
    except:
        raise HTTPException(status_code=401, detail="Authorization token missing or invalid in header.")

    if(now >= int(decoded['exp'])):
        raise HTTPException(status_code=401, detail="Token has expired.")

    await check_admin(request, decoded['oid'])

async def check_admin(request: Request, user_oid: str):
    item = await cosmos_query("admins")

    if item['admins']:
        is_admin = next((x for x in item['admins'] if user_oid == x['id']), None)
    else:
        is_admin = True

    request.state.admin = True if is_admin else False

async def get_admin(request: Request):
    return request.state.admin
