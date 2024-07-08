param virtualNetworkName string
param location string
param private bool

var addresSpace = '10.0.0.0/16'

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2023-06-01' = if(private) {
  name: virtualNetworkName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        addresSpace
      ]
    }
  }
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-06-01' = if(private) {
  name: 'default'
  parent: virtualNetwork
  properties: {
    addressPrefix: cidrSubnet(addresSpace, 26, 0)
  }
}

resource egressSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-06-01' = if(private) {
  name: 'egress'
  parent: virtualNetwork
  properties: {
    addressPrefix: cidrSubnet(addresSpace, 26, 1)
    delegations: [
      {
        name: 'Microsoft.Web/serverFarms'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'
        }
      }
    ]
  }
}

output privateEndpointSubnetId string = privateEndpointSubnet.id
output egressSubnetId string = egressSubnet.id
