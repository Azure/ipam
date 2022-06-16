@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity Id')
param managedIdentityId string

@description('API Scope for Access Token')
param ipamApiScope string

@description('API Scope for Access Token')
param ipamEndpoint string

@description('IPAM Space')
param ipamSpace string

@description('IPAM Space')
param ipamBlock string

var ipamUrl = '${ipamEndpoint}/api/spaces/${ipamSpace}/blocks/${ipamBlock}/reservations'

resource fetchNetworkPrefix 'Microsoft.Resources/deploymentScripts@2020-10-01' = {
  name: 'fetchNetworkPrefix'
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
        name: 'IPAM_API_SCOPE'
        value: ipamApiScope
      }
      {
        name: 'IPAM_URL'
        value: ipamUrl
      }
    ]
    scriptContent: '''
      $accessToken = ConvertTo-SecureString (Get-AzAccessToken -ResourceUrl $Env:IPAM_API_SCOPE).Token -AsPlainText
 
      $body = @{
          'size' = 16
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
