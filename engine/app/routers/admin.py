from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.encoders import jsonable_encoder

from pydantic import BaseModel, EmailStr, constr
from typing import Optional, List

import azure.cosmos.exceptions as exceptions

from app.dependencies import check_token_expired, get_admin

from uuid import UUID

from app.routers.common.helper import (
    cosmos_query,
    cosmos_upsert
)

router = APIRouter(
    prefix="/admins",
    tags=["admins"],
    dependencies=[Depends(check_token_expired)]
)

class Admin(BaseModel):
    name: str
    email: EmailStr
    id: UUID

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

@router.get(
    ""
)
async def get_admins(
    is_admin: str = Depends(get_admin)
):
    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    item = await cosmos_query("admins")

    return item['admins']

@router.post(
    "",
    status_code=201
)
async def create_admin(
    admin: Admin,
    is_admin: str = Depends(get_admin)
):
    """DOCSTRING"""

    current_try = 0
    max_retry = 5

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    while True:
        try:
            item = await cosmos_query("admins")

            target_admin = next((x for x in item['admins'] if x['id'] == admin.id), None)

            if target_admin:
                raise HTTPException(status_code=400, detail="User is already an admin.")

            item['admins'].append(jsonable_encoder(admin))

            await cosmos_upsert("admins", item)
        except exceptions.CosmosAccessConditionFailedError:
            if current_try < max_retry:
                current_try += 1
                continue
            else:
                raise HTTPException(status_code=500, detail="Error creating admin, please try again.")
        else:
            break

    return Response(status_code=status.HTTP_201_CREATED)

@router.delete(
    "/{objectId}",
    status_code=200
)
async def delete_admin(
    objectId: UUID,
    is_admin: str = Depends(get_admin)
):
    """DOCSTRING"""

    current_try = 0
    max_retry = 5

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    while True:
        try:
            item = await cosmos_query("admins")

            admin_index = next((i for i, admin in enumerate(item['admins']) if admin['id'] == str(objectId)), None)

            if not admin_index:
                raise HTTPException(status_code=400, detail="Invalid admin objectId.")

            del item['admins'][admin_index]

            await cosmos_upsert("admins", item)
        except exceptions.CosmosAccessConditionFailedError:
            if current_try < max_retry:
                current_try += 1
                continue
            else:
                raise HTTPException(status_code=500, detail="Error removing admin, please try again.")
        else:
            break

    return Response(status_code=status.HTTP_200_OK)

@router.put(
    "",
    status_code=200
)
async def update_admins(
    admin_list: List[Admin],
    is_admin: str = Depends(get_admin)
):
    """DOCSTRING"""

    current_try = 0
    max_retry = 5

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    while True:
        try:
            item = await cosmos_query("admins")

            id_list = [x.id for x in admin_list]
            unique_admins = len(set(id_list)) == len(admin_list)

            if not unique_admins:
                raise HTTPException(status_code=400, detail="List contains one or more duplicate objectId's.")

            item['admins'] = jsonable_encoder(admin_list)
            await cosmos_upsert("admins", item)
        except exceptions.CosmosAccessConditionFailedError:
            if current_try < max_retry:
                current_try += 1
                continue
            else:
                raise HTTPException(status_code=500, detail="Error updating admins, please try again.")
        else:
            break

    return PlainTextResponse(status_code=status.HTTP_200_OK)
