// Global parameters
targetScope = 'subscription'

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Deployment Location')
param location string = deployment().location

@description('Name Prefix')
param namePrefix string

@description('Service Principal ClientId')
param spnClientId string

@secure()
@description('Service Principal Secret')
param spnSecret string

@description('Tags')
param tags object

// Resource naming variables
var appServiceName = '${namePrefix}-${uniqueString(guid)}'
var appServicePlanName = '${namePrefix}-asp-${uniqueString(guid)}'
var cosmosAccountName = '${namePrefix}-dbacct-${uniqueString(guid)}'
var keyVaultName = '${namePrefix}-kv-${uniqueString(guid)}'
var managedIdentityName = '${namePrefix}-mi-${uniqueString(guid)}'
var resourceGroupName = '${namePrefix}-rg-${uniqueString(guid)}'
var storageName = '${namePrefix}stg${uniqueString(guid)}'


// Resource group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  name: resourceGroupName
  tags: tags
}

// Authentication related resources
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    managedIdentityName: managedIdentityName
    location: location
  }
}

// Security related resources
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

// Data related resources
module cosmos 'cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    location: location
    cosmosAccountName: cosmosAccountName
    keyVaultName: keyVault.outputs.keyVaultName
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

// Compute related resources
module appService 'appService.bicep' = {
  scope: resourceGroup
  name: 'appServiceModule'
  params: {
    location: location
    appServicePlanName: appServicePlanName
    appServiceName: appServiceName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    managedIdentityClientId: managedIdentity.outputs.clientId
    managedIdentityId: managedIdentity.outputs.id
    storageAccountName: storageAccount.outputs.name
  }
}

// Outputs
output appServiceHostName string = appService.outputs.appServiceHostName
