// Global parameters
targetScope = 'subscription'

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Deployment Location')
param location string = deployment().location

@description('IPAM-UI App Registration Client/App ID')
param uiAppId string

@description('IPAM-Engine App Registration Client/App ID')
param engineAppId string

@secure()
@description('IPAM-Engine App Registration Client Secret')
param engineAppSecret string

// Resource Naming Variables
var resourceGroupName = 'ipam-rg-${uniqueString(guid)}'
var managedIdentityName = 'ipam-mi-${uniqueString(guid)}'
var keyVaultName = 'ipam-kv-${uniqueString(guid)}'
var storageName = 'ipamstg${uniqueString(guid)}'

// App Service Variables
var appServicePlanName = 'ipam-asp-${uniqueString(guid)}'
var appServiceName = 'ipam-${uniqueString(guid)}'

// Cosmos Variables
var cosmosAccountName = 'ipam-dbacct-${uniqueString(guid)}'

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
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
