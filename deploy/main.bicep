// Global parameters
targetScope = 'subscription'

@description('GUID for Resource Naming')
param guid string = newGuid()

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

@description('Flag to Deploy IPAM as a Container')
param deployAsContainer bool = false

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
  functionName: '${namePrefix}-${uniqueString(guid)}'
  appServiceName: '${namePrefix}-${uniqueString(guid)}'
  functionPlanName: '${namePrefix}-asp-${uniqueString(guid)}'
  appServicePlanName: '${namePrefix}-asp-${uniqueString(guid)}'
  cosmosAccountName: '${namePrefix}-dbacct-${uniqueString(guid)}'
  cosmosContainerName: '${namePrefix}-ctr'
  cosmosDatabaseName: '${namePrefix}-db'
  keyVaultName: '${namePrefix}-kv-${uniqueString(guid)}'
  workspaceName: '${namePrefix}-law-${uniqueString(guid)}'
  managedIdentityName: '${namePrefix}-mi-${uniqueString(guid)}'
  resourceGroupName: '${namePrefix}-rg-${uniqueString(guid)}'
  storageAccountName: '${namePrefix}stg${uniqueString(guid)}'
  containerRegistryName: '${namePrefix}acr${uniqueString(guid)}'
}

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  #disable-next-line use-stable-resource-identifiers
  name: resourceNames.resourceGroupName
  tags: tags
}

// Log Analytics Workspace
module logAnalyticsWorkspace './modules/logAnalyticsWorkspace.bicep' ={
  name: 'logAnalyticsWorkspaceModule'
  scope: resourceGroup
  params: {
    location: location
    workspaceName: resourceNames.workspaceName
  }
}

// Managed Identity for Secure Access to KeyVault
module managedIdentity './modules/managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: resourceGroup
  params: {
    location: location
    managedIdentityName: resourceNames.managedIdentityName
  }
}

// KeyVault for Secure Values
module keyVault './modules/keyVault.bicep' = {
  name: 'keyVaultModule'
  scope: resourceGroup
  params: {
    location: location
    keyVaultName: resourceNames.keyVaultName
    identityPrincipalId:  managedIdentity.outputs.principalId
    identityClientId:  managedIdentity.outputs.clientId
    uiAppId: uiAppId
    engineAppId: engineAppId
    engineAppSecret: engineAppSecret
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
  }
}

// Cosmos DB for IPAM Database
module cosmos './modules/cosmos.bicep' = {
  name: 'cosmosModule'
  scope: resourceGroup
  params: {
    location: location
    cosmosAccountName: resourceNames.cosmosAccountName
    cosmosContainerName: resourceNames.cosmosContainerName
    cosmosDatabaseName: resourceNames.cosmosDatabaseName
    keyVaultName: keyVault.outputs.keyVaultName
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    principalId: managedIdentity.outputs.principalId
  }
}

// Storage Account for Nginx Config/Function Metadata
module storageAccount './modules/storageAccount.bicep' = if (deployAsFunc) {
  scope: resourceGroup
  name: 'storageAccountModule'
  params: {
    location: location
    storageAccountName: resourceNames.storageAccountName
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
  }
}

// Container Registry
module containerRegistry './modules/containerRegistry.bicep' = if (privateAcr) {
  scope: resourceGroup
  name: 'containerRegistryModule'
  params: {
    location: location
    containerRegistryName: resourceNames.containerRegistryName
    principalId: managedIdentity.outputs.principalId
  }
}

// App Service w/ Docker Compose + CI
module appService './modules/appService.bicep' = if (!deployAsFunc) {
  scope: resourceGroup
  name: 'appServiceModule'
  params: {
    location: location
    azureCloud: azureCloud
    appServiceName: resourceNames.appServiceName
    appServicePlanName: resourceNames.appServicePlanName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    databaseName: resourceNames.cosmosDatabaseName
    containerName: resourceNames.cosmosContainerName
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    deployAsContainer: deployAsContainer
    privateAcr: privateAcr
    privateAcrUri: privateAcr ? containerRegistry.outputs.acrUri : ''
  }
}

// Function App
module functionApp './modules/functionApp.bicep' = if (deployAsFunc) {
  scope: resourceGroup
  name: 'functionAppModule'
  params: {
    location: location
    azureCloud: azureCloud
    functionAppName: resourceNames.functionName
    functionPlanName: resourceNames.appServicePlanName
    keyVaultUri: keyVault.outputs.keyVaultUri
    cosmosDbUri: cosmos.outputs.cosmosDocumentEndpoint
    databaseName: resourceNames.cosmosDatabaseName
    containerName: resourceNames.cosmosContainerName
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityClientId: managedIdentity.outputs.clientId
    storageAccountName: resourceNames.storageAccountName
    workspaceId: logAnalyticsWorkspace.outputs.workspaceId
    deployAsContainer: deployAsContainer
    privateAcr: privateAcr
    privateAcrUri: privateAcr ? containerRegistry.outputs.acrUri : ''
  }
}

// Outputs
output suffix string = uniqueString(guid)
output subscriptionId string = subscription().subscriptionId
output resourceGroupName string = resourceGroup.name
output appServiceName string = deployAsFunc ? resourceNames.functionName : resourceNames.appServiceName
output appServiceHostName string = deployAsFunc ? functionApp.outputs.functionAppHostName : appService.outputs.appServiceHostName
output acrName string = privateAcr ? containerRegistry.outputs.acrName : ''
output acrUri string = privateAcr ? containerRegistry.outputs.acrUri : ''
