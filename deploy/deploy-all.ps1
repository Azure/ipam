[CmdletBinding()]
param (
  [Parameter()]
  [ValidateScript(
    { (Get-AzLocation).Location -contains $_ },
    ErrorMessage = "{0} is not a valid Azure Region."
  )]
  [string]
  $Location = 'eastus',

  <#[Parameter()]
  [ValidateSet(
    'AppServiceZip',
    'AppServiceContainer',
    'FunctionZip',
    'FunctionContainer'
  )]
  [string]
  $Architecture = 'AppServiceContainer',
  #>

  [Parameter()]
  [ValidateScript(
    { (Test-Path $_ -PathType Leaf) -and ($_.EndsWith('.bicep')) },
    ErrorMessage = "{0} is not an existing .bicep file."
  )]
  [string]
  $IdentityTemplateFile = './identity/main.bicep',

  [Parameter()]
  [ValidateScript(
    { (Test-Path $_ -PathType Leaf) -and ($_.EndsWith('.bicepparam')) },
    ErrorMessage = "{0}  is not an existing .bicepparam file."
  )]
  [string]
  $IdentityParameterFile = './identity/main.bicepparam',

  [Parameter()]
  [ValidateScript(
    { (Test-Path $_ -PathType Leaf) -and ($_.EndsWith('.bicep')) },
    ErrorMessage = "{0} is not an existing .bicep file."
  )]
  [string]
  $InfrastructureTemplateFile = './main.bicep',

  [Parameter()]
  [ValidateScript(
    { (Test-Path $_ -PathType Leaf) -and ($_.EndsWith('.bicepparam')) },
    ErrorMessage = "{0} is not an existing .bicepparam file."
  )]
  [string]
  $InfrastructureParameterFile = './main.bicepparam',

  [Parameter()]
  [ValidateNotNullOrWhiteSpace()]
  [string]
  $SubscriptionIdForInfrastructureDeployment = (Get-AzContext).Subscription.Id,

  [Parameter()]
  [ValidateNotNullOrWhiteSpace()]
  [string]
  $ManagementGroupIdForIdentityDeployment = (Get-AzContext).Tenant.Id,

  [Parameter()]
  [bool]
  $IncludeIdentities = $true,

  [Parameter()]
  [bool]
  $IncludeInfrastructure = $true
)

begin {
  # Set preference variables
  $ErrorActionPreference = "Stop"
  $ProgressPreference = 'SilentlyContinue'

  # Check for Debug Flag
  $DEBUG_MODE = [bool]$PSCmdlet.MyInvocation.BoundParameters["Debug"].IsPresent
  
  # Hide Azure PowerShell SDK Warnings
  $Env:SuppressAzurePowerShellBreakingChangeWarnings = $true

  # Hide Azure PowerShell SDK & Azure CLI Survey Prompts
  $Env:AzSurveyMessage = $false
  $Env:AZURE_CORE_SURVEY_MESSAGE = $false
} # begin


process {

  # initial identity deployment
  if ($IncludeIdentities) {
    $identityDeploySplat = @{
      DeploymentName        = -join ('ipamIdentityDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
      Location              = $Location
      TemplateFile          = $IdentityTemplateFile
      TemplateParameterFile = $IdentityParameterFile
      WhatIf                = $false
      Verbose               = $DEBUG_MODE
      ManagementGroupId     = $ManagementGroupIdForIdentityDeployment
    }

    $identityDeplyment = New-AzManagementGroupDeployment @identityDeploySplat
  }


  # infrastructure deployment
  if ($IncludeInfrastructure) {
    $infrastructureDeploySplat = @{
      DeploymentName        = -join ('ipamInfrastructureDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
      Location              = $Location
      TemplateFile          = $InfrastructureTemplateFile
      TemplateParameterFile = $InfrastructureParameterFile
      WhatIf                = $false
      Verbose               = $DEBUG_MODE
    }

    # include appIds from identity deployment if it was included
    if ($IncludeIdentities) {
      $infrastructureDeploySplat.Add('uiAppId', $identityDeplyment.Outputs.uiAppId.Value)
      $infrastructureDeploySplat.Add('engineAppId', $identityDeplyment.Outputs.engineAppId.Value)
    }

    Select-AzSubscription -SubscriptionId $SubscriptionIdForInfrastructureDeployment
    $infrastructureDeployment = New-AzSubscriptionDeployment @infrastructureDeploySplat
  }


  # full identity deployment
  if ($IncludeIdentities) {
    $identityDeploySplat = @{
      DeploymentName        = -join ('ipamIdentityDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
      Location              = $Location
      TemplateFile          = $IdentityTemplateFile
      TemplateParameterFile = $IdentityParameterFile
      WhatIf                = $false
      Verbose               = $DEBUG_MODE
      ManagementGroupId     = $ManagementGroupIdForIdentityDeployment
      # pass appIds & appServiceHostName from previous deployment
      uiAppId               = $identityDeplyment.Outputs.uiAppId.Value
      engineAppId           = $identityDeplyment.Outputs.engineAppId.Value
    }

    # include uiAppRedirectUris from infrastructure deployment if it was included
    if ($IncludeInfrastructure) {
      $identityDeploySplat.Add('uiAppRedirectUris', @( $infrastructureDeployment.Outputs.appServiceHostName.Value ))
    }

    $identityDeplyment = New-AzManagementGroupDeployment @identityDeploySplat
  }


  if ($IncludeInfrastructure -and $infrastructureDeployment.Outputs.acrName.Value.Length -gt 1) {
    # az acr build
  }


  if ($IncludeInfrastructure -and [bool]$infrastructureDeployment.Outputs.zipDeployNeeded.Value) {
    # archive and publish .zip
  }

} # process

end {

} # end