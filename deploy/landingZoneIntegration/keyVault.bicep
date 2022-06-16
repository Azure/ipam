@description('KeyVault Name')
param keyVaultName string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity PrincipalId')
param principalId string

@description('AzureAD TenantId')
param tenantId string = subscription().tenantId

resource keyVault 'Microsoft.KeyVault/vaults@2021-11-01-preview' = {
  name: keyVaultName
  location: location
  properties: {
    accessPolicies: [
      {
        objectId: principalId
        tenantId: tenantId
        permissions: {
          certificates: [
            'get'
            'list'
            'update'
            'create'
            'import'
            'delete'
            'recover'
            'deleteissuers'
            'managecontacts'
            'manageissuers'
            'getissuers'
            'listissuers'
            'setissuers'
          ]
          keys: [
            'get'
            'list'
            'update'
            'create'
            'import'
            'delete'
            'recover'
            'backup'
            'restore'
          ]
          secrets: [
            'get'
            'list'
            'set'
            'delete'
            'recover'
            'backup'
            'restore'
          ]
        }
      }
    ]
    createMode: 'default'
    enabledForDeployment: true
    enabledForDiskEncryption: true
    enabledForTemplateDeployment: true
    enablePurgeProtection: true
    enableSoftDelete: true
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
    sku: {
      name: 'premium'
      family: 'A'
    }
    tenantId: tenantId
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
