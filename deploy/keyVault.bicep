@description('KeyVault Name')
param keyVaultName string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity PrincipalId')
param principalId string

@description('Service Principal ClientId')
@secure()
param spnClientId string

@description('Service Principal Secret')
@secure()
param spnSecret string

@description('AzureAD TenantId')
param tenantId string = subscription().tenantId

// KeyVault Secret Permissions Assigned to Managed Identity
var secretsPermissions = [
  'get'
]

resource keyVault 'Microsoft.KeyVault/vaults@2021-11-01-preview' = {
  name: keyVaultName
  location: location
  properties: {
    enablePurgeProtection: true
    tenantId: tenantId
    accessPolicies: [
      {
        objectId: principalId
        tenantId: tenantId
        permissions: {
          secrets: secretsPermissions
        }
      }
    ]
    sku: {
      name: 'standard'
      family: 'A'
    }
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource clientId 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'CLIENT-ID'
  properties: {
    value: spnClientId
  }
}

resource clientSecret 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'CLIENT-SECRET'
  properties: {
    value: spnSecret
  }
}

resource clientTenant 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'TENANT-ID'
  properties: {
    value: tenantId
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
