from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Header
)

from typing import List

import regex
import copy
from netaddr import IPSet, IPNetwork

from app.dependencies import (
    api_auth_checks,
    get_tenant_id
)

from app.models import *
from . import argquery

from app.routers.common.helper import (
    cosmos_query,
    cosmos_retry,
    arg_query,
    vnet_fixup
)

from app.routers.azure import (
    get_network
)

router = APIRouter(
    prefix="/tools",
    tags=["tools"],
    dependencies=[Depends(api_auth_checks)]
)

@router.post(
    "/nextAvailableSubnet",
    summary = "Get Next Available Subnet in a Virtual Network",
    response_model = NewSubnetCIDR,
    status_code = 200
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

    - **vnet_id**: Virtual Network Resource ID
    - **size**: Network mask bits
    - **reverse_search**:
        - **true**: New subnets will be located as close to the <u>end</u> of the Virtual Network CIDR as possible
        - **false (default)**: New subnets will be located as close to the <u>beginning</u> of the Virtual Network CIDR as possible
    - **smallest_cidr**:
        - **true**: New subnets will be created using the smallest possible available CIDR (e.g. it will not break up large CIDR blocks when possible)
        - **false (default)**: New subnets will be created using the first available CIDR, regardless of size
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

@router.post(
    "/nextAvailableVNet",
    summary = "Get Next Available Virtual Network from a List of Blocks",
    response_model = NewVNetCIDR,
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error fetching next available virtual network, please try again."
)
async def next_available_vnet(
    req: VNetCIDRReq,
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get the next available Virtual Network CIDR in a list of Blocks with the following information:

    - **space**: Space name
    - **blocks**: Array of Block names (*Evaluated in the order provided*)
    - **size**: Network mask bits
    - **reverse_search**:
        - **true**: New networks will be created as close to the <u>end</u> of the block as possible
        - **false (default)**: New networks will be created as close to the <u>beginning</u> of the block as possible
    - **smallest_cidr**:
        - **true**: New networks will be created using the smallest possible available block (e.g. it will not break up large CIDR blocks when possible)
        - **false (default)**: New networks will be created using the first available block, regardless of size
    """

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER('{}')".format(req.space), tenant_id)

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

            for e in (e for e in target_block['externals']):
                block_all_cidrs.append(e['cidr'])

            block_set = IPSet([target_block['cidr']])
            reserved_set = IPSet(block_all_cidrs)
            available_set = block_set ^ reserved_set

            if req.smallest_cidr:
                cidr_list = list(filter(lambda x: x.prefixlen <= req.size, available_set.iter_cidrs()[available_slicer]))
                min_mask = max(map(lambda x: x.prefixlen, cidr_list))
                available_block = next((net for net in list(filter(lambda network: network.prefixlen == min_mask, cidr_list))), None)
            else:
                available_block = next((net for net in list(available_set.iter_cidrs())[available_slicer] if net.prefixlen <= req.size), None)

            available_block_name = block if available_block else None

    if not available_block:
        raise HTTPException(status_code=500, detail="Network of requested size unavailable in target block(s).")

    next_cidr = list(available_block.subnet(req.size))[next_selector]

    new_cidr = {
        "space": target_space['name'],
        "block": available_block_name,
        "cidr": str(next_cidr)
    }

    return new_cidr

@router.post(
    "/cidrCheck",
    summary = "Find Virtual Networks that Overlap a Given CIDR Range",
    response_model = List[CIDRCheckRes],
    status_code = 200
)
@cosmos_retry(
    max_retry = 5,
    error_msg = "Error fetching overlapping virtual networks, please try again."
)
async def cidr_check(
    req: CIDRCheckReq,
    authorization: str = Header(None, description="Azure Bearer token"),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get a list of Virtual Networks which overlap a given CIDR range with the following information:

    - **cidr**: CIDR range

    <font color='red'>**EXPERIMENTAL**: This API is currently in testing and may change in future releases!</font>
    """

    if IPNetwork(req.cidr).ip != IPNetwork(req.cidr).network:
        raise HTTPException(status_code=400, detail="Invalid CIDR range.")

    spaces = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", tenant_id)

    nets = await arg_query(authorization, True, argquery.NET_BASIC)

    nets = vnet_fixup(nets)

    overlap = [net for net in nets if IPSet([req.cidr]) & IPSet(net['prefixes'])]

    for item in overlap:
        new_prefixes = []

        for prefix in item['prefixes']:
            if IPSet([req.cidr]) & IPSet([prefix]):
                new_prefixes.append(prefix)

        item['prefixes'] = new_prefixes

        item['containers'] = []

        for space in spaces:
            for block in space['blocks']:
                for vnet in block['vnets']:
                    if vnet['id'] == item['id']:
                        container = {
                            "space": space['name'],
                            "block": block['name']
                        }

                        # container = "/spaces/{}/blocks/{}".format(space['name'], block['name'])

                        item['containers'].append(container)

    return overlap

# Use below for new/experimental APIs:
# <font color='red'>**EXPERIMENTAL**: This API is currently in testing and may change in future releases!</font>
