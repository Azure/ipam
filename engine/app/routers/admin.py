from fastapi.responses import PlainTextResponse
from fastapi.encoders import jsonable_encoder

from fastapi import (
    APIRouter,
    HTTPException,
    Response,
    status,
    Depends,
    Header,
    Path
)

from typing import List

import copy
import uuid

from app.dependencies import (
    api_auth_checks,
    get_admin,
    get_tenant_id
)

from app.models import *
from . import argquery

from app.routers.common.helper import (
    cosmos_query,
    cosmos_upsert,
    cosmos_replace,
    cosmos_retry,
    arg_query
)

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(api_auth_checks)]
)

async def new_admin_db(admin_list, exclusion_list, tenant_id):
    admin_data = {
        "id": uuid.uuid4(),
        "type": "admin",
        "tenant_id": tenant_id,
        "admins": admin_list,
        "exclusions": exclusion_list
    }

    query_results = await cosmos_upsert(jsonable_encoder(admin_data))

    return query_results

@router.get(
    "/admins",
    summary = "Get All Admins",
    response_model = List[Admin],
    status_code = 200
)
async def get_admins(
    authorization: str = Header(None, description="Azure Bearer token"),
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
    "/admins",
    summary = "Create IPAM Admin",
    status_code=201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating admin, please try again."
)
async def create_admin(
    admin: Admin,
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Create an new IPAM Administrator with the following details:

    - **type**: [ "User" | "Principal" ]
    - **name**: Full name of the Administrator or DisplayName of the Service Principal
    - **email**: Email address for the Administrator (not required for 'Principal' type)
    - **id**: Azure AD ObjectID for the Administrator user Service Principal
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        await new_admin_db([admin], [], tenant_id)
    else:
        admin_data = copy.deepcopy(admin_query[0])

        target_admin = next((x for x in admin_data['admins'] if uuid.UUID(x['id']) == admin.id), None)

        if target_admin:
            raise HTTPException(status_code=400, detail="User is already an admin.")

        admin_data['admins'].append(jsonable_encoder(admin))

        await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_201_CREATED)

@router.put(
    "/admins",
    summary = "Replace IPAM Admins",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating admins, please try again."
)
async def update_admins(
    admin_list: List[Admin],
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Replace the list of IPAM Administrators with the following details:

    - Array **[ ]** of:
        - **type**: [ "User" | "Principal" ]
        - **name**: Full name of the Administrator or DisplayName of the Service Principal
        - **email**: Email address for the Administrator (not required for 'Principal' type)
        - **id**: Azure AD ObjectID for the Administrator user Service Principal
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    id_list = [x.id for x in admin_list]
    unique_admins = len(set(id_list)) == len(admin_list)

    if not unique_admins:
        raise HTTPException(status_code=400, detail="List contains one or more duplicate objectId's.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        await new_admin_db(admin_list, [], tenant_id)
    else:
        admin_data = copy.deepcopy(admin_query[0])

        admin_data['admins'] = jsonable_encoder(admin_list)
        
        await cosmos_replace(admin_query[0], admin_data)

    return PlainTextResponse(status_code=status.HTTP_200_OK)

@router.get(
    "/admins/{objectId}",
    summary = "Get IPAM Admin",
    response_model = Admin,
    status_code = 200
)
async def get_admins(
    objectId: UUID = Path(..., description="Azure AD ObjectID for the target user"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a specific IPAM admin.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    try:
        admins = copy.deepcopy(admin_query[0])
    except:
        raise HTTPException(status_code=400, detail="No admins found in database.")

    target_admin = next((x for x in admins['admins'] if x['id'] == str(objectId)), None)

    if target_admin:
        return target_admin
    else:
        raise HTTPException(status_code=404, detail="Admin not found.")

@router.delete(
    "/admins/{objectId}",
    summary = "Delete IPAM Admin",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error removing admin, please try again."
)
async def delete_admin(
    objectId: UUID = Path(..., description="Azure AD ObjectID for the target user"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove a specific IPAM Administrator
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if admin_query is None:
        raise HTTPException(status_code=400, detail="Admin not found.")

    admin_data = copy.deepcopy(admin_query[0])

    admin_index = next((i for i, admin in enumerate(admin_data['admins']) if admin['id'] == str(objectId)), None)

    if admin_index is None:
        raise HTTPException(status_code=400, detail="Invalid admin objectId.")

    del admin_data['admins'][admin_index]

    await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_200_OK)

@router.get(
    "/exclusions",
    summary = "Get Excluded Subscriptions",
    response_model = List[Subscription],
    status_code = 200
)
async def get_exclusions(
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of excluded subscriptions.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if admin_query:
        admin_data = copy.deepcopy(admin_query[0])

        return admin_data['exclusions']
    else:
        return []

@router.post(
    "/exclusions",
    summary = "Add Excluded Subscription(s)",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error adding exclusion(s), please try again."
)
async def add_exclusions(
    exclusions: List[Subscription],
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Add a list of excluded Subscriptions:

    - **[&lt;UUID&gt;]**: Array of Subscription ID's
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    subscription_list = await arg_query(None, True, argquery.SUBSCRIPTION)
    invalid_subscriptions = [str(x) for x in exclusions if str(x) not in [y['subscription_id'] for y in subscription_list]]

    if invalid_subscriptions:
        raise HTTPException(status_code=400, detail="One or more invalid subscriptions id's provided.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        await new_admin_db([], list(set(exclusions)), tenant_id)
    else:
        admin_data = copy.deepcopy(admin_query[0])

        admin_data['exclusions'] = jsonable_encoder(list(set(admin_data['exclusions'] + exclusions)))

        await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_200_OK)

@router.put(
    "/exclusions",
    summary = "Replace Excluded Subscriptions",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating exclusions, please try again."
)
async def update_exclusions(
    exclusions: List[Subscription],
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Replace the list of excluded Subscriptions:

    - **[&lt;UUID&gt;]**: Array of Subscription ID's
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    subscription_list = await arg_query(None, True, argquery.SUBSCRIPTION)
    invalid_subscriptions = [str(x) for x in exclusions if str(x) not in [y['subscription_id'] for y in subscription_list]]

    if invalid_subscriptions:
        raise HTTPException(status_code=400, detail="One or more invalid subscriptions id's provided.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        await new_admin_db([], list(set(exclusions)), tenant_id)
    else:
        admin_data = copy.deepcopy(admin_query[0])

        admin_data['exclusions'] = jsonable_encoder(list(set(exclusions)))

        await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_200_OK)

@router.delete(
    "/exclusions/{subscriptionId}",
    summary = "Remove Excluded Subscription",
    status_code=200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error removing exclusion, please try again."
)
async def remove_exclusion(
    subscriptionId: Subscription = Path(..., description="Azure Subscription ID"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove an excluded Subscription ID.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        raise HTTPException(status_code=400, detail="Subscription id not found.")

    admin_data = copy.deepcopy(admin_query[0])

    exclusion_index = next((i for i, exclusion in enumerate(admin_data['exclusions']) if exclusion == str(subscriptionId)), None)

    if exclusion_index is None:
        raise HTTPException(status_code=400, detail="Invalid subscription id.")

    del admin_data['exclusions'][exclusion_index]

    await cosmos_replace(admin_query[0], admin_data)

    return Response(status_code=status.HTTP_200_OK)
