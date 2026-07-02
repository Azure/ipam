@description('App Service Name (existing production site)')
param appServiceName string

@description('App Service Plan Resource ID')
param appServicePlanId string

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

@description('Whether the app authenticates to ACR with a managed identity (mirrored from production)')
param acrUseManagedIdentity bool = false

@description('Flag to Run from Package (build-restricted clouds)')
param runFromPackage bool = false

@description('Current production LinuxFxVersion (runtime stack / container image) to mirror onto the slot')
param linuxFxVersion string

@description('Replicate production VNet integration onto the slot (set false to create a bare slot)')
param replicateVnet bool = true

// Existing production site (never modified by this template)
resource appService 'Microsoft.Web/sites@2022-03-01' existing = {
  name: appServiceName
}

// Live production app settings, read at deploy time to preserve any user-added extras
var liveAppSettings = list('${appService.id}/config/appsettings', '2022-03-01').properties

// Canonical baseline keys that Azure IPAM owns and enforces.
// IMPORTANT: keep in sync with deploy/modules/appService.bicep (appServiceSiteConfig).
// Any user settings beyond these keys are preserved via the union() below.
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
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES: '2'
  },
  deployAsContainer
    ? {
        WEBSITE_ENABLE_SYNC_UPDATE_SITE: 'true'
        DOCKER_REGISTRY_SERVER_URL: privateAcr ? 'https://${privateAcrUri}' : 'https://index.docker.io/v1'
      }
    : runFromPackage
        ? {
            WEBSITE_RUN_FROM_PACKAGE: '1'
          }
        : {
            SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
          }
)

// Merge: enforce baseline key PRESENCE only. Live values ALWAYS win; the canonical
// baseline only backfills baseline keys that are entirely MISSING. This never overwrites
// values users have customized over time (e.g. version-pinned Key Vault secret references).
var mergedSettings = union(canonicalBaseline, liveAppSettings)

// Replicate user VNet integration (regional) onto the slot, if present on production
var prodSubnetId = appService.properties.?virtualNetworkSubnetId ?? ''

// Staging slot (created dormant; started on demand for slot-based upgrades/swaps)
resource appServiceStagingSlot 'Microsoft.Web/sites/slots@2022-03-01' = {
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
    serverFarmId: appServicePlanId
    keyVaultReferenceIdentity: managedIdentityId
    virtualNetworkSubnetId: (replicateVnet && !empty(prodSubnetId)) ? prodSubnetId : null
    siteConfig: {
      acrUseManagedIdentityCreds: acrUseManagedIdentity
      acrUserManagedIdentityID: acrUseManagedIdentity ? managedIdentityClientId : null
      alwaysOn: true
      linuxFxVersion: linuxFxVersion
      appCommandLine: !deployAsContainer ? 'bash ./init.sh 8000' : null
      healthCheckPath: '/api/status'
    }
  }
}

// Merged app settings (object map) applied via the dedicated appsettings config
resource appServiceStagingSlotAppSettings 'Microsoft.Web/sites/slots/config@2022-03-01' = {
  name: 'appsettings'
  parent: appServiceStagingSlot
  properties: mergedSettings
}

resource appServiceStagingSlotLogs 'Microsoft.Web/sites/slots/config@2022-03-01' = {
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

output stagingSlotHostName string = appServiceStagingSlot.properties.defaultHostName
output vnetReplicated bool = replicateVnet && !empty(prodSubnetId)
