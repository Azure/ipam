// Global parameters
targetScope = 'subscription'

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Deployment Location')
param location string = deployment().location

@description('Service Principal ClientId')
param spnClientId string

@secure()
@description('Service Principal Secret')
param spnSecret string

// Naming variables
var resourceGroupName = 'ipam-rg-${uniqueString(guid)}'
var managedIdentityName = 'ipam-mi-${uniqueString(guid)}'
var keyVaultName = 'ipam-kv-${uniqueString(guid)}'
var storageName = 'ipamstg${uniqueString(guid)}'

// App Service Variables
var appServicePlanName = 'ipam-asp-${uniqueString(guid)}'
var appServiceName = 'ipam-${uniqueString(guid)}'

// Cosmos Variables
var cosmosAccountName = 'ipam-dbacct-${uniqueString(guid)}'
var cosmosDbName = 'ipam-db'
var cosmosDbContainerName = 'ipam-container'

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

//Security related resources
module keyVault 'keyVault.bicep' ={
  name: 'keyVaultModule'
  scope: resourceGroup
  params: {
    keyVaultName: keyVaultName
    location: location
    principalId:  managedIdentity.outputs.principalId
    spnClientId: spnClientId
    spnSecret: spnSecret
  }
}

// Database related resources
module cosmos 'cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    location: location
    cosmosAccountName: cosmosAccountName
    cosmosDbName: cosmosDbName
    cosmosDbContainerName: cosmosDbContainerName
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

module appService 'appService.bicep' = {
  scope: resourceGroup
  name: 'appServiceModule'
  params: {
    location: location
    appServicePlanName: appServicePlanName
    appServiceName: appServiceName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    cosmosDbName: cosmos.outputs.cosmosDbName
    cosmosDbContainerName: cosmos.outputs.cosmosDbContainerName
    managedIdentityClientId: managedIdentity.outputs.clientId
    managedIdentityId: managedIdentity.outputs.id
    storageAccountName: storageAccount.outputs.name
  }
}

module storageAccount 'storageAccount.bicep' = {
  scope: resourceGroup
  name: 'storageAccountModule'
  params: {
    location: location
    storageAccountName: storageName
    principalId: managedIdentity.outputs.principalId
    managedIdentityId: managedIdentity.outputs.id
  }
}

//Outputs
output appServiceHostName string = appService.outputs.appServiceHostName
