RESERVATION = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| where isnotnull(tags["ipam-res-id"])
| extend prefixes = properties.addressSpace.addressPrefixes
| project id, prefixes, resv = tags["ipam-res-id"]
"""

SUBSCRIPTION = """
ResourceContainers
| where type =~ 'microsoft.resources/subscriptions'
| project name, id, tenant_id = tenantId, subscription_id = subscriptionId
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

# VNET = """
# resources
# | where type =~ 'Microsoft.Network/virtualNetworks'
# | project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes = properties.addressSpace.addressPrefixes
# | join kind = leftouter(
#     resources
#     | where type =~ 'Microsoft.Network/virtualNetworks'
#     | mv-expand subnet = todynamic(properties.subnets)
#     | summarize subnets = make_list(subnet.properties.addressPrefix) by id
# ) on id
# | project-away id1
# | project name, id, prefixes, subnets, resource_group, subscription_id, tenant_id
# """

VNET="""
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId, prefixes = properties.addressSpace.addressPrefixes, resv = tostring(tags["ipam-res-id"])
| join kind = leftouter(
    resources
    | where type =~ 'Microsoft.Network/virtualNetworks'
    | mv-expand subnet = todynamic(properties.subnets)
    | extend subnet_details = pack("name", subnet.name, "prefix", tostring(subnet.properties.addressPrefix), "used", array_length(subnet.properties.ipConfigurations) + 5)
    | summarize bag = make_bag(subnet_details) by tostring(subnet.id), id
) on id
| project-away id1
| summarize subnets = make_list(bag) by id, name, tostring(prefixes), resource_group, subscription_id, tenant_id, resv
| project name, id, todynamic(prefixes), subnets, resource_group, subscription_id, tenant_id, todynamic(resv)
"""

SUBNET = """
resources
| where type =~ 'Microsoft.Network/virtualNetworks'
| mv-expand subnet = todynamic(properties.subnets)
| extend subnet_size = array_length(subnet.properties.ipConfigurations)
| project name = subnet.name, id = subnet.id, prefix = subnet.properties.addressPrefix,resource_group = resourceGroup, subscription_id = subscriptionId, tenant_id = tenantId,vnet_name = name, vnet_id = id, used = (iif(isnull(subnet_size), 0, subnet_size) + 5), appgw_config = subnet.properties.applicationGatewayIPConfigurations
"""

PRIVATE_ENDPOINT = """
resources
| where type =~ 'microsoft.network/networkinterfaces'
| where isnotempty(properties.privateEndpoint)
| mv-expand ipconfig = properties.ipConfigurations
| project pe_id = tostring(properties.privateEndpoint.id), subnet_id = tolower(tostring(ipconfig.properties.subnet.id)), group_id = ipconfig.properties.privateLinkConnectionProperties.groupId, private_ip = ipconfig.properties.privateIPAddress
| join kind = leftouter (
    resources
    | where array_length(properties.privateEndpointConnections) > 0
    | mv-expand peConn = properties.privateEndpointConnections
    | project tenant_id = tenantId, resource_group = resourceGroup, subscription_id = subscriptionId, name = name, id = id, pe_id = tostring(peConn.properties.privateEndpoint.id)
) on pe_id
| project-away pe_id1
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = tolower(tostring(subnet.id)), subnet_name = subnet.name, vnet_id = id, vnet_name = name
) on subnet_id
| project-away subnet_id1
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('group_id', group_id, 'pe_id', pe_id)
"""

VIRTUAL_MACHINE = """
resources
| where type =~ 'microsoft.compute/virtualmachines'
| extend nics = array_length(properties.networkProfile.networkInterfaces)
| mv-expand nic = properties.networkProfile.networkInterfaces
| project tenant_id = tenantId, id = id, name = name, size = properties.hardwareProfile.vmSize, resource_group = resourceGroup, subscription_id = subscriptionId, nic_id = nic.id
| extend nic_id = tostring(nic_id)
| extend nic_id_lower = tolower(nic_id)
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/networkinterfaces'
    | extend ipConfigCount = array_length(properties.ipConfigurations)
    | mv-expand ipConfig = properties.ipConfigurations
    | project nic_id = id, public_ip_id = ipConfig.properties.publicIPAddress.id, private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = ipConfig.properties.subnet.id
    | extend nic_id = tostring(nic_id), public_ip_id = tostring(public_ip_id), subnet_id = tolower(tostring(subnet_id))
    | extend nic_id_lower = tolower(nic_id)
) on nic_id_lower
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = subnet.id, subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id = tolower(tostring(subnet_id))
) on subnet_id
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = id, public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
) on public_ip_id
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('size', size, 'public_ip', public_ip, 'nic_id', nic_id, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
"""

FIREWALL_VNET = """
resources
| where type =~ 'Microsoft.Network/azureFirewalls'
| where properties.sku.name =~ 'AZFW_VNet'
| extend ipConfigs = array_length(properties.ipConfigurations)
| mv-expand ipConfig = properties.ipConfigurations
| project tenant_id = tenantId, id = id, name = name, size = properties.sku.tier, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = ipConfig.properties.subnet.id, public_ip_id = ipConfig.properties.publicIPAddress.id
| extend subnet_id = tostring(subnet_id), public_ip_id = tostring(public_ip_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = id, public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id = tostring(public_ip_id)
) on public_ip_id
| project-away public_ip_id1
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = subnet.id, subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id = tostring(subnet_id)
) on subnet_id
| project-away subnet_id1
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('size', size, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
"""

FIREWALL_VHUB = """
resources
| where type =~ 'Microsoft.Network/azureFirewalls'
| where properties.sku.name =~ 'AZFW_Hub'
| project name = name, id = id, size = properties.sku.tier, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip_address = properties.hubIPAddresses.privateIPAddress, virtual_hub_id = properties.virtualHub.id, tenant_id = tenantId
| join kind = leftouter (
resources
    | where type =~ 'Microsoft.Network/azureFirewalls'
    | where properties.sku.name =~ 'AZFW_Hub'
    | mv-expand publicIps = properties.hubIPAddresses.publicIPAddresses
    | summarize public_ip_addresses = make_list(publicIps.address), id = any(id)
) on id
| project-away id1
"""

BASTION = """
resources
| where type =~ 'Microsoft.Network/bastionHosts'
| extend ipConfigs = array_length(properties.ipConfigurations)
| mv-expand ipConfig = properties.ipConfigurations
| project tenant_id = tenantId, id = id, name = name, size = sku.name, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = dynamic(null), private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = ipConfig.properties.subnet.id, public_ip_id = ipConfig.properties.publicIPAddress.id
| extend subnet_id = tostring(subnet_id), public_ip_id = tostring(public_ip_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = id, public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id = tostring(public_ip_id)
) on public_ip_id
| project-away public_ip_id1
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = subnet.id, subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id = tostring(subnet_id)
) on subnet_id
| project-away subnet_id1
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('size', size, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
"""

APP_GATEWAY = """
resources
| where type =~ 'Microsoft.Network/applicationGateways'
| mv-expand ipConfig = properties.frontendIPConfigurations
| where isnotempty(ipConfig.properties.publicIPAddress)
| project tenant_id = tenantId, name, id, size = properties.sku.tier, resource_group = resourceGroup, subscription_id = subscriptionId, public_ip_id = ipConfig.properties.publicIPAddress.id, public_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod
| extend public_ip_id = tostring(public_ip_id)
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/applicationGateways'
    | mv-expand ipConfig = properties.frontendIPConfigurations
    | where isnotempty(ipConfig.properties.privateIPAddress)
    | project name, private_ip = ipConfig.properties.privateIPAddress, private_ip_alloc_method = ipConfig.properties.privateIPAllocationMethod, subnet_id = ipConfig.properties.subnet.id
    | extend subnet_id = tolower(tostring(subnet_id))
) on name
| project-away name1
| join kind = leftouter (
    resources
    | where type =~ 'Microsoft.Network/PublicIpAddresses'
    | project public_ip_id = id, public_ip = properties.ipAddress, public_ip_alloc_method = properties.publicIPAllocationMethod
    | extend public_ip_id = tostring(public_ip_id)
) on public_ip_id
| project-away public_ip_id1
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = subnet.id, subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id = tolower(tostring(subnet_id))
) on subnet_id
| project-away subnet_id1
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('size', size, 'public_ip', public_ip, 'public_ip_id', public_ip_id, 'private_ip_alloc_method', private_ip_alloc_method, 'public_ip_alloc_method', public_ip_alloc_method)
"""

APIM = """
resources
| where type =~ 'Microsoft.ApiManagement/service'
| where properties.provisioningState =~ 'Succeeded'
| mv-expand privateIP = properties.privateIPAddresses, publicIP = properties.publicIPAddresses
| project name, id, resource_group = resourceGroup, subscription_id = subscriptionId, private_ip = privateIP, public_ip = publicIP, subnet_id = properties.virtualNetworkConfiguration.subnetResourceId, tenant_id = tenantId, vnet_type = properties.virtualNetworkType
| extend subnet_id = tolower(tostring(subnet_id))
| join kind = leftouter (
    resources
    | where type =~ 'microsoft.network/virtualnetworks'
    | extend subnets = array_length(properties.subnets)
    | mv-expand subnet = properties.subnets
    | project subnet_id = subnet.id, subnet_name = subnet.name, vnet_id = id, vnet_name = name
    | extend subnet_id = tolower(tostring(subnet_id))
) on subnet_id
| project-away subnet_id1
| project name, id, private_ip, resource_group, subscription_id, tenant_id, vnet_name, vnet_id, subnet_name, subnet_id, metadata = pack('vnet_type', vnet_type, 'public_ip', public_ip)
"""
