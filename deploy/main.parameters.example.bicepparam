using './main.bicep'

param guid = sys.guid('<Contoso Ltd.>')
param location = 'eastus'
param namePrefix = 'ipam'
param azureCloud = 'AZURE_PUBLIC'
param privateAcr = false
param deployAsFunc = false
param deployAsContainer = true
param uiAppId = '<UI APP REGISTRATION APP/CLIENT ID>'
param engineAppId = '<ENGINE APP REGISTRATION APP/CLIENT ID>'
param engineAppSecret = sys.readEnvironmentVariable('ENGINE_APP_SECRET') // recommended to change use az.getSecret() instead after the initial deployment
// param engineAppSecret = az.getSecret('<subscription-id>', '<rg-name>', '<key-vault-name>', '<secret-name>', '<secret-version>')
param additionalKeyVaultRoleAssignments = []
param tags = {}
param resourceNames = {
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
