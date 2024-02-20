@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity Name')
param managedIdentityName string

var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var contributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributor)
var contributorRoleAssignmentId = guid(contributor, managedIdentity.id, subscription().id)
var managedIdentityOperator = 'f1a07417-d97a-45cb-824c-7a7467783830'
var managedIdentityOperatorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', managedIdentityOperator)
var managedIdentityOperatorRoleAssignmentId = guid(managedIdentityOperator, managedIdentity.id, subscription().id)

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentityName
  location: location
}

resource contributorAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: contributorRoleAssignmentId
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorId
    principalId: managedIdentity.properties.principalId
  }
}

resource managedIdentityOperatorAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: managedIdentityOperatorRoleAssignmentId
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: managedIdentityOperatorId
    principalId: managedIdentity.properties.principalId
  }
}

output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId
output id string = managedIdentity.id
