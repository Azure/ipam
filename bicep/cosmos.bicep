param cosmosAccountName string
param cosmosDbName string
param cosmosDbContainerName string
param keyVaultName string
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

resource cosmosDB 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2021-06-15' = {
  name: '${cosmosAccount.name}/${cosmosDbName}'
  location: location
  properties: {
    resource: {
      id: cosmosDbName
    }
  }
}

resource cosmosDBCollection 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2021-06-15' = {
  name: '${cosmosDB.name}/${cosmosDbContainerName}'
  location: location
  properties: {
    resource: {
      id: cosmosDbContainerName
      partitionKey: {
        paths: [
          '/id'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

resource secret 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  name: '${keyVaultName}/cosmos-db-key'
  properties: {
    value: cosmosAccount.listKeys().primaryMasterKey
  }
}

output cosmosDocumentEndpoint string = cosmosAccount.properties.documentEndpoint
