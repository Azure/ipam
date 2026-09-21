@description('Managed Identity PrincipalId')
param principalId string

var contributor = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
var contributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', contributor)
var contributorRoleAssignmentId = guid(resourceGroup().id, principalId, contributor)
var managedIdentityOperator = 'f1a07417-d97a-45cb-824c-7a7467783830'
var managedIdentityOperatorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', managedIdentityOperator)
var managedIdentityOperatorRoleAssignmentId = guid(resourceGroup().id, principalId, managedIdentityOperator)

resource contributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: contributorRoleAssignmentId
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorId
    principalId: principalId
  }
}

resource managedIdentityOperatorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: managedIdentityOperatorRoleAssignmentId
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: managedIdentityOperatorId
    principalId: principalId
  }
}
