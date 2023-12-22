from fastapi import (
    APIRouter,
    Depends,
    Header
)

import asyncio
from netaddr import IPNetwork

from app.dependencies import (
    api_auth_checks,
    get_admin,
    get_tenant_id
)

from app.models import *

from app.routers.space import (
    get_spaces
)

from app.routers.azure import (
    get_vnet,
    get_subnet,
    pe,
    vm,
    vmss,
    fwvnet,
    bastion,
    vnetgw,
    appgw,
    apim
)

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(api_auth_checks)]
)

async def multi_helper(func, list, *args):
    """DOCSTRING"""

    results = await func(*args)
    list.append(results)

@router.get(
    "/tree",
    summary = "Get Space Tree View"
)
async def tree(
    authorization: str = Header(None),
    tenant_id: str = Depends(get_tenant_id),
    admin: str = Depends(get_admin)
):
    """
    Get a hierarchical tree view of Spaces, Blocks, Virtual Networks, Subnets, and Endpoints.
    """

    tasks = []
    space_list=[]
    vnet_list=[]
    subnet_list = []
    endpoint_list = []

    tasks.append(asyncio.create_task(multi_helper(get_spaces, space_list, False, True, authorization, tenant_id, True)))
    tasks.append(asyncio.create_task(multi_helper(get_vnet, vnet_list, authorization, tenant_id, admin)))
    tasks.append(asyncio.create_task(multi_helper(get_subnet, subnet_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(pe, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(vm, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(vmss, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(fwvnet, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(bastion, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(vnetgw, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(appgw, endpoint_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(apim, endpoint_list, authorization, admin)))

    await asyncio.gather(*tasks)

    tree = []

    spaces = [item for sublist in space_list for item in sublist]

    for space in spaces:
        space_item = {
            "name": space['name'],
            "value": space['size']
        }

        if len(space['blocks']) > 0:
            space_item['children'] = []
            for block in space['blocks']:
                block_item = {
                    "name": block['name'],
                    "value": block['size'],
                    "ip": block['cidr']
                }
                space_item['value'] -= block_item['value']

                vnets = [item for sublist in vnet_list for item in sublist]
                block_vnets = list(filter(lambda x: x['id'].lower() in (map(lambda y: y['id'].lower(), block['vnets'])), vnets))

                if len(block_vnets) > 0:
                    block_item['children'] = []
                    for vnet in block_vnets:
                        # vnet_details = next((x for x in vnets if x['id'].lower() == vnet.lower()), None)
                        target_prefix = next((x for x in vnet['prefixes'] if IPNetwork(x) in IPNetwork(block['cidr'])), None)

                        vnet_item = {
                            "name": vnet['name'],
                            "value": IPNetwork(target_prefix).size,
                            "ip": target_prefix
                        }
                        block_item['value'] -= vnet_item['value']

                        subnets = [item for sublist in subnet_list for item in sublist]
                        vnet_subnets = list(filter(lambda x: x['vnet_id'].lower() == vnet['id'].lower(), subnets))

                        if len(vnet_subnets) > 0:
                            vnet_item['children'] = []
                            for subnet in vnet_subnets:
                                subnet_item = {
                                    "name": subnet['name'],
                                    "value": IPNetwork(subnet['prefix']).size,
                                    "ip": subnet['prefix']
                                }
                                vnet_item['value'] -= subnet_item['value']

                                endpoints = [item for sublist in endpoint_list for item in sublist]
                                subnet_endpoints = list(filter(lambda x: x['subnet_id'].lower() == subnet['id'].lower(), endpoints))
                                unique_subnet_endpoints = list({x['id']: x for x in subnet_endpoints}.values())

                                if len(subnet_endpoints) > 0:
                                    subnet_item['children'] = []
                                    for endpoint in unique_subnet_endpoints:
                                        endpoint_item = {
                                            "name": endpoint['name'],
                                            "value": sum(se['name'] == endpoint['name'] for se in subnet_endpoints),
                                            "ip": endpoint['private_ip']
                                        }
                                        subnet_item['value'] -= endpoint_item['value']

                                        # subnet_item['value'] -= 1
                                        subnet_item['children'].append(endpoint_item)

                                # vnet_item['value'] -= IPNetwork(subnet['prefix']).size
                                vnet_item['children'].append(subnet_item)

                        # block_item['value'] -= IPNetwork(target_prefix).size
                        block_item['children'].append(vnet_item)

                # space_item['value'] -= block['size']
                space_item["children"].append(block_item)

        tree.append({
            "name": "root",
            "children": [space_item]
        })

    return tree
