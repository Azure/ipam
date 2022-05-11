// Global parameters
targetScope = 'subscription'

@description('guid used for naming all resources')
param guid string = newGuid()

@description('location for all resources')
param location string = deployment().location

@description('contributor role definition ID')
param roleId string = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

@description('key vault SPN ID secret')
param spnIdValue string

@secure()
@description('key vault SPN secret value')
param spnSecretValue string

// Naming variables
var appServicePlanName = 'ipam-asp-${uniqueString(guid)}'
var containerRegistryName = 'ipamcr${uniqueString(guid)}'
var cosmosAccountName = 'ipam-dbacct-${uniqueString(guid)}'
var cosmosDbContainerName = 'ipam-dbcntnr-${uniqueString(guid)}'
var cosmosDbName = 'ipam-db-${uniqueString(guid)}'
var keyVaultName = 'ipam-kv-${uniqueString(guid)}'
var managedIdentityName = 'ipam-mi-${uniqueString(guid)}'
var resourceGroupName = 'ipam-rg-${uniqueString(guid)}'
var websiteName = 'ipam-${uniqueString(guid)}'

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
  scope: resourceGroup
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
    objectId:  managedIdentity.outputs.principalId
    spnIdValue: spnIdValue
    spnSecretValue: spnSecretValue
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
    keyVaultName: keyVault.outputs.keyVaultName
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
    cosmosDbName: cosmos.outputs.cosmosDbName
    cosmosDbContainerName: cosmos.outputs.cosmosDbContainerName
    cosmosDocumentEndpoint: cosmos.outputs.cosmosDocumentEndpoint
    keyVaultUri: keyVault.outputs.keyVaultUri
    location: location
    managedIdentityClientId: managedIdentity.outputs.clientId
    managedIdentityId: managedIdentity.outputs.managedIdentityId
    websiteName: websiteName
  }
}

//Outputs
output appServiceHostName string = appService.outputs.appServiceHostName
output containerRegistryLoginServer string = containerRegistry.outputs.loginServer
