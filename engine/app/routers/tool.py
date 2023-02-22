from fastapi import APIRouter, Depends, HTTPException, Header

import regex
from netaddr import IPSet

from app.dependencies import (
    check_token_expired
)

from app.models import *
from . import argquery

from app.routers.common.helper import (
    cosmos_retry,
    arg_query,
    vnet_fixup
)

router = APIRouter(
    prefix="/tools",
    tags=["tools"],
    dependencies=[Depends(check_token_expired)]
)

@router.post(
    "/nextAvailableSubnet",
    summary = "Get Next Available Subnet in a Virtual Network",
    response_model = NewSubnetCIDR,
    status_code = 201
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error fetching next available subnet, please try again."
)
async def next_available_subnet(
    req: SubnetCIDRReq,
    authorization: str = Header(None, description="Azure Bearer token"),
):
    """
    Get the next available Subnet CIDR in a Virtual Network with the following information:

    - **vnet_id**: Virtual Network ID
    - **size**: Network mask bits
    - **reverse_search**:
        - **true**: New subnets will be located as close to the <u>end</u> of the Virtual Network CIDR as possible
        - **false (default)**: New subnets will be located as close to the <u>beginning</u> of the Virtual Network CIDR as possible
    - **smallest_cidr**:
        - **true**: New subnets will be created using the smallest possible available CIDR (e.g. it will not break up large CIDR blocks when possible)
        - **false (default)**: New subnets will be created using the first available CIDR, regardless of size

    <font color='red'>**EXPERIMENTAL**: This API is currently in testing and may change in future releases!</font>
    """

    vnet_pattern = regex.compile(r'(?i)^\/subscriptions\/[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\/resourceGroups\/(?=.{1,90})([a-zA-Z0-9-_\.\p{L}\p{N}]*)(?<!\.)\/providers\/Microsoft.Network\/virtualNetworks\/(?=.{2,64})([a-zA-Z0-9-_\.]*)(?<=[a-zA-Z0-9_])$')

    valid_vnet = vnet_pattern.match(req.vnet_id)

    if not valid_vnet:
        raise HTTPException(status_code=400, detail="Invalid Virtual Network ID.")

    vnet_list = await arg_query(authorization, True, argquery.VNET)
    vnet_list = vnet_fixup(vnet_list)

    vnet_all_cidrs = []

    target = next((x for x in vnet_list if x['id'].lower() == req.vnet_id.lower()), None)

    if not target:
        raise HTTPException(status_code=400, detail="Virtual Network not found.")

    for subnet in target['subnets']:
        vnet_all_cidrs.append(subnet['prefix'])

    vnet_set = IPSet(target['prefixes'])
    reserved_set = IPSet(vnet_all_cidrs)
    available_set = vnet_set ^ reserved_set

    available_slicer = slice(None, None, -1) if req.reverse_search else slice(None)
    next_selector = -1 if req.reverse_search else 0

    if req.smallest_cidr:
        cidr_list = list(filter(lambda x: x.prefixlen <= req.size, available_set.iter_cidrs()[available_slicer]))
        min_mask = max(map(lambda x: x.prefixlen, cidr_list))
        available_block = next((net for net in list(filter(lambda network: network.prefixlen == min_mask, cidr_list))), None)
    else:
        available_block = next((net for net in list(available_set.iter_cidrs())[available_slicer] if net.prefixlen <= req.size), None)

    if not available_block:
        raise HTTPException(status_code=500, detail="Subnet of requested size unavailable in target virtual network.")

    next_cidr = list(available_block.subnet(req.size))[next_selector]

    new_cidr = {
        "vnet_name": target['name'],
        "resource_group": target['resource_group'],
        "subscription_id": target['subscription_id'],
        "cidr": str(next_cidr)
    }

    return new_cidr
