from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.encoders import jsonable_encoder

from pydantic import BaseModel, EmailStr, constr
from typing import Optional, List, Any

import azure.cosmos.exceptions as exceptions

from app.dependencies import check_token_expired, get_admin

import re
import jsonpatch
from uuid import UUID

from app.routers.common.helper import (
    get_username_from_jwt,
    get_user_id_from_jwt,
    cosmos_query,
    cosmos_upsert
)

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(check_token_expired)]
)

class User(BaseModel):
    """DOCSTRING"""

    id: UUID
    apiRefresh: int
    isAdmin: bool

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

class JSONPatch(BaseModel):
    """DOCSTRING"""

    op: str
    path: str
    value: Any

class UserUpdate(List[JSONPatch]):
    """DOCSTRING"""

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
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of IPAM Users.
    """

    user_list = []

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    users = await cosmos_query("users")
    admins = await cosmos_query("admins")

    for user in users['users']:
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
async def get_user(
    authorization: str = Header(None)
):
    """
    Get your IPAM user details.
    """

    user_assertion = authorization.split(' ')[1]
    userId = get_user_id_from_jwt(user_assertion)

    current_try = 0
    max_retry = 5

    while True:
        try:
            item = await cosmos_query("users")

            target_user = next((x for x in item['users'] if x['id'] == userId), None)

            if not target_user:
                target_user = {
                    "id": userId,
                    "apiRefresh": 5
                }

                item['users'].append(target_user)

                await cosmos_upsert("users", item)
        except exceptions.CosmosAccessConditionFailedError as e:
            if current_try < max_retry:
                current_try += 1
                continue
            else:
                raise HTTPException(status_code=500, detail="Error creating user, please try again.")
        else:
            break

    admins = await cosmos_query("admins")

    if admins['admins']:
      is_admin = next((x for x in admins['admins'] if x['id'] == target_user['id']), None)
    else:
      is_admin = True

    target_user['isAdmin'] = True if is_admin else False

    return target_user

@router.patch(
    "/me",
    summary = "Update User Details",
    response_model = User,
    status_code=200
)
async def update_user(
    updates: UserUpdate,
    authorization: str = Header(None)
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

    current_try = 0
    max_retry = 5

    user_assertion = authorization.split(' ')[1]
    userId = get_user_id_from_jwt(user_assertion)

    while True:
        try:
            item = await cosmos_query("users")

            target_user = next((x for x in item['users'] if x['id'] == userId), None)

            try:
                patch = jsonpatch.JsonPatch(updates)
            except jsonpatch.InvalidJsonPatch:
                raise HTTPException(status_code=500, detail="Invalid JSON patch, please review and try again.")

            scrubbed_patch = jsonpatch.JsonPatch(await scrub_patch(patch))
            scrubbed_patch.apply(target_user, in_place = True)

            await cosmos_upsert("users", item)
        except exceptions.CosmosAccessConditionFailedError:
            if current_try < max_retry:
                current_try += 1
                continue
            else:
                raise HTTPException(status_code=500, detail="Error updating user, please try again.")
        else:
            break

    admins = await cosmos_query("admins")

    is_admin = next((x for x in admins['admins'] if x['id'] == target_user['id']), None)

    target_user['isAdmin'] = True if is_admin else False

    return target_user
