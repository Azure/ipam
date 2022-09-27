from fastapi import Request, HTTPException

import jwt
import time
import copy

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

    request.state.tenant_id = decoded['tid']

    await check_admin(request, decoded['oid'], decoded['tid'])

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

async def get_admin(request: Request):
    return request.state.admin

async def get_tenant_id(request: Request):
    return request.state.tenant_id
