targetScope = 'managementGroup'

@description('Display name for the IPAM UI App Registration.')
param uiAppName string = 'ipam-ui-app'

@description('AppId of the IPAM UI App Registration. Fill in this after first deployment!')
param uiAppId string = ''

@description('Display name for the IPAM Engine App Registration.')
param engineAppName string = 'ipam-engine-app'

@description('AppId of the IPAM Engine App Registration. Fill in this after first deployment!')
param engineAppId string = ''

@description('Flag to disable the IPAM UI.')
param disableUi bool = false

@description('Redirect URIs for the IPAM UI App Registration. Update this when the infrastructure is deployed!')
param uiAppRedirectUris string[] = ['https://replace-this-value.azurewebsites.net']

@description('Guid for the IPAM Engine API Permission.')
param engineAppApiPermissionGuid string = guid('myOrgNameHereForUniqueness')

@description('Management group IDs where the IPAM Engine will get Reader permissions. e.g. [\'alz-platform-connectivity\',\'alz-landingzones-corp\']')
param engineReaderRoleManagementGroupIds string[] = [tenant().tenantId]

@description('Azure cloud environment.')
@allowed([
  'AZURE_PUBLIC'
  'AZURE_US_GOV'
  'AZURE_US_GOV_SECRET'
  'AZURE_GERMANY'
  'AZURE_CHINA'
])
param azureCloud string = 'AZURE_PUBLIC'

var engineResourceMap = {
  AZURE_PUBLIC: {
    resourceAppId: '797f4846-ba00-4fd7-ba43-dac1f8f63013' // Azure Service Management
    resourceAccessIds: [
      { id: '41094075-9dad-400e-a0bd-54e686782033', type: 'Scope' } // user_impersonation
    ]
  }

  AZURE_US_GOV: {
    resourceAppId: '40a69793-8fe6-4db1-9591-dbc5c57b17d8' // Azure Service Management
    resourceAccessIds: [
      { id: '8eb49ffc-05ac-454c-9027-8648349217dd', type: 'Scope' } // user_impersonation
      { id: 'e59ee429-1fb1-4054-b99f-f542e8dc9b95', type: 'Scope' } // user_impersonation
    ]
  }

  AZURE_US_GOV_SECRET: {
    resourceAppId: '797f4846-ba00-4fd7-ba43-dac1f8f63013' // Azure Service Management
    resourceAccessIds: [
      { id: '41094075-9dad-400e-a0bd-54e686782033', type: 'Scope' } // user_impersonation
    ]
  }

  AZURE_GERMANY: {
    ResourceAppId: '797f4846-ba00-4fd7-ba43-dac1f8f63013' // Azure Service Management
    resourceAccessIds: [
      { id: '41094075-9dad-400e-a0bd-54e686782033', type: 'Scope' } // user_impersonation
    ]
  }

  AZURE_CHINA: {
    ResourceAppId: '797f4846-ba00-4fd7-ba43-dac1f8f63013' // Azure Service Management
    resourceAccessIds: [
      { id: '41094075-9dad-400e-a0bd-54e686782033', type: 'Scope' } // user_impersonation
    ]
  }
}

// Initialize the Graph provider / extension: https://github.com/Azure/bicep/issues/14374
provider microsoftGraph

// Get the Resource Id of the Graph resource in the tenant
resource graphSpn 'Microsoft.Graph/servicePrincipals@v1.0' existing = {
  appId: '00000003-0000-0000-c000-000000000000'
}

// Get the Resource Id of the Microsoft Azure Management / Azure Service Management resource in the tenant 
resource microsoftAzureManagementSpn 'Microsoft.Graph/servicePrincipals@v1.0' existing = {
  appId: '797f4846-ba00-4fd7-ba43-dac1f8f63013'
}

resource engineApp 'Microsoft.Graph/applications@v1.0' = if (!disableUi) {
  displayName: engineAppName
  uniqueName: engineAppName
  requiredResourceAccess: [
    {
      resourceAppId: engineResourceMap[azureCloud].resourceAppId
      resourceAccess: engineResourceMap[azureCloud].resourceAccessIds
    }
  ]
  identifierUris: empty(engineAppId) ? [] : ['api://${engineAppId}']
  api: {
    requestedAccessTokenVersion: 2
    knownClientApplications: disableUi || empty(uiAppId) ? [] : [uiAppId] // avoid sircular dependency
    oauth2PermissionScopes: [
      {
        adminConsentDescription: 'Allows the IPAM UI to access IPAM Engine API as the signed-in user.'
        adminConsentDisplayName: 'Access IPAM Engine API'
        id: engineAppApiPermissionGuid
        isEnabled: true
        type: 'User'
        userConsentDescription: 'Allow the IPAM UI to access IPAM Engine API on your behalf.'
        userConsentDisplayName: 'Access IPAM Engine API'
        value: 'access_as_user'
      }
    ]
    preAuthorizedApplications: [
      { delegatedPermissionIds: [engineAppApiPermissionGuid], appId: '1950a258-227b-4e31-a9cf-717495945fc2' } // Azure PowerShell
      { delegatedPermissionIds: [engineAppApiPermissionGuid], appId: '04b07795-8ddb-461a-bbee-02f9e1bf7b46' } // Azure CLI 
    ]
  }
}

resource engineSpn 'Microsoft.Graph/servicePrincipals@v1.0' = {
  appId: engineApp.appId
}

module roleAssignments 'br/public:avm/ptn/authorization/role-assignment:0.1.0' = [
  for mgId in engineReaderRoleManagementGroupIds: {
    name: guid(engineAppName, 'Reader', mgId)
    params: {
      principalId: engineSpn.id
      principalType: 'ServicePrincipal'
      roleDefinitionIdOrName: 'Reader'
      managementGroupId: mgId
    }
  }
]

resource uiApp 'Microsoft.Graph/applications@v1.0' = if (!disableUi) {
  displayName: uiAppName
  uniqueName: uiAppName
  spa: { redirectUris: uiAppRedirectUris }
  // web: { redirectUris: uiAppRedirectUris }
  requiredResourceAccess: [
    {
      resourceAppId: graphSpn.appId
      resourceAccess: [
        { id: '37f7f235-527c-4136-accd-4a02d197296e', type: 'Scope' } // openid 
        { id: '14dad69e-099b-42c9-810b-d002981feec1', type: 'Scope' } // profile
        { id: '7427e0e9-2fba-42fe-b0c0-848c9e6a8182', type: 'Scope' } // offline_access
        { id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', type: 'Scope' } // User.Read
        { id: '06da0dbc-49e2-44d2-8312-53f166ab848a', type: 'Scope' } // Directory.Read.All
      ]
    }
    {
      resourceAppId: engineApp.appId // opportunity for circular dependency
      resourceAccess: [
        { id: engineAppApiPermissionGuid, type: 'Scope' }
      ]
    }
  ]
}

resource uiSpn 'Microsoft.Graph/servicePrincipals@v1.0' = if (!disableUi) {
  appId: uiApp.appId
}

resource uiSpnGrantPermissionToMsGraphApi 'Microsoft.Graph/oauth2PermissionGrants@v1.0' = if (!disableUi) {
  clientId: uiSpn.id
  consentType: 'AllPrincipals'
  resourceId: graphSpn.id
  scope: 'openid profile offline_access User.Read Directory.Read.All'
}

resource uiSpnGrantPermissionToEngineApi 'Microsoft.Graph/oauth2PermissionGrants@v1.0' = if (!disableUi) {
  clientId: uiSpn.id
  consentType: 'AllPrincipals'
  resourceId: engineSpn.id
  scope: 'access_as_user'
}

resource engineSpnGrantPermissionToAzureServiceManagementApi 'Microsoft.Graph/oauth2PermissionGrants@v1.0' = {
  clientId: engineSpn.id
  consentType: 'AllPrincipals'
  resourceId: microsoftAzureManagementSpn.id
  scope: 'user_impersonation'
}

output uiAppId string = uiApp.appId
output engineAppId string = engineApp.appId
output engineAppIdentifierUris array = engineApp.identifierUris
output engineAppKnownClientApplications array = engineApp.api.knownClientApplications
