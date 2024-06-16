@description('App Service Name')
param appServiceName string

@description('App Service Plan Name')
param appServicePlanName string

@description('CosmosDB URI')
param cosmosDbUri string

@description('CosmosDB Database Name')
param databaseName string

@description('CosmosDB Container Name')
param containerName string

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

@description('Log Analytics Worskpace ID')
param workspaceId string

@description('Flag to Deploy IPAM as a Container')
param deployAsContainer bool = false

@description('Flag to Deploy Private Container Registry')
param privateAcr bool

@description('Uri for Private Container Registry')
param privateAcrUri string

// ACR Uri Variable
var acrUri = privateAcr ? privateAcrUri : 'azureipam.azurecr.io'

// Disable Build Process Internet-Restricted Clouds
var runFromPackage = azureCloud == 'AZURE_US_GOV_SECRET' ? true : false

// Current Python Version
var engineVersion = loadJsonContent('../../engine/app/version.json')
var pythonVersion = engineVersion.python

resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'P1v3'
    size: 'P1v3'
    tier: 'PremiumV3'
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
  kind: deployAsContainer ? 'app,linux,container' : 'app,linux'
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
      acrUseManagedIdentityCreds: privateAcr ? true : false
      acrUserManagedIdentityID: privateAcr ? managedIdentityClientId : null
      alwaysOn: true
      linuxFxVersion: deployAsContainer ? 'DOCKER|${acrUri}/ipam:latest' : 'PYTHON|${pythonVersion}'
      appCommandLine: !deployAsContainer ? 'bash ./init.sh 8000' : null
      healthCheckPath: '/api/status'
      appSettings: concat(
        [
          {
            name: 'AZURE_ENV'
            value: azureCloud
          }
          {
            name: 'COSMOS_URL'
            value: cosmosDbUri
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
            name: 'MANAGED_IDENTITY_ID'
            value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/IDENTITY-ID/)'
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
            name: 'ENGINE_APP_SECRET'
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
            name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES'
            value: '2'
          }
        ],
        deployAsContainer ? [
          {
            name: 'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
            value: 'true'
          }
          {
            name: 'DOCKER_REGISTRY_SERVER_URL'
            value: privateAcr ? 'https://${privateAcrUri}' : 'https://index.docker.io/v1'
          }
        ] : runFromPackage ? [
          {
            name: 'WEBSITE_RUN_FROM_PACKAGE'
            value: '1'
          }
        ] : [
          {
            name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
            value: 'true'
          }
        ]
      )
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

resource diagnosticSettingsPlan 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagSettings'
  scope: appServicePlan
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
  scope: appService
  properties: {
    logs: [
      {
        category: 'AppServiceAntivirusScanAuditLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServiceFileAuditLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServiceAuditLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServiceIPSecAuditLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
      {
        category: 'AppServicePlatformLogs'
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

output appServiceHostName string = appService.properties.defaultHostName
