param appServicePlanName string
param location string = resourceGroup().location
param containerRegistryloginServer string
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
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistryloginServer}/ipam/ipamapp:latest'
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: managedIdentityClientId
      appSettings: [
        {
          name: 'DOCKER_ENABLE_CI'
          value: 'true'
        }
      ]
    }
  }
}

output appServiceHostName string = appService.properties.defaultHostName
