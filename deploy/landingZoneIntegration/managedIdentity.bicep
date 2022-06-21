@description('Contributor Role Assignment GUID')
param contributorAssignmentName string = newGuid()

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity Name')
param managedIdentityName string

var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var contributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributor)

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentityName
  location: location
}

resource contributorAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: contributorAssignmentName
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorId
    principalId: managedIdentity.properties.principalId
  }
}

output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId
output id string = managedIdentity.id
