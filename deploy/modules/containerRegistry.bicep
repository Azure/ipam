@description('Deployment Location')
param location string = resourceGroup().location

@description('Container Registry Name')
param containerRegistryName string

@description('Managed Identity PrincipalId')
param principalId string

var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var acrPullId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
var acrPullRoleAssignmentId = guid(subscription().id, acrPull, principalId)

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2021-12-01-preview' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Standard'
  }
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: acrPullRoleAssignmentId
  scope: containerRegistry
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullId
    principalId: principalId
  }
}

output acrName string = containerRegistry.name
output acrUri string = containerRegistry.properties.loginServer
