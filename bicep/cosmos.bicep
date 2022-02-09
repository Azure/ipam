
param cosmosAccountName string
param cosmosDbName string
param cosmosDbCollectionName string



resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2021-04-15' = {
  name: cosmosAccountName
  location: resourceGroup().location
  kind: 'MongoDB'
  properties: {
    apiProperties: {
      serverVersion: '4.0'
    }
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
      }
    }
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxStalenessPrefix: 100
      maxIntervalInSeconds: 5
    }
    locations: [
      {
        locationName: resourceGroup().location
        failoverPriority: 0
      }
    ]
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: true
    capabilities: [
      {
        name: 'EnableMongo'
      }
      {
        name: 'DisableRateLimitingResponses'
      }
    ]
  }
}

resource cosmosDB 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2021-06-15' = {
  name: '${cosmosAccount.name}/${cosmosDbName}'
  location: resourceGroup().location
  properties: {
    resource: {
      id: cosmosDbName
    }
  }
}

resource cosmosDBCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2021-06-15' ={
  name: '${cosmosDB.name}/${cosmosDbCollectionName}'
  location: resourceGroup().location
  properties: {
    options: {
      autoscaleSettings: {
        maxThroughput: 4000
      }
    }
    resource: {
      id: cosmosDbCollectionName
      shardKey: {
        tenant_id: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
      ]
    }
  }
}

output cosmosAccountId string = cosmosAccount.id
output cosmosAccountApiVersion string = cosmosAccount.apiVersion
