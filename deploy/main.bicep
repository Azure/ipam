// Global parameters
targetScope = 'subscription'

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Deployment Location')
param location string = deployment().location

@description('Prefix for Resource Naming')
param namePrefix string = 'ipam'

@description('Azure Cloud Enviroment')
param azureCloud string = 'AZURE_PUBLIC'

@description('Flag to Deploy Private Container Registry')
param privateAcr bool = false

@description('Flag to Deploy IPAM as a Function')
param deployAsFunc bool = false

@description('IPAM-UI App Registration Client/App ID')
param uiAppId string = '00000000-0000-0000-0000-000000000000'

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
var cosmosContainerName = '${namePrefix}-ctr'
var cosmosDatabaseName = '${namePrefix}-db'
var keyVaultName = '${namePrefix}-kv-${uniqueString(guid)}'
var workspaceName = '${namePrefix}-law-${uniqueString(guid)}'
var managedIdentityName = '${namePrefix}-mi-${uniqueString(guid)}'
var resourceGroupName = '${namePrefix}-rg-${uniqueString(guid)}'
var storageName = '${namePrefix}stg${uniqueString(guid)}'
var containerRegistryName = '${namePrefix}acr${uniqueString(guid)}'


// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  #disable-next-line use-stable-resource-identifiers
  name: resourceGroupName
  tags: tags
}

// Log Analytics Workspace
module logAnalyticsWorkspace 'logAnalyticsWorkspace.bicep' ={
  name: 'logAnalyticsWorkspaceModule'
  scope: resourceGroup
  params: {
    location: location
    workspaceName: workspaceName
  }
}

// Managed Identity for Secure Access to KeyVault
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    location: location
    managedIdentityName: managedIdentityName
  }
}

// KeyVault for Secure Values
module keyVault 'keyVault.bicep' = {
  name: 'keyVaultModule'
  scope: resourceGroup
  params: {
    location: location
    keyVaultName: keyVaultName
    principalId:  managedIdentity.outputs.principalId
    uiAppId: uiAppId
    engineAppId: engineAppId
    engineAppSecret: engineAppSecret
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
  }
}

// Cosmos DB for IPAM Database
module cosmos 'cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    location: location
    cosmosAccountName: cosmosAccountName
    cosmosContainerName: cosmosContainerName
    cosmosDatabaseName: cosmosDatabaseName
    keyVaultName: keyVault.outputs.keyVaultName
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
  }
}

// Storage Account for Nginx Config/ Function Metadata
module storageAccount 'storageAccount.bicep' = {
  scope: resourceGroup
  name: 'storageAccountModule'
  params: {
    location: location
    storageAccountName: storageName
    principalId: managedIdentity.outputs.principalId
    managedIdentityId: managedIdentity.outputs.id
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    deployAsFunc: deployAsFunc
  }
}

// Container Registry
module containerRegistry 'containerRegistry.bicep' = if (privateAcr) {
  scope: resourceGroup
  name: 'containerRegistryModule'
  params: {
    location: location
    containerRegistryName: containerRegistryName
    principalId: managedIdentity.outputs.principalId
  }
}

// App Service w/ Docker Compose + CI
module appService 'appService.bicep' = if (!deployAsFunc) {
  scope: resourceGroup
  name: 'appServiceModule'
  params: {
    location: location
    azureCloud: azureCloud
    appServicePlanName: appServicePlanName
    appServiceName: appServiceName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    storageAccountName: storageAccount.outputs.name
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    privateAcr: privateAcr
    privateAcrUri: privateAcr ? containerRegistry.outputs.acrUri : ''
  }
}

// Function App
module functionApp 'functionApp.bicep' = if (deployAsFunc) {
  scope: resourceGroup
  name: 'functionAppModule'
  params: {
    location: location
    azureCloud: azureCloud
    functionAppPlanName: appServicePlanName
    functionAppName: appServiceName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    storageAccountName: storageAccount.outputs.name
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    privateAcr: privateAcr
    privateAcrUri: privateAcr ? containerRegistry.outputs.acrUri : ''
  }
}

// Outputs
output resourceGroupName string = resourceGroupName
output appServiceName string = appServiceName
output appServiceHostName string = deployAsFunc ? functionApp.outputs.functionAppHostName : appService.outputs.appServiceHostName
output acrName string = privateAcr ? containerRegistry.outputs.acrName : ''
output acrUri string = privateAcr ? containerRegistry.outputs.acrUri : ''
