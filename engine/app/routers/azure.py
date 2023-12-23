from fastapi import (
    APIRouter,
    HTTPException,
    Depends,
    Header
)

from azure.core.exceptions import ClientAuthenticationError, HttpResponseError
from azure.mgmt.compute.aio import ComputeManagementClient
from azure.mgmt.network.aio import NetworkManagementClient
from azure.mgmt.resource.subscriptions.aio import SubscriptionClient

from typing import  List

import re
import copy
import time
import asyncio
from netaddr import IPSet, IPNetwork

from app.dependencies import (
    api_auth_checks,
    get_admin,
    get_tenant_id
)

from app.models import *
from . import argquery

from app.routers.common.helper import (
    get_client_credentials,
    get_obo_credentials,
    cosmos_query,
    cosmos_replace,
    cosmos_retry,
    arg_query,
    vnet_fixup,
    subnet_fixup
)

from app.globals import globals

from app.logs.logs import ipam_logger as logger

router = APIRouter(
    prefix="/azure",
    tags=["azure"],
    dependencies=[Depends(api_auth_checks)]
)

def str_to_list(input):
    try:
        scrubbed = re.sub(r"\s+", "", input, flags = re.UNICODE)
        split = scrubbed.split(",")
    except:
        return []

    return split

async def get_subscriptions_sdk(credentials):
    """DOCSTRING"""

    QUOTA_MAP = {
        "EnterpriseAgreement": "Enterprise Agreement",
        "MSDNDevTest": "Dev/Test",
        "MSDN": "PAYGO",
        "Internal": "Microsoft Internal"
    }

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    subscription_client = SubscriptionClient(
        credential=credentials,
        base_url=azure_arm_url,
        credential_scopes=[azure_arm_scope],
        transport=globals.SHARED_TRANSPORT
    )

    subscriptions = []

    async for poll in subscription_client.subscriptions.list():
        quota_id = poll.subscription_policies.quota_id
        quota_id_parts = quota_id.split("_")

        if quota_id_parts[0] in QUOTA_MAP:
            quota_type = QUOTA_MAP[quota_id_parts[0]]
        else:
            quota_type = "Unknown"

        sub = {
            "id": poll.id,
            "name": poll.display_name,
            "type": quota_type,
            "subscription_id": poll.subscription_id,
            "tenant_id": poll.tenant_id
        }

        subscriptions.append(sub)

    await subscription_client.close()

    return subscriptions

async def update_vhub_data(auth, admin, hubs):
    """DOCSTRING"""

    if admin:
        creds = await get_client_credentials()
    else:
        user_assertion=auth.split(' ')[1]
        creds = await get_obo_credentials(user_assertion)

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    for hub in hubs:
        network_client = NetworkManagementClient(
            credential=creds,
            subscription_id=hub['subscription_id'],
            base_url=azure_arm_url,
            credential_scopes=[azure_arm_scope],
            transport=globals.SHARED_TRANSPORT
        )

        hub['peerings'] = []

        try:
            async for poll in network_client.hub_virtual_network_connections.list(hub['resource_group'], hub['name']):
                connection_data = {
                    "name": poll.name,
                    "remote_network": poll.remote_virtual_network.id,
                    "state": "Connected"
                }

                hub['peerings'].append(connection_data)
        except HttpResponseError:
            logger.error("Error fetching vWAN Hub connections on subscription {}".format(hub['subscription_id']))
            pass

        await network_client.close()

    await creds.close()

    return hubs

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

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    compute_client = ComputeManagementClient(
        credential=credentials,
        subscription_id=subscription['subscription_id'],
        base_url=azure_arm_url,
        credential_scopes=[azure_arm_scope],
        transport=globals.SHARED_TRANSPORT
    )

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
        logger.error("Error fetching VMSS on subscription {}".format(subscription['subscription_id']))
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

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    network_client = NetworkManagementClient(
        credential=credentials,
        subscription_id=vmss['subscription']['subscription_id'],
        base_url=azure_arm_url,
        credential_scopes=[azure_arm_scope],
        transport=globals.SHARED_TRANSPORT
    )

    try:
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
    except Exception as e:
        logger.error("Error processing VMSS '{}'".format(vmss['name']))
        logger.error(vmss)
        logger.error(e.args)
        pass

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

    # if admin:
    #     creds = await get_client_credentials()
    # else:
    #     user_assertion=authorization.split(' ')[1]
    #     creds = await get_obo_credentials(user_assertion)

    # subscription_list = await get_subscriptions_sdk(creds)

    # await creds.close()

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
    vnet_list = vnet_fixup(vnet_list)

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
        # ip_blocks = [(block | {'parent_space': space['name']}) for space in space_query for block in space['blocks']]
        ip_blocks = [{**block , **{'parent_space': space['name']}} for space in space_query for block in space['blocks']]
        parent_space = next((x['parent_space'] for x in ip_blocks if vnet['id'] in [v['id'] for v in x['vnets']]), None)
        parent_blocks = list(x['name'] for x in ip_blocks if vnet['id'] in [v['id'] for v in x['vnets']])

        vnet['parent_space'] = parent_space
        vnet['parent_block'] = parent_blocks or None

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

    # SUBNET_TYPE_MAP = [
    #     {
    #         "field": "name",
    #         "oper": "==",
    #         "value": "AzureFirewallSubnet",
    #         "type": "AFW"
    #     },
    #             {
    #         "field": "name",
    #         "oper": "==",
    #         "value": "GatewaySubnet",
    #         "type": "VGW"
    #     },
    #     {
    #         "field": "name",
    #         "oper": "==",
    #         "value": "AzureBastionSubnet",
    #         "type": "BAS"
    #     },
    #     {
    #         "field": "appgw_config",
    #         "oper": "is not",
    #         "value": None,
    #         "type": "AGW"
    #     }
    # ]

    subnet_list = await arg_query(authorization, admin, argquery.SUBNET)
    subnet_list = subnet_fixup(subnet_list)

    updated_subnet_list = []

    for subnet in subnet_list:
        subnet['size'] = IPNetwork(subnet['prefix']).size

        # subnet["type"] = None

        # for map_item in SUBNET_TYPE_MAP:
        #     eval_string = f"subnet[map_item['field']] {map_item['oper']} map_item['value']"
        #     check = eval(eval_string)

        #     if(check):
        #         subnet["type"] = map_item["type"]

        # del subnet['appgw_config']

        updated_subnet_list.append(subnet)

    return updated_subnet_list

@router.get(
    "/vhub",
    summary = "Get All Virtual Hubs",
    response_model = List[VWanHub]
)
async def get_vhub(
    authorization: str = Header(None),
    tenant_id: str = Depends(get_tenant_id),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Virtual Hubs.
    """

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", tenant_id)

    vwan_hubs = await arg_query(authorization, admin, argquery.VHUB)
    vwan_hubs_update = await update_vhub_data(authorization, admin, vwan_hubs)

    updated_vhub_list = []

    for hub in vwan_hubs_update:
        hub['size'] = IPNetwork(hub['prefix']).size
        hub['used'] = None

        # Python 3.9+
        # ip_blocks = [(block | {'parent_space': space['name']}) for space in space_query for block in space['blocks']]
        ip_blocks = [{**block , **{'parent_space': space['name']}} for space in space_query for block in space['blocks']]
        parent_space = next((x['parent_space'] for x in ip_blocks if hub['id'] in [v['id'] for v in x['vnets']]), None)
        parent_blocks = list(x['name'] for x in ip_blocks if hub['id'] in [v['id'] for v in x['vnets']])

        hub['parent_space'] = parent_space
        hub['parent_block'] = parent_blocks or None

        updated_vhub_list.append(hub)

    return updated_vhub_list

@router.get(
    "/network",
    summary = "Get All Azure Networks (vNets & vHubs)",
    # response_model = List[AzureNetwork]
)
async def get_network(
    authorization: str = Header(None),
    tenant_id: str = Depends(get_tenant_id),
    admin: str = Depends(get_admin)
):
    """
    Get a list of Azure Networks (vNets & vHubs).
    """

    tasks = [
        asyncio.create_task(get_vnet(authorization, tenant_id, admin)),
        asyncio.create_task(get_vhub(authorization, tenant_id, admin))
    ]

    networks = await asyncio.gather(*tasks)

    # networks[0] = vnet_fixup(networks[0])

    for vnet in networks[0]:
        vnet['type'] = 'vnet'

    for vwan in networks[1]:
        vwan['type'] = 'vhub'
        vwan['prefixes'] = [vwan['prefix']]

        del vwan['prefix']

        for peering in vwan['peerings']:
            target_vnet = next((x for x in networks[0] if x['id'] == peering['remote_network']), None)

            if target_vnet:
                peering_match = ".*(virtualNetworks/HV_{}_).*".format(vwan['name'])
                target_peering = next((x for x in target_vnet['peerings'] if re.match(peering_match, x['remote_network'])), None)

                if target_peering:
                    target_peering['remote_network'] = vwan['id']

    results = [item for sublist in networks for item in sublist]

    return results

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

    results = await arg_query(authorization, admin, argquery.PRIVATE_ENDPOINT)

    return results

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

    results = await arg_query(authorization, admin, argquery.VIRTUAL_MACHINE)

    return results

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

    if globals.AZURE_ENV == "AZURE_PUBLIC":
        results = await arg_query(authorization, admin, argquery.VM_SCALE_SET)
    else:
        results = await get_vmss(authorization, admin)

    return results

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

    results = await arg_query(authorization, admin, argquery.FIREWALL_VNET)

    return results

# @router.get(
#     "/fwvhub",
#     summary = "Get all vWAN Hub Firewalls"
# )
# async def fwvhub(
#     authorization: str = Header(None),
#     admin: str = Depends(get_admin)
# ):
#     """
#     Get a list of all vWAN Hub integrated Azure Firewalls.
#     """

#     results = await arg_query(authorization, admin, argquery.FIREWALL_VHUB)

#     return results

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

    results = await arg_query(authorization, admin, argquery.BASTION)

    return results

@router.get(
    "/vnetgw",
    summary = "Get All Virtual Network Gateways"
)
async def vnetgw(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all Azure Virtual Network Gateways.
    """

    results = await arg_query(authorization, admin, argquery.VNET_GATEWAY)

    return results

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

    results = await arg_query(authorization, admin, argquery.APP_GATEWAY)

    return results

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

    results = await arg_query(authorization, admin, argquery.APIM)

    return results

@router.get(
    "/lb",
    summary = "Get All Load Balancers"
)
async def lb(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all Azure Load Balancers.
    """

    results = await arg_query(authorization, admin, argquery.LB)

    return results

@router.get(
    "/vhub_ep",
    summary = "Get All Load Balancers"
)
async def vhub_ep(
    authorization: str = Header(None),
    admin: str = Depends(get_admin)
):
    """
    Get a list of all endpoints within a vWAN vHub
    """

    results = await arg_query(authorization, admin, argquery.VHUB_ENDPOINT)

    return results

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
    tasks.append(asyncio.create_task(multi_helper(vnetgw, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(appgw, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(apim, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(lb, result_list, authorization, admin)))
    tasks.append(asyncio.create_task(multi_helper(vhub_ep, result_list, authorization, admin)))

    await asyncio.gather(*tasks)

    return [item for sublist in result_list for item in sublist]

@cosmos_retry(
    max_retry = 5,
    error_msg = "Error updating reservation status!"
)
async def match_resv_to_vnets():
    net_list = await get_network(None, globals.TENANT_ID, True)
    stale_resv = list(i for j in list(str_to_list(x['resv']) for x in net_list if x['resv'] != None) for i in j)

    space_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'space'", globals.TENANT_ID)

    for space in space_query:
        original_space = copy.deepcopy(space)

        for block in space['blocks']:
            for net in block['vnets']:
                active = next((x for x in net_list if x['id'] == net['id']), None)

                if active:
                    net_prefix_set = IPSet(active['prefixes'])
                    block_network = IPSet([block['cidr']])

                    if net_prefix_set & block_network:
                        net['active'] = True
                    else:
                        net['active'] = False
                else:
                    net['active'] = False

            # print("Beginning Reservation Matching...")
            for index, resv in enumerate(block['resv']):
                # print("Block {} has reservations...".format(block['name']))
                if resv['settledOn'] is None:
                    # print("Reservation {} is not settled...".format(resv['id']))
                    if resv['id'] in stale_resv:
                        net = next((x for x in net_list if resv['id'] in str_to_list(x['resv'])), None)

                        stale_resv.remove(resv['id'])
                        resv['status'] = "wait"

                        cidr_match = resv['cidr'] in net['prefixes']

                        if not cidr_match:
                            # print("Reservation ID assigned to vNET which does not have an address space that matches the reservation.")
                            # logging.info("Reservation ID assigned to vNET which does not have an address space that matches the reservation.")
                            resv['status'] = "warnCIDRMismatch"

                        existing_block_cidrs = []

                        for v in block['vnets']:
                            target_net = next((x for x in net_list if x['id'].lower() == v['id'].lower()), None)

                            if target_net:
                                if target_net['id'] == net['id']:
                                    target_cidrs = [x for x in target_net['prefixes'] if (IPNetwork(x) in IPNetwork(block['cidr'])) and x != resv['cidr']]
                                else:
                                    target_cidrs = [x for x in target_net['prefixes'] if IPNetwork(x) in IPNetwork(block['cidr'])]

                                existing_block_cidrs += target_cidrs

                        if IPNetwork(resv['cidr']) in IPSet(existing_block_cidrs):
                            # print("A vNET with the assigned CIDR has already been associated with the target IP Block.")
                            # logging.info("A vNET with the assigned CIDR has already been associated with the target IP Block.")
                            resv['status'] = "errCIDRExists"

                        if resv['status'] == "wait":
                            # print("vNET is being added to IP Block...")
                            # logging.info("vNET is being added to IP Block...")
                            block['vnets'].append(
                                {
                                    "id": net['id'],
                                    "active": True
                                }
                            )

                            # del block['resv'][index]

                            resv['status'] = "fulfilled"
                            resv['settledOn'] = time.time()
                            resv['settledBy'] = "AzureIPAM"
                    else:
                        # print("Resetting status to 'wait'.")
                        # logging.info("Resetting status to 'wait'.")
                        resv['status'] = "wait"

        await cosmos_replace(original_space, space)
