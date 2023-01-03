@description('Function App Name')
param functionAppName string

@description('Function App Plan Name')
param functionAppPlanName string

@description('CosmosDB URI')
param cosmosDbUri string

@description('CosmosDB Database Name')
param databaseName

@description('CosmosDB Container Name')
param containerName

@description('KeyVault URI')
param keyVaultUri string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Azure Cloud Enviroment')
param azureCloud string = 'AZURE_PUBLIC'

@description('Managed Identity Id')
param managedIdentityId string

@description('Managed Identity ClientId')
param managedIdentityClientId string

@description('Storage Account Name')
param storageAccountName string

@description('Log Analytics Workspace ID')
param workspaceId string

@description('Flag to Deploy Private Container Registry')
param privateAcr bool

@description('Uri for Private Container Registry')
param privateAcrUri string

// ACR Uri Variable
var acrUri = privateAcr ? privateAcrUri : 'azureipam.azurecr.io'

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' existing = {
  name: storageAccountName
}

resource functionAppPlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: functionAppPlanName
  location: location
  sku: {
    name: 'EP1'
    tier: 'ElasticPremium'
  }
  kind: 'elastic'
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2021-03-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
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
      acrUseManagedIdentityCreds: privateAcr ? true : false
      acrUserManagedIdentityID: privateAcr ? managedIdentityClientId : null
      linuxFxVersion: 'DOCKER|${acrUri}/ipam-func:latest'
      appSettings: [
        {
          name: 'AZURE_ENV'
          value: azureCloud
        }
        {
          name: 'COSMOS_URL'
          value: cosmosDbUri
        }
        {
          name: 'COSMOS_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/COSMOS-KEY/)'
        }
        {
          name: 'DATABASE_NAME'
          value: databaseName
        }
        {
          name: 'CONTAINER_NAME'
          value: containerName
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
          name: 'DOCKER_ENABLE_CI'
          value: 'true'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: privateAcr ? 'https://${privateAcrUri}' : 'https://index.docker.io/v1'
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
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
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

resource appConfigLogs 'Microsoft.Web/sites/config@2021-02-01' = {
  name: 'logs'
  parent: functionApp
  properties: {
    detailedErrorMessages: {
      enabled: true
    }
    failedRequestsTracing: {
      enabled: true
    }
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 7
        retentionInMb: 50
      }
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
    WorkspaceResourceId: workspaceId
  }
}

resource diagnosticSettingsPlan 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagSettings'
  scope: functionAppPlan
  properties: {
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
    ]
    workspaceId: workspaceId
  }
}

resource diagnosticSettingsApp 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagSettings'
  scope: functionApp
  properties: {
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false 
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
    ]
    workspaceId: workspaceId
  }
}

output functionAppHostName string = functionApp.properties.defaultHostName
