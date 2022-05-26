@description('App Service Name')
param appServiceName string

@description('App Service Plan Name')
param appServicePlanName string

@description('CosmosDB URI')
param cosmosDbUri string

@description('KeyVault URI')
param keyVaultUri string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity ClientId')
param managedIdentityClientId string

@description('Managed Identity Id')
param managedIdentityId string

@description('Storage Account Name')
param storageAccountName string

var dockerCompose = loadFileAsBase64('../docker-compose.prod.yml')

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' existing = {
  name: storageAccountName
}

resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource appService 'Microsoft.Web/sites@2021-02-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    httpsOnly: true
    serverFarmId: appServicePlan.id
    keyVaultReferenceIdentity: managedIdentityId
    siteConfig: {
      linuxFxVersion: 'COMPOSE|${dockerCompose}'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: managedIdentityClientId
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
          name: 'UI_APP_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/UI-ID/)'
        }
        {
          name: 'ENGINE_APP_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-ID/)'
        }
        {
          name: 'ENGINE_SECRET'
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
          value: 'https://index.docker.io/v1'
        }
        {
          name: 'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
          value: 'true'
        }
      ]
      azureStorageAccounts: {
        nginx: {
          type: 'AzureBlob'
          accountName: storageAccountName
          shareName: 'nginx'
          mountPath: '/nginx'
          accessKey: listkeys(storageAccount.id, storageAccount.apiVersion).keys[0].value
        }
      }
    }
  }
}

resource appConfigLogs 'Microsoft.Web/sites/config@2021-02-01' = {
  name: 'logs'
  parent: appService
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

output appServiceHostName string = appService.properties.defaultHostName
