###############################################################################################################
##
## Azure IPAM Solution Deployment Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="10.3.0"}
#Requires -Modules @{ ModuleName="Microsoft.Graph"; ModuleVersion="2.0.0"}

# Intake and set global parameters
[CmdletBinding(DefaultParameterSetName = 'AppContainer')]
param(
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'FunctionContainer')]
  [string]
  $Location,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [string]
  $UIAppName = 'ipam-ui-app',

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [string]
  $EngineAppName = 'ipam-engine-app',

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [ValidateLength(1,7)]
  [string]
  $NamePrefix,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [hashtable]
  $Tags,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'AppsOnly')]
  [switch]
  $AppsOnly,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [switch]
  $DisableUI,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'FunctionContainer')]
  [switch]
  $Function,

  # [Parameter(ValueFromPipelineByPropertyName = $true,
  #   Mandatory = $true,
  #   ParameterSetName = 'AppContainer')]
  # [Parameter(ValueFromPipelineByPropertyName = $true,
  #   Mandatory = $true,
  #   ParameterSetName = 'FunctionContainer')]
  # [switch]
  # $Container,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'Function')]
  [switch]
  $Native,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [switch]
  $PrivateACR,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [ValidateSet('Debian', 'RHEL')]
  [string]
  $ContainerType = 'Debian',

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'App')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppContainer')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FunctionContainer')]
  [ValidateScript({
    if(-Not ($_ | Test-Path) ){
      throw [System.ArgumentException]::New("Target file or does not exist.")
    }
    if(-Not ($_ | Test-Path -PathType Leaf) ){
      throw [System.ArgumentException]::New("The 'ParameterFile' argument must be a file, folder paths are not allowed.")
    }
    if($_ -notmatch "(\.json)"){
      throw [System.ArgumentException]::New("The file specified in the 'ParameterFile' argument must be of type json.")
    }
    return $true 
  })]
  [System.IO.FileInfo]
  $ParameterFile
)

DynamicParam {
  $validators = @{
    functionName = '^(?=^.{2,59}$)([^-][\w-]*[^-])$'
    appServiceName = '^(?=^.{2,59}$)([^-][\w-]*[^-])$'
    functionPlanName = '^(?=^.{1,40}$)([\w-]*)$'
    appServicePlanName = '^(?=^.{1,40}$)([\w-]*)$'
    cosmosAccountName = '^(?=^.{3,44}$)([^-][a-z0-9-]*[^-])$'
    cosmosContainerName = '^(?=^.{1,255}$)([^/\\#?]*)$'
    cosmosDatabaseName = '^(?=^.{1,255}$)([^/\\#?]*)$'
    keyVaultName = '^(?=^.{3,24}$)(?!.*--)([a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])$'
    workspaceName = '^(?=^.{4,63}$)([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])$'
    managedIdentityName = '^(?=^.{3,128}$)([a-zA-Z0-9][a-zA-Z0-9-_]*)$'
    resourceGroupName = '^(?=^.{1,90}$)(?!.*\.$)([a-zA-Z0-9-_\.\p{L}\p{N}]*)$'
    storageAccountName = '^(?=^.{3,24}$)([a-z0-9]*)$'
    containerRegistryName = '^(?=^.{5,50}$)([a-zA-Z0-9]*)$'
  }

  if(-not $PrivateAcr) {
    $validators.Remove('containerRegistryName')
  }

  if(-not $Function) {
    $validators.Remove('functionName')
    $validators.Remove('functionPlanName')
    $validators.Remove('storageAccountName')
  }

  if($Function) {
    $validators.Remove('appServiceName')
    $validators.Remove('appServicePlanName')
  }

  $attrApp = [System.Management.Automation.ParameterAttribute]::new()
  $attrApp.ParameterSetName = "App"
  $attrApp.Mandatory = $false

  $attrAppContainer = [System.Management.Automation.ParameterAttribute]::new()
  $attrAppContainer.ParameterSetName = "AppContainer"
  $attrAppContainer.Mandatory = $false

  $attrFunction = [System.Management.Automation.ParameterAttribute]::new()
  $attrFunction.ParameterSetName = "Function"
  $attrFunction.Mandatory = $false

  $attrFunctionContainer = [System.Management.Automation.ParameterAttribute]::new()
  $attrFunctionContainer.ParameterSetName = "FunctionContainer"
  $attrFunctionContainer.Mandatory = $false

  $attrValidation = [System.Management.Automation.ValidateScriptAttribute]::new({
    $invalidFields = [System.Collections.ArrayList]@()
    $missingFields = [System.Collections.ArrayList]@()

    foreach ($validator in $validators.GetEnumerator()) {
      if ($_.ContainsKey($validator.Name)) {
        if (-not ($_[$validator.Name] -match $validator.Value)) {
          $invalidFields.Add($validator.Name) | Out-Null
        }
      } else {
        $missingFields.Add($validator.Name) | Out-Null
      }
    }

    if ($invalidFields -or $missingFields) {
      $deploymentType = $PrivateAcr ? "'$($PSCmdlet.ParameterSetName) w/ Private ACR'" : $PSCmdlet.ParameterSetName
      Write-Host
      Write-Host "ERROR: Missing or improperly formatted field(s) in 'ResourceNames' parameter for deploment type $deploymentType" -ForegroundColor Red

      foreach ($field in $invalidFields) {
        Write-Host "ERROR: Invalid Field ->" $field -ForegroundColor Red
      }

      foreach ($field in $missingFields) {
        Write-Host "ERROR: Missing Field ->" $field -ForegroundColor Red
      }

      Write-Host "ERROR: Please refer to the 'Naming Rules and Restrictions for Azure Resources'" -ForegroundColor Red
      Write-Host "ERROR: " -ForegroundColor Red -NoNewline
      Write-Host "https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules" -ForegroundColor Yellow
      Write-Host

      throw [System.ArgumentException]::New("One of the required resource names is missing or invalid.")
    }

    return -not ($invalidFields -or $missingFields)
  })

  $attributeCollection = [System.Collections.ObjectModel.Collection[System.Attribute]]::new()
  $attributeCollection.Add($attrApp)
  $attributeCollection.Add($attrAppContainer)
  $attributeCollection.Add($attrFunction)
  $attributeCollection.Add($attrFunctionContainer)
  $attributeCollection.Add($attrValidation)

  $param = [System.Management.Automation.RuntimeDefinedParameter]::new('ResourceNames', [hashtable], $attributeCollection)
  $paramDict = [System.Management.Automation.RuntimeDefinedParameterDictionary]::new()
  $paramDict.Add('ResourceNames', $param)

  return $paramDict
}
begin {
  $ResourceNames = $PSBoundParameters['ResourceNames']
}
process {
  $AZURE_ENV_MAP = @{
    AzureCloud        = "AZURE_PUBLIC"
    AzureUSGovernment = "AZURE_US_GOV"
    USSec             = "AZURE_US_GOV_SECRET"
    AzureGermanCloud  = "AZURE_GERMANY"
    AzureChinaCloud   = "AZURE_CHINA"
  }

  # Root Directory
  $ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

  # Minimum Required Azure CLI Version
  $MIN_AZ_CLI_VER = [System.Version]'2.35.0'

  # Check for Debug Flag
  $DEBUG_MODE = [bool]$PSCmdlet.MyInvocation.BoundParameters[“Debug”].IsPresent

  # Set preference variables
  $ErrorActionPreference = "Stop"
  $DebugPreference = 'SilentlyContinue'
  $ProgressPreference = 'SilentlyContinue'

  # Hide Azure PowerShell SDK Warnings
  $Env:SuppressAzurePowerShellBreakingChangeWarnings = $true

  # Hide Azure PowerShell SDK & Azure CLI Survey Prompts
  $Env:AzSurveyMessage = $false
  $Env:AZURE_CORE_SURVEY_MESSAGE = $false

  # Set Log File Location
  $logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
  New-Item -ItemType Directory -Path $logpath -Force| Out-Null

  $debugLog = Join-Path -Path $logPath -ChildPath "debug_$(get-date -format `"yyyyMMddhhmmsstt`").log"
  $errorLog = Join-Path -Path $logPath -ChildPath "error_$(get-date -format `"yyyyMMddhhmmsstt`").log"
  $transcriptLog = Join-Path -Path $logPath -ChildPath "deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"

  $debugSetting = $DEBUG_MODE ? 'Continue' : 'SilentlyContinue'

  $deploymentSuccess = $false

  Start-Transcript -Path $transcriptLog | Out-Null

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
      [Parameter(Mandatory=$false)]
      [string]$EngineAppName = 'ipam-engine-app',
      [Parameter(Mandatory=$false)]
      [string]$UIAppName = 'ipam-ui-app',
      [Parameter(Mandatory=$true)]
      [string]$TenantId,
      [Parameter(Mandatory=$true)]
      [string]$AzureCloud,
      [Parameter(Mandatory=$false)]
      [bool]$DisableUI = $false
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

    # Create IPAM UI Application (If -UI:$false not specified)
    if (-not $DisableUI) {
      Write-Host "INFO: Creating Azure IPAM UI Application" -ForegroundColor Green

      $uiApp = New-AzADApplication `
        -DisplayName $UiAppName `
        -SPARedirectUri "https://replace-this-value.azurewebsites.net" `
        -Web $uiWebSettings
    }

    $engineResourceMap = @{
      "AZURE_PUBLIC" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Service Management
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033") # user_impersonation
      }
      "AZURE_US_GOV" = @{
        ResourceAppId    = "40a69793-8fe6-4db1-9591-dbc5c57b17d8" # Azure Service Management
        ResourceAccessIds = @("8eb49ffc-05ac-454c-9027-8648349217dd", "e59ee429-1fb1-4054-b99f-f542e8dc9b95") # user_impersonation
      }
      "AZURE_US_GOV_SECRET" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Service Management
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033") # user_impersonation
      }
      "AZURE_GERMANY" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Service Management
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033") # user_impersonation
      }
      "AZURE_CHINA" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013" # Azure Service Management
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033") # user_impersonation
      }
    }

    $engineResourceAppId = $engineResourceMap[$AzureCloud].ResourceAppId
    $engineResourceAccess = [System.Collections.ArrayList]@()

    foreach ($engineAccessId in  $engineResourceMap[$AzureCloud].ResourceAccessIds) {
      $access = @{
        Id   = $engineAccessId
        Type = "Scope"
      }

      $engineResourceAccess.Add($access) | Out-Null
    }

    $engineResourceAccessList = [System.Collections.ArrayList]@(
      @{
        ResourceAppId  = $engineResourceAppId
        ResourceAccess = $engineResourceAccess
      }
    )

    $engineApiGuid = New-Guid

    $knownClientApplication = @(
      $uiApp.AppId
    )

    $engineApiSettings = @{
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
      PreAuthorizedApplication = @( # Allow Azure PowerShell/CLI to obtain access tokens
        @{
          AppId = "1950a258-227b-4e31-a9cf-717495945fc2" # Azure PowerShell
          DelegatedPermissionId = @( $engineApiGuid )
        },
        @{
          AppId = "04b07795-8ddb-461a-bbee-02f9e1bf7b46" # Azure CLI
          DelegatedPermissionId = @( $engineApiGuid )
        }
      )
      RequestedAccessTokenVersion = 2
    }

    # Add the UI App as a Known Client App (If -UI:$false not specified)
    if (-not $DisableUI) {
      $engineApiSettings.Add("KnownClientApplication", $knownClientApplication)
    }

    Write-Host "INFO: Creating Azure IPAM Engine Application" -ForegroundColor Green

    # Create IPAM Engine Application
    $engineApp = New-AzADApplication `
      -DisplayName $EngineAppName `
      -Api $engineApiSettings `
      -RequiredResourceAccess $engineResourceAccessList

    Write-Host "INFO: Updating Azure IPAM Engine API Endpoint" -ForegroundColor Green

    # Update IPAM Engine API Endpoint
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

    # Update IPAM UI Application Resource Access (If -UI:$false not specified)
    if (-not $DisableUI) {
      Write-Host "INFO: Updating Azure IPAM UI Application Resource Access" -ForegroundColor Green

      Update-AzADApplication -ApplicationId $uiApp.AppId -RequiredResourceAccess $uiResourceAccess

      $uiObject = Get-AzADApplication -ApplicationId $uiApp.AppId
    }
    
    $engineObject = Get-AzADApplication -ApplicationId $engineApp.AppId

    # Create IPAM UI Service Principal (If -UI:$false not specified)
    if (-not $DisableUI) {
      Write-Host "INFO: Creating Azure IPAM UI Service Principal" -ForegroundColor Green

      New-AzADServicePrincipal -ApplicationObject $uiObject | Out-Null
    }

    $scope = "/providers/Microsoft.Management/managementGroups/$TenantId"

    Write-Host "INFO: Creating Azure IPAM Engine Service Principal" -ForegroundColor Green

    # Create IPAM Engine Service Principal
    New-AzADServicePrincipal -ApplicationObject $engineObject `
                            -Role "Reader" `
                            -Scope $scope `
                            | Out-Null

    Write-Host "INFO: Creating Azure IPAM Engine Secret" -ForegroundColor Green

    # Create IPAM Engine Secret
    $engineSecret = New-AzADAppCredential -ApplicationObject $engineObject -StartDate (Get-Date) -EndDate (Get-Date).AddYears(2)

    if (-not $DisableUI) {
      Write-Host "INFO: Azure IPAM Engine & UI Applications/Service Principals created successfully" -ForegroundColor Green
    } else {
      Write-Host "INFO: Azure IPAM Engine Application/Service Principal created successfully" -ForegroundColor Green
    }

    $appDetails = @{
      EngineAppId  = $engineApp.AppId
      EngineSecret = $engineSecret.SecretText
    }

    # Add UI AppID to AppDetails (If -UI:$false not specified)
    if (-not $DisableUI) {
      $appDetails.Add("UIAppId", $uiApp.AppId)
    }

    return $appDetails
  }

  Function Grant-AdminConsent {
    Param(
      [Parameter(Mandatory=$false)]
      [string]$UIAppId = [GUID]::Empty,
      [Parameter(Mandatory=$true)]
      [string]$EngineAppId,
      [Parameter(Mandatory=$true)]
      [string]$AzureCloud,
      [Parameter(Mandatory=$false)]
      [bool]$DisableUI = $false
    )

    $msGraphMap = @{
      AZURE_PUBLIC  = @{
        Endpoint    = "graph.microsoft.com"
        Environment = "Global"
      }
      AZURE_US_GOV  = @{
        Endpoint    = "graph.microsoft.us"
        Environment = "USGov"
      }
      AZURE_US_GOV_SECRET  = @{
        Endpoint    = "graph.cloudapi.microsoft.scloud"
        Environment = "USSec"
      }
      AZURE_GERMANY = @{
        Endpoint    = "graph.microsoft.de"
        Environment = "Germany"
      }
      AZURE_CHINA   = @{
        Endpoint    = "microsoftgraph.chinacloudapi.cn"
        Environment = "China"
      }
    };

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
    $accesstoken = (Get-AzAccessToken -Resource "https://$($msGraphMap[$AzureCloud].Endpoint)/").Token

    # Switch Access Token to SecureString if Graph Version is 2.x
    $graphVersion = [System.Version](Get-InstalledModule -Name Microsoft.Graph | Sort-Object -Property Version | Select-Object -Last 1).Version `
      ?? (Get-Module -Name Microsoft.Graph | Sort-Object -Property Version | Select-Object -Last 1).Version

    if ($graphVersion.Major -gt 1) {
      $accesstoken = ConvertTo-SecureString $accesstoken -AsPlainText -Force
    }

    Write-Host "INFO: Logging in to Microsoft Graph" -ForegroundColor Green

    # Connect to Microsoft Graph
    Connect-MgGraph -Environment $msGraphMap[$AzureCloud].Environment -AccessToken $accesstoken | Out-Null

    # Fetch Azure IPAM UI Service Principal (If -UI:$false not specified)
    if (-not $DisableUI) {
      $uiSpn = Get-AzADServicePrincipal `
        -ApplicationId $UIAppId
    }

    # Fetch Azure IPAM Engine Service Principal
    $engineSpn = Get-AzADServicePrincipal `
      -ApplicationId $EngineAppId

    # Grant admin consent for Microsoft Graph API permissions assigned to IPAM UI application (If -UI:$false not specified)
    if (-not $DisableUI) {
      Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI application" -ForegroundColor Green

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

      Write-Host "INFO: Admin consent for Microsoft Graph API permissions granted successfully" -ForegroundColor Green
    }

    # Grant admin consent to the IPAM UI application for exposed API from the IPAM Engine application (If -UI:$false not specified)
    if (-not $DisableUI) {
      Write-Host "INFO: Granting admin consent to the IPAM UI application for exposed API from the IPAM Engine application" -ForegroundColor Green

      New-MgOauth2PermissionGrant `
        -ResourceId $engineSpn.Id `
        -Scope "access_as_user" `
        -ClientId $uiSpn.Id `
        -ConsentType AllPrincipals `
        | Out-Null

      Write-Host "INFO: Admin consent for IPAM Engine exposed API granted successfully" -ForegroundColor Green
    }

    Write-Host "INFO: Granting admin consent for Azure Service Management API permissions assigned to IPAM Engine application" -ForegroundColor Green

    # Grant admin consent for Azure Service Management API permissions assigned to IPAM Engine application
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

    Write-Host "INFO: Admin consent for Azure Service Management API permissions granted successfully" -ForegroundColor Green
  }

  Function Save-Parameters {
    Param(
      [Parameter(Mandatory=$false)]
      [string]$UIAppId = [GUID]::Empty,
      [Parameter(Mandatory=$true)]
      [string]$EngineAppId,
      [Parameter(Mandatory=$true)]
      [string]$EngineSecret,
      [Parameter(Mandatory=$false)]
      [bool]$DisableUI = $false
    )

    Write-Host "INFO: Populating Bicep parameter file for infrastructure deployment" -ForegroundColor Green

    # Retrieve JSON object from sample parameter file
    $parametersObject = Get-Content main.parameters.example.json | ConvertFrom-Json

    # Update Parameter Values
    $parametersObject.parameters.engineAppId.value = $EngineAppId
    $parametersObject.parameters.engineAppSecret.value = $EngineSecret

    if (-not $DisableUI) {
      $parametersObject.parameters.uiAppId.value = $UIAppId
      $parametersObject.parameters = $parametersObject.parameters | Select-Object -Property uiAppId, engineAppId, engineAppSecret
    } else {
      $parametersObject.parameters = $parametersObject.parameters | Select-Object -Property engineAppId, engineAppSecret
    }

    # Output updated parameter file for Bicep deployment
    $parametersObject | ConvertTo-Json -Depth 4 | Out-File -FilePath main.parameters.json

    Write-Host "INFO: Bicep parameter file populated successfully" -ForegroundColor Green
  }

  Function Import-Parameters {
    Param(
      [Parameter(Mandatory=$true)]
      [System.IO.FileInfo]$ParameterFile
    )

    Write-Host "INFO: Importing values from Bicep parameters file" -ForegroundColor Green

    # Retrieve JSON object from sample parameter file
    $parametersObject = Get-Content $ParameterFile | ConvertFrom-Json

    # Read Values from Parameters
    $UIAppId = $parametersObject.parameters.uiAppId.value ?? [GUID]::Empty
    $EngineAppId = $parametersObject.parameters.engineAppId.value
    $EngineSecret = $parametersObject.parameters.engineAppSecret.value
    $script:DisableUI = ($UIAppId -eq [GUID]::Empty) ? $true : $false

    if ((-not $EngineAppId) -or (-not $EngineSecret)) {
      Write-Host "ERROR: Missing required parameters from Bicep parameter file" -ForegroundColor Red
      Write-Host "ERROR: Please ensure the following parameters are present in the Bicep parameter file" -ForegroundColor Red
      Write-Host "ERROR: Required: [engineAppId, engineAppSecret]" -ForegroundColor Red
      Write-Host ""
      Write-Host "ERROR: Please refer to the deployment documentation for more information" -ForegroundColor Red
      Write-Host "ERROR: " -ForegroundColor Red -NoNewline
      Write-Host "https://azure.github.io/ipam/#/deployment/README" -ForegroundColor Yellow
      Write-Host ""

      throw [System.ArgumentException]::New("One of the required parameters are missing or invalid.")
    }

    # $deployType = $script:AsFunction ? 'Function' : 'Full'

    Write-Host "INFO: Successfully import Bicep parameter values for deployment" -ForegroundColor Green

    $appDetails = @{
      UIAppId      = $UIAppId
      EngineAppId  = $EngineAppId
      EngineSecret = $EngineSecret
    }

    return $appDetails
  }

  Function Deploy-Bicep {
    Param(
      [Parameter(Mandatory=$false)]
      [string]$UIAppId = [GUID]::Empty,
      [Parameter(Mandatory=$true)]
      [string]$EngineAppId,
      [Parameter(Mandatory=$true)]
      [string]$EngineSecret,
      [Parameter(Mandatory=$false)]
      [string]$NamePrefix,
      [Parameter(Mandatory=$false)]
      [string]$AzureCloud,
      [Parameter(Mandatory=$false)]
      [bool]$Function,
      [Parameter(Mandatory=$false)]
      [bool]$Native,
      [Parameter(Mandatory=$false)]
      [bool]$PrivateAcr,
      [Parameter(Mandatory=$false)]
      [hashtable]$Tags,
      [Parameter(Mandatory=$false)]
      [hashtable]$ResourceNames
    )

    Write-Host "INFO: Deploying IPAM bicep templates" -ForegroundColor Green

    # Instantiate deployment parameter object
    $deploymentParameters = @{
      engineAppId     = $EngineAppId
      engineAppSecret = $EngineSecret
      uiAppId         = $UiAppId
    }

    if($NamePrefix) {
      $deploymentParameters.Add('namePrefix', $NamePrefix)
    }

    if($AzureCloud) {
      $deploymentParameters.Add('azureCloud', $AzureCloud)
    }

    if($Function) {
      $deploymentParameters.Add('deployAsFunc', $Function)
    }

    if(-not $Native) {
      $deploymentParameters.Add('deployAsContainer', !$Native)
    }

    if($PrivateAcr) {
      $deploymentParameters.Add('privateAcr', $PrivateAcr)
    }

    if($Tags) {
      $deploymentParameters.Add('tags', $Tags)
    }

    if($ResourceNames) {
      $deploymentParameters.Add('resourceNames', $ResourceNames)
    }

    $DebugPreference = $debugSetting

    # Deploy IPAM bicep template
    $deployment = &{
      New-AzSubscriptionDeployment `
      -Name "ipamInfraDeploy-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
      -Location $location `
      -TemplateFile main.bicep `
      -TemplateParameterObject $deploymentParameters `
      5>$($DEBUG_MODE ? $debugLog : $null)
    }

    $DebugPreference = 'SilentlyContinue'

    Write-Host "INFO: IPAM bicep templates deployed successfully" -ForegroundColor Green

    return $deployment
  }

  Function Publish-ZipFile {
    Param(
      [Parameter(Mandatory=$true)]
      [string]$AppName,
      [Parameter(Mandatory=$true)]
      [string]$ResourceGroupName,
      [Parameter(Mandatory=$false)]
      [switch]$UseAPI
    )

    if ($UseAPI) {
      Write-Host "INFO: Using Kudu API for ZIP Deploy" -ForegroundColor Green
    }

    $zipPath = Join-Path -Path $ROOT_DIR -ChildPath 'assets' -AdditionalChildPath "ipam.zip"

    $publishRetries = 3
    $publishSuccess = $False

    if ($UseAPI) {
      $accessToken = (Get-AzAccessToken).Token
      $zipContents = Get-Item -Path $zipPath

      $publishProfile = Get-AzWebAppPublishingProfile -Name $AppName -ResourceGroupName $ResourceGroupName
      $zipUrl = ([System.uri]($publishProfile | Select-Xml -XPath "//publishProfile[@publishMethod='ZipDeploy']" | Select-Object -ExpandProperty Node).publishUrl).Scheme
    }

    do {
      try {
        if (-not $UseAPI) {
          Publish-AzWebApp `
            -Name $AppName `
            -ResourceGroupName $ResourceGroupName `
            -ArchivePath $zipPath `
            -Restart `
            -Force `
            | Out-Null
        } else {
          Invoke-RestMethod `
            -Uri "https://${zipUrl}/api/zipdeploy" `
            -Method Post `
            -ContentType "multipart/form-data" `
            -Headers @{ "Authorization" = "Bearer $accessToken" } `
            -Form @{ file = $zipContents } `
            -StatusCodeVariable statusCode `
            | Out-Null

            if ($statusCode -ne 200) {
              throw [System.Exception]::New("Error while uploading ZIP Deploy via Kudu API! ($statusCode)")
            }
        }

        $publishSuccess = $True
        Write-Host "INFO: ZIP Deploy archive successfully uploaded" -ForegroundColor Green
      } catch {
        if($publishRetries -gt 0) {
          Write-Host "WARNING: Problem while uploading ZIP Deploy archive! Retrying..." -ForegroundColor Yellow
          $publishRetries--
        } else {
          Write-Host "ERROR: Unable to upload ZIP Deploy archive!" -ForegroundColor Red
          throw $_
        }
      }
    } while ($publishSuccess -eq $False -and $publishRetries -ge 0)
  }

  Function Update-UIApplication {
    Param(
      [Parameter(Mandatory=$true)]
      [string]$UIAppId,
      [Parameter(Mandatory=$true)]
      [string]$Endpoint
    )

    Write-Host "INFO: Updating UI Application with SPA configuration" -ForegroundColor Green

    $appServiceEndpoint = "https://$Endpoint"

    # Update UI Application with single-page application configuration
    Update-AzADApplication -ApplicationId $UIAppId -SPARedirectUri $appServiceEndpoint 

    Write-Host "INFO: UI Application SPA configuration update complete" -ForegroundColor Green
  }

  # Main Deployment Script Section
  Write-Host
  Write-Host "NOTE: IPAM Deployment Type: $($PSCmdlet.ParameterSetName)" -ForegroundColor Magenta

  if($DEBUG_MODE) {
    Write-Host "DEBUG: Debug Mode Enabled" -ForegroundColor Gray
  }

  try {
    if($PrivateAcr) {
      Write-Host "INFO: PrivateACR flag set, verifying minimum Azure CLI version" -ForegroundColor Green

      # Verify Minimum Azure CLI Version
      $azureCliVer = [System.Version](az version | ConvertFrom-Json).'azure-cli'

      if($azureCliVer -lt $MIN_AZ_CLI_VER) {
        Write-Host "ERROR: Azure CLI must be version $MIN_AZ_CLI_VER or greater!" -ForegroundColor Red
        exit
      }

      Write-Host "INFO: PrivateACR flag set, verifying Azure PowerShell and Azure CLI contexts match" -ForegroundColor Green

      # Verify Azure PowerShell and Azure CLI Contexts Match
      $azureCliContext = $(az account show | ConvertFrom-Json) 2>$null

      if(-not $azureCliContext) {
        Write-Host "ERROR: Azure CLI not logged in or no subscription has been selected!" -ForegroundColor Red
        exit
      }

      $azureCliSub = $azureCliContext.id
      $azurePowerShellSub = (Get-AzContext).Subscription.Id

      if($azurePowerShellSub -ne $azureCliSub) {
        Write-Host "ERROR: Azure PowerShell and Azure CLI must be set to the same context!" -ForegroundColor Red
        exit
      }
    }

    if ($PSCmdlet.ParameterSetName -in ('App', 'AppContainer', 'Function', 'FunctionContainer', 'AppsOnly')) {
      Write-Host "INFO: Fetching Tenant ID from Azure PowerShell SDK" -ForegroundColor Green

      # Fetch Tenant ID
      $tenantId = (Get-AzContext).Tenant.Id

      Write-Host "INFO: Fetching Azure Cloud type from Azure PowerShell SDK" -ForegroundColor Green

      # Fetch Azure Cloud Type
      $azureCloud = $AZURE_ENV_MAP[(Get-AzContext).Environment.Name]

      # Verify Azure Cloud Type is Supported
      if (-not [bool]$azureCloud) {
        Write-Host "ERROR: Azure Cloud type is not currently supported!" -ForegroundColor Red
        Write-Host
        Write-Host "Azure Cloud type: " -ForegroundColor Yellow -NoNewline
        Write-Host (Get-AzContext).Environment.Name -ForegroundColor Cyan
        exit
      }
    }

    if ($PSCmdlet.ParameterSetName -in ('App', 'AppContainer', 'Function', 'FunctionContainer')) {
      Write-Host "INFO: Validating Azure Region selected for deployment" -ForegroundColor Green

      # Validate Azure Region
      if (Test-Location -Location $Location) {
        Write-Host "INFO: Azure Region validated successfully" -ForegroundColor Green
      } else {
        Write-Host "ERROR: Location provided is not a valid Azure Region!" -ForegroundColor Red
        Write-Host
        Write-Host "Azure Region: " -ForegroundColor Yellow -NoNewline
        Write-Host $Location -ForegroundColor Cyan
        exit
      }
    }

    if (-not $ParameterFile) {
      $appDetails = Deploy-IPAMApplications `
        -UIAppName $UIAppName `
        -EngineAppName $EngineAppName `
        -TenantId $tenantId `
        -AzureCloud $azureCloud `
        -DisableUI $DisableUI

      $consentDetails = @{
        EngineAppId = $appDetails.EngineAppId
      }

      if (-not $DisableUI) {
        $consentDetails.Add("UIAppId", $appDetails.UIAppId)
      }

      Grant-AdminConsent @consentDetails -AzureCloud $azureCloud -DisableUI $DisableUI
    }

    if ($PSCmdlet.ParameterSetName -in ('AppsOnly')) {
      Save-Parameters @appDetails -DisableUI $DisableUI
    }

    if ($ParameterFile) {
      $appDetails = Import-Parameters `
        -ParameterFile $ParameterFile
    }

    if ($PSCmdlet.ParameterSetName -in ('App', 'AppContainer', 'Function', 'FunctionContainer')) {
      $deployment = Deploy-Bicep @appDetails `
        -NamePrefix $NamePrefix `
        -AzureCloud $azureCloud `
        -PrivateAcr $PrivateAcr `
        -Function $Function `
        -Native $Native `
        -Tags $Tags `
        -ResourceNames $ResourceNames
    }

    if (($PSCmdlet.ParameterSetName -notin 'AppsOnly') -and (-not $DisableUI)) {
      Update-UIApplication `
        -UIAppId $appDetails.UIAppId `
        -Endpoint $deployment.Outputs["appServiceHostName"].Value
    }

    if ($PSCmdlet.ParameterSetName -in ('App', 'Function')) {
      Write-Host "INFO: Uploading ZIP Deploy archive..." -ForegroundColor Green

      try {
        Publish-ZipFile -AppName $deployment.Outputs["appServiceName"].Value -ResourceGroupName $deployment.Outputs["resourceGroupName"].Value
      } catch {
        Write-Host "SWITCH: Retrying ZIP Deploy with Kudu API..." -ForegroundColor Blue
        Publish-ZipFile -AppName $deployment.Outputs["appServiceName"].Value -ResourceGroupName $deployment.Outputs["resourceGroupName"].Value -UseAPI
      }
    }

    if ($PSCmdlet.ParameterSetName -in ('AppContainer', 'FunctionContainer') -and $PrivateAcr) {
      Write-Host "INFO: Building and pushing container images to Azure Container Registry" -ForegroundColor Green

      $containerMap = @{
        Debian = @{
          Extension = 'deb'
          Port = 80
          Images = @{
            Build = 'node:18-slim'
            Serve = 'python:3.9-slim'
          }
        }
        RHEL = @{
          Extension = 'rhel'
          Port = 8080
          Images = @{
            Build = 'registry.access.redhat.com/ubi8/nodejs-18'
            Serve = 'registry.access.redhat.com/ubi8/python-39'
          }
        }
      }

      $dockerFile = 'Dockerfile.' + $containerMap[$ContainerType].Extension
      $dockerFilePath = Join-Path -Path $ROOT_DIR -ChildPath $dockerFile
      $dockerFileFunc = Join-Path -Path $ROOT_DIR -ChildPath 'Dockerfile.func'

      if($Function) {
        Write-Host "INFO: Building Function container..." -ForegroundColor Green

        $funcBuildOutput = $(
          az acr build -r $deployment.Outputs["acrName"].Value `
          -t ipamfunc:latest `
          -f $dockerFileFunc $ROOT_DIR
        ) *>&1

        if ($LASTEXITCODE -ne 0) {
          throw $funcBuildOutput
        } else {
          Write-Host "INFO: Function container image build and push completed successfully" -ForegroundColor Green
        }

        Write-Host "INFO: Restarting Function App" -ForegroundColor Green

        Restart-AzFunctionApp -Name $deployment.Outputs["appServiceName"].Value -ResourceGroupName $deployment.Outputs["resourceGroupName"].Value -Force | Out-Null
      } else {
        Write-Host "INFO: Building App container ($ContainerType)..." -ForegroundColor Green

        $appBuildOutput = $(
          az acr build -r $deployment.Outputs["acrName"].Value `
            -t ipam:latest `
            -f $dockerFilePath $ROOT_DIR `
            --build-arg PORT=$($containerMap[$ContainerType].Port) `
            --build-arg BUILD_IMAGE=$($containerMap[$ContainerType].Images.Build) `
            --build-arg SERVE_IMAGE=$($containerMap[$ContainerType].Images.Serve)
        ) *>&1

        if ($LASTEXITCODE -ne 0) {
          throw $appBuildOutput
        } else {
          Write-Host "INFO: App container image build and push completed successfully" -ForegroundColor Green
        }

        Write-Host "INFO: Restarting App Service" -ForegroundColor Green

        Restart-AzWebApp -Name $deployment.Outputs["appServiceName"].Value -ResourceGroupName $deployment.Outputs["resourceGroupName"].Value | Out-Null
      }
    }

    Write-Host "INFO: Azure IPAM Solution deployed successfully" -ForegroundColor Green

    if ($($PSCmdlet.ParameterSetName -notin 'AppsOnly') -and (-not $DisableUI) -and $ParameterFile) {
      $updateUrl = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Authentication/appId/$($appDetails.UIAppId)"
      $updateAddr = "https://$($deployment.Outputs["appServiceHostName"].Value)"

      Write-Host
      Write-Host "POST DEPLOYMENT TASKS:" -ForegroundColor Yellow
      Write-Host "##############################################" -ForegroundColor Yellow
      Write-Host "Navigate In Browser To:" -ForegroundColor Cyan
      Write-Host $updateUrl -ForegroundColor White
      Write-Host "Change 'Redirect URI' To:" -ForegroundColor Cyan
      Write-Host $updateAddr -ForegroundColor White
      Write-Host "##############################################" -ForegroundColor Yellow
    }

    if ($PSCmdlet.ParameterSetName -in ('App', 'Function')) {
      Write-Host
      Write-Host "NOTE: Please allow ~5 minutes for the Azure IPAM service to become available" -ForegroundColor Yellow
    }

    $script:deploymentSuccess = $true
  }
  catch {
    $_ | Out-File -FilePath $errorLog -Append
    Write-Host "ERROR: Unable to deploy Azure IPAM solution due to an exception, see logs for detailed information!" -ForegroundColor Red
    Write-Host "Run Log: $transcriptLog" -ForegroundColor Red
    Write-Host "Error Log: $errorLog" -ForegroundColor Red

    if($DEBUG_MODE) {
      Write-Host "Debug Log: $debugLog" -ForegroundColor Red
    }
  }
  finally {
    Write-Host
    Stop-Transcript | Out-Null

    if ($script:deploymentSuccess) {
      Write-Output "ipamURL=https://$($deployment.Outputs["appServiceHostName"].Value)" >> $Env:GITHUB_OUTPUT
      Write-Output "ipamUIAppId=$($appDetails.UIAppId)" >> $Env:GITHUB_OUTPUT
      Write-Output "ipamEngineAppId=$($appDetails.EngineAppId)" >> $Env:GITHUB_OUTPUT
      Write-Output "ipamSuffix=$($deployment.Outputs["suffix"].Value)" >> $Env:GITHUB_OUTPUT
      Write-Output "ipamResourceGroup=$($deployment.Outputs["resourceGroupName"].Value)" >> $Env:GITHUB_OUTPUT
    }

    exit
  }
}
