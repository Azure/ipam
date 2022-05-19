@description('Deployment Location')
param location string = resourceGroup().location

@description('Storage Account Name')
param storageAccountName string

@description('Blob Container Name')
param containerName string = 'nginx'

@description('Managed Identity PrincipalId')
param principalId string

@description('Managed Identity Id')
param managedIdentityId string

@description('Role Assignment GUID')
param roleAssignmentName string = newGuid()

var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var roleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-06-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
  }
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2021-06-01' = {
  name: '${storageAccount.name}/default/${containerName}'
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: roleAssignmentName
  scope: blobContainer
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: roleDefinitionId
    principalId: principalId
  }
}

resource exampleScript 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: 'exampleScript'
  location: location
  kind: 'AzurePowerShell'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    azPowerShellVersion: '7.5'
    timeout: 'PT1H'
    environmentVariables: [
      {
        name: 'StorageAccountName'
        value: storageAccount.name
      }
      {
        name: 'ContainerName'
        value: containerName
      }
      {
        name: 'ResourceGroup'
        value: resourceGroup().name
      }
    ]
    scriptContent: '''
      Invoke-WebRequest "https://raw.githubusercontent.com/Azure/ipam/init/default.conf" -OutFile ./default.conf
      $storageAccount = Get-AzStorageAccount -ResourceGroupName $Env:ResourceGroup -Name $Env:StorageAccountName
      $ctx = $storageAccount.Context
      $container = Get-AzStorageContainer -Name $Env:ContainerName -Context $ctx

      $NginxConfig = @{
        File             = "./default.conf"
        Container        = $Env:ContainerName
        Blob             = "default.conf"
        Context          = $ctx
        StandardBlobTier = "Hot"
      }

      Set-AzStorageBlobContent @NginxConfig
    '''
    cleanupPreference: 'Always'
    retentionInterval: 'PT1H'
  }
}

output name string = storageAccount.name
