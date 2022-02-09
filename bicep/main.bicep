// Global parameters
targetScope = 'subscription'

@minLength(4)
@maxLength(30)
@description('string used for naming all resources')
param name string

@description('Contributor Role definition ID')
param roleId string = 'b24988ac-6180-42a0-ab88-20f7382dd24c'


// Naming variables
var appServicePlanName = '${name}-asp'
var cosmosAccountName = '${name}-dbaccount'
var cosmosDbCollectionName = '${name}-dbcollection'
var cosmosDbName = '${name}-db'
var managedIdentityName = '${name}-mi'
var resourceGroupName = '${name}-rg'
var websiteName = '${name}-service'

//Resource group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: deployment().location
}

//Authentication related resources
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    managedIdentityName: managedIdentityName
  }
}

module roleAssignment 'role.bicep' = {
  name: 'roleAssignmentModule'
  scope: subscription()
  params: {
    roleId: roleId
    principalId: managedIdentity.outputs.principalId
  }
} 

// Database related resources
module cosmos 'cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    cosmosDbName: cosmosDbName
    cosmosAccountName: cosmosAccountName
    cosmosDbCollectionName: cosmosDbCollectionName
  }
}

//Compute related resources
module appService 'appService.bicep' = {
  scope: resourceGroup
  name: 'appServiceModule'
  params: {
    appServicePlanName: appServicePlanName
    cosmosAccountApiVersion: cosmos.outputs.cosmosAccountApiVersion
    cosmosAccountId: cosmos.outputs.cosmosAccountId
    cosmosAccountName: cosmosAccountName
    managedIdentityId: managedIdentity.outputs.managedIdentityId
    websiteName: websiteName
  }
}

//Outputs
output appServiceHostName string = appService.outputs.appServiceHostName
