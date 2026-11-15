import copy
import re
import uuid

import jsonpatch
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.dependencies import (
    UNAUTHORIZED,
    api_auth_checks,
    get_tenant_id,
    get_token_auth_header,
    resolve_admin,
)
from app.models import User, UserExpand, UserUpdate, ViewSettings
from app.permissions import Permission, requires, role_for
from app.routers.admin import new_admin_db
from app.routers.common.helper import (
    cosmos_query,
    cosmos_replace,
    cosmos_retry,
    cosmos_upsert,
    get_user_id_from_jwt,
)

VIEW_NAMES = "spaces|blocks|vnets|vhubs|subnets|endpoints|networks|reservations|admins|exclusions|extnetworks|extsubnets|extendpoints"

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(api_auth_checks)],
    responses=UNAUTHORIZED
)

async def get_admins(tenant_id):
    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    if not admin_query:
        admin_query = [await new_admin_db([], [], tenant_id)]

    return admin_query[0]['admins']

def get_access(user_id, admins):
    """The access fields reported for a user: their admin status and the roles they hold."""

    is_admin = resolve_admin(user_id, admins)

    return {
        "isAdmin": is_admin,
        "roles": [role_for(is_admin).id]
    }

async def new_user(user_id, tenant_id):
    new_user = {
        "id": uuid.uuid4(),
        "type": "user",
        "tenant_id": tenant_id,
        "data": {
            "id": user_id,
            "darkMode": False,
            "apiRefresh": 5,
            "views": {}
        }
    }

    query_results = await cosmos_upsert(jsonable_encoder(new_user))

    return query_results

async def scrub_patch(patch):
    scrubbed_patch = []

    allowed_ops = [
        {
            "ops": ["replace"],
            "path": "/apiRefresh",
            "valid": "(?:(?:^|, )(5|10|15|30))+$",
            "error": "apiRefresh must have a value in [5|10|15|30]."
        },
        {
            "ops": ["replace"],
            "path": "/darkMode",
            "valid": "^(?:true|false)$",
            "error": "darkMode must be 'true' or 'false'."
        },
        {
            "ops": ["add", "replace"],
            "path": f"/views/({VIEW_NAMES})",
            "valid": ViewSettings,
            "error": f"Valid views are [{VIEW_NAMES}]."
        },
        {
            "ops": ["remove"],
            "path": f"/views/({VIEW_NAMES})$",
            "valid": None,
            "error": f"Valid views are [{VIEW_NAMES}]."
        }
    ]

    for item in list(patch):
        target = next((x for x in allowed_ops if ((item['op'] in x['ops']) and re.match(x['path'], item['path']))), None)

        if target:
            if target['valid'] is None:
                scrubbed_patch.append(item)
            elif isinstance(target['valid'], str):
                if re.match(target['valid'], str(item['value']), re.IGNORECASE):
                    scrubbed_patch.append(item)
                else:
                    raise HTTPException(status_code=400, detail=target['error'])
            elif issubclass(target['valid'], BaseModel):
                try:
                    target['valid'](**item['value'])
                    scrubbed_patch.append(item)
                except Exception:
                    raise HTTPException(status_code=400, detail=target['error'])
            else:
                raise HTTPException(status_code=400, detail=target['error'])

    return scrubbed_patch

@router.get(
    "",
    summary = "Get All Users",
    response_model = list[User],
    status_code = 200,
    dependencies = [Depends(requires(Permission.USERS_READ))]
)
async def get_users(
    token: str = Depends(get_token_auth_header),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a list of IPAM Users.
    """

    user_list = []

    users = await cosmos_query("SELECT VALUE c.data FROM c WHERE c.type = 'user'", tenant_id)
    admins = await get_admins(tenant_id)

    for user in users:
        current_user = {
            **user,
            **get_access(user['id'], admins)
        }

        user_list.append(current_user)

    return user_list

@router.get(
    "/me",
    summary = "Get My User Details",
    response_model = (
        UserExpand
        | User
    ),
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error fetching user, please try again."
)
async def get_user(
    expand: bool = Query(False, description="Show expanded user details"),
    token: str = Depends(get_token_auth_header),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get your IPAM user details.
    """

    user_id = get_user_id_from_jwt(token)

    user_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND c['data']['id'] = @user_id)", tenant_id, [{"name": "@user_id", "value": user_id}])

    if not user_query:
        user_query = [await new_user(user_id, tenant_id)]

    user_data = copy.deepcopy(user_query[0])

    user_data['data'].update(get_access(user_id, await get_admins(tenant_id)))

    if expand:
        return UserExpand(**user_data['data'])
    else:
        return User(**user_data['data'])

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
    token: str = Depends(get_token_auth_header),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update your own user settings with a JSON patch:

    - **[&lt;JSON Patch&gt;]**: Array of JSON Patches

    Allowed paths and operations:
    - **/darkMode**
        - **replace**: `true` or `false`
    - **/apiRefresh**
        - **replace**: how often the UI refreshes its data, in minutes: `5`, `10`, `15` or `30`
    - **/views/{view}**: the saved layout of a table, where **{view}** is one of
      `spaces`, `blocks`, `vnets`, `vhubs`, `subnets`, `endpoints`, `networks`, `reservations`,
      `admins`, `exclusions`, `extnetworks`, `extsubnets` or `extendpoints`
        - **add**, **replace**: save the layout
        - **remove**: remove the saved layout; returns **409** if none is saved

    Operations on any other path are ignored.
    """

    user_id = get_user_id_from_jwt(token)

    user_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND c['data']['id'] = @user_id)", tenant_id, [{"name": "@user_id", "value": user_id}])

    if not user_query:
        user_query = [await new_user(user_id, tenant_id)]

    user_data = copy.deepcopy(user_query[0])

    try:
        patch = jsonpatch.JsonPatch([x.model_dump() for x in updates])
    except jsonpatch.InvalidJsonPatch:
        raise HTTPException(status_code=400, detail="Invalid JSON patch, please review and try again.")

    try:
        scrubbed_patch = jsonpatch.JsonPatch(await scrub_patch(patch))
        user_data['data'] = scrubbed_patch.apply(user_data['data'], in_place = True)
    except jsonpatch.JsonPatchConflict as e:
        raise HTTPException(status_code=409, detail=str(e).capitalize())

    await cosmos_replace(user_query[0], user_data)

    user_data['data'].update(get_access(user_id, await get_admins(tenant_id)))

    return user_data['data']
