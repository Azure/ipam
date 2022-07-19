@description('Function App Name')
param functionAppName string

@description('Function App Plan Name')
param functionAppPlanName string

@description('CosmosDB URI')
param cosmosDbUri string

@description('KeyVault URI')
param keyVaultUri string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity Id')
param managedIdentityId string

@description('Storage Account Name')
param storageAccountName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' existing = {
  name: storageAccountName
}

resource functionAppPlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: functionAppPlanName
  location: location
  sku: {
    name: 'EP1'
    size: 'EP1'
    tier: 'ElasticPremium'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2021-03-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    httpsOnly: true
    serverFarmId: functionAppPlan.id
    keyVaultReferenceIdentity: managedIdentityId
    siteConfig: {
      alwaysOn: true
      linuxFxVersion: 'azureipam.azurecr.io/ipam-func:latest'
      appSettings: [
        {
          name: 'COSMOS_URL'
          value: cosmosDbUri
        }
        {
          name: 'COSMOS_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/COSMOS-KEY/)'
        }
        {
          name: 'CLIENT_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-ID/)'
        }
        {
          name: 'CLIENT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-SECRET/)'
        }
        {
          name: 'TENANT_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/TENANT-ID/)'
        }
        {
          name: 'KEYVAULT_URL'
          value: keyVaultUri
        }
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
      ]
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: functionAppName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

output functionAppHostName string = functionApp.properties.defaultHostName
