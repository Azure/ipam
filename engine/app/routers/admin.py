from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.encoders import jsonable_encoder

import azure.cosmos.exceptions as exceptions

from pydantic import BaseModel, EmailStr, constr
from typing import Optional, List

import copy
import uuid

from app.dependencies import (
  check_token_expired,
  get_admin,
  get_tenant_id
)

from app.models import *

from app.routers.common.helper import (
    cosmos_query,
    cosmos_upsert,
    cosmos_replace,
    cosmos_delete,
    cosmos_retry
)

router = APIRouter(
    prefix="/admins",
    tags=["admins"],
    dependencies=[Depends(check_token_expired)]
)

@router.get(
    "",
    summary = "Get All Admins"
)
async def get_admins(
  tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of all IPAM admins.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if admin_query:
        admin_data = copy.deepcopy(admin_query[0])

        return admin_data['admins']
    else:
        return []

@router.post(
    "",
    summary = "Create IPAM Admin",
    status_code=201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating admin, please try again."
)
async def create_admin(
    admin: Admin,
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Create an new IPAM Administrator with the following details:

    - **name**: Full name of the Administrator
    - **email**: Email address for the Administrator
    - **id**: Azure AD ObjectID for the Administrator user
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        admin_data = {
          "id": uuid.uuid4(),
          "type": "admin",
          "tenant_id": tenant_id,
          "admins": [admin],
          "excluded": []
        }

        await cosmos_upsert(jsonable_encoder(admin_data))
    else:
        admin_data = copy.deepcopy(admin_query[0])

        target_admin = next((x for x in admin_data['admins'] if x['id'] == admin.id), None)

        if target_admin:
            raise HTTPException(status_code=400, detail="User is already an admin.")

        admin_data['admins'].append(jsonable_encoder(admin))

        await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_201_CREATED)

@router.delete(
    "/{objectId}",
    summary = "Delete IPAM Admin",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error removing admin, please try again."
)
async def delete_admin(
    objectId: UUID,
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove a specific IPAM Administrator
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)
    admin_data = copy.deepcopy(admin_query[0])

    admin_index = next((i for i, admin in enumerate(admin_data['admins']) if admin['id'] == str(objectId)), None)

    if admin_index is None:
        raise HTTPException(status_code=400, detail="Invalid admin objectId.")

    del admin_data['admins'][admin_index]

    await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_200_OK)

@router.put(
    "",
    summary = "Replace IPAM Admins",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating admins, please try again."
)
async def update_admins(
    admin_list: List[Admin],
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Replace the list of IPAM Administrators with the following details:

    - Array **[]** of:
        - **name**: Full name of the Administrator
        - **email**: Email address for the Administrator
        - **id**: Azure AD ObjectID for the Administrator user
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    id_list = [x.id for x in admin_list]
    unique_admins = len(set(id_list)) == len(admin_list)

    if not unique_admins:
        raise HTTPException(status_code=400, detail="List contains one or more duplicate objectId's.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        admin_data = {
          "id": uuid.uuid4(),
          "type": "admin",
          "tenant_id": tenant_id,
          "admins": admin_list,
          "excluded": []
        }

        await cosmos_upsert(jsonable_encoder(admin_data))
    else:
        admin_data = copy.deepcopy(admin_query[0])

        admin_data['admins'] = jsonable_encoder(admin_list)
        
        await cosmos_replace(admin_query[0], admin_data)

    return PlainTextResponse(status_code=status.HTTP_200_OK)
