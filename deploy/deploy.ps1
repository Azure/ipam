###############################################################################################################
##
## Azure IPAM Solution Deployment Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="7.5.0"}
#Requires -Modules @{ ModuleName="Microsoft.Graph"; ModuleVersion="1.9.6"}

# Intake and set global parameters
[CmdletBinding(DefaultParameterSetName = 'Full')]
param(
  [Parameter(Mandatory = $true,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $true,
    ParameterSetName = 'TemplateOnly')]
  [string]
  $Location,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [string]
  $UIAppName = 'ipam-ui-app',

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [string]
  $EngineAppName = 'ipam-engine-app',

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [string]
  $NamePrefix,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [hashtable]
  $Tags,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [switch]
  $TemplateOnly,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [switch]
  $AppsOnly,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [switch]
  $NoConsent,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [switch]
  $SubscriptionScope,

  [Parameter(Mandatory = $false,
  ParameterSetName = 'TemplateOnly')]
  [Parameter(Mandatory = $false,
  ParameterSetName = 'Full')]
  [switch]
  $DeployAcr,

  [Parameter(Mandatory = $true,
    ParameterSetName = 'TemplateOnly')]
  [ValidateScript({
    if(-Not ($_ | Test-Path) ){
      throw "File or does not exist."
    }
    if(-Not ($_ | Test-Path -PathType Leaf) ){
      throw "The ParameterFile argument must be a file, folder paths are not allowed."
    }
    if($_ -notmatch "(\.json)"){
      throw "The file specified in the ParameterFile argument must be of type json."
    }
    return $true 
  })]
  [System.IO.FileInfo]$ParameterFile
)

# Set preference variables
$ErrorActionPreference = "Stop"

# Hide Azure PowerShell SDK Warnings
$Env:SuppressAzurePowerShellBreakingChangeWarnings = $true

# Set Log File Location
$logFile = "./deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"

Function Test-Location {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$Location
  )

  $validLocations = Get-AzLocation | Select-Object -ExpandProperty Location

  return $validLocations.Contains($Location)
}

Function Deploy-IPAMApplications {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$EngineAppName,
    [Parameter(Mandatory=$true)]
    [string]$UIAppName,
    [Parameter(Mandatory=$true)]
    [string]$TenantId,
    [Parameter(Mandatory=$false)]
    [bool]$SubscriptionScope
  ) 

  $uiResourceAccess = [System.Collections.ArrayList]@(
    @{
      ResourceAppId = "00000003-0000-0000-c000-000000000000"; # Microsoft Graph
      ResourceAccess = @(
        @{
          Id = "37f7f235-527c-4136-accd-4a02d197296e"; # openid
          Type = "Scope"
        },
        @{
          Id = "14dad69e-099b-42c9-810b-d002981feec1"; # profile
          Type = "Scope"
        },
        @{
          Id = "7427e0e9-2fba-42fe-b0c0-848c9e6a8182"; # offline_access
          Type = "Scope"
        },
        @{
          Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"; # User.Read
          Type = "Scope"
        },
        @{
          Id = "06da0dbc-49e2-44d2-8312-53f166ab848a"; # Directory.Read.All
          Type = "Scope"
        }
      )
    }
  )

  $uiWebSettings = @{
    ImplicitGrantSetting = @{
      EnableAccessTokenIssuance = $true
      EnableIdTokenIssuance = $true
    }
  }

  # Create IPAM UI Application
  Write-Host "INFO: Creating Azure IPAM UI Application" -ForegroundColor green
  Write-Verbose -Message "Creating Azure IPAM UI Application"
  $uiApp = New-AzADApplication `
    -DisplayName $UiAppName `
    -SPARedirectUri "https://replace-this-value.azurewebsites.net" `
    -Web $uiWebSettings

  $engineResourceAccess = [System.Collections.ArrayList]@(
    @{
      ResourceAppId = "797f4846-ba00-4fd7-ba43-dac1f8f63013"; # Azure Service Management
      ResourceAccess = @(
        @{
          Id = "41094075-9dad-400e-a0bd-54e686782033"; # user_impersonation
          Type = "Scope"
        }
      )
    }
  )

  $engineApiGuid = New-Guid

  $engineApiSettings = @{
    KnownClientApplication = @(
      $uiApp.AppId
    )
    Oauth2PermissionScope = @(
      @{ 
        AdminConsentDescription = "Allows the IPAM UI to access IPAM Engine API as the signed-in user."
        AdminConsentDisplayName = "Access IPAM Engine API"
        Id = $engineApiGuid
        IsEnabled = $true
        Type = "User"
        UserConsentDescription = "Allow the IPAM UI to access IPAM Engine API on your behalf."
        UserConsentDisplayName = "Access IPAM Engine API"
        Value = "access_as_user"
      }
    )
    # PreAuthorizedApplication = @(
    #   @{
    #     AppId = "1950a258-227b-4e31-a9cf-717495945fc2" # Azure PowerShell
    #     DelegatedPermissionId = @( $engineApiGuid )
    #   },
    #   @{
    #     AppId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46" # Azure CLI
    #     DelegatedPermissionId = @( $engineApiGuid )
    #   }
    # )
    RequestedAccessTokenVersion = 2
  }

  # Create IPAM Engine Application
  Write-Host "INFO: Creating Azure IPAM Engine Application" -ForegroundColor green
  Write-Verbose -Message "Creating Azure IPAM Engine Application"
  $engineApp = New-AzADApplication `
    -DisplayName $EngineAppName `
    -Api $engineApiSettings `
    -RequiredResourceAccess $engineResourceAccess

  # Update IPAM Engine API endpoint
  Write-Host "INFO: Updating Azure IPAM Engine API Endpoint" -ForegroundColor green
  Write-Verbose -Message "Updating Azure IPAM UI Engine API Endpoint"
  Update-AzADApplication -ApplicationId $engineApp.AppId -IdentifierUri "api://$($engineApp.AppId)"

  $uiEngineApiAccess =@{
    ResourceAppId = $engineApp.AppId
    ResourceAccess = @(
      @{
        Id = $engineApiGuid
        Type = "Scope"
      }
    )
  }

  $uiResourceAccess.Add($uiEngineApiAccess) | Out-Null

  # Update IPAM UI Application Resource Access
  Write-Host "INFO: Updating Azure IPAM UI Application Resource Access" -ForegroundColor green
  Write-Verbose -Message "Updating Azure IPAM UI Application Resource Access"
  Update-AzADApplication -ApplicationId $uiApp.AppId -RequiredResourceAccess $uiResourceAccess

  $uiObject = Get-AzADApplication -ApplicationId $uiApp.AppId
  $engineObject = Get-AzADApplication -ApplicationId $engineApp.AppId

  # Create IPAM UI Service Principal
  Write-Host "INFO: Creating Azure IPAM UI Service Principal" -ForegroundColor green
  Write-Verbose -Message "Creating Azure IPAM UI Service Principal"
  New-AzADServicePrincipal -ApplicationObject $uiObject | Out-Null

  if ($SubscriptionScope) {
    $subscriptionId = $(Get-AzContext).Subscription.Id
    $scope = "/subscriptions/$subscriptionId"
  } else {
    $scope = "/providers/Microsoft.Management/managementGroups/$TenantId"
  }

  # Create IPAM Engine Service Principal
  Write-Host "INFO: Creating Azure IPAM Engine Service Principal" -ForegroundColor green
  Write-Verbose -Message "Creating Azure IPAM Engine Service Principal"
  New-AzADServicePrincipal -ApplicationObject $engineObject `
                           -Role "Reader" `
                           -Scope $scope `
                           | Out-Null

  # Create IPAM Engine Secret
  Write-Host "INFO: Creating Azure IPAM Engine Secret" -ForegroundColor green
  Write-Verbose -Message "Creating Azure IPAM Engine Secret"
  $engineSecret = New-AzADAppCredential -ApplicationObject $engineObject -StartDate (Get-Date) -EndDate (Get-Date).AddYears(2)

  Write-Host "INFO: Azure IPAM Engine & UI Applications/Service Principals created successfully" -ForegroundColor green
  Write-Verbose -Message "Azure IPAM Engine & UI Applications/Service Principals created successfully"

  $appDetails = @{
    UIAppId      = $uiApp.AppId
    EngineAppId  = $engineApp.AppId
    EngineSecret = $engineSecret.SecretText
  }

  return $appDetails
}

Function Grant-AdminConsent {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$UIAppId,
    [Parameter(Mandatory=$true)]
    [string]$EngineAppId
  )

  $uiGraphScopes = [System.Collections.ArrayList]@(
    @{
      scopeId = "00000003-0000-0000-c000-000000000000" # Microsoft Graph
      scopes = " openid profile offline_access User.Read Directory.Read.All"
    }
  )

  $engineGraphScopes = [System.Collections.ArrayList]@(
    @{
      scopeId = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Service Management
      scopes = "user_impersonation"
    }
  )

  # Get Microsoft Graph Access Token
  $accesstoken = (Get-AzAccessToken -Resource "https://graph.microsoft.com/").Token

  # Connect to Microsoft Graph
  Write-Host "INFO: Logging in to Microsoft Graph" -ForegroundColor green
  Write-Verbose -Message "Logging in to Microsoft Graph"
  Connect-MgGraph -AccessToken $accesstoken | Out-Null

  # Fetch Azure IPAM UI Service Principal
  $uiSpn = Get-AzADServicePrincipal `
    -ApplicationId $UIAppId

  # Fetch Azure IPAM Engine Service Principal
  $engineSpn = Get-AzADServicePrincipal `
    -ApplicationId $EngineAppId

  # Grant admin consent for Microsoft Graph API permissions assigned to IPAM UI application
  Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI Application" -ForegroundColor Green
  Write-Verbose -Message "Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI Application"
  foreach($scope in $uiGraphScopes) {
    $msGraphId = Get-AzADServicePrincipal `
      -ApplicationId $scope.scopeId
  
    New-MgOauth2PermissionGrant `
      -ResourceId $msGraphId.Id `
      -Scope $scope.scopes `
      -ClientId $uiSpn.Id `
      -ConsentType AllPrincipals `
      | Out-Null
  }

  Write-Host "INFO: Admin consent for Microsoft Graph API permissions granted successfully" -ForegroundColor green
  Write-Verbose -Message "Admin consent for Microsoft Graph API permissions granted successfully"

  # Grant admin consent for Azure Service Management API permissions assigned to IPAM application
  Write-Host "INFO: Granting admin consent for Azure Service Management API permissions assigned to IPAM Engine Application" -ForegroundColor Green
  Write-Verbose -Message "Granting admin consent for Azure Service Management API permissions assigned to IPAM Engine Application"
  New-MgOauth2PermissionGrant `
    -ResourceId $engineSpn.Id `
    -Scope "access_as_user" `
    -ClientId $uiSpn.Id `
    -ConsentType AllPrincipals `
    | Out-Null

  Write-Host "INFO: Admin consent for Azure Service Management API permissions granted successfully" -ForegroundColor green
  Write-Verbose -Message "Admin consent for Azure Service Management API API permissions granted successfully"

  # Grant admin consent for Microsoft Graph API permissions assigned to IPAM engine application
  Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM Engine Application" -ForegroundColor Green
  Write-Verbose -Message "Granting admin consent for Microsoft Graph API permissions assigned to IPAM Engine Application"
  foreach($scope in $engineGraphScopes) {
    $msGraphId = Get-AzADServicePrincipal `
      -ApplicationId $scope.scopeId

    New-MgOauth2PermissionGrant `
      -ResourceId $msGraphId.Id `
      -Scope $scope.scopes `
      -ClientId $engineSpn.Id `
      -ConsentType AllPrincipals `
      | Out-Null
  }

  Write-Host "INFO: Admin consent for Microsoft Graph API permissions granted successfully" -ForegroundColor green
  Write-Verbose -Message "Admin consent for Microsoft Graph API permissions granted successfully"
}

Function Save-Parameters {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$UIAppId,
    [Parameter(Mandatory=$true)]
    [string]$EngineAppId,
    [Parameter(Mandatory=$true)]
    [string]$EngineSecret,
    [Parameter(Mandatory=$false)]
    [bool]$DeployAcr
  )

  Write-Host "INFO: Populating Bicep parameter file for infrastructure deployment" -ForegroundColor Green
  Write-Verbose -Message "Populating Bicep parameter file for infrastructure deployment"

  # Retrieve JSON object from sample parameter file
  $parametersObject = Get-Content main.parameters.example.json | ConvertFrom-Json

  # Update Parameter Values
  $parametersObject.parameters.uiAppId.value = $UIAppId
  $parametersObject.parameters.engineAppId.value = $EngineAppId
  $parametersObject.parameters.engineAppSecret.value = $EngineSecret
  $parametersObject.parameters.deployAcr.value = $DeployAcr
  $parametersObject.parameters = $parametersObject.parameters | Select-Object * -ExcludeProperty namePrefix, tags

  # Output updated parameter file for Bicep deployment
  $parametersObject | ConvertTo-Json -Depth 4 | Out-File -FilePath main.parameters.json

  Write-Host "INFO: Bicep parameter file populated successfully" -ForegroundColor green
  Write-Verbose -Message "Bicep parameter file populated successfully"
}

Function Import-Parameters {
  Param(
    [Parameter(Mandatory=$true)]
    [System.IO.FileInfo]$ParameterFile
  )

  Write-Host "INFO: Importing values from Bicep parameters file" -ForegroundColor Green
  Write-Verbose -Message "Importing values from Bicep parameters file"

  # Retrieve JSON object from sample parameter file
  $parametersObject = Get-Content $ParameterFile | ConvertFrom-Json

  # Read Values from Parameters
  $UIAppId = $parametersObject.parameters.uiAppId.value
  $EngineAppId = $parametersObject.parameters.engineAppId.value
  $EngineSecret = $parametersObject.parameters.engineAppSecret.value
  $script:DeployAcr = $parametersObject.parameters.deployAcr.value

  Write-Host "INFO: Successfully import Bicep parameter values" -ForegroundColor green
  Write-Verbose -Message "Successfully import Bicep parameter values"

  $appDetails = @{
    UIAppId      = $UIAppId
    EngineAppId  = $EngineAppId
    EngineSecret = $EngineSecret
  }

  return $appDetails
}

Function Deploy-Bicep {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$UIAppId,
    [Parameter(Mandatory=$true)]
    [string]$EngineAppId,
    [Parameter(Mandatory=$true)]
    [string]$EngineSecret,
    [Parameter(Mandatory=$false)]
    [string]$NamePrefix,
    [Parameter(Mandatory=$false)]
    [boolean]$DeployAcr,
    [Parameter(Mandatory=$false)]
    [hashtable]$Tags

  )

  Write-Host "INFO: Deploying IPAM bicep templates" -ForegroundColor green
  Write-Verbose -Message "Deploying bicep templates"

  # Instantiate deployment parameter object
  $deploymentParameters = @{
    engineAppId     = $EngineAppId
    engineAppSecret = $EngineSecret
    uiAppId         = $UiAppId
  }

  if($NamePrefix) {
    $deploymentParameters.Add('namePrefix', $NamePrefix)
  }

  if($DeployAcr) {
    $deploymentParameters.Add('deployAcr', $DeployAcr)
  }

  if($Tags) {
    $deploymentParameters.Add('tags', $Tags)
  }

  # Deploy IPAM bicep template
  $deployment = New-AzSubscriptionDeployment `
    -Name "ipamInfraDeploy-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
    -Location $location `
    -TemplateFile main.bicep `
    -TemplateParameterObject $deploymentParameters

  Write-Host "INFO: IPAM bicep templates deployed successfully" -ForegroundColor green
  Write-Verbose -Message "IPAM bicep template deployed successfully"

  return $deployment
}

Function Update-UIApplication {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$UIAppId,
    [Parameter(Mandatory=$true)]
    [string]$Endpoint
  )

  Write-Host "INFO: Updating UI Application with SPA configuration" -ForegroundColor green
  Write-Verbose -Message "Updating UI Application with SPA configuration"

  $appServiceEndpoint = "https://$Endpoint"

  # Update UI Application with single-page application configuration
  Update-AzADApplication -ApplicationId $UIAppId -SPARedirectUri $appServiceEndpoint 

  Write-Host "INFO: UI Application SPA configuration update complete" -ForegroundColor green
  Write-Verbose -Message "UI Application SPA configuration update complete"
}

try {
  if ($PSCmdlet.ParameterSetName -in ('Full', 'AppsOnly')) {
    # Fetch Tenant ID
    Write-Host "INFO: Fetching Tenant ID from Azure PowerShell SDK" -ForegroundColor green
    Write-Verbose -Message "Fetching Tenant ID from Azure PowerShell SDK"
    $tenantId = (Get-AzContext).Tenant.Id
  }

  if ($PSCmdlet.ParameterSetName -in ('Full', 'TemplateOnly')) {
    # Validate Azure Region
    Write-Host "INFO: Validating Azure Region selected for deployment" -ForegroundColor green
    Write-Verbose -Message "Validating Azure Region selected for deployment"

    if (Test-Location -Location $Location) {
      Write-Host "INFO: Azure Region validated successfully" -ForegroundColor green
      Write-Verbose -Message "Azure Region validated successfully"
    } else {
      Write-Host "ERROR: Location provided is not a valid Azure Region!" -ForegroundColor red
      exit
    }
  }

  if ($PSCmdlet.ParameterSetName -in ('Full', 'AppsOnly')) {
    $appDetails = Deploy-IPAMApplications `
      -UIAppName $UIAppName `
      -EngineAppName $EngineAppName `
      -TenantId $tenantId `
      -SubscriptionScope $SubscriptionScope

    if (-not $NoConsent) {
      Grant-AdminConsent `
        -UIAppId $appDetails.UIAppId `
        -EngineAppId $appDetails.EngineAppId
    }
  }

  if ($PSCmdlet.ParameterSetName -eq 'AppsOnly') {
    Save-Parameters @appDetails
  }

  if ($PSCmdlet.ParameterSetName -eq 'TemplateOnly') {
    $appDetails = Import-Parameters `
      -ParameterFile $ParameterFile
  }

  if ($PSCmdlet.ParameterSetName -in ('Full', 'TemplateOnly')) {
    $deployment = Deploy-Bicep @appDetails `
      -NamePrefix $NamePrefix `
      -DeployAcr $DeployAcr `
      -Tags $Tags
  }

  if ($PSCmdlet.ParameterSetName -eq 'Full') {
    Update-UIApplication `
      -UIAppId $appDetails.UIAppId `
      -Endpoint $deployment.Outputs["appServiceHostName"].Value
  }

  if ($PSCmdlet.ParameterSetName -in ('Full', 'TemplateOnly') -and $($DeployAcr)) {
    Write-Host "INFO: Building and pushing container images to Azure Container Registry" -ForegroundColor Green
    Write-Verbose -Message "Building and pushing container images to Azure Container Registry"

    az acr build -r $deployment.Outputs["loginServer"].Value -t ipam-engine:latest -f ../engine/Dockerfile.prod

    az acr build -r $deployment.Outputs["loginServer"].Value -t ipam-ui:latest -f ../ui/Dockerfile.prod
  } 

  Write-Host "INFO: Azure IPAM Solution deployed successfully" -ForegroundColor green
  Write-Verbose -Message "Azure IPAM Solution deployed successfully"
}
catch {
  $_ | Out-File -FilePath $logFile -Append
  Write-Host "ERROR: Unable to deploy Azure IPAM solution due to an exception, see $logFile for detailed information!" -ForegroundColor red
  exit
}
