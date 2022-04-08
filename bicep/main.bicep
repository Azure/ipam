// Global parameters
targetScope = 'subscription'

@description('location for all resources')
param location string = deployment().location

@minLength(4)
@maxLength(30)
@description('string used for naming all resources')
param name string

@description('object ID of the service principal for accessing secrets in key vault')
param objectId string

@description('contributor role definition ID')
param roleId string = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

@description('name of key vault secret')
param secretName string

@description('value of key vault secret')
@secure()
param secretValue string

// Naming variables
var appServicePlanName = '${name}-asp'
var containerRegistryName = '${name}cr'
var cosmosAccountName = '${name}-dbaccount'
var cosmosDbContainerName = '${name}-dbcontainer'
var cosmosDbName = '${name}-db'
var keyVaultName = '${name}-kv'
var managedIdentityName = '${name}-mi'
var resourceGroupName = '${name}-rg'
var websiteName = '${name}-service'

//Resource group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
}

//Authentication related resources
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    managedIdentityName: managedIdentityName
    location: location
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

//Security related resources
module keyVault 'keyVault.bicep' ={
  name: 'keyVaultModule'
  scope: resourceGroup
  params: {
    keyVaultName: keyVaultName
    location: location
    objectId: objectId
    secretName: secretName
    secretValue: secretValue
  }
}

// Database related resources
module cosmos 'cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    cosmosDbName: cosmosDbName
    cosmosAccountName: cosmosAccountName
    cosmosDbContainerName: cosmosDbContainerName
    location: location
  }
}

//Compute related resources
module containerRegistry 'containerRegistry.bicep' = {
  scope: resourceGroup
  name: 'containerRegistryModule'
  params: {
    containerRegistryName: containerRegistryName
    location: location
  }
}
module appService 'appService.bicep' = {
  scope: resourceGroup
  name: 'appServiceModule'
  params: {
    appServicePlanName: appServicePlanName
    containerRegistryloginServer: containerRegistry.outputs.loginServer
    location: location
    managedIdentityClientId: managedIdentity.outputs.clientId
    managedIdentityId: managedIdentity.outputs.managedIdentityId
    websiteName: websiteName
  }
}

//Outputs
output appServiceHostName string = appService.outputs.appServiceHostName
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
