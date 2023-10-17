@description('KeyVault Name')
param keyVaultName string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity PrincipalId')
param principalId string

@description('AzureAD TenantId')
param tenantId string = subscription().tenantId

@description('IPAM-UI App Registration Client/App ID')
param uiAppId string

@description('IPAM-Engine App Registration Client/App ID')
param engineAppId string

@secure()
@description('IPAM-Engine App Registration Client Secret')
param engineAppSecret string

@description('Log Analytics Worskpace ID')
param workspaceId string

@description('Flag to Disable the IPAM UI')
param disableUi bool = false

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

resource uiId 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = if (!disableUi) {
  parent: keyVault
  name: 'UI-ID'
  properties: {
    value: uiAppId
  }
}

resource engineId 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'ENGINE-ID'
  properties: {
    value: engineAppId
  }
}

resource engineSecret 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'ENGINE-SECRET'
  properties: {
    value: engineAppSecret
  }
}

resource appTenant 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'TENANT-ID'
  properties: {
    value: tenantId
  }
}

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diagSettings'
  scope: keyVault
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
        retentionPolicy: {
          days: 0
          enabled: false
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
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

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
