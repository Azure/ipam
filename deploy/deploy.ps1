###############################################################################################################
##
## Azure IPAM Solution Deployment Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="8.0.0"}
#Requires -Modules @{ ModuleName="Microsoft.Graph"; ModuleVersion="1.9.6"}

# Intake and set global parameters
[CmdletBinding(DefaultParameterSetName = 'Full')]
param(
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'Full')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'TemplateOnly')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'Function')]
  [string]
  $Location,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [string]
  $UIAppName = 'ipam-ui-app',

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'AppsOnly')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'FuncAppsOnly')]
  [string]
  $EngineAppName = 'ipam-engine-app',

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'Function')]
  [ValidateLength(1,7)]
  [string]
  $NamePrefix,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'Function')]
  [hashtable]
  $Tags,

  [Parameter(Mandatory = $true,
    ParameterSetName = 'AppsOnly')]
  [Parameter(Mandatory = $true,
    ParameterSetName = 'FuncAppsOnly')]
  [switch]
  $AppsOnly,

  [Parameter(Mandatory = $true,
    ParameterSetName = 'Function')]
  [Parameter(Mandatory = $true,
    ParameterSetName = 'FuncAppsOnly')]
  [switch]
  $AsFunction,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [switch]
  $PrivateACR,

  [Parameter(Mandatory = $false,
    ParameterSetName = 'Full')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'Function')]
  [Parameter(Mandatory = $false,
    ParameterSetName = 'TemplateOnly')]
  [ValidateSet('Debian', 'RHEL')]
  [string]
  $ContainerType = 'Debian',

  [Parameter(Mandatory = $true,
    ParameterSetName = 'TemplateOnly')]
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

  if(-not $AsFunction) {
    $validators.Remove('functionName')
    $validators.Remove('storageAccountName')
  }

  if($AsFunction) {
    $validators.Remove('appServiceName')
  }

  $attrFull = [System.Management.Automation.ParameterAttribute]::new()
  $attrFull.ParameterSetName = 'ResourceNames'
  $attrFull.ParameterSetName = "Full"
  $attrFull.Mandatory = $false

  $attrTemplateOnly = [System.Management.Automation.ParameterAttribute]::new()
  $attrTemplateOnly.ParameterSetName = 'ResourceNames'
  $attrTemplateOnly.ParameterSetName = "TemplateOnly"
  $attrTemplateOnly.Mandatory = $false

  $attrFunction = [System.Management.Automation.ParameterAttribute]::new()
  $attrFunction.ParameterSetName = 'ResourceNames'
  $attrFunction.ParameterSetName = "Function"
  $attrFunction.Mandatory = $false

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
      Write-Host "ERROR: Missing or improperly formatted field(s) in 'ResourceNames' parameter for deploment type '$deploymentType'" -ForegroundColor Red

      foreach ($field in $invalidFields) {
        Write-Host "ERROR: Invalid Field ->" $field -ForegroundColor Red
      }

      foreach ($field in $missingFields) {
        Write-Host "ERROR: Missing Field ->" $field -ForegroundColor Red
      }

      Write-Host "ERROR: Please refer to the 'Naming Rules and Restrictions for Azure Resources'" -ForegroundColor Red
      Write-Host "ERROR: " -ForegroundColor Red -NoNewline
      Write-Host "https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules" -ForegroundColor Yellow
      Write-Host ""

      throw [System.ArgumentException]::New("One of the required resource names is missing or invalid.")
    }

    return -not ($invalidFields -or $missingFields)
  })

  $attributeCollection = [System.Collections.ObjectModel.Collection[System.Attribute]]::new()
  $attributeCollection.Add($attrFull)
  $attributeCollection.Add($attrTemplateOnly)
  $attributeCollection.Add($attrFunction)
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
    AzureGermanCloud  = "AZURE_GERMANY"
    AzureChinaCloud   = "AZURE_CHINA"
  }

  $MIN_AZ_CLI_VER = [System.Version]'2.35.0'

  $DEBUG_MODE = [bool]$PSCmdlet.MyInvocation.BoundParameters[“Debug”].IsPresent

  # Set preference variables
  $ErrorActionPreference = "Stop"
  $DebugPreference = 'SilentlyContinue'

  # Hide Azure PowerShell SDK Warnings
  $Env:SuppressAzurePowerShellBreakingChangeWarnings = $true

  # Set Log File Location
  $logPath = [Io.Path]::Combine('..', 'logs')
  New-Item -ItemType Directory -Force -Path $logpath | Out-Null

  $debugLog = Join-Path -Path $logPath -ChildPath "debug_$(get-date -format `"yyyyMMddhhmmsstt`").log"
  $errorLog = Join-Path -Path $logPath -ChildPath "error_$(get-date -format `"yyyyMMddhhmmsstt`").log"
  $transcriptLog = Join-Path -Path $logPath -ChildPath "deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"

  $debugSetting = $DEBUG_MODE ? 'Continue' : 'SilentlyContinue'

  Start-Transcript -Path $transcriptLog | Out-Null

  Function Test-Location {
    Param(
      [Parameter(Mandatory=$true)]
      [string]$Location
    )

    $validLocations = Get-AzLocation | Select-Object -ExpandProperty Location

    return $validLocations.Contains($Location)
  }

  # Create unique string to be used in naming for each deployment instance
  Function New-UniqueIPAMDeployString {
    $unique = (-join ((48..57) + (97..122) | Get-Random -Count 13 | % {[char]$_}))
    
    $script:UIAppName = $UIAppName + "-" + $unique
    $script:EngineAppName = $EngineAppName + "-" + $unique

    return $unique 
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
      [bool]$AsFunction
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

    # Create IPAM UI Application (If not deployed as a Function App)
    if (-not $AsFunction) {
      Write-Host "INFO: Creating Azure IPAM UI Application" -ForegroundColor Green
      Write-Verbose -Message "Creating Azure IPAM UI Application"
      $uiApp = New-AzADApplication `
        -DisplayName $UiAppName `
        -SPARedirectUri "https://replace-this-value.azurewebsites.net" `
        -Web $uiWebSettings
    }

    $engineResourceMap = @{
      "AZURE_PUBLIC" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013"
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033")
      }
      "AZURE_US_GOV" = @{
        ResourceAppId    = "40a69793-8fe6-4db1-9591-dbc5c57b17d8"
        ResourceAccessIds = @("8eb49ffc-05ac-454c-9027-8648349217dd", "e59ee429-1fb1-4054-b99f-f542e8dc9b95")
      }
      "AZURE_GERMANY" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013"
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033")
      }
      "AZURE_CHINA" = @{
        ResourceAppId    = "797f4846-ba00-4fd7-ba43-dac1f8f63013"
        ResourceAccessIds = @("41094075-9dad-400e-a0bd-54e686782033")
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

    # Add the UI App as a Known Client App (If not deployed as Function App)
    if (-not $AsFunction) {
      $engineApiSettings.Add("KnownClientApplication", $knownClientApplication)
    }

    # Create IPAM Engine Application
    Write-Host "INFO: Creating Azure IPAM Engine Application" -ForegroundColor Green
    Write-Verbose -Message "Creating Azure IPAM Engine Application"
    $engineApp = New-AzADApplication `
      -DisplayName $EngineAppName `
      -Api $engineApiSettings `
      -RequiredResourceAccess $engineResourceAccessList

    # Update IPAM Engine API Endpoint (If not deployed as Function App)
    if (-not $AsFunction) {
      Write-Host "INFO: Updating Azure IPAM Engine API Endpoint" -ForegroundColor Green
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
    }

    # Update IPAM UI Application Resource Access (If not deployed as Function App)
    if (-not $AsFunction) {
      Write-Host "INFO: Updating Azure IPAM UI Application Resource Access" -ForegroundColor Green
      Write-Verbose -Message "Updating Azure IPAM UI Application Resource Access"
      Update-AzADApplication -ApplicationId $uiApp.AppId -RequiredResourceAccess $uiResourceAccess

      $uiObject = Get-AzADApplication -ApplicationId $uiApp.AppId
    }
    
    $engineObject = Get-AzADApplication -ApplicationId $engineApp.AppId

    # Create IPAM UI Service Principal (If not deployed as Function App)
    if (-not $AsFunction) {
      Write-Host "INFO: Creating Azure IPAM UI Service Principal" -ForegroundColor Green
      Write-Verbose -Message "Creating Azure IPAM UI Service Principal"
      New-AzADServicePrincipal -ApplicationObject $uiObject | Out-Null
    }

    $scope = "/providers/Microsoft.Management/managementGroups/$TenantId"

    # Create IPAM Engine Service Principal
    Write-Host "INFO: Creating Azure IPAM Engine Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Creating Azure IPAM Engine Service Principal"
    New-AzADServicePrincipal -ApplicationObject $engineObject `
                            -Role "Reader" `
                            -Scope $scope `
                            | Out-Null

    # Create IPAM Engine Secret
    Write-Host "INFO: Creating Azure IPAM Engine Secret" -ForegroundColor Green
    Write-Verbose -Message "Creating Azure IPAM Engine Secret"
    $engineSecret = New-AzADAppCredential -ApplicationObject $engineObject -StartDate (Get-Date) -EndDate (Get-Date).AddYears(2)

    Write-Host "INFO: Azure IPAM Engine & UI Applications/Service Principals created successfully" -ForegroundColor Green
    Write-Verbose -Message "Azure IPAM Engine & UI Applications/Service Principals created successfully"

    $appDetails = @{
      EngineAppId  = $engineApp.AppId
      EngineSecret = $engineSecret.SecretText
    }

    # Add UI AppID to AppDetails (If not deployed as Function App)
    if (-not $AsFunction) {
      $appDetails.Add("UIAppId", $uiApp.AppId)
    }

    return $appDetails
  }

  Function Grant-AdminConsent {
    Param(
      [Parameter(Mandatory=$false)]
      [string]$UIAppId,
      [Parameter(Mandatory=$true)]
      [string]$EngineAppId,
      [Parameter(Mandatory=$false)]
      [bool]$AsFunction,
      [Parameter(Mandatory=$true)]
      [string]$AzureCloud
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
    $graphVersion = [System.Version](Get-InstalledModule -Name Microsoft.Graph).Version

    if ($graphVersion.Major -gt 1) {
      $accesstoken = ConvertTo-SecureString $accesstoken -AsPlainText -Force
    }

    # Connect to Microsoft Graph
    Write-Host "INFO: Logging in to Microsoft Graph" -ForegroundColor Green
    Write-Verbose -Message "Logging in to Microsoft Graph"
    Connect-MgGraph -Environment $msGraphMap[$AzureCloud].Environment -AccessToken $accesstoken | Out-Null

    # Fetch Azure IPAM UI Service Principal (If not deployed as Function App)
    if (-not $AsFunction) {
      $uiSpn = Get-AzADServicePrincipal `
        -ApplicationId $UIAppId
    }

    # Fetch Azure IPAM Engine Service Principal
    $engineSpn = Get-AzADServicePrincipal `
      -ApplicationId $EngineAppId

    # Grant admin consent for Microsoft Graph API permissions assigned to IPAM UI application (If not deployed as Function App)
    if (-not $AsFunction) {
      Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI application" -ForegroundColor Green
      Write-Verbose -Message "Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI application"
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
      Write-Verbose -Message "Admin consent for Microsoft Graph API permissions granted successfully"
    }

    # Grant admin consent to the IPAM UI application for exposed API from the IPAM Engine application (If not deployed as a Function App)
    if (-not $AsFunction) {
      Write-Host "INFO: Granting admin consent to the IPAM UI application for exposed API from the IPAM Engine application" -ForegroundColor Green
      Write-Verbose -Message "Granting admin consent to the IPAM UI application for exposed API from the IPAM Engine application"
      New-MgOauth2PermissionGrant `
        -ResourceId $engineSpn.Id `
        -Scope "access_as_user" `
        -ClientId $uiSpn.Id `
        -ConsentType AllPrincipals `
        | Out-Null

      Write-Host "INFO: Admin consent for IPAM Engine exposed API granted successfully" -ForegroundColor Green
      Write-Verbose -Message "Admin consent for IPAM Engine exposed API granted successfully"
    }

    # Grant admin consent for Azure Service Management API permissions assigned to IPAM Engine application
    Write-Host "INFO: Granting admin consent for Azure Service Management API permissions assigned to IPAM Engine application" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Azure Service Management API permissions assigned to IPAM Engine application"
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
    Write-Verbose -Message "Admin consent for Azure Service Management API permissions granted successfully"
  }

  Function Save-Parameters {
    Param(
      [Parameter(Mandatory=$false)]
      [string]$UIAppId = '00000000-0000-0000-000000000000',
      [Parameter(Mandatory=$true)]
      [string]$EngineAppId,
      [Parameter(Mandatory=$true)]
      [string]$EngineSecret,
      [Parameter(Mandatory=$false)]
      [bool]$AsFunction
    )

    Write-Host "INFO: Populating Bicep parameter file for infrastructure deployment" -ForegroundColor Green
    Write-Verbose -Message "Populating Bicep parameter file for infrastructure deployment"

    # Retrieve JSON object from sample parameter file
    $parametersObject = Get-Content main.parameters.example.json | ConvertFrom-Json

    # Update Parameter Values
    $parametersObject.parameters.engineAppId.value = $EngineAppId
    $parametersObject.parameters.engineAppSecret.value = $EngineSecret
    $parametersObject.parameters.deployAsFunc.value = $AsFunction

    if (-not $AsFunction) {
      $parametersObject.parameters.uiAppId.value = $UIAppId
      $parametersObject.parameters = $parametersObject.parameters | Select-Object * -ExcludeProperty namePrefix, tags
    } else {
      $parametersObject.parameters = $parametersObject.parameters | Select-Object * -ExcludeProperty uiAppId, namePrefix, tags
    }

    # Output updated parameter file for Bicep deployment
    $parametersObject | ConvertTo-Json -Depth 4 | Out-File -FilePath main.parameters.json

    Write-Host "INFO: Bicep parameter file populated successfully" -ForegroundColor Green
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
    $script:AsFunction = $parametersObject.parameters.deployAsFunc.value

    $deployType = $script:AsFunction ? 'Function' : 'Full'

    Write-Host "INFO: Successfully import Bicep parameter values for $deployType deployment" -ForegroundColor Green
    Write-Verbose -Message "Successfully import Bicep parameter values for $deployType deployment"

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
      [string]$UIAppId = '00000000-0000-0000-0000-000000000000',
      [Parameter(Mandatory=$true)]
      [string]$EngineAppId,
      [Parameter(Mandatory=$true)]
      [string]$EngineSecret,
      [Parameter(Mandatory=$true)]
      [string]$UniqueSuffix,
      [Parameter(Mandatory=$false)]
      [string]$NamePrefix,
      [Parameter(Mandatory=$false)]
      [string]$AzureCloud,
      [Parameter(Mandatory=$false)]
      [bool]$AsFunction,
      [Parameter(Mandatory=$false)]
      [bool]$PrivateAcr,
      [Parameter(Mandatory=$false)]
      [hashtable]$Tags,
      [Parameter(Mandatory=$false)]
      [hashtable]$ResourceNames
    )

    Write-Host "INFO: Deploying IPAM bicep templates" -ForegroundColor Green
    Write-Verbose -Message "Deploying bicep templates"

    # Instantiate deployment parameter object
    $deploymentParameters = @{
      engineAppId     = $EngineAppId
      engineAppSecret = $EngineSecret
      uiAppId         = $UiAppId
    }

    if($UniqueSuffix) {
      $deploymentParameters.Add('uniqueSuffix', $UniqueSuffix)
    }

    if($NamePrefix) {
      $deploymentParameters.Add('namePrefix', $NamePrefix)
    }

    if($AzureCloud) {
      $deploymentParameters.Add('azureCloud', $AzureCloud)
    }

    if($AsFunction) {
      $deploymentParameters.Add('deployAsFunc', $AsFunction)
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

    Write-Host "INFO: Updating UI Application with SPA configuration" -ForegroundColor Green
    Write-Verbose -Message "Updating UI Application with SPA configuration"

    $appServiceEndpoint = "https://$Endpoint"

    # Update UI Application with single-page application configuration
    Update-AzADApplication -ApplicationId $UIAppId -SPARedirectUri $appServiceEndpoint 

    Write-Host "INFO: UI Application SPA configuration update complete" -ForegroundColor Green
    Write-Verbose -Message "UI Application SPA configuration update complete"
  }

  # Main Deployment Script Section
  Write-Host
  Write-Host "NOTE: IPAM Deployment Type: $($PSCmdlet.ParameterSetName)" -ForegroundColor Magenta

  if($DEBUG_MODE) {
    Write-Host "DEBUG: Debug Mode Enabled" -ForegroundColor Gray
  }

  try {
    if($PrivateAcr) {
      # Verify Minimum Azure CLI Version
      Write-Host "INFO: PrivateACR flag set, verifying minimum Azure CLI version" -ForegroundColor Green
      Write-Verbose -Message "PrivateACR flag set, verifying minimum Azure CLI version"

      $azureCliVer = [System.Version](az version | ConvertFrom-Json).'azure-cli'

      if($azureCliVer -lt $MIN_AZ_CLI_VER) {
        Write-Host "ERROR: Azure CLI must be version $MIN_AZ_CLI_VER or greater!" -ForegroundColor red
        exit
      }

      # Verify Azure PowerShell and Azure CLI Contexts Match
      Write-Host "INFO: PrivateACR flag set, verifying Azure PowerShell and Azure CLI contexts match" -ForegroundColor Green
      Write-Verbose -Message "PrivateACR flag set, verifying Azure PowerShell and Azure CLI contexts match"

      $azureCliContext = $(az account show | ConvertFrom-Json) 2>$null

      if(-not $azureCliContext) {
        Write-Host "ERROR: Azure CLI not logged in or no subscription has been selected!" -ForegroundColor red
        exit
      }

      $azureCliSub = $azureCliContext.id
      $azurePowerShellSub = (Get-AzContext).Subscription.Id

      if($azurePowerShellSub -ne $azureCliSub) {
        Write-Host "ERROR: Azure PowerShell and Azure CLI must be set to the same context!" -ForegroundColor red
        exit
      }
    }

    if ($PSCmdlet.ParameterSetName -in ('Full', 'AppsOnly', 'Function', 'FuncAppsOnly')) {
      # Fetch Tenant ID
      Write-Host "INFO: Fetching Tenant ID from Azure PowerShell SDK" -ForegroundColor Green
      Write-Verbose -Message "Fetching Tenant ID from Azure PowerShell SDK"
      $tenantId = (Get-AzContext).Tenant.Id

      # Fetch Azure Cloud Type
      Write-Host "INFO: Fetching Azure Cloud type from Azure PowerShell SDK" -ForegroundColor Green
      Write-Verbose -Message "Fetching Azure Cloud type from Azure PowerShell SDK"
      $azureCloud = $AZURE_ENV_MAP[(Get-AzContext).Environment.Name]
    }

    if ($PSCmdlet.ParameterSetName -in ('Full', 'TemplateOnly', 'Function', 'FuncTemplateOnly')) {
      # Validate Azure Region
      Write-Host "INFO: Validating Azure Region selected for deployment" -ForegroundColor Green
      Write-Verbose -Message "Validating Azure Region selected for deployment"

      if (Test-Location -Location $Location) {
        Write-Host "INFO: Azure Region validated successfully" -ForegroundColor Green
        Write-Verbose -Message "Azure Region validated successfully"
      } else {
        Write-Host "ERROR: Location provided is not a valid Azure Region!" -ForegroundColor red
        exit
      }
    }
    

    if ($PSCmdlet.ParameterSetName -in ('Full', 'AppsOnly', 'Function', 'FuncAppsOnly')) {
      $unique = New-UniqueIPAMDeployString

      $appDetails = Deploy-IPAMApplications `
        -UIAppName $UIAppName `
        -EngineAppName $EngineAppName `
        -TenantId $tenantId `
        -AzureCloud $azureCloud `
        -AsFunction $AsFunction

      $consentDetails = @{
        EngineAppId = $appDetails.EngineAppId
        AsFunction = $AsFunction
      }

      if ($PSCmdlet.ParameterSetName -in ('Full', 'AppsOnly')) {
        $consentDetails.Add("UIAppId", $appDetails.UIAppId)
      }

      Grant-AdminConsent @consentDetails -AzureCloud $azureCloud
    }

    if ($PSCmdlet.ParameterSetName -in ('AppsOnly', 'FuncAppsOnly')) {
      Save-Parameters @appDetails -AsFunction $AsFunction
    }

    if ($PSCmdlet.ParameterSetName -in ('TemplateOnly', 'FuncTemplateOnly')) {
      $appDetails = Import-Parameters `
        -ParameterFile $ParameterFile
    }

    if ($PSCmdlet.ParameterSetName -in ('Full', 'TemplateOnly', 'Function', 'FuncTemplateOnly')) {
      $deployment = Deploy-Bicep @appDetails `
        -UniqueSuffix $unique `
        -NamePrefix $NamePrefix `
        -AzureCloud $azureCloud `
        -PrivateAcr $PrivateAcr `
        -AsFunction $AsFunction `
        -Tags $Tags `
        -ResourceNames $ResourceNames

      # Write-Output "ipamSuffix=$($deployment.Outputs["suffix"].Value)" >> $Env:GITHUB_OUTPUT
    }

    if ($PSCmdlet.ParameterSetName -eq 'Full') {
      Update-UIApplication `
        -UIAppId $appDetails.UIAppId `
        -Endpoint $deployment.Outputs["appServiceHostName"].Value
    }

    if ($PSCmdlet.ParameterSetName -in ('Full', 'Function', 'TemplateOnly') -and $PrivateAcr) {
      Write-Host "INFO: Building and pushing container images to Azure Container Registry" -ForegroundColor Green
      Write-Verbose -Message "Building and pushing container images to Azure Container Registry"

      $containerMap = @{
        Debian = @{
          Extension = "deb"
          Port = 80
          Images = @{
            UI     = 'node:18-slim'
            Engine = 'python:3.9-slim'
            LB     = 'nginx:alpine'
          }
        }
        RHEL = @{
          Extension = "rhel"
          Port = 8080
          Images = @{
            UI     = 'registry.access.redhat.com/ubi8/nodejs-18'
            Engine = 'registry.access.redhat.com/ubi8/python-39'
            LB     = 'registry.access.redhat.com/ubi8/nginx-122'
          }
        }
      }

      $enginePath = [Io.Path]::Combine('..', 'engine')
      $engineDockerFile = Join-Path -Path $enginePath -ChildPath "Dockerfile.$($containerMap[$ContainerType].Extension)"
      $functionDockerFile = Join-Path -Path $enginePath -ChildPath 'Dockerfile.func'

      $uiPath = [Io.Path]::Combine('..', 'ui')
      $uiDockerFile = Join-Path -Path $uiPath -ChildPath "Dockerfile.$($containerMap[$ContainerType].Extension)"

      $lbPath = [Io.Path]::Combine('..', 'lb')
      $lbDockerFile = Join-Path -Path $lbPath -ChildPath "Dockerfile"

      if($AsFunction) {
        # WRITE-HOST "INFO: Building Function container ($ContainerType)..." -ForegroundColor Green
        # Write-Verbose -Message "INFO: Building Function container ($ContainerType)..."

        # $funcBuildOutput = $(
        #   az acr build -r $deployment.Outputs["acrName"].Value `
        #     -t ipam-func:latest `
        #     -f $functionDockerFile $enginePath `
        #     --build-arg PORT=$($containerMap[$ContainerType].Port) `
        #     --build-arg BASE_IMAGE=$($containerMap[$ContainerType].Images.Engine)
        # ) *>&1

        WRITE-HOST "INFO: Building Function container..." -ForegroundColor Green
        Write-Verbose -Message "INFO: Building Function container..."

        $funcBuildOutput = $(
          az acr build -r $deployment.Outputs["acrName"].Value `
          -t ipam-func:latest `
          -f $functionDockerFile $enginePath
        ) *>&1

        if ($LASTEXITCODE -ne 0) {
          throw $funcBuildOutput
        } else {
          WRITE-HOST "INFO: Function container image build and push completed successfully" -ForegroundColor Green
          Write-Verbose -Message "Function container image build and push completed successfully"
        }

        Write-Host "INFO: Restarting Function App" -ForegroundColor Green
        Write-Verbose -Message "Restarting Function App"

        Restart-AzFunctionApp -Name $deployment.Outputs["appServiceName"].Value -ResourceGroupName $deployment.Outputs["resourceGroupName"].Value -Force | Out-Null
      } else {
        WRITE-HOST "INFO: Building Engine container ($ContainerType)..." -ForegroundColor Green
        Write-Verbose -Message "INFO: Building Engine container ($ContainerType)..."

        $engineBuildOutput = $(
          az acr build -r $deployment.Outputs["acrName"].Value `
            -t ipam-engine:latest `
            -f $engineDockerFile $enginePath `
            --build-arg PORT=$($containerMap[$ContainerType].Port) `
            --build-arg BASE_IMAGE=$($containerMap[$ContainerType].Images.Engine)
        ) *>&1

        if ($LASTEXITCODE -ne 0) {
          throw $engineBuildOutput
        } else {
          WRITE-HOST "INFO: Engine container image build and push completed successfully" -ForegroundColor Green
          Write-Verbose -Message "Engine container image build and push completed successfully"
        }

        WRITE-HOST "INFO: Building UI container ($ContainerType)..." -ForegroundColor Green
        Write-Verbose -Message "INFO: Building UI container ($ContainerType)..."

        $uiBuildOutput = $(
          az acr build -r $deployment.Outputs["acrName"].Value `
            -t ipam-ui:latest `
            -f $uiDockerFile $uiPath `
            --build-arg PORT=$($containerMap[$ContainerType].Port) `
            --build-arg BASE_IMAGE=$($containerMap[$ContainerType].Images.UI)
        ) *>&1

        if ($LASTEXITCODE -ne 0) {
          throw $uiBuildOutput
        } else {
          WRITE-HOST "INFO: UI container image build and push completed successfully" -ForegroundColor Green
          Write-Verbose -Message "UI container image build and push completed successfully"
        }

        WRITE-HOST "INFO: Building Load Balancer container ($ContainerType)..." -ForegroundColor Green
        Write-Verbose -Message "INFO: Building Load Balancer container ($ContainerType)..."

        $lbBuildOutput = $(
          az acr build -r $deployment.Outputs["acrName"].Value `
            -t ipam-lb:latest `
            -f $lbDockerFile $lbPath `
            --build-arg BASE_IMAGE=$($containerMap[$ContainerType].Images.LB)
        ) *>&1

        if ($LASTEXITCODE -ne 0) {
          throw $lbBuildOutput
        } else {
          WRITE-HOST "INFO: Load Balancer container image build and push completed successfully" -ForegroundColor Green
          Write-Verbose -Message "Load Balancer container image build and push completed successfully"
        }

        Write-Host "INFO: Restarting App Service" -ForegroundColor Green
        Write-Verbose -Message "Restarting App Service"

        Restart-AzWebApp -Name $deployment.Outputs["appServiceName"].Value -ResourceGroupName $deployment.Outputs["resourceGroupName"].Value | Out-Null
      }
    }

    Write-Host "INFO: Azure IPAM Solution deployed successfully" -ForegroundColor Green
    Write-Verbose -Message "Azure IPAM Solution deployed successfully"

    if ($($PSCmdlet.ParameterSetName -eq 'TemplateOnly') -and $(-not $AsFunction)) {
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
  }
  catch {
    $_ | Out-File -FilePath $errorLog -Append
    Write-Host "ERROR: Unable to deploy Azure IPAM solution due to an exception, see logs for detailed information!" -ForegroundColor red
    Write-Host "Run Log: $transcriptLog" -ForegroundColor Red
    Write-Host "Error Log: $errorLog" -ForegroundColor Red

    if($DEBUG_MODE) {
      Write-Host "Debug Log: $debugLog" -ForegroundColor Red
    }
  }
  finally {
    Write-Host
    Stop-Transcript | Out-Null

    Write-Output "ipamURL=https://$($deployment.Outputs["appServiceHostName"].Value)" >> $Env:GITHUB_OUTPUT
    Write-Output "ipamUIAppId=$($appDetails.UIAppId)" >> $Env:GITHUB_OUTPUT
    Write-Output "ipamEngineAppId=$($appDetails.EngineAppId)" >> $Env:GITHUB_OUTPUT
    Write-Output "ipamSuffix=$($deployment.Outputs["suffix"].Value)" >> $Env:GITHUB_OUTPUT
    Write-Output "ipamResourceGroup=$($deployment.Outputs["resourceGroupName"].Value)" >> $Env:GITHUB_OUTPUT

    exit
  }
}
