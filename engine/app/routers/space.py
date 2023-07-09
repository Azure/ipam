from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, Query, Path, status
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.encoders import jsonable_encoder

from typing import Optional, List, Union, Any

import azure.cosmos.exceptions as exceptions

import re
import jwt
import time
import uuid
import copy
import asyncio
import shortuuid
import jsonpatch
from netaddr import IPSet, IPNetwork
from netaddr.core import AddrFormatError

from app.dependencies import (
    check_token_expired,
    get_admin,
    get_tenant_id
)

from app.models import *
from . import argquery

from app.routers.common.helper import (
    get_username_from_jwt,
    cosmos_query,
    cosmos_upsert,
    cosmos_replace,
    cosmos_delete,
    cosmos_retry,
    arg_query,
    vnet_fixup
)

from app.routers.azure import (
    get_vnet,
    get_vhub,
    get_network
)

from app.logs.logs import ipam_logger as logger

router = APIRouter(
    prefix="/spaces",
    tags=["spaces"],
    dependencies=[Depends(check_token_expired)]
)

async def scrub_space_patch(patch):
    scrubbed_patch = []

    allowed_ops = [
        {
            "op": "replace",
            "path": "/name",
            "valid": "^([a-zA-Z0-9\._-]){1,32}$",
            "error": "Space name can be a maximum of 32 characters and may contain alphanumerics, underscores, hypens, and periods."
        },
        {
            "op": "replace",
            "path": "/desc",
            "valid": "^([a-zA-Z0-9 /\._-]){1,64}$",
            "error": "Space description can be a maximum of 64 characters and may contain alphanumerics, spaces, underscores, hypens, slashes, and periods."
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

async def valid_block_cidr_update(cidr, space, block_name):
    space_cidrs = []
    block_cidrs = []

    target_block = next((x for x in space['blocks'] if x['name'].lower() == block_name.lower()), None)

    if target_block:
        if(cidr == target_block['cidr']):
            return True

        block_network = IPNetwork(cidr)

        if(str(block_network.cidr) != cidr):
            raise HTTPException(status_code=400, detail="Invalid CIDR value, Try '{}' instead.".format(block_network.cidr))

    net_list = await get_network(None, True)

    for block in space['blocks']:
        if block['name'] != block_name:
            space_cidrs.append(block['cidr'])
        else:
            for vnet in block['vnets']:
                target_net = next((i for i in net_list if i['id'] == vnet['id']), None)
                
                if target_net:
                    block_cidrs += target_net['prefixes']

            for resv in block['resv']:
                not resv['settledOn'] and block_cidrs.append(resv['cidr'])

    update_set = IPSet([cidr])
    space_set = IPSet(space_cidrs)
    block_set = IPSet(block_cidrs)

    if space_set & update_set:
        return False
    
    if not block_set.issubset(update_set):
        return False
    
    return True

async def scrub_block_patch(patch, space, block_name):
    scrubbed_patch = []

    allowed_ops = [
        {
            "op": "replace",
            "path": "/name",
            "valid": "^([a-zA-Z0-9/\._-]){1,32}$",
            "error": "Block name can be a maximum of 32 characters and may contain alphanumerics, underscores, hypens, slashes, and periods."
        },
        {
            "op": "replace",
            "path": "/cidr",
            "valid": valid_block_cidr_update,
            "error": "Block CIDR must be in valid CIDR notation (x.x.x.x/x) and must contain all existing block networks and reservations."
        }
    ]

    for item in list(patch):
        target = next((x for x in allowed_ops if (x['op'] == item['op'] and x['path'] == item['path'])), None)

        if target:
            if isinstance(target['valid'], str):
                if re.match(target['valid'], str(item['value']), re.IGNORECASE):
                    scrubbed_patch.append(item)
                else:
                    raise HTTPException(status_code=400, detail=target['error'])
            elif callable(target['valid']):
                if await target['valid'](item['value'], space, block_name):
                    scrubbed_patch.append(item)
                else:
                    raise HTTPException(status_code=400, detail=target['error'])
            else:
                raise HTTPException(status_code=400, detail=target['error'])

    return scrubbed_patch

@router.get(
    "",
    summary = "Get All Spaces",
    response_model = Union[
        List[SpaceExpandUtil],
        List[SpaceExpand],
        List[SpaceUtil],
        List[Space],
        List[SpaceBasicUtil],
        List[SpaceBasic]
    ],
    status_code = 200
)
async def get_spaces(
    expand: bool = Query(False, description="Expand network references to full network objects"),
    utilization: bool = Query(False, description="Append utilization information for each network"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of all Spaces.
    """

    user_assertion = authorization.split(' ')[1]

    if expand and not is_admin:
        raise HTTPException(status_code=403, detail="Expand parameter can only be used by admins.")

    if expand or utilization:
        nets = await get_network(authorization, True)

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", tenant_id)

    for space in space_query:
        if utilization:
            space['size'] = 0
            space['used'] = 0

        for block in space['blocks']:
            if expand:
                expanded_nets = []

                for net in block['vnets']:
                    target_net = next((i for i in nets if i['id'] == net['id']), None)
                    target_net and expanded_nets.append(target_net)

                block['vnets'] = expanded_nets

            if utilization:
                space['size'] += IPNetwork(block['cidr']).size
                block['size'] = IPNetwork(block['cidr']).size
                block['used'] = 0

                for net in block['vnets']:
                    if expand:
                        net['size'] = 0
                        net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(block['cidr']), net['prefixes']))
                    else:
                        target_net = next((i for i in nets if i['id'] == net['id']), None)
                        net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(block['cidr']), target_net['prefixes'])) if target_net else []

                    for prefix in net_prefixes:
                        space['used'] += IPNetwork(prefix).size
                        block['used'] += IPNetwork(prefix).size

                        if expand:
                            net['size'] += IPNetwork(prefix).size
                            net['used'] = 0

                    if expand:
                        if 'subnets' in net:
                            for subnet in net['subnets']:
                                net['used'] += IPNetwork(subnet['prefix']).size
                                subnet['size'] = IPNetwork(subnet['prefix']).size

            if not is_admin:
                user_name = get_username_from_jwt(user_assertion)
                block['resv'] = list(filter(lambda x: x['createdBy'] == user_name, block['resv']))

    if not is_admin:
        if utilization:
            return [SpaceBasicUtil(**item) for item in space_query]
        else:
            return [SpaceBasic(**item) for item in space_query]
    else:
        return space_query

@router.post(
    "",
    summary = "Create New Space",
    response_model = Space,
    status_code = 201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating space, please try again."
)
async def create_space(
    space: SpaceReq,
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str =  Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Create an new Space with the following details:

    - **name**: Name of the Space
    - **desc**: A description for the Space
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="This API is admin restricted.")

    if not re.match("^([a-zA-Z0-9\._-]){1,32}$", space.name, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Space name can be a maximum of 32 characters and may contain alphanumerics, underscores, hypens, and periods.")

    if not re.match("^([a-zA-Z0-9 /\._-]){1,64}$", space.name, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Space description can be a maximum of 64 characters and may contain alphanumerics, spaces, underscores, hypens, slashes, and periods.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", tenant_id)

    duplicate = next((x for x in space_query if x['name'].lower() == space.name.lower()), None)

    if duplicate:
        raise HTTPException(status_code=400, detail="Space name must be unique.")

    new_space = {
        "id": uuid.uuid4(),
        "type": "space",
        "tenant_id": tenant_id,
        **space.dict(),
        "blocks": []
    }

    await cosmos_upsert(jsonable_encoder(new_space))

    return new_space

@router.get(
    "/{space}",
    summary = "Get Space Details",
    response_model = Union[
        SpaceExpandUtil,
        SpaceExpand,
        SpaceUtil,
        Space,
        SpaceBasicUtil,
        SpaceBasic
    ],
    status_code = 200
)
async def get_space(
    space: str = Path(..., description="Name of the target Space"),
    expand: bool = Query(False, description="Expand network references to full network objects"),
    utilization: bool = Query(False, description="Append utilization information for each network"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get the details of a specific Space.
    """

    user_assertion = authorization.split(' ')[1]

    if expand and not is_admin:
        raise HTTPException(status_code=403, detail="Expand parameter can only be used by admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    if expand or utilization:
        nets = await get_network(authorization, is_admin)

    if utilization:
        target_space['size'] = 0
        target_space['used'] = 0

    for block in target_space['blocks']:
        if expand:
            expanded_nets = []

            for net in block['vnets']:
                target_net = next((i for i in nets if i['id'] == net['id']), None)
                target_net and expanded_nets.append(target_net)

            block['vnets'] = expanded_nets

        if utilization:
            target_space['size'] += IPNetwork(block['cidr']).size
            block['size'] = IPNetwork(block['cidr']).size
            block['used'] = 0

            for net in block['vnets']:
                if expand:
                    net['size'] = 0
                    net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(block['cidr']), net['prefixes']))
                else:
                    target_net = next((i for i in nets if i['id'] == net['id']), None)
                    net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(block['cidr']), target_net['prefixes'])) if target_net else []

                for prefix in net_prefixes:
                    target_space['used'] += IPNetwork(prefix).size
                    block['used'] += IPNetwork(prefix).size

                    if expand:
                        net['size'] += IPNetwork(prefix).size
                        net['used'] = 0

                if expand:
                    if 'subnets' in net:
                        for subnet in net['subnets']:
                            net['used'] += IPNetwork(subnet['prefix']).size
                            subnet['size'] = IPNetwork(subnet['prefix']).size

        if not is_admin:
            user_name = get_username_from_jwt(user_assertion)
            block['resv'] = list(filter(lambda x: x['createdBy'] == user_name, block['resv']))

    if not is_admin:
        if utilization:
            return SpaceBasicUtil(**target_space)
        else:
            return SpaceBasic(**target_space)
    else:
        return target_space

@router.patch(
    "/{space}",
    summary = "Update Space Details",
    response_model = Space,
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating space, please try again."
)
async def update_space(
    updates: SpaceUpdate,
    space: str = Path(..., description="Name of the target Space"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Update a Space with a JSON patch:

    - **[&lt;JSON Patch&gt;]**: Array of JSON Patches

    Allowed operations:
    - **replace**

    Allowed paths:
    - **/name**
    - **/desc**
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="This API is admin restricted.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    try:
        patch = jsonpatch.JsonPatch(updates)
    except jsonpatch.InvalidJsonPatch:
        raise HTTPException(status_code=500, detail="Invalid JSON patch, please review and try again.")

    scrubbed_patch = jsonpatch.JsonPatch(await scrub_space_patch(patch))
    update_space = scrubbed_patch.apply(target_space)

    await cosmos_replace(target_space, update_space)

    return update_space

@router.delete(
    "/{space}",
    summary = "Delete a Space",
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error deleting space, please try again."
)
async def delete_space(
    space: str = Path(..., description="Name of the target Space"),
    force: Optional[bool] = Query(False, description="Forcefully delete a Space with existing Blocks"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove a specific Space.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="This API is admin restricted.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    if not force:
        if len(target_space['blocks']) > 0:
            raise HTTPException(status_code=400, detail="Cannot delete space while it contains blocks.")

    await cosmos_delete(target_space, tenant_id)

    return PlainTextResponse(status_code=status.HTTP_200_OK)

@router.get(
    "/{space}/blocks",
    summary = "Get all Blocks within a Space",
    response_model = Union[
        List[BlockExpandUtil],
        List[BlockExpand],
        List[BlockUtil],
        List[Block],
        List[BlockBasicUtil],
        List[BlockBasic]
    ],
    status_code = 200
)
async def get_blocks(
    space: str = Path(..., description="Name of the target Space"),
    expand: bool = Query(False, description="Expand network references to full network objects"),
    utilization: bool = Query(False, description="Append utilization information for each network"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of all Blocks within a specific Space.
    """

    user_assertion = authorization.split(' ')[1]

    if expand and not is_admin:
        raise HTTPException(status_code=403, detail="Expand parameter can only be used by admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    block_list = target_space['blocks']

    if expand or utilization:
        nets = await get_network(authorization, is_admin)

    for block in block_list:
        if expand:
            expanded_nets = []

            for net in block['vnets']:
                target_net = next((i for i in nets if i['id'] == net['id']), None)
                target_net and expanded_nets.append(target_net)

            block['vnets'] = expanded_nets

        if utilization:
            block['size'] = IPNetwork(block['cidr']).size
            block['used'] = 0

            for net in block['vnets']:
                if expand:
                    net['size'] = 0
                    net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(block['cidr']), net['prefixes']))
                else:
                    target_net = next((i for i in nets if i['id'] == net['id']), None)
                    net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(block['cidr']), target_net['prefixes'])) if target_net else []

                for prefix in net_prefixes:
                    block['used'] += IPNetwork(prefix).size

                    if expand:
                        net['size'] += IPNetwork(prefix).size
                        net['used'] = 0

                if expand:
                    if 'subnets' in net:
                        for subnet in net['subnets']:
                            net['used'] += IPNetwork(subnet['prefix']).size
                            subnet['size'] = IPNetwork(subnet['prefix']).size

        if not is_admin:
            user_name = get_username_from_jwt(user_assertion)
            block['resv'] = list(filter(lambda x: x['createdBy'] == user_name, block['resv']))

    if not is_admin:
        if utilization:
            return [BlockBasicUtil(**item) for item in target_space['blocks']]
        else:
            return [BlockBasic(**item) for item in target_space['blocks']]
    else:
        return target_space['blocks']

@router.post(
    "/{space}/blocks",
    summary = "Create a new Block",
    response_model = Block,
    status_code = 201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating block, please try again."
)
async def create_block(
    block: BlockReq,
    space: str = Path(..., description="Name of the target Space"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Create an new Block within a Space with the following details:

    - **name**: Name of the Block
    - **cidr**: IPv4 CIDR Range
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="This API is admin restricted.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    if not re.match("^([a-zA-Z0-9/\._-]){1,32}$", block.name, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Block name can be a maximum of 32 characters and may contain alphanumerics, underscores, hypens, slashes, and periods.")

    try:
        block_network = IPNetwork(str(block.cidr))
    except:
        raise HTTPException(status_code=400, detail="Invalid CIDR, please ensure CIDR is in valid IPv4 CIDR notation (x.x.x.x/x).")

    if str(block_network.cidr) != str(block.cidr):
        raise HTTPException(status_code=400, detail="Invalid CIDR value, Try '{}' instead.".format(block_network.cidr))

    block_cidrs = IPSet([x['cidr'] for x in target_space['blocks']])

    overlap = bool(IPSet([str(block.cidr)]) & block_cidrs)

    if overlap:
        raise HTTPException(status_code=400, detail="New block cannot overlap existing blocks.")

    new_block = {
        **block.dict(),
        "vnets": [],
        "resv": []
    }

    target_space['blocks'].append(jsonable_encoder(new_block))

    await cosmos_replace(space_query[0], target_space)

    return new_block

@router.post(
    "/{space}/reservations",
    summary = "Create CIDR Reservation from List of Blocks",
    response_model = ReservationExpand,
    status_code = 201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating cidr reservation, please try again."
)
async def create_multi_block_reservation(
    req: SpaceCIDRReq,
    space: str = Path(..., description="Name of the target Space"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a CIDR Reservation for the first available Block from a list of Blocks with the following information:

    - **blocks**: Array of Block names (*Evaluated in the order provided*)
    - **size**: Network mask bits
    - **desc**: Description (optional)
    - **reverse_search**:
        - **true**: New networks will be created as close to the <u>end</u> of the block as possible
        - **false (default)**: New networks will be created as close to the <u>beginning</u> of the block as possible
    - **smallest_cidr**:
        - **true**: New networks will be created using the smallest possible available block (e.g. it will not break up large CIDR blocks when possible)
        - **false (default)**: New networks will be created using the first available block, regardless of size
    """

    user_assertion = authorization.split(' ')[1]
    decoded = jwt.decode(user_assertion, options={"verify_signature": False})

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    request_blocks = set(req.blocks)
    space_blocks = set([x['name'] for x in target_space['blocks']])
    invalid_blocks = (request_blocks - space_blocks)

    if invalid_blocks:
        raise HTTPException(status_code=400, detail="Invalid Block(s) in Block list: {}.".format(list(invalid_blocks)))

    net_list = await get_network(authorization, True)

    available_slicer = slice(None, None, -1) if req.reverse_search else slice(None)
    next_selector = -1 if req.reverse_search else 0

    available_block = None
    available_block_name = None

    for block in req.blocks:
        if not available_block:
            target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

            block_all_cidrs = []

            for v in target_block['vnets']:
                target = next((x for x in net_list if x['id'].lower() == v['id'].lower()), None)
                prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(target_block['cidr']), target['prefixes'])) if target else []
                block_all_cidrs += prefixes

            for r in (r for r in target_block['resv'] if not r['settledOn']):
                block_all_cidrs.append(r['cidr'])

            block_set = IPSet([target_block['cidr']])
            reserved_set = IPSet(block_all_cidrs)
            available_set = block_set ^ reserved_set

            if req.smallest_cidr:
                cidr_list = list(filter(lambda x: x.prefixlen <= req.size, available_set.iter_cidrs()[available_slicer]))
                min_mask = max(map(lambda x: x.prefixlen, cidr_list), default = None)
                available_block = next((net for net in list(filter(lambda network: network.prefixlen == min_mask, cidr_list))), None)
            else:
                available_block = next((net for net in list(available_set.iter_cidrs())[available_slicer] if net.prefixlen <= req.size), None)

            available_block_name = block if available_block else None

    if not available_block:
        raise HTTPException(status_code=500, detail="Network of requested size unavailable in target block(s).")

    next_cidr = list(available_block.subnet(req.size))[next_selector]

    if "preferred_username" in decoded:
        creator_id = decoded["preferred_username"]
    else:
        creator_id = f"spn:{decoded['oid']}"

    new_cidr = {
        "id": shortuuid.uuid(),
        "cidr": str(next_cidr),
        "desc": req.desc,
        "createdOn": time.time(),
        "createdBy": creator_id,
        "settledOn": None,
        "settledBy": None,
        "status": "wait"
    }

    target_block['resv'].append(new_cidr)

    await cosmos_replace(space_query[0], target_space)

    new_cidr['space'] = target_space['name']
    new_cidr['block'] = available_block_name

    return new_cidr

@router.post(
    "/{space}/reservations/custom",
    summary="Create CIDR Reservation with Custom CIDR for All Blocks",
    response_model=ReservationExpand,
    status_code=201
)
@cosmos_retry(
    max_retry=5,
    error_msg="Error creating custom CIDR reservation, please try again."
)
async def create_custom_cidr_reservation_all_blocks(
    req: CustomCIDRReservationReq,
    space: str = Path(..., description="Name of the target Space"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a custom CIDR Reservation for all blocks within the target Space with the following information:

    - **cidr**: The custom CIDR to reserve within each block's range.
    - **desc** (optional): Description for the CIDR reservation
    """

    user_assertion = authorization.split(' ')[1]
    decoded = jwt.decode(user_assertion, options={"verify_signature": False})

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    # Validate the provided CIDR
    try:
        provided_cidr = IPNetwork(req.cidr)
    except AddrFormatError:
        raise HTTPException(status_code=400, detail="Invalid CIDR format.")

    new_cidr = {
        "id": shortuuid.uuid(),
        "cidr": str(provided_cidr),
        "desc": req.desc,
        "createdOn": time.time(),
        "createdBy": decoded.get("preferred_username", f"spn:{decoded['oid']}"),
        "settledOn": None,
        "settledBy": None,
        "status": "wait"
    }

    new_cidr['space'] = target_space['name']
    new_cidr['block'] = "All Blocks"
    
    found_block = False

    for block in target_space['blocks']:
        block_cidr = IPNetwork(block['cidr'])
        if provided_cidr in block_cidr:
            block['resv'].append(new_cidr)
            found_block = True

    if not found_block:
        raise HTTPException(status_code=400, detail="Provided CIDR is not within the address space of any block.")

    await cosmos_replace(space_query[0], target_space)

    return new_cidr

@router.get(
    "/{space}/blocks/{block}",
    summary = "Get Block Details",
    response_model = Union[
        BlockExpandUtil,
        BlockExpand,
        BlockUtil,
        Block,
        BlockBasicUtil,
        BlockBasic
    ],
    status_code = 200
)
async def get_block(
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    expand: bool = Query(False, description="Expand network references to full network objects"),
    utilization: bool = Query(False, description="Append utilization information for each network"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get the details of a specific Block.
    """

    user_assertion = authorization.split(' ')[1]

    if expand and not is_admin:
        raise HTTPException(status_code=403, detail="Expand parameter can only be used by admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    if expand or utilization:
        nets = await get_network(authorization, is_admin)

    if expand:
        expanded_nets = []

        for net in target_block['vnets']:
            target_net = next((i for i in nets if i['id'] == net['id']), None)
            target_net and expanded_nets.append(target_net)

        target_block['vnets'] = expanded_nets

    if utilization:
        target_block['size'] = IPNetwork(target_block['cidr']).size
        target_block['used'] = 0

        for net in target_block['vnets']:
            if expand:
                net['size'] = 0
                net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(target_block['cidr']), net['prefixes']))
            else:
                target_net = next((i for i in nets if i['id'] == net['id']), None)
                net_prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(target_block['cidr']), target_net['prefixes'])) if target_net else []

            for prefix in net_prefixes:
                target_block['used'] += IPNetwork(prefix).size

                if expand:
                    net['size'] += IPNetwork(prefix).size
                    net['used'] = 0

            if expand:
                if 'subnets' in net:
                    for subnet in net['subnets']:
                        net['used'] += IPNetwork(subnet['prefix']).size
                        subnet['size'] = IPNetwork(subnet['prefix']).size

    if not is_admin:
        user_name = get_username_from_jwt(user_assertion)
        target_block['resv'] = list(filter(lambda x: x['createdBy'] == user_name, target_block['resv']))

    if not is_admin:
        if utilization:
            return BlockBasicUtil(**target_block)
        else:
            return BlockBasic(**target_block)
    else:
        return target_block

@router.patch(
    "/{space}/blocks/{block}",
    summary = "Update Block Details",
    response_model = Block,
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating block, please try again."
)
async def update_block(
    updates: BlockUpdate,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Update a Block with a JSON patch:

    - **[&lt;JSON Patch&gt;]**: Array of JSON Patches

    Allowed operations:
    - **replace**

    Allowed paths:
    - **/name**
    - **/cidr**
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="This API is admin restricted.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
        update_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    update_block = next((x for x in update_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not update_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    try:
        patch = jsonpatch.JsonPatch(updates)
    except jsonpatch.InvalidJsonPatch:
        raise HTTPException(status_code=500, detail="Invalid JSON patch, please review and try again.")

    scrubbed_patch = jsonpatch.JsonPatch(await scrub_block_patch(patch, target_space, block))
    scrubbed_patch.apply(update_block, in_place=True)

    await cosmos_replace(target_space, update_space)

    return update_block

@router.delete(
    "/{space}/blocks/{block}",
    summary = "Delete a Block",
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error deleting block, please try again."
)
async def delete_block(
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    force: Optional[bool] = Query(False, description="Forcefully delete a Block with existing networks and/or reservations"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove a specific Block.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="This API is admin restricted.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    if not force:
        if len(target_block['vnets']) > 0 or len(target_block['resv']) > 0:
            raise HTTPException(status_code=400, detail="Cannot delete block while it contains vNets or reservations.")

    index = next((i for i, item in enumerate(target_space['blocks']) if item['name'] == block), None)
    del target_space['blocks'][index]

    await cosmos_replace(space_query[0], target_space)

    return PlainTextResponse(status_code=status.HTTP_200_OK)

@router.get(
    "/{space}/blocks/{block}/available",
    summary = "List Available Block Networks",
    response_model = Union[
        List[NetworkExpand],
        List[str]
    ],
    status_code = 200
)
async def available_block_nets(
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    expand: bool = Query(False, description="Expand network references to full network objects"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of Azure networks which can be associated to the target Block.
    This list is a combination on Virtual Networks and vWAN Virtual Hubs.
    Any Networks which overlap outstanding reservations are excluded.
    """

    available_vnets = []

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", tenant_id)

    target_space = next((x for x in space_query if x['name'].lower() == space.lower()), None)

    if not target_space:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    net_list = await get_network(authorization, True)
    resv_list = IPSet(x['cidr'] for x in target_block['resv'] if not x['settledOn'])

    for net in net_list:
        valid = list(filter(lambda x: (IPNetwork(x) in IPNetwork(target_block['cidr']) and not (IPSet([x]) & resv_list)), net['prefixes']))

        if valid:
            net['prefixes'] = valid
            available_vnets.append(net)

    # ADD CHECK TO MAKE SURE VNET ISN'T ASSIGNED TO ANOTHER BLOCK
    # assigned_vnets = [''.join(vnet) for space in item['spaces'] for block in space['blocks'] for vnet in block['vnets']]
    # unassigned_vnets = list(set(available_vnets) - set(assigned_vnets)) + list(set(assigned_vnets) - set(available_vnets))

    for space_iter in space_query:
        for block_iter in space_iter['blocks']:
            for net_iter in block_iter['vnets']:
                if space_iter['name'] != space and block_iter['name'] != block:
                    net_index = next((i for i, item in enumerate(available_vnets) if item['id'] == net_iter['id']), None)

                    if net_index:
                        del available_vnets[net_index]

    if expand:
        return available_vnets
    else:
        return [item['id'] for item in available_vnets]

@router.get(
    "/{space}/blocks/{block}/networks",
    summary = "List Block Networks",
    response_model = Union[
        List[NetworkExpand],
        List[Network]
    ],
    status_code = 200
)
async def available_block_nets(
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    expand: bool = Query(False, description="Expand network references to full network objects"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of virtual networks which are currently associated to the target Block.
    This list is a combination on Virtual Networks and vWAN Virtual Hubs.
    """

    block_nets = []

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    if expand:
        net_list = await get_network(authorization, True)

        for block_net in target_block['vnets']:
            target_vnet = next((x for x in net_list if x['id'].lower() == block_net['id'].lower()), None)
            target_vnet and block_nets.append(target_vnet)

        return block_nets
    else:
        return target_block['vnets']

@router.post(
    "/{space}/blocks/{block}/networks",
    summary = "Add Block Network",
    response_model = BlockBasic,
    status_code = 201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error adding network to block, please try again."
)
async def create_block_net(
    vnet: VNet,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Associate a network to the target Block with the following information:

    - **id**: Azure Resource ID
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    if vnet.id in [v['id'] for v in target_block['vnets']]:
        raise HTTPException(status_code=400, detail="Network already exists in block.")

    net_list = await get_network(authorization, True)

    target_net = next((x for x in net_list if x['id'].lower() == vnet.id.lower()), None)

    if not target_net:
        raise HTTPException(status_code=400, detail="Invalid network ID.")

    target_cidr = next((x for x in target_net['prefixes'] if IPNetwork(x) in IPNetwork(target_block['cidr'])), None)

    if not target_cidr:
        raise HTTPException(status_code=400, detail="Network CIDR not within block CIDR.")

    block_net_cidrs = []
    resv_cidrs = IPSet(x['cidr'] for x in target_block['resv'])
    block_net_cidrs += resv_cidrs

    for v in target_block['vnets']:
        target = next((x for x in net_list if x['id'].lower() == v['id'].lower()), None)

        if target:
            prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(target_block['cidr']), target['prefixes']))
            block_net_cidrs += prefixes

    cidr_overlap = IPSet(block_net_cidrs) & IPSet([target_cidr])

    if cidr_overlap:
        raise HTTPException(status_code=400, detail="Block already contains network(s) and/or reservation(s) within the CIDR range of target network.")

    vnet.active = True
    target_block['vnets'].append(jsonable_encoder(vnet))

    await cosmos_replace(space_query[0], target_space)

    return target_block

# THE REQUEST BODY ITEM SHOULD MATCH THE BLOCK VALUE THAT IS BEING PATCHED
@router.put(
    "/{space}/blocks/{block}/networks",
    summary = "Replace Block Networks",
    response_model = List[Network],
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating block networks, please try again."
)
async def update_block_vnets(
    vnets: VNetsUpdate,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Replace the list of networks currently associated to the target Block with the following information:

    - **[&lt;str&gt;]**: Array of Azure Resource ID's
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    unique_nets = len(vnets) == len(set(vnets))

    if not unique_nets:
        raise HTTPException(status_code=400, detail="List contains duplicate networks.")

    net_list = await get_network(authorization, True)

    invalid_nets = []
    outside_block_cidr = []
    net_ipset = IPSet([])
    net_overlap = False
    resv_ipset = IPSet(x['cidr'] for x in target_block['resv'] if not x['settledOn'])

    for v in vnets:
        target_net = next((x for x in net_list if x['id'].lower() == v.lower()), None)

        if not target_net:
            invalid_nets.append(v)
        else:
            target_cidr = next((x for x in target_net['prefixes'] if IPNetwork(x) in IPNetwork(target_block['cidr'])), None)

            if not target_cidr:
                outside_block_cidr.append(v)
            else:
                if not net_ipset & IPSet([target_cidr]):
                    net_ipset.add(target_cidr)
                else:
                    net_overlap = True

    if net_overlap:
        raise HTTPException(status_code=400, detail="Network list contains overlapping CIDRs.")

    if (net_ipset & resv_ipset):
        raise HTTPException(status_code=400, detail="Network list contains CIDR(s) that overlap outstanding reservations.")

    if len(outside_block_cidr) > 0:
        raise HTTPException(status_code=400, detail="Network CIDR(s) not within Block CIDR: {}".format(outside_block_cidr))

    if len(invalid_nets) > 0:
        raise HTTPException(status_code=400, detail="Invalid network ID(s): {}".format(invalid_nets))

    new_net_list = []

    for net in vnets:
        new_net = {
            "id": net,
            "active": True
        }

        new_net_list.append(new_net)

    target_block['vnets'] = new_net_list

    await cosmos_replace(space_query[0], target_space)

    return target_block['vnets']

@router.delete(
    "/{space}/blocks/{block}/networks",
    summary = "Remove Block Networks",
    response_model = BlockBasic,
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error removing block network(s), please try again."
)
async def delete_block_nets(
    req: VNetsUpdate,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove one or more networks currently associated to the target Block with the following information:

    - **[&lt;str&gt;]**: Array of Azure Resource ID's
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    unique_nets = len(set(req)) == len(req)

    if not unique_nets:
        raise HTTPException(status_code=400, detail="List contains one or more duplicate network id's.")

    current_nets = list(x['id'] for x in target_block['vnets'])
    ids_exist = all(elem in current_nets for elem in req)

    if not ids_exist:
        raise HTTPException(status_code=400, detail="List contains one or more invalid network id's.")
        # OR VNET IDS THAT DON'T BELONG TO THE CURRENT BLOCK

    for id in req:
        index = next((i for i, item in enumerate(target_block['vnets']) if item['id'] == id), None)
        del target_block['vnets'][index]

    await cosmos_replace(space_query[0], target_space)

    return PlainTextResponse(status_code=status.HTTP_200_OK)

@router.get(
    "/{space}/blocks/{block}/reservations",
    summary = "Get Block Reservations",
    response_model = List[ReservationExpand],
    status_code = 200
)
async def get_block_reservations(
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    settled: bool = Query(False, description="Include settled reservations."),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Get a list of CIDR Reservations for the target Block.
    """

    user_assertion = authorization.split(' ')[1]

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    if settled:
        reservations = target_block['resv']
    else:
        reservations = [r for r in target_block['resv'] if not r['settledOn']]

    for resv in reservations:
        resv['space'] = target_space['name']
        resv['block'] = target_block['name']

    if not is_admin:
        user_name = get_username_from_jwt(user_assertion)
        return list(filter(lambda x: x['createdBy'] == user_name, reservations))
    else:
        return reservations

@router.post(
    "/{space}/blocks/{block}/reservations",
    summary = "Create CIDR Reservation",
    response_model = ReservationExpand,
    status_code = 201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error creating cidr reservation, please try again."
)
async def create_block_reservation(
    req: BlockCIDRReq,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a CIDR Reservation for the target Block with the following information:

    - **size**: Network mask bits
    - **desc**: Description (optional)
    - **reverse_search**:
        - **true**: New networks will be created as close to the <u>end</u> of the block as possible
        - **false (default)**: New networks will be created as close to the <u>beginning</u> of the block as possible
    - **smallest_cidr**:
        - **true**: New networks will be created using the smallest possible available block (e.g. it will not break up large CIDR blocks when possible)
        - **false (default)**: New networks will be created using the first available block, regardless of size
    """

    user_assertion = authorization.split(' ')[1]
    decoded = jwt.decode(user_assertion, options={"verify_signature": False})

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    net_list = await get_network(authorization, True)

    block_all_cidrs = []

    for v in target_block['vnets']:
        target = next((x for x in net_list if x['id'].lower() == v['id'].lower()), None)
        prefixes = list(filter(lambda x: IPNetwork(x) in IPNetwork(target_block['cidr']), target['prefixes'])) if target else []
        block_all_cidrs += prefixes

    for r in (r for r in target_block['resv'] if not r['settledOn']):
        block_all_cidrs.append(r['cidr'])

    block_set = IPSet([target_block['cidr']])
    reserved_set = IPSet(block_all_cidrs)
    available_set = block_set ^ reserved_set

    available_slicer = slice(None, None, -1) if req.reverse_search else slice(None)
    next_selector = -1 if req.reverse_search else 0

    if req.smallest_cidr:
        cidr_list = list(filter(lambda x: x.prefixlen <= req.size, available_set.iter_cidrs()[available_slicer]))
        min_mask = max(map(lambda x: x.prefixlen, cidr_list))
        available_block = next((net for net in list(filter(lambda network: network.prefixlen == min_mask, cidr_list))), None)
    else:
        available_block = next((net for net in list(available_set.iter_cidrs())[available_slicer] if net.prefixlen <= req.size), None)

    if not available_block:
        raise HTTPException(status_code=500, detail="Network of requested size unavailable in target block.")

    next_cidr = list(available_block.subnet(req.size))[next_selector]

    if "preferred_username" in decoded:
        creator_id = decoded["preferred_username"]
    else:
        creator_id = f"spn:{decoded['oid']}"

    new_cidr = {
        "id": shortuuid.uuid(),
        "cidr": str(next_cidr),
        "desc": req.desc,
        "createdOn": time.time(),
        "createdBy": creator_id,
        "settledOn": None,
        "settledBy": None,
        "status": "wait"
    }

    target_block['resv'].append(new_cidr)

    await cosmos_replace(space_query[0], target_space)

    new_cidr['space'] = target_space['name']
    new_cidr['block'] = target_block['name']

    return new_cidr

@router.post(
    "/{space}/blocks/{block}/reservations/custom",
    summary="Create CIDR Reservation with Custom CIDR",
    response_model=ReservationExpand,
    status_code=201
)
@cosmos_retry(
    max_retry=5,
    error_msg="Error creating custom CIDR reservation, please try again."
)
async def create_custom_cidr_reservation(
    req: CustomCIDRReservationReq,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Create a custom CIDR Reservation for the target Block with the following information:

    - **cidr**: The custom CIDR to reserve within the target block's range.
    - **desc** (optional): Description for the CIDR reservation
    """

    user_assertion = authorization.split(' ')[1]
    decoded = jwt.decode(user_assertion, options={"verify_signature": False})

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    # Validate the provided CIDR
    try:
        provided_cidr = IPNetwork(req.cidr)
    except AddrFormatError:
        raise HTTPException(status_code=400, detail="Invalid CIDR format.")

    if provided_cidr not in IPNetwork(target_block['cidr']):
        raise HTTPException(status_code=400, detail="Provided CIDR is not within the target block's range.")

    new_cidr = {
        "id": shortuuid.uuid(),
        "cidr": str(provided_cidr),
        "desc": req.desc,
        "createdOn": time.time(),
        "createdBy": decoded.get("preferred_username", f"spn:{decoded['oid']}"),
        "settledOn": None,
        "settledBy": None,
        "status": "wait"
    }

    target_block['resv'].append(new_cidr)

    await cosmos_replace(space_query[0], target_space)

    new_cidr['space'] = target_space['name']
    new_cidr['block'] = target_block['name']

    return new_cidr

@router.delete(
    "/{space}/blocks/{block}/reservations",
    summary = "Delete CIDR Reservations",
    status_code = 204
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error removing block reservation(s), please try again."
)
async def delete_block_reservations(
    req: DeleteResvReq,
    space: str = Path(..., description="Name of the target Space"),
    block: str = Path(..., description="Name of the target Block"),
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id),
    is_admin: str = Depends(get_admin)
):
    """
    Remove one or more CIDR Reservations for the target Block.

    - **[&lt;str&gt;]**: Array of CIDR Reservation ID's
    """

    user_assertion = authorization.split(' ')[1]
    user_name = get_username_from_jwt(user_assertion)

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(space), tenant_id)

    try:
        target_space = copy.deepcopy(space_query[0])
    except:
        raise HTTPException(status_code=400, detail="Invalid space name.")

    target_block = next((x for x in target_space['blocks'] if x['name'].lower() == block.lower()), None)

    if not target_block:
        raise HTTPException(status_code=400, detail="Invalid block name.")

    unique_ids = len(set(req)) == len(req)

    if not unique_ids:
        raise HTTPException(status_code=400, detail="List contains one or more duplicate id's.")

    current_reservations = list(o['id'] for o in target_block['resv'])
    ids_exist = all(elem in current_reservations for elem in req)

    if not ids_exist:
        raise HTTPException(status_code=400, detail="List contains one or more invalid id's.")

    # settled_reservations = list(o['id'] for o in target_block['resv'] if o['settledOn'])
    # contains_settled = all(elem in settled_reservations for elem in req)

    # if contains_settled:
    #     raise HTTPException(status_code=400, detail="List contains one or more settled reservations.")

    if not is_admin:
        not_owned = list(filter(lambda x: x['id'] in req and x['createdBy'] != user_name, target_block['resv']))

        if not_owned:
            raise HTTPException(status_code=403, detail="Users can only delete their own reservations.")

    filtered_req = [r['id'] for r in target_block['resv'] if not r['settledOn'] if r['id'] in req]

    for id in filtered_req:
        index = next((i for i, item in enumerate(target_block['resv']) if item['id'] == id), None)
        # del target_block['resv'][index]
        target_block['resv'][index]['settledOn'] = time.time()
        target_block['resv'][index]['settledBy'] = user_name
        target_block['resv'][index]['status'] = "cancelledByUser"

    await cosmos_replace(space_query[0], target_space)

    return PlainTextResponse(status_code=status.HTTP_204_NO_CONTENT)
