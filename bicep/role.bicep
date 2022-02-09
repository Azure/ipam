targetScope = 'subscription'

param principalId string
param roleAssignmentName string = newGuid()
param roleId string

var roleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: roleAssignmentName
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: roleDefinitionId
    principalId: principalId
  }
} 
