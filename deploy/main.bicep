// Global parameters
targetScope = 'subscription'

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Deployment Location')
param location string = deployment().location

@description('Prefix for Resource Naming')
param namePrefix string = 'ipam'

@description('IPAM-UI App Registration Client/App ID')
param uiAppId string

@description('IPAM-Engine App Registration Client/App ID')
param engineAppId string

@secure()
@description('IPAM-Engine App Registration Client Secret')
param engineAppSecret string

@description('Tags')
param tags object = {}

// Resource naming variables
var appServiceName = '${namePrefix}-${uniqueString(guid)}'
var appServicePlanName = '${namePrefix}-asp-${uniqueString(guid)}'
var cosmosAccountName = '${namePrefix}-dbacct-${uniqueString(guid)}'
var keyVaultName = '${namePrefix}-kv-${uniqueString(guid)}'
var managedIdentityName = '${namePrefix}-mi-${uniqueString(guid)}'
var resourceGroupName = '${namePrefix}-rg-${uniqueString(guid)}'
var storageName = '${namePrefix}stg${uniqueString(guid)}'


// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  name: resourceGroupName
  tags: tags
}

// Managed Identity for Secure Access to KeyVault
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    managedIdentityName: managedIdentityName
    location: location
  }
}

// KeyVault for Secure Values
module keyVault 'keyVault.bicep' ={
  name: 'keyVaultModule'
  scope: resourceGroup
  params: {
    keyVaultName: keyVaultName
    location: location
    principalId:  managedIdentity.outputs.principalId
    uiAppId: uiAppId
    engineAppId: engineAppId
    engineAppSecret: engineAppSecret
  }
}

// Cosmos DB for IPAM Database
module cosmos 'cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    location: location
    cosmosAccountName: cosmosAccountName
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// Storage Account for Nginx Config
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

// App Service w/ Docker Compose + CI
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
