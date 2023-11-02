RESERVATION = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| where isnotnull(tags["ipam-res-id"])
| extend prefixes = properties.addressSpace.addressPrefixes
| project id, prefixes, resv = tags["ipam-res-id"]
"""

# SUBSCRIPTION = """
# resourcecontainers
# | where type =~ 'microsoft.resources/subscriptions'
# | extend quotaId = properties.subscriptionPolicies.quotaId
# | extend type = case(
#     quotaId startswith "EnterpriseAgreement", "Enterprise Agreement",
#     quotaId startswith "MSDNDevTest", "Dev/Test",
#     quotaId startswith "MSDN_2014-09-0", "PAYGO",
#     quotaId startswith "Internal", "Microsoft Internal",
#     "Unknown"
# )
# | project name, id, type, subscription_id = subscriptionId, tenant_id = tenantId
# """

SUBSCRIPTION = """
resourcecontainers
| where type=~ 'microsoft.resources/subscriptions'
| extend mgParent = properties.managementGroupAncestorsChain
| extend mgName = tostring(mgParent[0].name)
| extend quotaId = properties.subscriptionPolicies.quotaId
| extend type = case(
    quotaId startswith "EnterpriseAgreement", "Enterprise Agreement",
    quotaId startswith "MSDNDevTest", "Dev/Test",
    quotaId startswith "MSDN_2014-09-0", "PAYGO",
    quotaId startswith "Internal", "Microsoft Internal",
    "Unknown"
)
| join kind=leftouter (
    resourcecontainers
    | where type =~ 'microsoft.management/managementgroups'
    | extend mgDisplayName = iff((tostring(name) == tostring(tenantId)), "Tenant Root Group", name)
    | project mgId = id, mgName = name, mgDisplayName
) on mgName
| project name, id, type, subscription_id = subscriptionId, mg_id = mgId, mg_name = mgDisplayName, tenant_id = tenantId
"""

SPACE = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes = properties.addressSpace.addressPrefixes
"""

BLOCK = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes = properties.addressSpace.addressPrefixes
"""

# This version gets both IPv4 and IPv6 vNET/Subnet address spaces
# VNET = """
# resources
# | where type =~ 'Microsoft.Network/virtualNetworks'
# | where subscriptionId !in~ {}
# | project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes = properties.addressSpace.addressPrefixes, resv = tostring(coalesce(tags['X-IPAM-RES-ID'], tags['ipam-res-id']))
# | extend id_lower = tolower(id)
# | join kind = leftouter(
#     resources
#     | where type =~ 'Microsoft.Network/virtualNetworks'
#     | mv-expand subnet = todynamic(properties.subnets)
#     | extend nameMap = dynamic({{'AzureFirewallSubnet': 'AFW', 'GatewaySubnet': 'VGW', 'AzureBastionSubnet': 'BAS'}})
#     | extend nameResult = nameMap[tostring(subnet.name)]
#     | extend appGwConfig = subnet.properties.applicationGatewayIPConfigurations
#     | extend appGwResult = iff(isnotnull(appGwConfig), "AGW", appGwConfig)
#     | extend subnetType = coalesce(nameResult, appGwResult)
#     | extend subnet_details = pack("name", subnet.name, "prefix", tostring(subnet.properties.addressPrefix), "used", coalesce(array_length(subnet.properties.ipConfigurations), 0) + 5, "type", todynamic(subnetType))
#     | summarize subnet_bag = make_bag(subnet_details) by tostring(subnet.id), id
#     | extend id_lower = tolower(id)
# ) on id_lower
# | join kind = leftouter(
#     resources
#     | where type =~ 'Microsoft.Network/virtualNetworks'
#     | mv-expand peering = todynamic(properties.virtualNetworkPeerings)
#     | extend peering_details = pack("name", peering.name, "remote_network", peering.properties.remoteVirtualNetwork.id, "state", peering.properties.peeringState)
#     | summarize peering_bag = make_bag(peering_details) by tostring(peering.id), id
#     | extend id_lower = tolower(id)
# ) on id_lower
# | summarize subnets = make_list(subnet_bag) by id, tostring(peering_bag), name, tostring(prefixes), resource_group, subscription_id, tenant_id, resv
# | summarize peerings = make_list(todynamic(peering_bag)) by id, name, tostring(subnets), tostring(prefixes), resource_group, subscription_id, tenant_id, resv
# | project name, id, todynamic(prefixes), todynamic(subnets), peerings, resource_group, subscription_id, tenant_id, todynamic(resv)
# """

VNET = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| where subscriptionId !in~ {}
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes = properties.addressSpace.addressPrefixes, resv = tostring(coalesce(tags['X-IPAM-RES-ID'], tags['ipam-res-id']))
| extend id_lower = tolower(id)
| join kind = leftouter(
    resources
    | where type =~ 'Microsoft.Network/virtualNetworks'
    | mv-expand subnet = todynamic(properties.subnets)
    | extend nameMap = dynamic({{'AzureFirewallSubnet': 'AFW', 'GatewaySubnet': 'VGW', 'AzureBastionSubnet': 'BAS'}})
    | extend nameResult = nameMap[tostring(subnet.name)]
    | extend appGwConfig = subnet.properties.applicationGatewayIPConfigurations
    | extend appGwResult = iff(isnotnull(appGwConfig), "AGW", appGwConfig)
    | extend subnetType = coalesce(nameResult, appGwResult)
    | extend subnetPrefix = todynamic(subnet.properties.addressPrefix)
    | extend subnetPrefixes = todynamic(subnet.properties.addressPrefixes)
    | extend subnet_details = pack("name", subnet.name, "prefix", iff(isnotnull(subnetPrefixes), subnetPrefixes, pack_array(subnetPrefix)), "used", coalesce(array_length(subnet.properties.ipConfigurations), 0) + 5, "type", todynamic(subnetType))
    | summarize subnet_bag = make_bag(subnet_details) by tostring(subnet.id), id
    | extend id_lower = tolower(id)
) on id_lower
| join kind = leftouter(
    resources
    | where type =~ 'Microsoft.Network/virtualNetworks'
    | mv-expand peering = todynamic(properties.virtualNetworkPeerings)
    | extend peering_details = pack("name", peering.name, "remote_network", peering.properties.remoteVirtualNetwork.id, "state", peering.properties.peeringState)
    | summarize peering_bag = make_bag(peering_details) by tostring(peering.id), id
    | extend id_lower = tolower(id)
) on id_lower
| summarize subnets = make_list(subnet_bag) by id, tostring(peering_bag), name, tostring(prefixes), resource_group, subscription_id, tenant_id, resv
| summarize peerings = make_list(todynamic(peering_bag)) by id, name, tostring(subnets), tostring(prefixes), resource_group, subscription_id, tenant_id, resv
| project name, id, todynamic(prefixes), todynamic(subnets), peerings, resource_group, subscription_id, tenant_id, todynamic(resv)
"""

# This version gets both the IPv4 and IPv6 Subnet address space
# SUBNET = """
# resources
# | where type =~ 'Microsoft.Network/virtualNetworks'
# | where subscriptionId !in~ {}
# | mv-expand subnet = todynamic(properties.subnets)
# | extend subnet_size = array_length(subnet.properties.ipConfigurations)
# | extend nameMap = dynamic({{'AzureFirewallSubnet': 'AFW', 'GatewaySubnet': 'VGW', 'AzureBastionSubnet': 'BAS'}})
# | extend nameResult = nameMap[tostring(subnet.name)]
# | extend appGwConfig = subnet.properties.applicationGatewayIPConfigurations
# | extend appGwResult = iff(isnotnull(appGwConfig), "AGW", appGwConfig)
# | extend subnetType = coalesce(nameResult, appGwResult)
# | project name = subnet.name, id = subnet.id, prefix = subnet.properties.addressPrefix, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId,vnet_name = name, vnet_id = id, used = (iif(isnull(subnet_size), 0, subnet_size) + 5), type = todynamic(subnetType)
# """

SUBNET = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| where subscriptionId !in~ {}
| mv-expand subnet = todynamic(properties.subnets)
| extend subnet_size = array_length(subnet.properties.ipConfigurations)
| extend nameMap = dynamic({{'AzureFirewallSubnet': 'AFW', 'GatewaySubnet': 'VGW', 'AzureBastionSubnet': 'BAS'}})
| extend nameResult = nameMap[tostring(subnet.name)]
| extend appGwConfig = subnet.properties.applicationGatewayIPConfigurations
| extend appGwResult = iff(isnotnull(appGwConfig), "AGW", appGwConfig)
| extend subnetType = coalesce(nameResult, appGwResult)
| extend subnetPrefix = todynamic(subnet.properties.addressPrefix)
| extend subnetPrefixes = todynamic(subnet.properties.addressPrefixes)
| project name = subnet.name, id = subnet.id, prefix = iff(isnotnull(subnetPrefixes), subnetPrefixes, pack_array(subnetPrefix)), resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId,vnet_name = name, vnet_id = id, used = (iif(isnull(subnet_size), 0, subnet_size) + 5), type = todynamic(subnetType)
"""

# VWAN_HUBS = """
# resources
# | where type =~ 'microsoft.network/virtualhubs'
# | project name, resource_group = resourceGroup, subscription_id = subscriptionId
# """

# VHUB = """
# resources
# | where type =~ 'microsoft.network/virtualhubs'
# | where subscriptionId !in~ {}
# | project name, id, prefix = properties.addressPrefix, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, vwan_id = tostring(properties.virtualWan.id)
# | extend vwan_id_lower = tolower(vwan_id)
# | join kind = leftouter (
#     resources
#     | where type =~ 'microsoft.Network/virtualWans'
#     | project vwan_id = id, vwan_name = name
#     | extend vwan_id_lower = tolower(vwan_id)
# ) on vwan_id_lower
# | project name, id, prefix, resource_group, subscription_id, tenant_id, metadata = pack('vwan_name', vwan_name, 'vwan_id', vwan_id)
# """

VHUB = """
resources
| where type =~ 'microsoft.network/virtualhubs'
| where subscriptionId !in~ {}
| where isempty(kind)
| project name, id, prefix = properties.addressPrefix, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, vwan_id = tostring(properties.virtualWan.id), resv = tostring(coalesce(tags['X-IPAM-RES-ID'], tags['ipam-res-id']))
| extend vwan_id_lower = tolower(vwan_id)
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.Network/virtualWans'
    | project vwan_id = tostring(id), vwan_name = name
    | extend vwan_id_lower = tolower(vwan_id)
) on vwan_id_lower
| project name, id, prefix, vwan_name, vwan_id, resource_group, subscription_id, tenant_id, resv
"""

NET_BASIC = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| project name, id, resourceGroup, subscriptionId, tenantId, prefixes = properties.addressSpace.addressPrefixes
| union (
    resources
    | where type =~ 'microsoft.network/virtualhubs'
    | where isempty(kind)
    | project name, id, resourceGroup, subscriptionId, tenantId, prefixes = pack_array(properties.addressPrefix)
)
| where subscriptionId !in~ {}
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes
"""

PRIVATE_ENDPOINT = """
resources
| where type =~ 'microsoft.network/networkinterfaces'
| where subscriptionId !in~ {}
| where isnotempty(properties.privateEndpoint)
| mv-expand ipconfig = properties.ipConfigurations
| project pe_name = name, pe_rg = resourceGroup, pe_sid = subscriptionId, pe_tid = tenantId, pe_id = tostring(properties.privateEndpoint.id), subnet_id = tostring(ipconfig.properties.subnet.id), group_id = ipconfig.properties.privateLinkConnectionProperties.groupId, private_ip = ipconfig.properties.privateIPAddress
| extend pe_id_lower = tolower(pe_id)
| extend subnet_id_lower = tolower(subnet_id)
| join kind = leftouter (
    resources
    | where array_length(properties.privateEndpointConnections) > 0
    | mv-expand peConn = properties.privateEndpointConnections
    | project tenant_id = tenantId, resource_group = resourceGroup, subscription_id = subscriptionId, name = name, id = id, pe_id = tostring(peConn.properties.privateEndpoint.id)
    | extend pe_id_lower = tolower(pe_id)
) on pe_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend metadata = pack('kind', 'Private Endpoint', 'group_id', group_id, 'pe_id', pe_id, 'orphaned', iff(isempty(id), true, false))
| project name = iff(notempty(name), name, pe_name), id = iff(notempty(id), id, pe_id), private_ip, resource_group = iff(notempty(resource_group), resource_group, pe_rg), subscription_id = iff(notempty(subscription_id), subscription_id, pe_sid), tenant_id = iff(notempty(tenant_id), tenant_id, pe_tid), vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

VIRTUAL_MACHINE = """
resources
| where type =~ 'microsoft.compute/virtualmachines'
| where subscriptionId !in~ {}
| extend nics = array_length(properties.networkProfile.networkInterfaces)
| mv-expand nic = properties.networkProfile.networkInterfaces
| project tenant_id = tenantId, id = id, name = name, size = properties.hardwareProfile.vmSize, resource_group = resourceGroup, subscription_id = subscriptionId, nic_id = tostring(nic.id)
| extend nic_id_lower = tolower(nic_id)
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/networkinterfaces'
    | extend ipConfigCount = array_length(properties.ipConfigurations)
    | mv-expand ipConfig = properties.ipConfigurations
    | project nic_id = tostring(id), public_ip_id = tostring(ipConfig.properties.publicIPAddress.id), private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = tostring(ipConfig.properties.subnet.id)
    | extend subnet_id_lower = tolower(subnet_id)
    | extend public_ip_id_lower = tolower(public_ip_id)
    | extend nic_id_lower = tolower(nic_id)
) on nic_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(tostring(subnet_id))
) on subnet_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = tostring(id), public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id_lower = tolower(public_ip_id)
) on public_ip_id_lower
| extend metadata = pack('kind', 'Virtual Machine', 'size', size, 'public_ip', public_ip, 'nic_id', nic_id, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

# VM_SCALE_SET = """
# ComputeResources
# | where type =~ "microsoft.compute/virtualmachinescalesets/virtualmachines"
# | where subscriptionId !in~ {}
# | project name, tostring(id), resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId
# | extend lower_id = tolower(id)
# | join kind = leftouter (
#     ComputeResources
#     | where type =~ "microsoft.compute/virtualmachinescalesets/virtualmachines/networkinterfaces"
#     | mv-expand ipConfig = properties.ipConfigurations
#     | project id = tostring(properties.virtualMachine.id), private_ip = ipConfig.properties.privateIPAddress, subnet_id = ipConfig.properties.subnet.id
#     | extend lower_id = tolower(id)
#     | extend lower_subnet_id = tolower(tostring(subnet_id))
# ) on lower_id
# | join kind = leftouter (
#     resources
#     | where type =~ 'microsoft.network/virtualnetworks'
#     | mv-expand subnet = properties.subnets
#     | project subnet_id = subnet.id, subnet_name = subnet.name, vnet_id = id, vnet_name = name
#     | extend lower_subnet_id = tolower(tostring(subnet_id))
# ) on lower_subnet_id
# | extend vmss_name = replace(@'_[^_]+$', '', name)
# | extend vmss_vm_num = todynamic(replace(@'.*\/virtualMachines/', '', id))
# | extend vmss_id = replace(@'/virtualMachines.*', '', id)
# | project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('vmss_name', vmss_name, 'vmss_vm_num', vmss_vm_num, 'vmss_id', vmss_id)
# """

VM_SCALE_SET = """
ComputeResources
| where type =~ "microsoft.compute/virtualmachinescalesets/virtualmachines"
| where subscriptionId !in~ {}
| project name, tostring(id), resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId
| extend id_lower = tolower(id)
| join kind = leftouter (
    ComputeResources
    | where type =~ "microsoft.compute/virtualmachinescalesets/virtualmachines/networkinterfaces"
    | mv-expand ipConfig = properties.ipConfigurations
    | project id = tostring(properties.virtualMachine.id), private_ip = ipConfig.properties.privateIPAddress, subnet_id = tostring(ipConfig.properties.subnet.id)
    | extend id_lower = tolower(id)
    | extend subnet_id_lower = tolower(tostring(subnet_id))
) on id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(tostring(subnet_id))
) on subnet_id_lower
| extend vmss_name = extract(@'virtualMachineScaleSets\/(.*)\/virtualMachines', 1, id)
| extend vmss_vm_num = todynamic(replace(@'.*\/virtualMachines/', '', id))
| extend vmss_id = replace(@'/virtualMachines.*', '', id)
| extend metadata = pack('kind', 'VM Scale Set', 'vmss_name', vmss_name, 'vmss_vm_num', vmss_vm_num, 'vmss_id', vmss_id)
| project name = strcat(vmss_name, '_', vmss_vm_num), id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

FIREWALL_VNET = """
resources
| where type =~ 'Microsoft.Network/azureFirewalls'
| where subscriptionId !in~ {}
| where properties.sku.name =~ 'AZFW_VNet'
| extend ipConfigs = array_length(properties.ipConfigurations)
| mv-expand ipConfig = properties.ipConfigurations
| project tenant_id = tenantId, id = id, name = name, size = properties.sku.tier, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = tostring(ipConfig.properties.subnet.id), public_ip_id = tostring(ipConfig.properties.publicIPAddress.id)
| extend subnet_id_lower = tolower(subnet_id)
| extend public_ip_id_lower = tolower(public_ip_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = tostring(id), public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id_lower = tolower(public_ip_id)
) on public_ip_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend metadata = pack('kind', 'Firewall', 'size', size, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

# FIREWALL_VHUB = """
# resources
# | where type =~ 'Microsoft.Network/azureFirewalls'
# | where subscriptionId !in~ {}
# | where properties.sku.name =~ 'AZFW_Hub'
# | project name = name, id = id, size = properties.sku.tier, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip_address = properties.hubIPAddresses.privateIPAddress, virtual_hub_id = properties.virtualHub.id, tenant_id = tenantId
# | join kind = leftouter (
# resources
#     | where type =~ 'Microsoft.Network/azureFirewalls'
#     | where properties.sku.name =~ 'AZFW_Hub'
#     | mv-expand publicIps = properties.hubIPAddresses.publicIPAddresses
#     | summarize public_ip_addresses = make_list(publicIps.address), id = any(id)
# ) on id
# | project-away id1
# """

BASTION = """
resources
| where type =~ 'Microsoft.Network/bastionHosts'
| where subscriptionId !in~ {}
| extend ipConfigs = array_length(properties.ipConfigurations)
| mv-expand ipConfig = properties.ipConfigurations
| project tenant_id = tenantId, id = id, name = name, size = sku.name, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = dynamic(null), private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = tostring(ipConfig.properties.subnet.id), public_ip_id = tostring(ipConfig.properties.publicIPAddress.id)
| extend subnet_id_lower = tolower(subnet_id)
| extend public_ip_id_lower = tolower(public_ip_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = tostring(id), public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id_lower = tolower(public_ip_id)
) on public_ip_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend metadata = pack('kind', 'Bastion', 'size', size, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

VNET_GATEWAY = """
resources
| where type =~ 'microsoft.Network/virtualNetworkGateways'
| where subscriptionId !in~ {}
| mv-expand ipConfig = properties.ipConfigurations
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, private_ip_id = ipConfig.id, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, public_ip_id = tostring(ipConfig.properties.publicIPAddress.id), subnet_id = tostring(ipConfig.properties.subnet.id), type = properties.gatewayType
| extend private_ip_id_lower = tolower(private_ip_id)
| extend public_ip_id_lower = tolower(public_ip_id)
| extend subnet_id_lower = tolower(subnet_id)
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.Network/virtualNetworkGateways'
    | mv-expand bgpConfig = properties.bgpSettings.bgpPeeringAddresses
    | extend private_ip_id = bgpConfig.ipconfigurationId
    | extend private_ip_id_lower = tolower(private_ip_id)
) on private_ip_id_lower
| extend private_ip = bgpConfig.defaultBgpIpAddresses[0]
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = tostring(id), public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id_lower = tolower(public_ip_id)
) on public_ip_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend metadata_vpn = pack('kind', 'Virtual Network Gateway', 'type', type, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
| extend metadata_exr = pack('kind', 'Virtual Network Gateway', 'type', type, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'public_ip_alloc_method', public_ip_alloc_method)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = iff(tolower(type) == 'vpn', metadata_vpn, metadata_exr)
"""

APP_GATEWAY = """
resources
| where type =~ 'Microsoft.Network/applicationGateways'
| where subscriptionId !in~ {}
| mv-expand ipConfig = properties.frontendIPConfigurations
| where isnotempty(ipConfig.properties.privateIPAddress)
| project name, tenant_id = tenantId, id, size = properties.sku.tier, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = tostring(ipConfig.properties.subnet.id)
| extend name_lower = tolower(name)
| extend subnet_id_lower = tolower(subnet_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/applicationGateways'
    | mv-expand ipConfig = properties.frontendIPConfigurations
    | where isnotempty(ipConfig.properties.publicIPAddress)
    | project name, public_ip_id = tostring(ipConfig.properties.publicIPAddress.id), public_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod
    | extend name_lower = tolower(name)
    | extend public_ip_id_lower = tolower(public_ip_id)
) on name_lower
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = tostring(id), public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id_lower = tolower(public_ip_id)
) on public_ip_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend metadata = pack('kind', 'Application Gateway', 'size', size, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

APIM = """
resources
| where type =~ 'Microsoft.ApiManagement/service'
| where subscriptionId !in~ {}
| where properties.provisioningState =~ 'Succeeded'
| where isnotnull(properties.virtualNetworkConfiguration)
| mv-expand privateIP = properties.privateIPAddresses, publicIP = properties.publicIPAddresses
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = privateIP, public_ip = publicIP, subnet_id = tostring(properties.virtualNetworkConfiguration.subnetResourceId), tenant_id = tenantId, vnet_type = properties.virtualNetworkType
| extend subnet_id_lower = tolower(subnet_id)
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend metadata = pack('kind', 'API Management', 'vnet_type', vnet_type, 'public_ip', public_ip)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

LB = """
resources
| where type =~ 'microsoft.Network/LoadBalancers'
| where subscriptionId !in~ {}
| mv-expand ipConfig = properties.frontendIPConfigurations
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, public_ip_id = tostring(ipConfig.properties.publicIPAddress.id), subnet_id = tostring(ipConfig.properties.subnet.id)
| extend public_ip_id_lower = tolower(public_ip_id)
| extend subnet_id_lower = tolower(subnet_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = tostring(id), public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id_lower = tolower(public_ip_id)
) on public_ip_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tostring(subnet.id), subnet_name = subnet.name, vnet_id = todynamic(id), vnet_name = todynamic(name)
    | extend subnet_id_lower = tolower(subnet_id)
) on subnet_id_lower
| extend type = iff(isnotnull(private_ip), 'Private', 'Public')
| extend metadata = pack('kind', 'Load Balancer', 'type', type, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata
"""

VHUB_ENDPOINT = """
resources
| where subscriptionId !in~ {}
| where isnotnull(properties.virtualHub.id)
| extend type = extract(@'[^/]*Microsoft.Network[^/]*\/[^/]*', 0, id)
| extend vhub_id = tostring(properties.virtualHub.id)
| extend vhub_name = extract(@'virtualHubs\/(.*)', 1, vhub_id)
| extend fw_sku = tostring(properties.sku.name)
| mv-expand fw_ips = properties.hubIPAddresses.publicIPs.addresses
| mv-expand vpn_ips = properties.ipConfigurations
| extend fw_private_ip = tostring(properties.hubIPAddresses.privateIPAddress)
| extend exr_private_ip = tostring(dynamic(null))
| extend vpn_private_ip = tostring(vpn_ips.privateIpAddress)
| extend vpn_public_ip = tostring(vpn_ips.publicIpAddress)
| summarize fw_public_ips = make_list(fw_ips.address) by id, name, type, resourceGroup, subscriptionId, tenantId, vhub_name, vhub_id, fw_private_ip, fw_sku, exr_private_ip, vpn_private_ip, vpn_public_ip
| extend fw_metadata = iff(type =~ 'Microsoft.Network/azureFirewalls', pack('kind', 'vHub Firewall', 'sku', fw_sku, 'public_ip', fw_public_ips), dynamic(null))
| extend exr_metadata = iff(type =~ 'Microsoft.Network/expressRouteGateways', pack('kind', 'vHub ExpressRoute Gateway'), dynamic(null))
| extend vpn_metadata = iff(type =~ 'Microsoft.Network/vpnGateways', pack('kind','vHub VPN Gateway', 'public_ip', vpn_public_ip), dynamic(null))
| extend private_ip = coalesce(vpn_private_ip, exr_private_ip, fw_private_ip)
| extend metadata = coalesce(vpn_metadata, exr_metadata, fw_metadata)
| project name, id, todynamic(private_ip), resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, vnet_name = vhub_name, vnet_id = vhub_id, subnet_name = dynamic(null), subnet_id = dynamic(null), metadata
"""
