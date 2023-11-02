from fastapi.encoders import jsonable_encoder

from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Header,
    Query
)

from pydantic import BaseModel
from typing import Union, List

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

from app.routers.admin import (
    new_admin_db
)

from app.routers.common.helper import (
    get_user_id_from_jwt,
    cosmos_query,
    cosmos_upsert,
    cosmos_replace,
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
            "path": "/views/(spaces|blocks|vnets|vhubs|subnets|endpoints|networks|reservations|admins|exclusions|externals)",
            "valid": ViewSettings,
            "error": "Valid views are [spaces|blocks|vnets|vhubs|subnets|endpoints|networks|reservations|admins|exclusions|externals]."
        }
    ]

    for item in list(patch):
        target = next((x for x in allowed_ops if ((item['op'] in x['ops']) and re.match(x['path'], item['path']))), None)

        if target:
            if isinstance(target['valid'], str):
                if re.match(target['valid'], str(item['value']), re.IGNORECASE):
                    scrubbed_patch.append(item)
                else:
                    raise HTTPException(status_code=400, detail=target['error'])
            elif issubclass(target['valid'], BaseModel):
                try:
                    test_data = target['valid'](**item['value'])
                    scrubbed_patch.append(item)
                except:
                    raise HTTPException(status_code=400, detail=target['error'])
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
    authorization: str = Header(None, description="Azure Bearer token"),
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
    response_model = Union[
        UserExpand,
        User
    ],
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error fetching user, please try again."
)
async def get_user(
    expand: bool = Query(False, description="Show expanded user details"),
    authorization: str = Header(None, description="Azure Bearer token"),
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

    if not admin_query:
        admin_query = [await new_admin_db([], [], tenant_id)]

    admins = admin_query[0]

    if admins['admins']:
        is_admin = next((x for x in admins['admins'] if x['id'] == user_id), None)
    else:
        is_admin = True

    user_data['data']['isAdmin'] = True if is_admin else False

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
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Update a User with a JSON patch:

    - **[&lt;JSON Patch&gt;]**: Array of JSON Patches

    Allowed operations:
    - **replace**

    Allowed paths:
    - **/darkMode**
    - **/apiRefresh**
    """

    user_assertion = authorization.split(' ')[1]
    user_id = get_user_id_from_jwt(user_assertion)

    user_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND c['data']['id'] = '{}')".format(user_id), tenant_id)

    if not user_query:
        user_query = [await new_user(user_id, tenant_id)]

    user_data = copy.deepcopy(user_query[0])

    try:
        patch = jsonpatch.JsonPatch([x.model_dump() for x in updates])
    except jsonpatch.InvalidJsonPatch:
        raise HTTPException(status_code=500, detail="Invalid JSON patch, please review and try again.")

    try:
        scrubbed_patch = jsonpatch.JsonPatch(await scrub_patch(patch))
        user_data['data'] = scrubbed_patch.apply(user_data['data'], in_place = True)
    except jsonpatch.JsonPatchConflict as e:
        raise HTTPException(status_code=500, detail=str(e).capitalize())

    await cosmos_replace(user_query[0], user_data)

    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", tenant_id)

    admins = admin_query[0]

    is_admin = next((x for x in admins['admins'] if x['id'] == user_id), None)

    user_data['data']['isAdmin'] = True if is_admin else False

    return user_data['data']
