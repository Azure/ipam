@description('KeyVault Name')
param keyVaultName string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity PrincipalId')
param identityPrincipalId string

@description('Managed Identity ClientId')
param identityClientId string

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

var keyVaultUser = '4633458b-17de-408a-b874-0445c86b69e6'
var keyVaultUserId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultUser)
var keyVaultUserRoleAssignmentId = guid(keyVaultUser, identityPrincipalId, keyVault.id)

resource keyVault 'Microsoft.KeyVault/vaults@2021-11-01-preview' = {
  name: keyVaultName
  location: location
  properties: {
    enablePurgeProtection: true
    enableRbacAuthorization: true
    tenantId: tenantId
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

resource identityId 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
  parent: keyVault
  name: 'IDENTITY-ID'
  properties: {
    value: identityClientId
  }
}

resource uiId 'Microsoft.KeyVault/vaults/secrets@2021-11-01-preview' = {
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

resource keyVaultUserAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: keyVaultUserRoleAssignmentId
  scope: keyVault
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultUserId
    principalId: identityPrincipalId
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
