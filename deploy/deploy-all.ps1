<#
[CmdletBinding()]
param (
  [Parameter()]
  [string]$Location = 'eastus',
  
  [Parameter()]
  [string]$IdentityTemplateFile = './identity/main.bicep',
  
  [Parameter()]
  [string]$IdentityTemplateParameterFile = './identity/main.bicepparam',
  
  [Parameter()]
  [string]$InfrastructureTemplateFile = './main.bicep',
  
  [Parameter()]
  [string]$InfrastructureTemplateParameterFile = './main.bicepparam',
  
  [Parameter()]
  [string]$SubscriptionIdForInfrastructureDeployment = '<change-me>',
  
  [Parameter()]
  [string]$ManagementGroupIdForIdentityDeployment = '<change-me>'
)
#>


# initial identity deployment
$splat = @{
  DeploymentName        = -join ('ipamIdentityDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
  Location              = 'eastus'
  TemplateFile          = './identity/main.bicep'
  TemplateParameterFile = './identity/main.bicepparam'
  WhatIf                = $false
  Verbose               = $false
  ManagementGroupId     = '<change-me>'
}
$identityDeplyment = New-AzManagementGroupDeployment @splat


# infrastructure deployment
$splat = @{
  DeploymentName        = -join ('ipamInfrastructureDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
  Location              = 'eastus'
  TemplateFile          = './main.bicep'
  TemplateParameterFile = './main.bicepparam'
  WhatIf                = $false
  Verbose               = $false
  # pass appIds from identity deployment
  uiAppId               = $identityDeplyment.Outputs.uiAppId.Value
  engineAppId           = $identityDeplyment.Outputs.engineAppId.Value
}
Select-AzSubscription -SubscriptionId '<change-me>'
$infrastructureDeployment = New-AzSubscriptionDeployment @splat


# full identity deployment
$splat = @{
  DeploymentName        = -join ('ipamIdentityDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
  Location              = 'eastus'
  TemplateFile          = './identity/main.bicep'
  TemplateParameterFile = './identity/main.bicepparam'
  WhatIf                = $false
  Verbose               = $false
  ManagementGroupId     = '<change-me>'
  # pass appIds & appServiceHostName from previous deployments
  uiAppId               = $identityDeplyment.Outputs.uiAppId.Value
  engineAppId           = $identityDeplyment.Outputs.engineAppId.Value
  uiAppRedirectUris     = @( $infrastructureDeployment.Outputs.appServiceHostName.Value )
}
New-AzManagementGroupDeployment @splat
