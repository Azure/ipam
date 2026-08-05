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
var acrUri = privateAcr ? privateAcrUri : 'registry.azureipam.com'

// Disable Build Process Internet-Restricted Clouds
var runFromPackage = azureCloud == 'AZURE_US_GOV_SECRET' ? true : false

// Current Python Version
var engineVersion = loadJsonContent('../../engine/app/version.json')
var pythonVersion = engineVersion.python

// Shared App Service site configuration (reused by the production site and the staging slot)
var appServiceSiteConfig = {
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
    ] : runFromPackage ? [
      {
        name: 'WEBSITE_RUN_FROM_PACKAGE'
        value: '1'
      }
      // Sovereign cloud roots are absent from the default trust store
      {
        name: 'WEBSITES_INCLUDE_CLOUD_CERTS'
        value: 'true'
      }
    ] : [
      {
        name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
        value: 'true'
      }
    ]
  )
}

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
    siteConfig: appServiceSiteConfig
  }
}

// Staging slot (created dormant; started on demand for slot-based upgrades/swaps)
resource appServiceStagingSlot 'Microsoft.Web/sites/slots@2021-02-01' = {
  name: 'staging'
  parent: appService
  location: location
  kind: deployAsContainer ? 'app,linux,container' : 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    enabled: false
    httpsOnly: true
    serverFarmId: appServicePlan.id
    keyVaultReferenceIdentity: managedIdentityId
    siteConfig: appServiceSiteConfig
  }
}

resource appServiceLogs 'Microsoft.Web/sites/config@2021-02-01' = {
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

resource appServiceStagingSlotLogs 'Microsoft.Web/sites/slots/config@2021-02-01' = {
  name: 'logs'
  parent: appServiceStagingSlot
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
output appServiceStagingSlotHostName string = appServiceStagingSlot.properties.defaultHostName
