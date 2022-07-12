from fastapi import APIRouter, Depends, Request, Response, HTTPException, Header, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException
from fastapi.encoders import jsonable_encoder

from azure.core.exceptions import ClientAuthenticationError, HttpResponseError
from azure.mgmt.compute.aio import ComputeManagementClient
from azure.mgmt.network.aio import NetworkManagementClient
from azure.mgmt.resource.subscriptions.aio import SubscriptionClient

import azure.cosmos.exceptions as exceptions

import re
import copy
import asyncio
import logging
from ipaddress import IPv4Network
from netaddr import IPSet, IPNetwork
from uuid import uuid4

from sqlalchemy import true

from app.dependencies import (
    check_token_expired,
    get_admin,
    get_tenant_id
)

from . import argquery

from app.routers.common.helper import (
    get_client_credentials,
    get_obo_credentials,
    cosmos_query,
    cosmos_upsert,
    cosmos_replace,
    cosmos_retry,
    arg_query
)

from app.routers.space import (
    get_spaces
)

import app.globals as globals

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
console = logging.StreamHandler()
logger.addHandler(console)

router = APIRouter(
    prefix="/azure",
    tags=["azure"],
    dependencies=[Depends(check_token_expired)]
)

async def get_subscriptions_sdk(credentials):
    """DOCSTRING"""

    subscriptions = []

    subscription_client = SubscriptionClient(credentials)

    async for poll in subscription_client.subscriptions.list():
        sub = {
            "tenant_id": poll.tenant_id,
            "subscription_id": poll.subscription_id
        }

        subscriptions.append(sub)

    await subscription_client.close()

    return subscriptions

async def get_vmss(auth, admin):
    """DOCSTRING"""

    if admin:
        creds = await get_client_credentials()
    else:
        user_assertion=auth.split(' ')[1]
        creds = await get_obo_credentials(user_assertion)

    try:
        subscriptions = await get_subscriptions_sdk(creds)
        vmss_list = await get_vmss_list_sdk(creds, subscriptions)
        vmss_vm_interfaces = await get_vmss_interfaces_sdk(creds, vmss_list)
    except ClientAuthenticationError:
        await creds.close()
        raise HTTPException(status_code=401, detail="Access token expired.")

    await creds.close()

    return vmss_vm_interfaces

async def get_vmss_list_sdk(credentials, subscriptions):
    """DOCSTRING"""

    tasks = []
    vmss_list = []

    for subscription in subscriptions:
        tasks.append(asyncio.create_task(get_vmss_list_sdk_helper(credentials, subscription, vmss_list)))

    await asyncio.gather(*tasks)

    return vmss_list

async def get_vmss_list_sdk_helper(credentials, subscription, list):
    """DOCSTRING"""

    compute_client = ComputeManagementClient(credentials, subscription['subscription_id'])

    try:
        async for poll in compute_client.virtual_machine_scale_sets.list_all():
            rg_name_search = re.search(r"(?<=resourceGroups/).*(?=/providers)", poll.id)
            rg_name = rg_name_search.group(0)

            rg_id_search = re.search(r".*(?=/providers)", poll.id)
            rg_id = rg_id_search.group(0)

            vmss_data = {
                "name": poll.name,
                "id": poll.id,
                "size": poll.sku.name,
                "resource_group_name": rg_name,
                "resource_group_id": rg_id,
                "subscription": subscription
            }

            list.append(vmss_data)
    except HttpResponseError:
        print("Error fetching VMSS on subscription {}".format(subscription['subscription_id']))
        pass

    await compute_client.close()

async def get_vmss_interfaces_sdk(credentials, vmss_list):
    """DOCSTRING"""

    tasks = []
    vmss_interfaces = []

    for vmss in vmss_list:
        tasks.append(asyncio.create_task(get_vmss_interfaces_sdk_helper(credentials, vmss, vmss_interfaces)))

    await asyncio.gather(*tasks)

    return vmss_interfaces

async def get_vmss_interfaces_sdk_helper(credentials, vmss, list):
    """DOCSTRING"""

    network_client = NetworkManagementClient(credentials, vmss['subscription']['subscription_id'])

    async for poll in network_client.network_interfaces.list_virtual_machine_scale_set_network_interfaces(vmss['resource_group_name'], vmss['name']):
        for ip_config in poll.ip_configurations:
            vnet_name_search = re.search(r"(?<=virtualNetworks/).*(?=/subnets)", ip_config.subnet.id)
            vnet_name = vnet_name_search.group(0)

            vnet_id_search = re.search(r".*(?=/subnets)", ip_config.subnet.id)
            vnet_id = vnet_id_search.group(0)

            subnet_name_search = re.search(r"(?<=subnets/).*", ip_config.subnet.id)
            subnet_name = subnet_name_search.group(0)

            vmss_num_search = re.search(r"(?<=virtualMachines/).*", poll.virtual_machine.id)
            vmss_vm_num = vmss_num_search.group(0)

            vmss_data = {
                "name": (vmss['name'] + '_' + vmss_vm_num),
                "id": poll.virtual_machine.id,
                "private_ip": ip_config.private_ip_address,
                "resource_group": vmss['resource_group_name'],
                "subscription_id": vmss['subscription']['subscription_id'],
                "tenant_id": vmss['subscription']['tenant_id'],
                "vnet_name": vnet_name,
                "vnet_id": vnet_id,
                "subnet_name": subnet_name,
                "subnet_id": ip_config.subnet.id,
                "metadata": {
                    "size": vmss['size'],
                    "vmss_name": vmss['name'],
                    "vmss_vm_num": vmss_vm_num,
                    "vmss_id": vmss['id']
                }
            }

            list.append(vmss_data)

    await network_client.close()

@router.get(
    "/subscription",
    summary = "Get All Subscriptions"
)
async def subscription(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure subscriptions.
    """

    subscription_list = await arg_query(authorization, admin, argquery.SUBSCRIPTION)

    return subscription_list

@router.get(
    "/vnet",
    summary = "Get All Virtual Networks"
)
async def get_vnet(
    authorization: str = Header(None),
    tenant_id: str = Depends(get_tenant_id),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure Virtual Networks.
    """

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", tenant_id)

    vnet_list = await arg_query(authorization, admin, argquery.VNET)

    updated_vnet_list = []

    for vnet in vnet_list:
        total_size = 0
        total_used = 0

        for prefix in vnet['prefixes']:
            total_size += IPNetwork(prefix).size

        vnet['size'] = total_size

        for subnet in vnet['subnets']:
            subnet['size'] = IPNetwork(subnet['prefix']).size
            total_used += IPNetwork(subnet['prefix']).size
        
        vnet['used'] = total_used

        # Python 3.9+
        # ip_blocks = [(block | {'parentSpace': space['name']}) for space in space_query for block in space['blocks']]
        ip_blocks = [{**block , **{'parentSpace': space['name']}} for space in space_query for block in space['blocks']]
        ip_block = next((x for x in ip_blocks if vnet['id'] in [v['id'] for v in x['vnets']]), None)

        vnet['parentSpace'] = ip_block['parentSpace'] if ip_block else None
        vnet['parentBlock'] = ip_block['name'] if ip_block else None

        updated_vnet_list.append(vnet)
  
    return updated_vnet_list

@router.get(
    "/subnet",
    summary = "Get All Subnets"
)
async def get_subnet(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure Subnets.
    """

    SUBNET_TYPE_MAP = [
        {
            "field": "name",
            "oper": "==",
            "value": "AzureFirewallSubnet",
            "type": "AFW"
        },
                {
            "field": "name",
            "oper": "==",
            "value": "GatewaySubnet",
            "type": "VGW"
        },
        {
            "field": "name",
            "oper": "==",
            "value": "AzureBastionSubnet",
            "type": "BAS"
        },
        {
            "field": "appgw_config",
            "oper": "is not",
            "value": None,
            "type": "AGW"
        }
    ]

    subnet_list = await arg_query(authorization, admin, argquery.SUBNET)

    updated_subnet_list = []

    for subnet in subnet_list:
        subnet['size'] = IPNetwork(subnet['prefix']).size

        subnet["type"] = None

        for map_item in SUBNET_TYPE_MAP:
            eval_string = f"subnet[map_item['field']] {map_item['oper']} map_item['value']"
            check = eval(eval_string)

            if(check):
                subnet["type"] = map_item["type"]

        del subnet['appgw_config']

        updated_subnet_list.append(subnet)

    return updated_subnet_list

@router.get(
    "/pe",
    summary = "Get All Private Endpoints"
)
async def pe(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure Private Endpoints.
    """

    pe_list = await arg_query(authorization, admin, argquery.PRIVATE_ENDPOINT)

    return pe_list

@router.get(
    "/vm",
    summary = "Get All Virtual Machines"
)
async def vm(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure Virtual Machines
    """

    vm_list = await arg_query(authorization, admin, argquery.VIRTUAL_MACHINE)

    return vm_list

@router.get(
    "/vmss",
    summary = "Get All VM Scale Sets"
)
async def vmss(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure VM Scale Sets.
    """

    # vmss_list = await get_vmss(authorization, admin)
    vmss_list = await arg_query(authorization, admin, argquery.VM_SCALE_SET)

    return vmss_list

@router.get(
    "/fwvnet",
    summary = "Get All vNet Firewalls"
)
async def fwvnet(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of vNet integrated Azure Firewalls.
    """

    vm_list = await arg_query(authorization, admin, argquery.FIREWALL_VNET)

    return vm_list

@router.get(
    "/fwvhub",
    summary = "Get all vWAN Hub Firewalls"
)
async def fwvhub(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all vWAN Hub integrated Azure Firewalls.
    """

    vm_list = await arg_query(authorization, admin, argquery.FIREWALL_VHUB)

    return vm_list

@router.get(
    "/bastion",
    summary = "Get All Bastion Hosts"
)
async def bastion(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all Azure Bastions hosts.
    """

    vm_list = await arg_query(authorization, admin, argquery.BASTION)

    return vm_list

@router.get(
    "/appgw",
    summary = "Get All Application Gateways"
)
async def appgw(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all Azure Application Gateways.
    """

    vm_list = await arg_query(authorization, admin, argquery.APP_GATEWAY)

    return vm_list

@router.get(
    "/apim",
    summary = "Get All API Management Instances"
)
async def apim(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all Azure API Management instances.
    """

    vm_list = await arg_query(authorization, admin, argquery.APIM)

    return vm_list

async def multi_helper(func, list, *args):
    """DOCSTRING"""

    results = await func(*args)
    list.append(results)

@router.get(
    "/multi",
    summary = "Get All Endpoints"
)
async def multi(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a consolidated list of all Azure endpoints.
    """

    tasks = []
    result_list = []

    tasks.append(asyncio.create_task(multi_helper(pe, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(vm, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(vmss, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(fwvnet, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(bastion, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(appgw, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(apim, result_list, authorization, admin)))

    await asyncio.gather(*tasks)

    return [item for sublist in result_list for item in sublist]

@router.get(
    "/tree",
    summary = "Get Space Tree View"
)
async def multi(
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

@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating reservation status!"
)
async def match_resv_to_vnets():
    vnet_list = await arg_query(None, True, argquery.VNET)
    stale_resv = list(x['resv'] for x in vnet_list if x['resv'] != None)

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", globals.TENANT_ID)

    for space in space_query:
        original_space = copy.deepcopy(space)

        for block in space['blocks']:
            for vnet in block['vnets']:
              active = next((x for x in vnet_list if x['id'] == vnet['id']), None)

              if active:
                vnet['active'] = True
              else:
                vnet['active'] = False

            for index, resv in enumerate(block['resv']):
                if resv['id'] in stale_resv:
                    vnet = next((x for x in vnet_list if x['resv'] == resv['id']), None)

                    # print("RESV: {}".format(vnet['resv']))
                    # print("BLOCK {}".format(block['name']))
                    # print("VNET {}".format(vnet['id']))
                    # print("INDEX: {}".format(index))

                    stale_resv.remove(resv['id'])
                    resv['status'] = "wait"

                    cidr_match = resv['cidr'] in vnet['prefixes']

                    if not cidr_match:
                        # print("Reservation ID assigned to vNET which does not have an address space that matches the reservation.")
                        resv['status'] = "warnCIDRMismatch"

                    existing_block_cidrs = []

                    for v in block['vnets']:
                        target_vnet = next((x for x in vnet_list if x['id'].lower() == v['id'].lower()), None)

                        if target_vnet:
                            target_cidr = next((x for x in target_vnet['prefixes'] if IPNetwork(x) in IPNetwork(block['cidr'])), None)
                            existing_block_cidrs.append(target_cidr)

                    vnet_cidr = next((x for x in vnet['prefixes'] if IPNetwork(x) in IPNetwork(block['cidr'])), None)

                    if vnet_cidr in existing_block_cidrs:
                        # print("A vNET with the assigned CIDR has already been associated with the target IP Block.")
                        resv['status'] = "errCIDRExists"

                    if resv['status'] == "wait":
                        # print("vNET is being added to IP Block...")
                        block['vnets'].append(
                            {
                                "id": vnet['id'],
                                "active": True
                            }
                        )
                        del block['resv'][index]

        await cosmos_replace(original_space, space)

    # print("STALE:")
    # print(stale_resv)
    # print(query['spaces'])
