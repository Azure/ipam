@description('Deployment Location')
param location string = resourceGroup().location

@description('Storage Account Name')
param storageAccountName string

@description('Log Analytics Workspace ID')
param workspaceId string

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
  }
}

resource blob 'Microsoft.Storage/storageAccounts/blobServices@2021-09-01' existing = {
 name: 'default'
 parent: storageAccount
}

resource diagnosticSettingsAccount 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagSettingsAccount'
  scope: storageAccount
  properties: {
    metrics: [
      {
        category: 'Transaction'
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

resource diagnosticSettingsBlob 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagSettingsBlob'
  scope: blob
  properties: {
    logs: [
      {
        category: 'StorageRead'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false 
        }
      }
      {
        category: 'StorageWrite'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false 
        }
      }
      {
        category: 'StorageDelete'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false 
        }
      }
    ]
    metrics: [
      {
        category: 'Transaction'
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

output name string = storageAccount.name
