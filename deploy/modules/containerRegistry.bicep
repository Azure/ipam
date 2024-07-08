@description('Deployment Location')
param location string = resourceGroup().location

@description('Container Registry Name')
param containerRegistryName string

@description('Managed Identity PrincipalId')
param principalId string

@description('Role Assignment GUID')
param roleAssignmentName string = newGuid()

param privateEndpointSubnetId string
param private bool

var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrPullId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: private ? 'Disabled' : 'Enabled'
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-06-01' = if(private) {
  name: '${containerRegistryName}-privateEndpoint'
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${containerRegistryName}-privateLinkServiceConnection'
        properties: {
          privateLinkServiceId: containerRegistry.id
          groupIds: [
            'registry'
          ]
        }
      }
    ]
  }
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  #disable-next-line use-stable-resource-identifiers
  name: roleAssignmentName
  scope: containerRegistry
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullId
    principalId: principalId
  }
}

output acrName string = containerRegistry.name
output acrUri string = containerRegistry.properties.loginServer
