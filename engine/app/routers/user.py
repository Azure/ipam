from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.encoders import jsonable_encoder

from pydantic import BaseModel, EmailStr, constr
from typing import Optional, List, Any

import azure.cosmos.exceptions as exceptions

from app.dependencies import (
  check_token_expired,
  get_admin,
  get_tenant_id
)

import re
import jsonpatch
import uuid
import copy

from app.models import *

from app.routers.common.helper import (
    get_username_from_jwt,
    get_user_id_from_jwt,
    cosmos_query,
    cosmos_upsert,
    cosmos_replace,
    cosmos_delete,
    cosmos_retry
)

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(check_token_expired)]
)

async def new_user(user_id, tenant_id):
    new_user = {
      "id": uuid.uuid4(),
      "type": "user",
      "tenant_id": tenant_id,
      "data": {
        "id": user_id,
        "apiRefresh": 5
      }
    }

    query_results = await cosmos_upsert(jsonable_encoder(new_user))

    return query_results

async def scrub_patch(patch):
    scrubbed_patch = []

    allowed_ops = [
        {
            "op": "replace",
            "path": "/apiRefresh",
            "valid": "(?:(?:^|, )(5|10|15|30))+$",
            "error": "apiRefresh must have a value in [5|10|15|30]."
        }
    ]

    for item in list(patch):
        target = next((x for x in allowed_ops if (x['op'] == item['op'] and x['path'] == item['path'])), None)

        if target:
            if re.match(target['valid'], str(item['value'])):
                scrubbed_patch.append(item)
            else:
                raise HTTPException(status_code=400, detail=target['error'])

    return scrubbed_patch

@router.get(
    "",
    summary = "Get All Users",
    response_model = List[User],
    status_code = 200
)
async def get_users(
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of IPAM Users.
    """

    user_list = []

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    users = await cosmos_query("SELECT VALUE c.data FROM c WHERE c.type = 'user'", tenant_id)
    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    admins = admin_query[0]

    for user in users:
        is_admin = next((x for x in admins['admins'] if x['id'] == user['id']), None)

        current_user = {
            **user,
            "isAdmin": True if is_admin else False
        }

        user_list.append(current_user)

    return user_list

@router.get(
    "/me",
    summary = "Get My User Details",
    response_model = User,
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating user, please try again."
)
async def get_user(
    authorization: str = Header(None),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get your IPAM user details.
    """

    user_assertion = authorization.split(' ')[1]
    user_id = get_user_id_from_jwt(user_assertion)

    user_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND c['data']['id'] = '{}')".format(user_id), tenant_id)

    if not user_query:
        user_query = [await new_user(user_id, tenant_id)]

    user_data = copy.deepcopy(user_query[0])

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    admins = admin_query[0]

    if admins['admins']:
        is_admin = next((x for x in admins['admins'] if x['id'] == user_id), None)
    else:
        is_admin = True

    user_data['data']['isAdmin'] = True if is_admin else False

    return user_data['data']

@router.patch(
    "/me",
    summary = "Update User Details",
    response_model = User,
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating user, please try again."
)
async def update_user(
    updates: UserUpdate,
    authorization: str = Header(None),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update a User with a JSON patch:

    - **[&lt;JSON Patch&gt;]**: Array of JSON Patches

    &nbsp;

    Allowed operations:
    - **replace**

    Allowed paths:
    - **/apiRefresh**
    """

    user_assertion = authorization.split(' ')[1]
    user_id = get_user_id_from_jwt(user_assertion)

    user_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND c['data']['id'] = '{}')".format(user_id), tenant_id)

    if not user_query:
        user_query = [await new_user(user_id, tenant_id)]

    user_data = copy.deepcopy(user_query[0])

    try:
        patch = jsonpatch.JsonPatch(updates)
    except jsonpatch.InvalidJsonPatch:
        raise HTTPException(status_code=500, detail="Invalid JSON patch, please review and try again.")

    scrubbed_patch = jsonpatch.JsonPatch(await scrub_patch(patch))
    user_data['data'] = scrubbed_patch.apply(user_data['data'], in_place = True)

    await cosmos_replace(user_query[0], user_data)

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    admins = admin_query[0]

    is_admin = next((x for x in admins['admins'] if x['id'] == user_id), None)

    user_data['data']['isAdmin'] = True if is_admin else False

    return user_data['data']
