@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity Resource Id')
param managedIdentityId string

@description('Managed Identity Principal Id')
param managedIdentityPrincipalId string

@description('API Scope for Access Token')
param ipamApiScope string

@description('Azure IPAM Endpoint')
param ipamEndpoint string

@description('IPAM Space')
param ipamSpace string

@description('IPAM Block')
param ipamBlock string

@description('Reservation size as a CIDR mask (e.g. 24 for a /24)')
param reservationSize int

var ipamUrl = '${ipamEndpoint}/api/spaces/${ipamSpace}/blocks/${ipamBlock}/reservations'

// The deployment script service requires the identity to have Contributor
// on the resource group where the script runs (for storage and container instance management).
// See: https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-script-bicep
var contributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b24988ac-6180-42a0-ab88-20f7382dd24c'
)

resource contributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, managedIdentityPrincipalId, contributorRoleId)
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorRoleId
    principalId: managedIdentityPrincipalId
  }
}

resource fetchNetworkPrefix 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'fetchNetworkPrefix'
  location: location
  kind: 'AzurePowerShell'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  dependsOn: [
    contributorAssignment
  ]
  properties: {
    azPowerShellVersion: '14.0'
    timeout: 'PT1H'
    environmentVariables: [
      {
        name: 'IPAM_API_SCOPE'
        value: ipamApiScope
      }
      {
        name: 'IPAM_URL'
        value: ipamUrl
      }
      {
        name: 'RESERVATION_SIZE'
        value: string(reservationSize)
      }
    ]
    scriptContent: '''
      $accessToken = (Get-AzAccessToken -ResourceUrl $Env:IPAM_API_SCOPE).Token

      if ($accessToken -isnot [System.Security.SecureString]) {
        $accessToken = ConvertTo-SecureString $accessToken -AsPlainText -Force
      }

      $body = @{
          'size' = [int]$Env:RESERVATION_SIZE
      } | ConvertTo-Json

      $headers = @{
        'Accept' = 'application/json'
        'Content-Type' = 'application/json'
      }

      $response = Invoke-RestMethod `
        -Method 'Post' `
        -Uri $Env:IPAM_URL `
        -Authentication 'Bearer' `
        -Token $accessToken `
        -Headers $headers `
        -Body $body

      $DeploymentScriptOutputs = @{}
      $DeploymentScriptOutputs['cidr'] = $response.cidr
      $DeploymentScriptOutputs['reservationId'] = $response.id
    '''
    cleanupPreference: 'Always'
    retentionInterval: 'PT1H'
  }
}

output addressPrefix string = fetchNetworkPrefix.properties.outputs.cidr
output reservationId string = fetchNetworkPrefix.properties.outputs.reservationId
