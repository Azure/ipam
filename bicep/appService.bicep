param appServicePlanName string
param location string = resourceGroup().location
param containerRegistryloginServer string
param cosmosDbContainerName string
param cosmosDbName string
param cosmosDocumentEndpoint string
param keyVaultUri string
param managedIdentityClientId string
param managedIdentityId string
param websiteName string

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
  name: websiteName
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
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistryloginServer}/ipam/ipamapp:latest'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: managedIdentityClientId
      appSettings: [
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosDocumentEndpoint
        }
        {
          name: 'COSMOS_DB'
          value: cosmosDbName
        }
        {
          name: 'COSMOS_CONTAINER'
          value: cosmosDbContainerName
        }
        {
          name: 'COSMOS_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}cosmosKey/)'
        }
        {
          name: 'DOCKER_ENABLE_CI'
          value: 'true'
        }
        {
          name: 'SPN_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}spnId/)'
        }
        {
          name: 'SPN_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}spnSecret/)'
        }
        {
          name: 'SPN_TENANT'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}spnTenant/)'
        }
        {
          name: 'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
          value: 'true'
        }
      ]
    }
  }
}

output appServiceHostName string = appService.properties.defaultHostName
