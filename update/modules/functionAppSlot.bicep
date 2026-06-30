@description('Function App Name (existing production site)')
param functionAppName string

@description('Function App Plan Resource ID')
param functionPlanId string

@description('Managed Identity Id')
param managedIdentityId string

@description('Managed Identity ClientId')
param managedIdentityClientId string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Azure Cloud Enviroment')
param azureCloud string = 'AZURE_PUBLIC'

@description('CosmosDB URI')
param cosmosDbUri string

@description('CosmosDB Database Name')
param databaseName string

@description('CosmosDB Container Name')
param containerName string

@description('KeyVault URI')
param keyVaultUri string

@description('Flag to Deploy IPAM as a Container')
param deployAsContainer bool

@description('Flag to Deploy Private Container Registry')
param privateAcr bool

@description('Uri for Private Container Registry')
param privateAcrUri string

@description('Flag to Run from Package (build-restricted clouds)')
param runFromPackage bool = false

@description('Current production LinuxFxVersion (runtime stack / container image) to mirror onto the slot')
param linuxFxVersion string

@description('Replicate production VNet integration onto the slot (set false to create a bare slot)')
param replicateVnet bool = true

// Existing production site (never modified by this template)
resource functionApp 'Microsoft.Web/sites@2022-03-01' existing = {
  name: functionAppName
}

// Live production app settings, read at deploy time to preserve user-added extras
// AND deployment-owned secrets (storage connection string, content share, App Insights key)
var liveAppSettings = list('${functionApp.id}/config/appsettings', '2022-03-01').properties

// Canonical baseline keys that Azure IPAM owns and enforces.
// IMPORTANT: keep in sync with deploy/modules/functionApp.bicep (functionAppSiteConfig).
// Storage/content-share/App Insights settings are intentionally NOT enforced here; they are
// preserved as-is from the live site. Any user settings beyond these keys are also preserved.
var canonicalBaseline = union(
  {
    AZURE_ENV: azureCloud
    COSMOS_URL: cosmosDbUri
    DATABASE_NAME: databaseName
    CONTAINER_NAME: containerName
    MANAGED_IDENTITY_ID: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/IDENTITY-ID/)'
    UI_APP_ID: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/UI-ID/)'
    ENGINE_APP_ID: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-ID/)'
    ENGINE_APP_SECRET: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-SECRET/)'
    TENANT_ID: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/TENANT-ID/)'
    KEYVAULT_URL: keyVaultUri
    FUNCTIONS_EXTENSION_VERSION: '~4'
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES: '2'
  },
  deployAsContainer
    ? {
        DOCKER_REGISTRY_SERVER_URL: privateAcr ? 'https://${privateAcrUri}' : 'https://index.docker.io/v1'
        WEBSITES_ENABLE_APP_SERVICE_STORAGE: 'false'
      }
    : runFromPackage
        ? {
            FUNCTIONS_WORKER_RUNTIME: 'python'
            WEBSITE_RUN_FROM_PACKAGE: '1'
          }
        : {
            FUNCTIONS_WORKER_RUNTIME: 'python'
            SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
          }
)

// Merge: enforce baseline key PRESENCE only. Live values ALWAYS win; the canonical
// baseline only backfills baseline keys that are entirely MISSING. This never overwrites
// values users have customized over time (e.g. version-pinned Key Vault secret references).
var mergedSettings = union(canonicalBaseline, liveAppSettings)

// Replicate user VNet integration (regional) onto the slot, if present on production
var prodSubnetId = functionApp.properties.?virtualNetworkSubnetId ?? ''

// Staging slot (created dormant; started on demand for slot-based upgrades/swaps)
resource functionAppStagingSlot 'Microsoft.Web/sites/slots@2022-03-01' = {
  name: 'staging'
  parent: functionApp
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    enabled: false
    httpsOnly: true
    serverFarmId: functionPlanId
    keyVaultReferenceIdentity: managedIdentityId
    virtualNetworkSubnetId: (replicateVnet && !empty(prodSubnetId)) ? prodSubnetId : null
    siteConfig: {
      acrUseManagedIdentityCreds: privateAcr ? true : false
      acrUserManagedIdentityID: privateAcr ? managedIdentityClientId : null
      linuxFxVersion: linuxFxVersion
      healthCheckPath: '/api/status'
    }
  }
}

// Merged app settings (object map) applied via the dedicated appsettings config
resource functionAppStagingSlotAppSettings 'Microsoft.Web/sites/slots/config@2022-03-01' = {
  name: 'appsettings'
  parent: functionAppStagingSlot
  properties: mergedSettings
}

resource functionAppStagingSlotLogs 'Microsoft.Web/sites/slots/config@2022-03-01' = {
  name: 'logs'
  parent: functionAppStagingSlot
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

// Mark content-share settings as slot-sticky so a future swap never crosses the file share
resource functionAppSlotConfigNames 'Microsoft.Web/sites/config@2022-03-01' = {
  name: 'slotConfigNames'
  parent: functionApp
  properties: {
    appSettingNames: [
      'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
      'WEBSITE_CONTENTSHARE'
    ]
  }
}

output stagingSlotHostName string = functionAppStagingSlot.properties.defaultHostName
output vnetReplicated bool = replicateVnet && !empty(prodSubnetId)
