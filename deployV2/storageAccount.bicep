@description('Deployment Location')
param location string = resourceGroup().location

// @description('Blob Container Name')
// param containerName string = 'nginx'

// @description('Managed Identity Id')
// param managedIdentityId string

// @description('Managed Identity PrincipalId')
// param principalId string

// @description('Role Assignment GUID')
// param roleAssignmentName string = newGuid()

@description('Storage Account Name')
param storageAccountName string

@description('Log Analytics Workspace ID')
param workspaceId string

// @description('Flag to Deploy IPAM as a Function')
// param deployAsFunc bool

// var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
// var storageBlobDataContributorId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)

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

// resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2021-06-01' = if (!deployAsFunc) {
//   name: '${storageAccount.name}/default/${containerName}'
// }

// resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = if (!deployAsFunc) {
//   #disable-next-line use-stable-resource-identifiers
//   name: roleAssignmentName
//   scope: blobContainer
//   properties: {
//     principalType: 'ServicePrincipal'
//     roleDefinitionId: storageBlobDataContributorId
//     principalId: principalId
//   }
// }

// resource copyNginxConfig 'Microsoft.Resources/deploymentScripts@2020-10-01' = if (!deployAsFunc) {
//   name: 'copyNginxConfig'
//   location: location
//   kind: 'AzurePowerShell'
//   identity: {
//     type: 'UserAssigned'
//     userAssignedIdentities: {
//       '${managedIdentityId}': {}
//     }
//   }
//   properties: {
//     azPowerShellVersion: '7.5'
//     timeout: 'PT1H'
//     environmentVariables: [
//       {
//         name: 'StorageAccountName'
//         value: storageAccount.name
//       }
//       {
//         name: 'ContainerName'
//         value: containerName
//       }
//       {
//         name: 'ResourceGroup'
//         value: resourceGroup().name
//       }
//       {
//         name: 'DeployScript'
//         value: loadTextContent('../default.conf')
//       }
//     ]
//     scriptContent: '''
//       $Env:DeployScript | Out-File -FilePath ./default.conf
//       $storageAccount = Get-AzStorageAccount -ResourceGroupName $Env:ResourceGroup -Name $Env:StorageAccountName
//       $ctx = $storageAccount.Context
//       $container = Get-AzStorageContainer -Name $Env:ContainerName -Context $ctx

//       $NginxConfig = @{
//         File             = "./default.conf"
//         Container        = $Env:ContainerName
//         Blob             = "default.conf"
//         Context          = $ctx
//         StandardBlobTier = "Hot"
//       }

//       Set-AzStorageBlobContent @NginxConfig
//     '''
//     cleanupPreference: 'Always'
//     retentionInterval: 'PT1H'
//   }
// }

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
