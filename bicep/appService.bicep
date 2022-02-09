param appServicePlanName string
param cosmosAccountApiVersion string
param cosmosAccountId string
param cosmosAccountName string
param managedIdentityId string
param websiteName string

resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: appServicePlanName
  location: resourceGroup().location
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
  location: resourceGroup().location
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.9'
      appCommandLine: 'gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app'
      connectionStrings: [
        {
          connectionString: listConnectionStrings(cosmosAccountId, cosmosAccountApiVersion).connectionStrings[0].connectionString
          name: cosmosAccountName
          type: 'DocDb'
        }
      ]
    }
  }
}

output appServiceHostName string = appService.properties.defaultHostName
