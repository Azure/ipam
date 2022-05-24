@description('CosmosDB Account Name')
param cosmosAccountName string

@description('KeyVault Name')
param keyVaultName string

@description('Deployment Location')
param location string = resourceGroup().location

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2021-04-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: true
  }
}

resource cosmosKeySecret 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: '${keyVaultName}/COSMOS-KEY'
  properties: {
    value: cosmosAccount.listKeys().primaryMasterKey
  }
}

output cosmosDocumentEndpoint string = cosmosAccount.properties.documentEndpoint
