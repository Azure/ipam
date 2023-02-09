// Global parameters
targetScope = 'subscription'

@description('Unique String for Resource Naming')
param uniqueSuffix string

@description('Deployment Location')
param location string = deployment().location

@maxLength(7)
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

@description('IPAM Resource Names')
param resourceNames object = {
  functionName: '${namePrefix}-${uniqueSuffix}'
  appServiceName: '${namePrefix}-${uniqueSuffix}'
  appServicePlanName: '${namePrefix}-asp-${uniqueSuffix}'
  cosmosAccountName: '${namePrefix}-dbacct-${uniqueSuffix}'
  cosmosContainerName: '${namePrefix}-ctr'
  cosmosDatabaseName: '${namePrefix}-db'
  keyVaultName: '${namePrefix}-kv-${uniqueSuffix}'
  workspaceName: '${namePrefix}-law-${uniqueSuffix}'
  managedIdentityName: '${namePrefix}-mi-${uniqueSuffix}'
  resourceGroupName: '${namePrefix}-rg-${uniqueSuffix}'
  storageAccountName: '${namePrefix}stg${uniqueSuffix}'
  containerRegistryName: '${namePrefix}acr${uniqueSuffix}'
}

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  #disable-next-line use-stable-resource-identifiers
  name: resourceNames.resourceGroupName
  tags: tags
}

// Log Analytics Workspace
module logAnalyticsWorkspace 'logAnalyticsWorkspace.bicep' ={
  name: 'logAnalyticsWorkspaceModule'
  scope: resourceGroup
  params: {
    location: location
    workspaceName: resourceNames.workspaceName
  }
}

// Managed Identity for Secure Access to KeyVault
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    location: location
    managedIdentityName: resourceNames.managedIdentityName
  }
}

// KeyVault for Secure Values
module keyVault 'keyVault.bicep' = {
  name: 'keyVaultModule'
  scope: resourceGroup
  params: {
    location: location
    keyVaultName: resourceNames.keyVaultName
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
    cosmosAccountName: resourceNames.cosmosAccountName
    cosmosContainerName: resourceNames.cosmosContainerName
    cosmosDatabaseName: resourceNames.cosmosDatabaseName
    keyVaultName: keyVault.outputs.keyVaultName
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
  }
}

// Storage Account for Nginx Config/Function Metadata
module storageAccount 'storageAccount.bicep' = if (deployAsFunc) {
  scope: resourceGroup
  name: 'storageAccountModule'
  params: {
    location: location
    storageAccountName: resourceNames.storageAccountName
    // principalId: managedIdentity.outputs.principalId
    // managedIdentityId: managedIdentity.outputs.id
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    // deployAsFunc: deployAsFunc
  }
}

// Container Registry
module containerRegistry 'containerRegistry.bicep' = if (privateAcr) {
  scope: resourceGroup
  name: 'containerRegistryModule'
  params: {
    location: location
    containerRegistryName: resourceNames.containerRegistryName
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
    appServicePlanName: resourceNames.appServicePlanName
    appServiceName: resourceNames.appServiceName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    databaseName: resourceNames.cosmosDatabaseName
    containerName: resourceNames.cosmosContainerName
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
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
    functionAppPlanName: resourceNames.appServicePlanName
    functionAppName: resourceNames.functionName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    databaseName: resourceNames.cosmosDatabaseName
    containerName: resourceNames.cosmosContainerName
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    storageAccountName: resourceNames.storageAccountName
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    privateAcr: privateAcr
    privateAcrUri: privateAcr ? containerRegistry.outputs.acrUri : ''
  }
}

// Outputs
output resourceGroupName string = resourceGroup.name
output appServiceName string = deployAsFunc ? resourceNames.functionName : resourceNames.appServiceName
output appServiceHostName string = deployAsFunc ? functionApp.outputs.functionAppHostName : appService.outputs.appServiceHostName
output acrName string = privateAcr ? containerRegistry.outputs.acrName : ''
output acrUri string = privateAcr ? containerRegistry.outputs.acrUri : ''
