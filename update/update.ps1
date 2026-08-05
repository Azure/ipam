###############################################################################################################
##
## Azure IPAM ZIP Deploy Updater Script
##
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az.Accounts"; ModuleVersion="2.16.0" }
#Requires -Modules @{ ModuleName="Az.Functions"; ModuleVersion="4.0.7" }
#Requires -Modules @{ ModuleName="Az.Websites"; ModuleVersion="3.2.0" }
#Requires -Modules @{ ModuleName="Az.Resources"; ModuleVersion="6.16.0" }

# Intake and set global parameters
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]
  $AppName,

  [Parameter(Mandatory = $true)]
  [string]
  $ResourceGroupName,

  [Parameter(Mandatory=$false)]
  [string]
  $GitHubUserName = "Azure",

  [Parameter(Mandatory=$false)]
  [string]
  $GitHubRepoName = "ipam",

  [Parameter(Mandatory=$false)]
  [ValidateScript({
    $IndexOfInvalidChar = $_.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars())
    if (-not ($IndexOfInvalidChar -eq -1)) {
      throw [System.ArgumentException]::New("The 'ZipFileName' argument contains one or more invalid characters.")
    }
    if(-not ($_ -match "(\.zip)")) {
      throw [System.ArgumentException]::New("The 'ZipFileName' argument must be of type zip.")
    }
    return $true
  })]
  [string]
  $ZipFileName = "ipam.zip",

  [Parameter(Mandatory=$false)]
  [ValidateScript({
    if(-not ($_ | Get-Item) ) {
      throw [System.ArgumentException]::New("The specified 'AssetFolder' path does not exist. Please provide a pre-existing folder.")
    }
    return $true
  })]
  [System.IO.DirectoryInfo]
  $AssetFolder,

  [Parameter(Mandatory = $false)]
  [ValidateScript({
    if(-not ($_ | Test-Path) ) {
      throw [System.ArgumentException]::New("The specified 'ZipFilePath' path does not exist.")
    }
    if(-not ($_ | Test-Path -PathType Leaf) ) {
      throw [System.ArgumentException]::New("The 'ZipFilePath' argument must be a path to a file, not a folder.")
    }
    if($_ -notmatch "(\.zip)") {
      throw [System.ArgumentException]::New("The file specified in the 'ZipFilePath' argument must be of type zip.")
    }
    return $true
  })]
  [System.IO.FileInfo]
  $ZipFilePath,

  [Parameter(Mandatory = $false)]
  [ValidateSet('Debian', 'RHEL')]
  [string]
  $ContainerType,

  [Parameter(Mandatory = $false)]
  [switch]
  $SkipInfraUpdate,

  [Parameter(Mandatory = $false)]
  [switch]
  $Force
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# How a target version relates to the version currently running
enum IpamVersionState {
  Unknown
  Equal
  Newer
  Older
}

# Minimum Required Azure CLI Version
$MIN_AZ_CLI_VER = [System.Version]'2.35.0'

# Azure IPAM-managed registries. Element [0] is the current registry; any other entry
# (legacy production or the dev/test registry) is auto-repointed to [0].
$IPAM_PUBLIC_ACR = @("registry.azureipam.com", "azureipam.azurecr.io", "azureipamdev.azurecr.io")

# App settings whose presence depends on the deployment shape (App vs Function, container vs
# native, standard vs internet-restricted cloud). These are the ONLY settings convergence may
# REMOVE, and only when they do not belong to the detected shape. Everything else - instance
# specific values (storage, content share, App Insights) and anything a user added themselves -
# is never removed and never overwritten.
#
# DOCKER_REGISTRY_SERVER_URL is deliberately absent: it is only required for registries using
# stored credentials. Azure IPAM pulls anonymously (public) or with a managed identity
# (private ACR), so App Service manages and removes the setting on its own.
$IPAM_SHAPE_APP_SETTINGS = @(
  'FUNCTIONS_EXTENSION_VERSION'
  'FUNCTIONS_WORKER_RUNTIME'
  'SCM_DO_BUILD_DURING_DEPLOYMENT'
  'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
  'WEBSITE_RUN_FROM_PACKAGE'
  'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
)

# Staging slot name used for slot-based updates
$IPAM_SLOT_NAME = "staging"

# Set preference variables
$ErrorActionPreference = "Stop"
$DebugPreference = 'SilentlyContinue'

# Check for Debug Flag (native -Debug common parameter)
$DEBUG_MODE = [bool]$PSCmdlet.MyInvocation.BoundParameters["Debug"].IsPresent
$debugSetting = $DEBUG_MODE ? 'Continue' : 'SilentlyContinue'

# Hide Azure PowerShell SDK Warnings
$Env:SuppressAzurePowerShellBreakingChangeWarnings = $true

# Hide Azure PowerShell SDK & Azure CLI Survey Prompts
$Env:AzSurveyMessage = $false
$Env:AZURE_CORE_SURVEY_MESSAGE = $false

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

# Initialize logging (run transcript + structured detail log + on-demand debug log)
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$transcriptLog = Join-Path -Path $logPath -ChildPath "update_$timestamp.log"
$logFile = Join-Path -Path $logPath -ChildPath "detail_$timestamp.log"
$debugLog = Join-Path -Path $logPath -ChildPath "debug_$timestamp.log"

# Structured file logger (shared, identical pattern with migrate.ps1)
function Write-LogFile {
  param(
    [string]$Message,
    [string]$Level = "INFO",
    [switch]$ToConsole,
    [System.Management.Automation.ErrorRecord]$ErrorRecord = $null
  )

  $logEntry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"

  # Always write to log file
  Add-Content -Path $logFile -Value $logEntry -ErrorAction SilentlyContinue

  # Write detailed error information for ERROR level entries
  if ($Level -eq "ERROR" -and $ErrorRecord) {
    $errorDetails = @"
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] Exception Type: $($ErrorRecord.Exception.GetType().FullName)
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] Exception Message: $($ErrorRecord.Exception.Message)
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] Stack Trace: $($ErrorRecord.ScriptStackTrace)
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] Position: $($ErrorRecord.InvocationInfo.PositionMessage)
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] Command: $($ErrorRecord.InvocationInfo.MyCommand)
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] Line: $($ErrorRecord.InvocationInfo.ScriptLineNumber)
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR-DETAILS] ----------------------------------------
"@
    Add-Content -Path $logFile -Value $errorDetails -ErrorAction SilentlyContinue
  }

  # Optionally write to console
  if ($ToConsole) {
    switch ($Level) {
      "ERROR" { Write-Host $Message -ForegroundColor Red }
      "WARNING" { Write-Host $Message -ForegroundColor Yellow }
      "SUCCESS" { Write-Host $Message -ForegroundColor Green }
      default { Write-Host $Message }
    }
  }
}

$containerBuildError = $false

$TempFolderObj = $null

function Get-AccessToken {
  [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingConvertToSecureStringWithPlainText', '', Justification = 'Normalizes an ephemeral Azure access token across Az module versions (older Az returns a String, newer returns a SecureString). This is not a stored credential.')]
  param(
    [Parameter(Mandatory = $false)]
    [string]$Resource,
    [Parameter(Mandatory = $false)]
    [switch]$AsPlainText
  )

  $params = @{}
  if ($Resource) { $params['ResourceUrl'] = $Resource }

  $token = (Get-AzAccessToken @params).Token

  if ($AsPlainText) {
    if ($token -is [System.Security.SecureString]) {
      return ConvertFrom-SecureString $token -AsPlainText -Force
    }
    return $token
  } else {
    if ($token -isnot [System.Security.SecureString]) {
      return ConvertTo-SecureString $token -AsPlainText -Force
    }
    return $token
  }
}

function Write-Section {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title
  )

  Write-Host
  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host $Title -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue
}

function Get-BuildLog {
  param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory=$true)]
    [string]$RegistryName,
    [Parameter(Mandatory=$true)]
    [string]$BuildId,
    [Parameter(Mandatory=$true)]
    [string]$AzureCloud
  )

  $msArmMap = @{
    AZURE_PUBLIC         = "management.azure.com"
    AZURE_US_GOV         = "management.usgovcloudapi.net"
    AZURE_US_GOV_SECRET  = "management.azure.microsoft.scloud"
    AZURE_GERMANY        = "management.microsoftazure.de"
    AZURE_CHINA          = "management.chinacloudapi.cn"
  }

  $accessToken = Get-AccessToken

  $response = Invoke-RestMethod `
    -Method POST `
    -Uri "https://$($msArmMap[$AzureCloud])/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupName/providers/Microsoft.ContainerRegistry/registries/$RegistryName/runs/$BuildId/listLogSasUrl?api-version=2019-04-01" `
    -Authentication Bearer `
    -Token $accessToken

  $logLink = $response.logLink

  $logs = Invoke-RestMethod `
    -Method GET `
    -Uri $logLink

  return $logs
}

function Restart-IpamApp {
  param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory=$false)]
    [switch]$Function
  )

  $restartRetries = 5
  $restartSuccess = $False

  do {
    Write-Host "🔄 Restarting application..." -ForegroundColor Cyan -NoNewline

    try {
      if ($Function) {
        Restart-AzFunctionApp `
          -Name $AppName `
          -ResourceGroupName $ResourceGroupName `
          -ErrorVariable restartErr `
          -ErrorAction SilentlyContinue `
          -Force `
          | Out-Null
      } else {
        Restart-AzWebApp `
          -Name $AppName `
          -ResourceGroupName $ResourceGroupName `
          -ErrorVariable restartErr `
          -ErrorAction SilentlyContinue `
          | Out-Null
      }

      if ($restartErr) {
        throw $restartErr
      }

      $restartSuccess = $True
      Write-Host " ✅ Success" -ForegroundColor Green
    } catch {
      if($restartRetries -gt 0) {
        Write-Host " ⚠️ Restart failed, retrying..." -ForegroundColor Yellow
        $restartRetries--
      } else {
        Write-Host " ❌ Unable to restart application!" -ForegroundColor Red
        throw $_
      }
    }
  } while ($restartSuccess -eq $False -and $restartRetries -gt 0)
}

function Get-ZipFile {
  param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUserName,
    [Parameter(Mandatory=$true)]
    [string]$GitHubRepoName,
    [Parameter(Mandatory=$true)]
    [string]$ZipFileName,
    [Parameter(Mandatory=$true)]
    [System.IO.DirectoryInfo]$AssetFolder
  )

  $ZipFilePath = Join-Path -Path $AssetFolder.FullName -ChildPath $ZipFileName

  try {
    $GitHubURL = "https://api.github.com/repos/$GitHubUserName/$GitHubRepoName/releases/latest"

    Write-Host "🔍 Target GitHub repo: " -ForegroundColor Cyan -NoNewline
    Write-Host "$GitHubUserName/$GitHubRepoName" -ForegroundColor White
    Write-Host "🔍 Fetching latest release download URL..." -ForegroundColor Cyan -NoNewline

    $GHResponse = Invoke-WebRequest -Method GET -Uri $GitHubURL
    $JSONResponse = $GHResponse.Content | ConvertFrom-Json
    $AssetList = $JSONResponse.assets
    $Asset = $AssetList | Where-Object { $_.name -eq $ZipFileName }
    $DownloadURL = $Asset.browser_download_url

    Write-Host " ✅ Found" -ForegroundColor Green
    Write-Host "🔍 Downloading ZIP archive to " -ForegroundColor Cyan -NoNewline
    Write-Host $ZipFilePath -ForegroundColor White

    Invoke-WebRequest -Uri $DownloadURL -OutFile $ZipFilePath
  } catch {
    Write-Host " ❌ Failed" -ForegroundColor Red
    Write-Host "  ❌ Unable to download ZIP Deploy archive!" -ForegroundColor Red
    throw $_
  }
}

function Publish-ZipFile {
  param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory=$true)]
    [System.IO.FileInfo]$ZipFilePath,
    [Parameter(Mandatory=$false)]
    [switch]$UseAPI
  )

  if ($UseAPI) {
    Write-Host "ℹ️ Using Kudu API for ZIP Deploy" -ForegroundColor Cyan
  }

  $publishRetries = 3
  $publishSuccess = $False

  if ($UseAPI) {
    $accessToken = Get-AccessToken -AsPlainText
    $zipContents = Get-Item -Path $ZipFilePath

    $publishProfile = Get-AzWebAppPublishingProfile -Name $AppName -ResourceGroupName $ResourceGroupName
    $zipUrl = ([System.uri]($publishProfile | Select-Xml -XPath "//publishProfile[@publishMethod='ZipDeploy']" | Select-Object -ExpandProperty Node).publishUrl).Scheme
  }

  do {
    try {
      if (-not $UseAPI) {
        Publish-AzWebApp `
          -Name $AppName `
          -ResourceGroupName $ResourceGroupName `
          -ArchivePath $ZipFilePath `
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
    } catch {
      if($publishRetries -gt 0) {
        Write-Host "  ⚠️ Upload failed, retrying..." -ForegroundColor Yellow
        $publishRetries--
      } else {
        Write-Host "  ❌ Unable to upload ZIP Deploy archive!" -ForegroundColor Red
        throw $_
      }
    }
  } while ($publishSuccess -eq $False -and $publishRetries -ge 0)
}

function Get-RunningVersion {
  param(
    [Parameter(Mandatory = $true)]
    $ExistingApp
  )

  try {
    $appUri = $ExistingApp.DefaultHostName
    if ([string]::IsNullOrWhiteSpace($appUri)) { $appUri = $ExistingApp.HostNames[0] }

    $status = Invoke-RestMethod -Method Get -Uri "https://$appUri/api/status" -TimeoutSec 30 -ErrorAction Stop
    return $status.version
  } catch {
    return $null
  }
}

function Get-LatestReleaseVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUserName,
    [Parameter(Mandatory = $true)]
    [string]$GitHubRepoName
  )

  try {
    $release = Invoke-RestMethod -Method GET -Uri "https://api.github.com/repos/$GitHubUserName/$GitHubRepoName/releases/latest" -ErrorAction Stop
    return $release.tag_name
  } catch {
    return $null
  }
}

function Get-RegistryImageVersion {
  # Reads the 'org.opencontainers.image.version' OCI label from a remote image WITHOUT
  # pulling it, using the Docker Registry v2 HTTP API (compatible with ACR anonymous pull).
  # Returns the version string, or $null if it can't be determined (e.g. pre-OCI images,
  # anonymous pull disabled, or any transport error) so callers can fall back safely.
  param(
    [Parameter(Mandatory = $true)]
    [string]$Registry,
    [Parameter(Mandatory = $true)]
    [string]$Repository,
    [Parameter(Mandatory = $false)]
    [string]$Tag = 'latest'
  )

  $acceptTypes = @(
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
    'application/vnd.docker.distribution.manifest.v2+json'
  ) -join ', '

  try {
    $baseUri = "https://$Registry"

    # Obtain an anonymous pull token. If /v2/ is open we proceed without one; otherwise we
    # parse the Bearer challenge (realm + service) and request a repository:pull token.
    $token = $null
    try {
      Invoke-WebRequest -Uri "$baseUri/v2/" -Method Get -UseBasicParsing -ErrorAction Stop | Out-Null
    } catch {
      $response = $_.Exception.Response

      if ($null -ne $response -and [int]$response.StatusCode -eq 401) {
        $bearer = $response.Headers.WwwAuthenticate | Where-Object { $_.Scheme -eq 'Bearer' } | Select-Object -First 1

        if ($bearer -and $bearer.Parameter -match 'realm="([^"]+)"') {
          $realm = $Matches[1]
          $service = if ($bearer.Parameter -match 'service="([^"]+)"') { $Matches[1] } else { $Registry }
          $scope = "repository:${Repository}:pull"
          $tokenUri = "${realm}?service=$([uri]::EscapeDataString($service))&scope=$([uri]::EscapeDataString($scope))"

          $tokenResp = Invoke-RestMethod -Uri $tokenUri -Method Get -ErrorAction Stop
          $token = if ($tokenResp.access_token) { $tokenResp.access_token } else { $tokenResp.token }
        }
      } else {
        throw
      }
    }

    $headers = @{ Accept = $acceptTypes }
    if ($token) { $headers['Authorization'] = "Bearer $token" }

    # Fetch the manifest; if it's a multi-arch index, descend into a linux/amd64 manifest.
    $manifest = Invoke-RestMethod -Uri "$baseUri/v2/$Repository/manifests/$Tag" -Headers $headers -Method Get -ErrorAction Stop
    if ($manifest -is [string]) { $manifest = $manifest | ConvertFrom-Json }

    if ($manifest.manifests) {
      $child = $manifest.manifests |
        Where-Object { $_.platform.os -eq 'linux' -and $_.platform.architecture -eq 'amd64' } |
        Select-Object -First 1
      if (-not $child) {
        $child = $manifest.manifests | Where-Object { $_.platform.architecture -ne 'unknown' } | Select-Object -First 1
      }
      if (-not $child) { $child = $manifest.manifests[0] }

      $manifest = Invoke-RestMethod -Uri "$baseUri/v2/$Repository/manifests/$($child.digest)" -Headers $headers -Method Get -ErrorAction Stop
      if ($manifest -is [string]) { $manifest = $manifest | ConvertFrom-Json }
    }

    $configDigest = $manifest.config.digest
    if (-not $configDigest) { return $null }

    $configHeaders = @{}
    if ($token) { $configHeaders['Authorization'] = "Bearer $token" }

    $config = Invoke-RestMethod -Uri "$baseUri/v2/$Repository/blobs/$configDigest" -Headers $configHeaders -Method Get -ErrorAction Stop
    if ($config -is [string]) { $config = $config | ConvertFrom-Json }

    $version = $config.config.Labels.'org.opencontainers.image.version'
    if ([string]::IsNullOrWhiteSpace($version)) { return $null }

    # 0.0.0 is the Dockerfile default for IPAM_VERSION, so the image was built unstamped
    if ($version.Trim() -eq '0.0.0') {
      Write-LogFile -Message "Image ${Registry}/${Repository}:${Tag} carries the unstamped 0.0.0 version label; treating the version as unknown." -Level "WARNING"
      return $null
    }

    return $version
  } catch {
    Write-LogFile -Message "Unable to read OCI version label from ${Registry}/${Repository}:${Tag} - $($_.Exception.Message)" -Level "WARNING"
    return $null
  }
}

function Resolve-ContainerType {
  <#
    Resolves the container distro ('Debian' or 'RHEL') used to select the Dockerfile for the
    private-ACR image build. An explicit -ContainerType override always wins; otherwise the
    value auto-detected from the app's /api/status (container.image_id) is normalized.
    Returns $null when neither is available so the caller can guide the user rather than fail.
  #>
  param(
    [Parameter(Mandatory = $false)]
    [string]$Override,
    [Parameter(Mandatory = $false)]
    [string]$ProbedImage
  )

  # Explicit override wins (already constrained by the -ContainerType ValidateSet)
  if (-not [string]::IsNullOrWhiteSpace($Override)) {
    return $Override
  }

  switch ("$ProbedImage".Trim().ToLower()) {
    'debian' { return 'Debian' }
    'rhel'   { return 'RHEL' }
  }

  return $null
}

function Get-IpamVersionState {
  <#
    Describes how Target relates to Current using SemVer ordering, so prerelease suffixes
    (for example 4.0.0-preview) order correctly. Returns Unknown when either value is missing
    or cannot be parsed, letting callers fall back to their safe default.
  #>
  [OutputType([IpamVersionState])]
  param(
    [Parameter(Mandatory = $false)]
    [AllowNull()]
    [string]$Current,
    [Parameter(Mandatory = $false)]
    [AllowNull()]
    [string]$Target
  )

  $currentSemVer = $null
  $targetSemVer = $null

  if (-not [System.Management.Automation.SemanticVersion]::TryParse(($Current -replace '^v', ''), [ref]$currentSemVer)) {
    return [IpamVersionState]::Unknown
  }

  if (-not [System.Management.Automation.SemanticVersion]::TryParse(($Target -replace '^v', ''), [ref]$targetSemVer)) {
    return [IpamVersionState]::Unknown
  }

  if ($targetSemVer -eq $currentSemVer) { return [IpamVersionState]::Equal }
  if ($targetSemVer -gt $currentSemVer) { return [IpamVersionState]::Newer }

  return [IpamVersionState]::Older
}

function Get-UserConfirmation {
  param(
    [Parameter(Mandatory = $false)]
    [string]$Message,
    [Parameter(Mandatory = $true)]
    [string]$PromptText
  )

  if ($Message) {
    Write-Host $Message -ForegroundColor Yellow
  }

  do {
    $confirmation = Read-Host "$PromptText (Y/N)"
    switch ($confirmation.Trim().ToUpper()) {
      { $_ -in @("Y", "YES") } { Write-Host; return $true }
      { $_ -in @("N", "NO") }  { Write-Host; return $false }
      default { Write-Host "Invalid input. Please enter Y or N." -ForegroundColor Red }
    }
  } while ($true)
}

function Get-AppSettingValue {
  param(
    [Parameter(Mandatory = $true)]
    [AllowNull()]
    $AppSettings,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $setting = $AppSettings | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  return $setting ? $setting.Value : $null
}

function Get-IpamTargetSiteConfig {
  <#
    Site configuration a fresh deployment would produce today for the supplied shape.
    IMPORTANT: keep in sync with deploy/modules/appService.bicep + deploy/modules/functionApp.bicep.
  #>
  param(
    [Parameter(Mandatory = $true)]
    [string]$LinuxFxVersion,
    [Parameter(Mandatory = $true)]
    [bool]$IsFunction,
    [Parameter(Mandatory = $true)]
    [bool]$IsContainer,
    [Parameter(Mandatory = $true)]
    [string]$PythonVersion
  )

  $target = [ordered]@{}

  if ($IsContainer) {
    # Containers pin the runtime inside the image; only the registry host is ours to correct.
    $registryHost = $LinuxFxVersion.Split('|')[1].Split('/')[0]

    if (($registryHost -in $IPAM_PUBLIC_ACR) -and ($registryHost -ne $IPAM_PUBLIC_ACR[0])) {
      $target['LinuxFxVersion'] = $LinuxFxVersion.Replace($registryHost, $IPAM_PUBLIC_ACR[0])
    }
    else {
      $target['LinuxFxVersion'] = $LinuxFxVersion
    }
  }
  else {
    $target['LinuxFxVersion'] = "PYTHON|$PythonVersion"

    # Functions supply their own startup host; only App Service sets a command line.
    if (-not $IsFunction) {
      $target['AppCommandLine'] = 'bash ./init.sh 8000'
    }
  }

  $target['HealthCheckPath'] = '/api/status'

  return $target
}

function Get-IpamTargetAppSettingMap {
  <#
    Canonical app settings a fresh deployment would produce today for the supplied shape.
    Instance-specific settings (COSMOS_URL, storage, content share, App Insights) are
    deliberately excluded - they cannot be synthesized and are never touched.
    IMPORTANT: keep in sync with deploy/modules/appService.bicep + deploy/modules/functionApp.bicep.
  #>
  param(
    [Parameter(Mandatory = $true)]
    [AllowNull()]
    $AppSettings,
    [Parameter(Mandatory = $true)]
    [bool]$IsFunction,
    [Parameter(Mandatory = $true)]
    [bool]$IsContainer,
    [Parameter(Mandatory = $true)]
    [bool]$RunFromPackage,
    [Parameter(Mandatory = $true)]
    [string]$AzureCloud
  )

  $keyVaultUri = Get-AppSettingValue -AppSettings $AppSettings -Name 'KEYVAULT_URL'

  $target = [ordered]@{
    AZURE_ENV                           = $AzureCloud
    MANAGED_IDENTITY_ID                 = "@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/IDENTITY-ID/)"
    UI_APP_ID                           = "@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/UI-ID/)"
    ENGINE_APP_ID                       = "@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-ID/)"
    ENGINE_APP_SECRET                   = "@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/ENGINE-SECRET/)"
    TENANT_ID                           = "@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/TENANT-ID/)"
    WEBSITE_HEALTHCHECK_MAXPINGFAILURES = '2'
  }

  if ($IsFunction) {
    $target['FUNCTIONS_EXTENSION_VERSION'] = '~4'
  }

  if ($IsContainer) {
    if (-not $IsFunction) {
      $target['WEBSITE_ENABLE_SYNC_UPDATE_SITE'] = 'true'
    }

    if ($IsFunction) {
      $target['WEBSITES_ENABLE_APP_SERVICE_STORAGE'] = 'false'
    }
  }
  else {
    if ($IsFunction) {
      $target['FUNCTIONS_WORKER_RUNTIME'] = 'python'
    }

    if ($RunFromPackage) {
      $target['WEBSITE_RUN_FROM_PACKAGE'] = '1'
    }
    else {
      $target['SCM_DO_BUILD_DURING_DEPLOYMENT'] = 'true'
    }
  }

  return $target
}

function Get-IpamSiteDrift {
  <#
    Compares a single site (production or staging slot) against the supplied target state.
    Existing values are NEVER overwritten - only entirely missing settings are added, and only
    shape-conditional settings may be removed.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $Site,
    [Parameter(Mandatory = $true)]
    $TargetSiteConfig,
    [Parameter(Mandatory = $true)]
    $TargetAppSettings
  )

  $configChanges = [ordered]@{}

  foreach ($key in $TargetSiteConfig.Keys) {
    $current = $Site.SiteConfig.$key
    $desired = $TargetSiteConfig[$key]

    if ($current -ne $desired) {
      $configChanges[$key] = [PSCustomObject]@{ Current = $current; Target = $desired }
    }
  }

  $liveNames = @($Site.SiteConfig.AppSettings | ForEach-Object { $_.Name })

  $addSettings = [ordered]@{}

  foreach ($key in $TargetAppSettings.Keys) {
    if ($key -notin $liveNames) {
      $addSettings[$key] = $TargetAppSettings[$key]
    }
  }

  $removeSettings = @(
    $IPAM_SHAPE_APP_SETTINGS | Where-Object { ($_ -in $liveNames) -and ($_ -notin $TargetAppSettings.Keys) }
  )

  return [PSCustomObject]@{
    ConfigChanges  = $configChanges
    AddSettings    = $addSettings
    RemoveSettings = $removeSettings
    HasDrift       = (($configChanges.Count -gt 0) -or ($addSettings.Count -gt 0) -or ($removeSettings.Count -gt 0))
  }
}

function Invoke-IpamSiteConvergence {
  <#
    Applies the supplied drift to one site. Site configuration is written directly against the
    site's 'web' configuration - omitted properties are left unchanged - rather than round
    tripping the site object, which does not reliably carry every SiteConfig property.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $Site,
    [Parameter(Mandatory = $true)]
    $Drift,
    [Parameter(Mandatory = $true)]
    [string]$AppName,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $false)]
    [string]$Slot
  )

  $armPropertyNames = @{
    LinuxFxVersion  = 'linuxFxVersion'
    AppCommandLine  = 'appCommandLine'
    HealthCheckPath = 'healthCheckPath'
  }

  if ($Drift.ConfigChanges.Count -gt 0) {
    if ($Slot) {
      $resourceType = "Microsoft.Web/sites/slots/config"
      $resourceName = "${AppName}/${Slot}/web"
    }
    else {
      $resourceType = "Microsoft.Web/sites/config"
      $resourceName = "${AppName}/web"
    }

    $properties = @{}

    foreach ($key in $Drift.ConfigChanges.Keys) {
      $properties[$armPropertyNames[$key]] = $Drift.ConfigChanges[$key].Target
    }

    Set-AzResource `
      -ResourceGroupName $ResourceGroupName `
      -ResourceType $resourceType `
      -ResourceName $resourceName `
      -ApiVersion "2023-12-01" `
      -Properties $properties `
      -Force `
      | Out-Null
  }

  if (($Drift.AddSettings.Count -gt 0) -or ($Drift.RemoveSettings.Count -gt 0)) {
    $settings = @{}
    $Site.SiteConfig.AppSettings | ForEach-Object { $settings[$_.Name] = $_.Value }

    foreach ($key in $Drift.AddSettings.Keys) {
      $settings[$key] = $Drift.AddSettings[$key]
    }

    foreach ($key in $Drift.RemoveSettings) {
      $settings.Remove($key)
    }

    if ($Slot) {
      Set-AzWebAppSlot -ResourceGroupName $ResourceGroupName -Name $AppName -Slot $Slot -AppSettings $settings | Out-Null
    }
    else {
      Set-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName -AppSettings $settings | Out-Null
    }
  }
}

function Get-IpamSlotContext {
  <#
    Preflight for staging-slot creation. Returns a context describing whether the slot can be
    created and, when it can, everything update/main.bicep needs in order to create it.
    Never throws - an unsupported deployment reports Supported = $false with a reason.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $ExistingApp,
    [Parameter(Mandatory = $true)]
    [string]$AppName,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $true)]
    [bool]$IsFunction,
    [Parameter(Mandatory = $true)]
    [bool]$IsContainer,
    [Parameter(Mandatory = $true)]
    [string]$TargetLinuxFxVersion
  )

  $UNSUPPORTED_TIERS = @('Free', 'Shared', 'Basic', 'Dynamic')

  $unsupported = {
    param([string]$Reason)
    return [PSCustomObject]@{ Supported = $false; Reason = $Reason }
  }

  # Verify the App Service Plan tier supports deployment slots
  $planResource = Get-AzResource -ResourceId $ExistingApp.ServerFarmId -ExpandProperties -ErrorAction SilentlyContinue

  if (-not $planResource) {
    return & $unsupported "App Service Plan could not be resolved"
  }

  $planTier = $planResource.Sku.tier
  if ([string]::IsNullOrWhiteSpace($planTier)) { $planTier = $planResource.Sku.Tier }

  if ($planTier -in $UNSUPPORTED_TIERS) {
    return & $unsupported "the '$planTier' tier does not support deployment slots (requires Standard or higher)"
  }

  # Verify a user-assigned managed identity is present (the slot reuses it for KeyVault/Cosmos)
  $userAssignedIds = $ExistingApp.Identity.UserAssignedIdentities

  if (-not $userAssignedIds -or $userAssignedIds.Count -eq 0) {
    return & $unsupported "no user-assigned managed identity was found"
  }

  $managedIdentityId = @($userAssignedIds.Keys)[0]
  $miResource = Get-AzResource -ResourceId $managedIdentityId -ExpandProperties -ErrorAction SilentlyContinue
  $managedIdentityClientId = $miResource.Properties.clientId

  if ([string]::IsNullOrWhiteSpace($managedIdentityClientId)) {
    return & $unsupported "the managed identity client ID could not be resolved"
  }

  # Verify the baseline app settings are present (non-standard deployments are skipped)
  $appSettings = $ExistingApp.SiteConfig.AppSettings

  $cosmosDbUri   = Get-AppSettingValue -AppSettings $appSettings -Name 'COSMOS_URL'
  $databaseName  = Get-AppSettingValue -AppSettings $appSettings -Name 'DATABASE_NAME'
  $containerName = Get-AppSettingValue -AppSettings $appSettings -Name 'CONTAINER_NAME'
  $keyVaultUri   = Get-AppSettingValue -AppSettings $appSettings -Name 'KEYVAULT_URL'
  $azureEnv      = Get-AppSettingValue -AppSettings $appSettings -Name 'AZURE_ENV'

  $missingSettings = @()
  if ([string]::IsNullOrWhiteSpace($cosmosDbUri))   { $missingSettings += 'COSMOS_URL' }
  if ([string]::IsNullOrWhiteSpace($keyVaultUri))   { $missingSettings += 'KEYVAULT_URL' }
  if ([string]::IsNullOrWhiteSpace($databaseName))  { $missingSettings += 'DATABASE_NAME' }
  if ([string]::IsNullOrWhiteSpace($containerName)) { $missingSettings += 'CONTAINER_NAME' }

  if ($missingSettings.Count -gt 0) {
    return & $unsupported "baseline app settings are missing ($($missingSettings -join ', '))"
  }

  $azureCloud = [string]::IsNullOrWhiteSpace($azureEnv) ? 'AZURE_PUBLIC' : $azureEnv

  # Derived from the cloud, as deploy/modules/*.bicep does. Reading the live setting would be
  # wrong here because this runs before production converges.
  $runFromPackage = ($azureCloud -eq 'AZURE_US_GOV_SECRET')

  # Mirror production's ACR authentication method (managed identity vs admin/anonymous)
  # rather than inferring it from the registry name.
  $acrUseManagedIdentity = [bool]$ExistingApp.SiteConfig.AcrUseManagedIdentityCreds

  $prodSubnetId = $ExistingApp.VirtualNetworkSubnetId
  $hasVnet = -not [string]::IsNullOrWhiteSpace($prodSubnetId)

  return [PSCustomObject]@{
    Supported  = $true
    Reason     = ''
    HasVnet    = $hasVnet
    SubnetId   = $prodSubnetId
    AzureCloud = $azureCloud
    Location   = $ExistingApp.Location
    PlanTier   = $planTier
    ResourceDetails = @{
      appServiceName          = $AppName
      appServiceRG            = $ResourceGroupName
      appServicePlanId        = $ExistingApp.ServerFarmId
      managedIdentityId       = $managedIdentityId
      managedIdentityClientId = $managedIdentityClientId
      cosmosDbUri             = $cosmosDbUri
      databaseName            = $databaseName
      containerName           = $containerName
      keyVaultUri             = $keyVaultUri
      linuxFxVersion          = $TargetLinuxFxVersion
      isFunction              = $IsFunction
      deployAsContainer       = $IsContainer
      acrUseManagedIdentity   = $acrUseManagedIdentity
      runFromPackage          = $runFromPackage
    }
  }
}

function New-IpamStagingSlot {
  <#
    Creates the 'staging' slot from update/main.bicep, mirroring production (runtime stack,
    vNet) and enforcing only the PRESENCE of baseline app settings.

    Failure is non-fatal: it warns and returns so the production update can still proceed.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $SlotContext
  )

  try {
    $bicepPath = Join-Path -Path $ROOT_DIR -ChildPath "update" -AdditionalChildPath "main.bicep"

    if (-not (Test-Path -Path $bicepPath)) {
      Write-Host "⚠️ Infrastructure template not found at '$bicepPath'; skipping slot creation" -ForegroundColor Yellow
      return
    }

    $hasVnet = $SlotContext.HasVnet
    $prodSubnetId = $SlotContext.SubnetId

    $deploymentParameters = @{
      location        = $SlotContext.Location
      azureCloud      = $SlotContext.AzureCloud
      replicateVnet   = $true
      resourceDetails = $SlotContext.ResourceDetails
    }

    $deployment = $null
    $vnetManual = $false

    Write-Host "🚀 Creating the '$IPAM_SLOT_NAME' slot (this may take a few minutes)..." -ForegroundColor Cyan -NoNewline

    # Capture the Azure deployment debug stream to the debug log when -Debug is set
    $DebugPreference = $debugSetting

    try {
      $deployment = New-AzSubscriptionDeployment `
        -Name "ipamSlotMigrate-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
        -Location $SlotContext.Location `
        -TemplateFile $bicepPath `
        -TemplateParameterObject $deploymentParameters `
        -ErrorAction Stop 5>$($DEBUG_MODE ? $debugLog : $null)
    }
    catch {
      $deployError = $_

      # Only fall back to a bare slot when the failure is actually vNet/subnet related
      # (e.g. missing subnet join permission or delegation). Any other failure — such as
      # insufficient subscription-scope deployment rights — is a genuine failure and is
      # surfaced as-is rather than masked behind a misleading vNet retry.
      $isVnetFailure = $hasVnet -and ($deployError.ToString() -match 'subnet|virtualnetwork|delegat')

      if ($isVnetFailure) {
        Write-Host " ⚠️ Retrying without vNet integration" -ForegroundColor Yellow
        Write-LogFile -Message "Slot deployment failed; retrying without vNet integration." -Level "ERROR" -ErrorRecord $deployError

        $deploymentParameters.replicateVnet = $false
        $vnetManual = $true

        Write-Host "🚀 Creating the '$IPAM_SLOT_NAME' slot (this may take a few minutes)..." -ForegroundColor Cyan -NoNewline

        $deployment = New-AzSubscriptionDeployment `
          -Name "ipamSlotMigrate-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
          -Location $SlotContext.Location `
          -TemplateFile $bicepPath `
          -TemplateParameterObject $deploymentParameters `
          -ErrorAction Stop 5>$($DEBUG_MODE ? $debugLog : $null)
      }
      else {
        throw $deployError
      }
    }

    $DebugPreference = 'SilentlyContinue'

    Write-Host " ✅ Created" -ForegroundColor Green

    # vNet replication outcome / manual remediation guidance
    if ($hasVnet) {
      $vnetReplicated = -not $vnetManual -and [bool]$deployment.Outputs.vnetReplicated.Value

      if ($vnetReplicated) {
        Write-Host "  ✅ vNet integration replicated to the staging slot" -ForegroundColor Green
      }
      else {
        # Break the subnet resource ID into friendly parts for display; the full ID goes to the log
        $subnetParts = [ordered]@{}
        if ($prodSubnetId -match '/subscriptions/(?<sub>[^/]+)/resourceGroups/(?<rg>[^/]+)/providers/Microsoft\.Network/virtualNetworks/(?<vnet>[^/]+)/subnets/(?<subnet>[^/]+)') {
          $subnetParts['Subscription']    = $Matches['sub']
          $subnetParts['Resource Group']  = $Matches['rg']
          $subnetParts['Virtual Network'] = $Matches['vnet']
          $subnetParts['Subnet']          = $Matches['subnet']
        }

        Write-Host
        Write-Host "⚠️ vNet integration was not applied to the slot automatically." -ForegroundColor Yellow
        Write-Host "   To make the slot swap-ready, manually add regional vNet integration" -ForegroundColor Yellow
        Write-Host "   to the '$IPAM_SLOT_NAME' slot using the subnet below:" -ForegroundColor Yellow
        Write-Host

        if ($subnetParts.Count -gt 0) {
          foreach ($part in $subnetParts.GetEnumerator()) {
            Write-Host ("     {0,-16}: " -f $part.Key) -ForegroundColor Cyan -NoNewline
            Write-Host $part.Value -ForegroundColor White
          }
        }
        else {
          Write-Host "     $prodSubnetId" -ForegroundColor Cyan
        }

        Write-Host
        Write-Host "   Guidance: " -ForegroundColor Yellow -NoNewline
        Write-Host "https://azure.github.io/ipam/#/update/README?id=vnet-integration-on-the-staging-slot" -ForegroundColor Cyan
        Write-Host "   The full subnet resource ID has been written to the log." -ForegroundColor Gray

        # Verbose detail for the log
        Write-LogFile -Message "vNet integration was not applied to the '$IPAM_SLOT_NAME' slot automatically." -Level "WARNING"
        Write-LogFile -Message "To make the slot swap-ready, manually add regional vNet integration using subnet: $prodSubnetId" -Level "WARNING"
      }
    }
  }
  catch {
    # Slot creation is best-effort: never block the core production update
    Write-Host " ❌ Failed" -ForegroundColor Red
    Write-LogFile -Message "Staging slot creation failed (non-fatal): $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_

    Write-Host "  ⚠️ The staging slot could not be created." -ForegroundColor Yellow
    Write-Host "     The application update will continue — only this step was skipped." -ForegroundColor Yellow
    Write-Host "     This is most often caused by insufficient deployment permissions at the" -ForegroundColor Yellow
    Write-Host "     subscription scope. Review the prerequisites, or re-run with -SkipInfraUpdate" -ForegroundColor Yellow
    Write-Host "     to bypass this step entirely." -ForegroundColor Yellow
    Write-Host
    Write-Host ("     {0,-13}: " -f 'Prerequisites') -ForegroundColor Yellow -NoNewline
    Write-Host "https://azure.github.io/ipam/#/update/README?id=prerequisites" -ForegroundColor Cyan
    Write-Host ("     {0,-13}: " -f 'Detail Log') -ForegroundColor Yellow -NoNewline
    Write-Host $logFile -ForegroundColor Gray
  }
}

function Get-IpamDriftPlan {
  <#
    Compares the deployment against what a fresh deployment would produce today and returns
    every difference, along with the state needed to remediate it. Detection is read-only.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $ExistingApp,
    [Parameter(Mandatory = $true)]
    [string]$AppName,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $true)]
    [bool]$IsFunction,
    [Parameter(Mandatory = $true)]
    [bool]$IsContainer,
    [Parameter(Mandatory = $false)]
    [switch]$SkipInfra
  )

  $engineVersionFile = Join-Path -Path $ROOT_DIR -ChildPath 'engine' -AdditionalChildPath 'app', 'version.json'
  $pythonVersion = $(Get-Content -Path $engineVersionFile | ConvertFrom-Json).python

  $appSettings = $ExistingApp.SiteConfig.AppSettings

  $azureCloud = Get-AppSettingValue -AppSettings $appSettings -Name 'AZURE_ENV'
  if ([string]::IsNullOrWhiteSpace($azureCloud)) { $azureCloud = 'AZURE_PUBLIC' }

  # Derived from the cloud, exactly as deploy/modules/*.bicep does - not from the live setting,
  # so an internet-restricted deployment converges onto the run-from-package model.
  $runFromPackage = ($azureCloud -eq 'AZURE_US_GOV_SECRET')

  $targetSiteConfig = Get-IpamTargetSiteConfig `
    -LinuxFxVersion $ExistingApp.SiteConfig.LinuxFxVersion `
    -IsFunction $IsFunction `
    -IsContainer $IsContainer `
    -PythonVersion $pythonVersion

  $targetAppSettings = Get-IpamTargetAppSettingMap `
    -AppSettings $appSettings `
    -IsFunction $IsFunction `
    -IsContainer $IsContainer `
    -RunFromPackage $runFromPackage `
    -AzureCloud $azureCloud

  $prodDrift = Get-IpamSiteDrift -Site $ExistingApp -TargetSiteConfig $targetSiteConfig -TargetAppSettings $targetAppSettings

  # Staging slot: mirror production so a future swap cannot regress the live site
  $slot = Get-AzWebAppSlot `
    -ResourceGroupName $ResourceGroupName `
    -Name $AppName `
    -Slot $IPAM_SLOT_NAME `
    -ErrorAction SilentlyContinue

  $slotDrift = $null
  $slotContext = $null

  if ($slot) {
    $slotDrift = Get-IpamSiteDrift -Site $slot -TargetSiteConfig $targetSiteConfig -TargetAppSettings $targetAppSettings
  }
  elseif (-not $SkipInfra) {
    $slotContext = Get-IpamSlotContext `
      -ExistingApp $ExistingApp `
      -AppName $AppName `
      -ResourceGroupName $ResourceGroupName `
      -IsFunction $IsFunction `
      -IsContainer $IsContainer `
      -TargetLinuxFxVersion $targetSiteConfig['LinuxFxVersion']
  }

  # Content-share settings must stay with their slot during a swap (non-container Functions only)
  $stickyMissing = @()

  if ($IsFunction -and -not $IsContainer) {
    $stickyNames = @('WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', 'WEBSITE_CONTENTSHARE')
    $slotConfigNames = Get-AzWebAppSlotConfigName -ResourceGroupName $ResourceGroupName -Name $AppName -ErrorAction SilentlyContinue
    $currentSticky = @($slotConfigNames.AppSettingNames)

    $stickyMissing = @($stickyNames | Where-Object { $_ -notin $currentSticky })
  }

  return [PSCustomObject]@{
    ProdDrift        = $prodDrift
    SlotDrift        = $slotDrift
    Slot             = $slot
    SlotContext      = $slotContext
    StickyMissing    = $stickyMissing
    IsFunction       = $IsFunction
    IsContainer      = $IsContainer
    HasDrift         = (
      $prodDrift.HasDrift -or
      ($slotDrift -and $slotDrift.HasDrift) -or
      ($slotContext -and $slotContext.Supported) -or
      ($stickyMissing.Count -gt 0)
    )
  }
}

function Format-IpamConfigChange {
  <#
    Renders a site-config change as a label and a minimal before/after. For LinuxFxVersion only
    the registry host (container) or Python version (native) can differ - the rest of the string
    is identical either side - so only that portion is shown.
  #>
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    $Change,
    [Parameter(Mandatory = $true)]
    [bool]$IsContainer
  )

  $current = $Change.Current
  $target = $Change.Target

  switch ($Key) {
    'LinuxFxVersion' {
      $label = $IsContainer ? 'Container Registry' : 'Python Version'

      if ($current -match '\|') {
        $current = $IsContainer ? $current.Split('|')[1].Split('/')[0] : $current.Split('|')[1]
      }

      if ($target -match '\|') {
        $target = $IsContainer ? $target.Split('|')[1].Split('/')[0] : $target.Split('|')[1]
      }
    }
    'AppCommandLine'  { $label = 'Startup Command' }
    'HealthCheckPath' { $label = 'Health Check' }
    default           { $label = $Key }
  }

  if ([string]::IsNullOrWhiteSpace($current)) { $current = '(not set)' }

  return [PSCustomObject]@{
    Label  = $label
    Detail = "$current -> $target"
  }
}

function Show-IpamDriftPlan {
  <#
    Renders the drift plan. Production and the staging slot are presented as one logical unit;
    the slot is only called out separately when it is being created or has diverged.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $Plan
  )

  $write = {
    param([string]$Name, [string]$Detail)
    Write-Host ("  {0,-20}: " -f $Name) -ForegroundColor Cyan -NoNewline
    Write-Host $Detail -ForegroundColor White
  }

  Write-Host "The following changes will bring this deployment in line with a current" -ForegroundColor Gray
  Write-Host "Azure IPAM deployment. Existing values and any settings you have added" -ForegroundColor Gray
  Write-Host "yourself are preserved." -ForegroundColor Gray
  Write-Host

  foreach ($key in $Plan.ProdDrift.ConfigChanges.Keys) {
    $formatted = Format-IpamConfigChange -Key $key -Change $Plan.ProdDrift.ConfigChanges[$key] -IsContainer $Plan.IsContainer
    & $write $formatted.Label $formatted.Detail
  }

  # Slot-only differences (production is already correct for these)
  if ($Plan.SlotDrift) {
    foreach ($key in $Plan.SlotDrift.ConfigChanges.Keys) {
      if ($Plan.ProdDrift.ConfigChanges.Contains($key)) { continue }

      $formatted = Format-IpamConfigChange -Key $key -Change $Plan.SlotDrift.ConfigChanges[$key] -IsContainer $Plan.IsContainer
      & $write $formatted.Label "$($formatted.Detail) (staging slot)"
    }
  }

  $addedSettings = @($Plan.ProdDrift.AddSettings.Keys)
  if ($Plan.SlotDrift) {
    $addedSettings = @($addedSettings + @($Plan.SlotDrift.AddSettings.Keys) | Select-Object -Unique)
  }

  if ($addedSettings.Count -gt 0) {
    & $write 'Add Settings' ($addedSettings -join ', ')
  }

  $removedSettings = @($Plan.ProdDrift.RemoveSettings)
  if ($Plan.SlotDrift) {
    $removedSettings = @($removedSettings + @($Plan.SlotDrift.RemoveSettings) | Select-Object -Unique)
  }

  if ($removedSettings.Count -gt 0) {
    & $write 'Remove Settings' ($removedSettings -join ', ')
  }

  if ($Plan.SlotContext -and $Plan.SlotContext.Supported) {
    & $write 'Deployment Slot' "$IPAM_SLOT_NAME (created disabled)"

    if ($Plan.SlotContext.HasVnet) {
      & $write 'vNet Integration' 'mirrored from production'
    }
  }

  if ($Plan.StickyMissing.Count -gt 0) {
    & $write 'Slot Settings' "mark slot-specific: $($Plan.StickyMissing -join ', ')"
  }

  Write-Host

  if ($Plan.SlotContext -and -not $Plan.SlotContext.Supported) {
    Write-Host "ℹ️ The staging slot cannot be created because $($Plan.SlotContext.Reason)." -ForegroundColor Cyan
    Write-Host
  }
}

function Invoke-IpamDriftRemediation {
  <#
    Applies the plan. Production converges first so a newly created slot inherits corrected
    values rather than the stale ones it would otherwise mirror.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $Plan,
    [Parameter(Mandatory = $true)]
    $ExistingApp,
    [Parameter(Mandatory = $true)]
    [string]$AppName,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName
  )

  if ($Plan.ProdDrift.HasDrift) {
    Write-Host "🔧 Updating application configuration..." -ForegroundColor Cyan -NoNewline

    Invoke-IpamSiteConvergence `
      -Site $ExistingApp `
      -Drift $Plan.ProdDrift `
      -AppName $AppName `
      -ResourceGroupName $ResourceGroupName

    Write-Host " ✅ Done" -ForegroundColor Green

    # Give the site a moment to settle after a runtime stack or app setting change
    Start-Sleep -Seconds 10
  }

  if ($Plan.SlotDrift -and $Plan.SlotDrift.HasDrift) {
    Write-Host "🔧 Updating staging slot configuration..." -ForegroundColor Cyan -NoNewline

    Invoke-IpamSiteConvergence `
      -Site $Plan.Slot `
      -Drift $Plan.SlotDrift `
      -AppName $AppName `
      -ResourceGroupName $ResourceGroupName `
      -Slot $IPAM_SLOT_NAME

    Write-Host " ✅ Done" -ForegroundColor Green
  }

  if ($Plan.SlotContext -and $Plan.SlotContext.Supported) {
    New-IpamStagingSlot -SlotContext $Plan.SlotContext
  }

  if ($Plan.StickyMissing.Count -gt 0) {
    Write-Host "🔧 Marking slot-specific app settings..." -ForegroundColor Cyan -NoNewline

    try {
      $slotConfigNames = Get-AzWebAppSlotConfigName -ResourceGroupName $ResourceGroupName -Name $AppName -ErrorAction SilentlyContinue
      $names = @($slotConfigNames.AppSettingNames) + $Plan.StickyMissing | Where-Object { $_ } | Select-Object -Unique

      Set-AzWebAppSlotConfigName -ResourceGroupName $ResourceGroupName -Name $AppName -AppSettingNames $names | Out-Null

      Write-Host " ✅ Done" -ForegroundColor Green
    }
    catch {
      Write-Host " ⚠️ Skipped" -ForegroundColor Yellow
      Write-LogFile -Message "Unable to update slotConfigNames: $($_.Exception.Message)" -Level "WARNING" -ErrorRecord $_
    }
  }
}

Start-Transcript -Path $transcriptLog | Out-Null

Write-LogFile -Message "=== Azure IPAM Update Script Started ===" -Level "INFO"

try {
  if ($DEBUG_MODE) {
    Write-Host "🐛 Debug mode enabled — verbose Azure logs will be written to:" -ForegroundColor Gray
    Write-Host "   $debugLog" -ForegroundColor Gray
    Write-Host
  }

  Write-Section -Title "Verifying Azure IPAM Application"

  $appType = ""
  $isFunction = $false
  $privateAcr = $false
  $acrName = ""

  Write-Host "🔍 Verifying application exists..." -ForegroundColor Cyan -NoNewline
  $existingApp = Get-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName -ErrorAction SilentlyContinue

  if($null -eq $existingApp) {
    Write-Host " ❌ Not found" -ForegroundColor Red
    Write-Host "  ❌ Application not found in current subscription!" -ForegroundColor Red
    Write-Host
    exit
  } else {
    $appKind = $existingApp.Kind
    $appType = $($appKind.Split(",") -contains 'functionapp') ? 'Function' : 'App'
    $isFunction = $appType -eq 'Function' ? $true : $false
  }

  $isContainer = $appKind.Split(",") -contains 'container'

  if ($isContainer) {
    $appType += "Container"
  }

  Write-Host " ✅ Found" -ForegroundColor Green

  # A stopped app still supports every control-plane operation, but its /api/status endpoint is
  # unreachable, so the running version and container distro cannot be probed.
  $isStopped = $existingApp.State -ne 'Running'

  Write-Host "🔍 Detected application state: " -ForegroundColor Cyan -NoNewline
  Write-Host $existingApp.State -ForegroundColor ($isStopped ? 'Yellow' : 'White')

  Write-Host "🔍 Detected deployment type: " -ForegroundColor Cyan -NoNewline
  Write-Host $appType -ForegroundColor White

  if($isContainer -and $existingApp.SiteConfig.LinuxFxVersion.StartsWith("COMPOSE|")) {
    Write-Section -Title "Manual Migration Required"
    Write-Host "This deployment uses the legacy Docker Compose configuration, which is no longer" -ForegroundColor Yellow
    Write-Host "supported and cannot be updated automatically." -ForegroundColor Yellow
    Write-Host
    Write-Host "To migrate to the current single-container deployment, follow the migration guide:" -ForegroundColor Yellow
    Write-Host "  https://azure.github.io/ipam/#/migration/README" -ForegroundColor Cyan
    Write-Host
    exit
  }

  if ($isStopped) {
    Write-Host
    Write-Host "Configuration updates will still be applied, but the running version cannot be" -ForegroundColor Yellow
    Write-Host "determined and the application will remain stopped once the update completes." -ForegroundColor Yellow
    Write-LogFile -Message "Application state is '$($existingApp.State)'; status API probes will be skipped." -Level "WARNING"
  }

  # Configuration drift: compare the deployment against what a fresh deployment would produce
  # today, present the plan, then converge on approval. Production converges before the slot so
  # a newly created slot inherits corrected values instead of mirroring stale ones.
  Write-Section -Title "Checking for Configuration Drift"

  $driftPlan = Get-IpamDriftPlan `
    -ExistingApp $existingApp `
    -AppName $AppName `
    -ResourceGroupName $ResourceGroupName `
    -IsFunction $isFunction `
    -IsContainer $isContainer `
    -SkipInfra:$SkipInfraUpdate

  $registryRepointed = $false
  $runFromPackageChanged = $false

  if (-not $driftPlan.HasDrift) {
    Write-Host "✅ Configuration is up to date, no changes required" -ForegroundColor Green
  }
  else {
    Show-IpamDriftPlan -Plan $driftPlan

    $applyDrift = $Force ? $true : (Get-UserConfirmation -PromptText "Apply these changes now?")

    if ($applyDrift) {
      $registryRepointed = $isContainer -and $driftPlan.ProdDrift.ConfigChanges.Contains('LinuxFxVersion')

      $runFromPackageChanged = $driftPlan.ProdDrift.AddSettings.Contains('WEBSITE_RUN_FROM_PACKAGE') -or
                               ($driftPlan.ProdDrift.RemoveSettings -contains 'WEBSITE_RUN_FROM_PACKAGE')

      Invoke-IpamDriftRemediation `
        -Plan $driftPlan `
        -ExistingApp $existingApp `
        -AppName $AppName `
        -ResourceGroupName $ResourceGroupName

      # Re-read the site so the update phase operates on the converged configuration
      $existingApp = Get-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName
    }
    else {
      Write-Host "ℹ️ Configuration changes skipped by user" -ForegroundColor Cyan
    }
  }

  if ($isContainer) {
    $appAcr = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1].Split('/')[0]
    $privateAcr = $appAcr -in $IPAM_PUBLIC_ACR ? $false : $true

    # Repointing LinuxFxVersion already recycled the App Service and pulled the image from the
    # new registry, so there is no image work left to report.
    if (-not $privateAcr -and $registryRepointed) {
      Write-Section -Title "Azure IPAM Update Complete"
      Write-Host "✅ Azure IPAM registry updated; the App Service is restarting to pull the latest image" -ForegroundColor Green
      Write-Host "ℹ️ Please allow a few minutes for the container to restart and load the updated image" -ForegroundColor Cyan
      Write-Host
      exit
    }

    # Restarting a stopped app accomplishes nothing - it stays stopped and never pulls the image.
    if (-not $privateAcr -and $isStopped) {
      Write-Section -Title "Azure IPAM Update Complete"
      Write-Host "ℹ️ The application is stopped, so no restart was performed" -ForegroundColor Cyan
      Write-Host "ℹ️ Start the application to pull the latest image from the public registry" -ForegroundColor Cyan
      Write-Host
      exit
    }

    Write-Section -Title "Updating Container Deployment"

    if (-not $privateAcr) {
      # Determine whether a restart is required. With -Force, restart unconditionally to pull
      # the latest image. Otherwise compare the running version against the OCI version label
      # on the public image and skip the restart when already current. If the label can't be
      # read (older, pre-OCI images), fall back to restarting to pull the latest image.
      $restartNeeded = $true
      $downgradeBlocked = $false
      $latestVersion = $null

      if (-not $Force) {
        Write-Host "🔍 Comparing the running version with the registry..." -ForegroundColor Cyan -NoNewline

        # Parse repo:tag from the image reference so we handle both the app (ipam) and
        # function (ipamfunc) images.
        $imageRef = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1]
        $repoAndTag = $imageRef.Substring($imageRef.IndexOf('/') + 1)
        $imageRepository = $repoAndTag.Split(':')[0]
        $imageTag = ($repoAndTag -split ':', 2)[1]
        if ([string]::IsNullOrWhiteSpace($imageTag)) { $imageTag = 'latest' }

        $runningVersion = Get-RunningVersion -ExistingApp $existingApp
        $latestVersion = Get-RegistryImageVersion -Registry $appAcr -Repository $imageRepository -Tag $imageTag

        $versionState = Get-IpamVersionState -Current $runningVersion -Target $latestVersion

        if ($versionState -eq [IpamVersionState]::Equal) {
          Write-Host " ✅ Up to date (v$latestVersion)" -ForegroundColor Green
          $restartNeeded = $false
        }
        elseif ($versionState -eq [IpamVersionState]::Newer) {
          Write-Host " ⚠️ Update available (v$runningVersion -> v$latestVersion)" -ForegroundColor Yellow
        }
        elseif ($versionState -eq [IpamVersionState]::Older) {
          Write-Host " ⚠️ Registry image is older (v$runningVersion -> v$latestVersion)" -ForegroundColor Yellow
          $restartNeeded = $false
          $downgradeBlocked = $true
        }
        else {
          Write-Host " ℹ️ Unknown" -ForegroundColor Cyan
        }
      }

      if (-not $restartNeeded) {
        Write-Section -Title "Azure IPAM Update Complete"

        if ($downgradeBlocked) {
          Write-Host "⚠️ The registry image (v$latestVersion) is older than the running version (v$runningVersion)" -ForegroundColor Yellow
          Write-Host "ℹ️ No restart was performed; re-run with -Force to pull the older image anyway" -ForegroundColor Cyan
        }
        else {
          Write-Host "✅ Azure IPAM is already running the latest version (v$latestVersion)" -ForegroundColor Green
        }

        Write-Host
        exit
      }

      Write-Host "ℹ️ Restarting to pull the latest image from " -ForegroundColor Cyan -NoNewline
      Write-Host $appAcr -ForegroundColor White
      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName

      Write-Section -Title "Azure IPAM Update Complete"
      Write-Host "✅ Azure IPAM solution updated successfully" -ForegroundColor Green
      Write-Host "ℹ️ Please allow a few minutes for the container to restart and load the updated image" -ForegroundColor Cyan
      Write-Host
      exit
    }

    if($privateAcr) {
      $acrName = $appAcr.Split('.')[0]

      Write-Host "🔍 Private ACR detected: " -ForegroundColor Cyan -NoNewline
      Write-Host "$acrName" -ForegroundColor White

      # Target version comes from the repo (this is what we would build and push).
      # Compare it against the running version first so we can short-circuit before
      # doing any ACR/CLI/context verification when no update is required (unless -Force).
      # Both /api/status and version.json report bare versions (e.g. 3.6.0), so no normalization is needed.
      $engineVersionFile = Join-Path -Path $ROOT_DIR -ChildPath 'engine' -AdditionalChildPath 'app', 'version.json'
      $ipamVersion = $(Get-Content -Path $engineVersionFile | ConvertFrom-Json).app

      if (-not $Force) {
        Write-Host "🔍 Comparing the running version with the repository..." -ForegroundColor Cyan -NoNewline

        $runningVersion = Get-RunningVersion -ExistingApp $existingApp

        $versionState = Get-IpamVersionState -Current $runningVersion -Target $ipamVersion

        if ($versionState -eq [IpamVersionState]::Equal) {
          Write-Host " ✅ Up to date (v$ipamVersion)" -ForegroundColor Green

          Write-Section -Title "Azure IPAM Update Complete"
          Write-Host "✅ Azure IPAM is already running the latest version (v$ipamVersion)" -ForegroundColor Green
          Write-Host
          exit
        }
        elseif ($versionState -eq [IpamVersionState]::Newer) {
          Write-Host " ⚠️ Update available (v$runningVersion -> v$ipamVersion)" -ForegroundColor Yellow
        }
        elseif ($versionState -eq [IpamVersionState]::Older) {
          Write-Host " ⚠️ Repository is older (v$runningVersion -> v$ipamVersion)" -ForegroundColor Yellow

          Write-Section -Title "Azure IPAM Update Complete"
          Write-Host "⚠️ The repository version (v$ipamVersion) is older than the running version (v$runningVersion)" -ForegroundColor Yellow
          Write-Host "ℹ️ No image was built; re-run with -Force to build the older version anyway" -ForegroundColor Cyan
          Write-Host
          exit
        }
        else {
          Write-Host " ℹ️ Unable to determine; proceeding with build" -ForegroundColor Cyan
        }
      }

      # An update is required (or was forced); verify the ACR and tooling prerequisites.
      Write-Host "🔍 Looking for the ACR in Resource Group '$ResourceGroupName'..." -ForegroundColor Cyan -NoNewline
      $acrDetails = Get-AzContainerRegistry `
        -Name $acrName `
        -ResourceGroupName $ResourceGroupName `
        -ErrorVariable acrErr `
        -ErrorAction SilentlyContinue

      if ($acrErr) {
        Write-LogFile -Message "ACR lookup error: $acrErr" -Level "ERROR"

        Write-Host " ⚠️ Not found" -ForegroundColor Yellow

        $appNoun = $isFunction ? 'Function App' : 'App Service'

        Write-Section -Title "Manual Image Update Required"
        Write-Host "The container registry is not located in the $appNoun's resource group, so this" -ForegroundColor Yellow
        Write-Host "image cannot be updated automatically." -ForegroundColor Yellow
        Write-Host
        Write-Host "  Container Registry: " -ForegroundColor Cyan -NoNewline
        Write-Host $appAcr -ForegroundColor White
        Write-Host

        Write-Host "To perform this update manually, build and push a new image to the registry," -ForegroundColor Yellow
        Write-Host "then restart the $appNoun to load it. For build instructions, see:" -ForegroundColor Yellow
        Write-Host "  https://azure.github.io/ipam/#/update/README?id=container-build-failures" -ForegroundColor Cyan
        Write-Host
        exit
      }

      $acrName = $acrDetails.Name
      Write-Host " ✅ Found" -ForegroundColor Green

      # Verify Minimum Azure CLI Version
      Write-Host "🔍 Verifying minimum Azure CLI version..." -ForegroundColor Cyan -NoNewline
      $azureCliVer = [System.Version](az version | ConvertFrom-Json).'azure-cli'

      if($azureCliVer -lt $MIN_AZ_CLI_VER) {
        Write-Host " ❌ Outdated" -ForegroundColor Red
        Write-Host "  ❌ Azure CLI must be version $MIN_AZ_CLI_VER or greater!" -ForegroundColor Red
        exit
      }
      Write-Host " ✅ OK ($azureCliVer)" -ForegroundColor Green

      # Verify Azure PowerShell and Azure CLI Contexts Match
      Write-Host "🔍 Verifying Azure PowerShell and Azure CLI contexts match..." -ForegroundColor Cyan -NoNewline
      $azureCliContext = $(az account show | ConvertFrom-Json) 2>$null

      if(-not $azureCliContext) {
        Write-Host " ❌ Not logged in" -ForegroundColor Red
        Write-Host "  ❌ Azure CLI not logged in or no subscription has been selected!" -ForegroundColor Red
        exit
      }

      $azureCliSub = $azureCliContext.id
      $azurePowerShellSub = (Get-AzContext).Subscription.Id

      if($azurePowerShellSub -ne $azureCliSub) {
        Write-Host " ❌ Mismatch" -ForegroundColor Red
        Write-Host "  ❌ Azure PowerShell and Azure CLI must be set to the same context!" -ForegroundColor Red
        exit
      }
      Write-Host " ✅ Match" -ForegroundColor Green

      # The distro selects the Dockerfile, so resolve it alongside the other prerequisites
      # rather than part-way through the build.
      if (-not $isFunction) {
        $probedImage = $null

        # Probe only when we need to: an explicit override wins, and a stopped app cannot answer.
        if ([string]::IsNullOrWhiteSpace($ContainerType) -and -not $isStopped) {
          Write-Host "🔍 Detecting container distro..." -ForegroundColor Cyan -NoNewline

          $appUri = $existingApp.HostNames[0]
          $statusUri = "https://${appUri}/api/status"

          # A running app whose container failed to start accepts the connection but never
          # answers, so this must be bounded.
          try {
            $status = Invoke-RestMethod -Method Get -Uri $statusUri -TimeoutSec 30 -ErrorAction Stop
            $probedImage = $status.container.image_id

            if ([string]::IsNullOrWhiteSpace($probedImage)) {
              Write-Host " ⚠️ Unavailable" -ForegroundColor Yellow
              Write-LogFile -Message "Container distro probe returned no container.image_id value." -Level "WARNING"
            }
            else {
              Write-Host " ✅ Detected" -ForegroundColor Green
            }
          } catch {
            Write-Host " ⚠️ Unavailable" -ForegroundColor Yellow
            Write-LogFile -Message "Container distro probe failed: $($_.Exception.Message)" -Level "WARNING" -ErrorRecord $_
          }
        }

        $effectiveContainerType = Resolve-ContainerType -Override $ContainerType -ProbedImage $probedImage

        if (-not $effectiveContainerType) {
          $distroReason = $isStopped ? 'the application is stopped' : 'the application status API could not be reached'

          Write-Section -Title "Building Container Image"
          Write-Host "The container distro cannot be detected because $distroReason, so the" -ForegroundColor Yellow
          Write-Host "correct Dockerfile cannot be selected for the image build." -ForegroundColor Yellow
          Write-Host
          Write-Host "Re-run the update once the application is running, or specify the distro:" -ForegroundColor Yellow
          Write-Host "  -ContainerType Debian" -ForegroundColor Cyan -NoNewline
          Write-Host "  (default)" -ForegroundColor Gray
          Write-Host "  -ContainerType RHEL" -ForegroundColor Cyan
          Write-Host

          Write-LogFile -Message "Container distro could not be resolved and no -ContainerType override was supplied." -Level "ERROR"

          exit
        }

        Write-Host "🔍 Container distro: " -ForegroundColor Cyan -NoNewline
        Write-Host $effectiveContainerType -ForegroundColor White
      }
    }
  }

  $skipZipDeploy = $false
  $zipDowngradeBlocked = $false

  if (-not $isContainer) {
    Write-Section -Title "Updating Native (ZIP Deploy) Application"

    # Switching run-from-package mode requires a fresh deployment: the site would otherwise be
    # left pointing at a package that does not exist, so never short-circuit on version here.
    if (-not $ZipFilePath -and -not $Force -and -not $runFromPackageChanged) {
      Write-Host "🔍 Comparing deployed version with the latest release..." -ForegroundColor Cyan -NoNewline

      $runningVersion = Get-RunningVersion -ExistingApp $existingApp
      $latestVersion = Get-LatestReleaseVersion -GitHubUserName $GitHubUserName -GitHubRepoName $GitHubRepoName

      $runningClean = $runningVersion -replace '^v', ''
      $latestClean = $latestVersion -replace '^v', ''

      $versionState = Get-IpamVersionState -Current $runningVersion -Target $latestVersion

      if ($versionState -eq [IpamVersionState]::Equal) {
        Write-Host " ✅ Up to date (v$runningClean)" -ForegroundColor Green
        $skipZipDeploy = $true
      }
      elseif ($versionState -eq [IpamVersionState]::Newer) {
        Write-Host " ⚠️ Update available (v$runningClean -> v$latestClean)" -ForegroundColor Yellow
      }
      elseif ($versionState -eq [IpamVersionState]::Older) {
        Write-Host " ⚠️ Release is older (v$runningClean -> v$latestClean)" -ForegroundColor Yellow
        $skipZipDeploy = $true
        $zipDowngradeBlocked = $true
      }
      else {
        Write-Host " ℹ️ Unable to determine; proceeding with deploy" -ForegroundColor Cyan
      }
    }
  }

  if ($isContainer) {
    Write-Section -Title "Building Container Image"

    # $ipamVersion and $effectiveContainerType were resolved during the private ACR checks above.
    # Images are tagged <version> + latest, mirroring the CI convention.

    $containerMap = @{
      Debian = @{
        Extension = 'deb'
        Port = 8080
        Images = @{
          Build = 'node:22-slim'
          Serve = 'python:3.11-slim'
        }
      }
      RHEL = @{
        Extension = 'rhel'
        Port = 8080
        Images = @{
          Build = 'registry.access.redhat.com/ubi9/nodejs-22'
          Serve = 'registry.access.redhat.com/ubi9/python-311'
        }
      }
    }

    if($effectiveContainerType) {
      $dockerFile = 'Dockerfile.' + $containerMap[$effectiveContainerType].Extension
      $dockerFilePath = Join-Path -Path $ROOT_DIR -ChildPath $dockerFile
    }

    $dockerFileFunc = Join-Path -Path $ROOT_DIR -ChildPath 'Dockerfile.func'

    $azureCloud = Get-AppSettingValue -AppSettings $existingApp.SiteConfig.AppSettings -Name 'AZURE_ENV'
    if ([string]::IsNullOrWhiteSpace($azureCloud)) { $azureCloud = 'AZURE_PUBLIC' }

    if($isFunction) {
      Write-Host "🚀 Building and pushing Function container image..." -ForegroundColor Cyan -NoNewline

      $funcBuildOutput = $(
        az acr build -r $acrName `
        -t ipamfunc:$ipamVersion `
        -t ipamfunc:latest `
        -f $dockerFileFunc $ROOT_DIR `
        --build-arg IPAM_VERSION=$ipamVersion `
        --no-logs
      ) *>&1

      if ($LASTEXITCODE -ne 0) {
        Write-Host " ❌ Failed" -ForegroundColor Red

        $buildId = [regex]::Matches($funcBuildOutput, "(?<=Queued a build with ID: )[\w]*").Value.Trim()

        if ($buildId) {
          Write-Host "📋 Fetching build logs for ID: $buildId..." -ForegroundColor Cyan -NoNewline

          try {
            $buildLogs = Get-BuildLog `
              -SubscriptionId (Get-AzContext).Subscription.Id `
              -ResourceGroupName $ResourceGroupName `
              -RegistryName $acrName `
              -BuildId $buildId `
              -AzureCloud $azureCloud

            Write-Host " ✅ Success" -ForegroundColor Green
            Write-LogFile -Message "Container build logs:`n$($buildLogs | Out-String)" -Level "ERROR"
          }
          catch {
            Write-Host " ❌ Failed" -ForegroundColor Red
            Write-Host "⚠️ Failed to retrieve build logs: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-LogFile -Message "Failed to retrieve build logs: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
          }
        }
        else {
          Write-LogFile -Message "No build ID found in ACR build output" -Level "ERROR"
        }

        $script:containerBuildError = $true
      } else {
        Write-Host " ✅ Success" -ForegroundColor Green
      }

      if (-not $isStopped) {
        Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName -Function
      }
    } else {
      Write-Host "🚀 Building and pushing App container image (" -ForegroundColor Cyan -NoNewline
      Write-Host "$effectiveContainerType" -ForegroundColor White -NoNewline
      Write-Host ")..." -ForegroundColor Cyan -NoNewline

      $appBuildOutput = $(
        az acr build -r $acrName `
          -t ipam:$ipamVersion `
          -t ipam:latest `
          -f $dockerFilePath $ROOT_DIR `
          --build-arg PORT=$($containerMap[$effectiveContainerType].Port) `
          --build-arg BUILD_IMAGE=$($containerMap[$effectiveContainerType].Images.Build) `
          --build-arg SERVE_IMAGE=$($containerMap[$effectiveContainerType].Images.Serve) `
          --build-arg IPAM_VERSION=$ipamVersion `
          --no-logs
      ) *>&1

      if ($LASTEXITCODE -ne 0) {
        Write-Host " ❌ Failed" -ForegroundColor Red

        $buildId = [regex]::Matches($appBuildOutput, "(?<=Queued a build with ID: )[\w]*").Value.Trim()

        if ($buildId) {
          Write-Host "📋 Fetching build logs for ID: $buildId..." -ForegroundColor Cyan -NoNewline

          try {
            $buildLogs = Get-BuildLog `
              -SubscriptionId (Get-AzContext).Subscription.Id `
              -ResourceGroupName $ResourceGroupName `
              -RegistryName $acrName `
              -BuildId $buildId `
              -AzureCloud $azureCloud

            Write-Host " ✅ Success" -ForegroundColor Green
            Write-LogFile -Message "Container build logs:`n$($buildLogs | Out-String)" -Level "ERROR"
          }
          catch {
            Write-Host " ❌ Failed" -ForegroundColor Red
            Write-Host "⚠️ Failed to retrieve build logs: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-LogFile -Message "Failed to retrieve build logs: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
          }
        }
        else {
          Write-LogFile -Message "No build ID found in ACR build output" -Level "ERROR"
        }

        $script:containerBuildError = $true
      } else {
        Write-Host " ✅ Success" -ForegroundColor Green
      }

      if (-not $isStopped) {
        Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName
      }
    }

    if(-not $containerBuildError) {
      Write-Section -Title "Azure IPAM Update Complete"
      Write-Host "✅ Azure IPAM solution updated successfully" -ForegroundColor Green

      if ($isStopped) {
        Write-Host "ℹ️ The application is stopped; start it to pull the updated image" -ForegroundColor Cyan
      }
      else {
        Write-Host "ℹ️ Please allow a few minutes for the container to restart and load the updated image" -ForegroundColor Cyan
      }

      Write-Host
    } else {
      Write-Section -Title "Azure IPAM Update Completed With Errors"
      Write-Host "⚠️ Azure IPAM solution deployed with errors, see logs for details!" -ForegroundColor Yellow
      Write-Host "   Run Log:    $transcriptLog" -ForegroundColor Yellow
      Write-Host "   Detail Log: $logFile" -ForegroundColor Yellow
      Write-Host
    }
  } elseif ($skipZipDeploy) {
    Write-Section -Title "Azure IPAM Update Complete"

    if ($zipDowngradeBlocked) {
      Write-Host "⚠️ The latest release (v$latestClean) is older than the running version (v$runningClean)" -ForegroundColor Yellow
      Write-Host "ℹ️ No deployment was performed; re-run with -Force to deploy the older release anyway" -ForegroundColor Cyan
    }
    else {
      Write-Host "✅ Azure IPAM is already running the latest version (v$runningClean)" -ForegroundColor Green
    }

    Write-Host
  } else {
    if (-not $ZipFilePath) {
      if (-not $AssetFolder) {
        try {
          # Create a temporary folder path
          $TempFolder = Join-Path -Path TEMP:\ -ChildPath $(New-Guid)

          # Create directory if not exists
          $script:TempFolderObj = New-Item -ItemType Directory -Path $TempFolder -Force

          $script:AssetFolder = $TempFolderObj
        } catch {
          Write-Host "  ❌ Unable to create temp directory to store ZIP archive!" -ForegroundColor Red
          throw $_
        }
      } else {
        $script:AssetFolder = Get-Item -Path $AssetFolder
      }

      Get-ZipFile -GitHubUserName $GitHubUserName -GitHubRepoName $GitHubRepoName -ZipFileName $ZipFileName -AssetFolder $AssetFolder

      $script:ZipFilePath = Join-Path -Path $AssetFolder.FullName -ChildPath $ZipFileName
    } else {
      $script:ZipFilePath = Get-Item -Path $ZipFilePath
    }

    Write-Host "🚀 Uploading ZIP Deploy archive..." -ForegroundColor Cyan

    try {
      Publish-ZipFile -AppName $AppName -ResourceGroupName $ResourceGroupName -ZipFilePath $ZipFilePath
    } catch {
      Write-Host "  ⚠️ Standard ZIP Deploy failed, retrying with Kudu API..." -ForegroundColor Yellow
      Publish-ZipFile -AppName $AppName -ResourceGroupName $ResourceGroupName -ZipFilePath $ZipFilePath -UseAPI
    }

    if ($TempFolderObj) {
      Write-Host "🔍 Cleaning up temporary directory..." -ForegroundColor Cyan -NoNewline
      Remove-Item -LiteralPath $TempFolderObj.FullName -Force -Recurse -ErrorAction SilentlyContinue
      $script:TempFolderObj = $null
      Write-Host " ✅ Done" -ForegroundColor Green
    }

    Write-Section -Title "Azure IPAM Update Complete"
    Write-Host "✅ Azure IPAM solution updated successfully" -ForegroundColor Green
    Write-Host "ℹ️ Please allow ~5 minutes for the ZIP Deploy process to complete" -ForegroundColor Cyan
    Write-Host
  }
}
catch {
  Write-LogFile -Message "Update failed: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
  Write-Host
  Write-Host "❌ Unable to update Azure IPAM application, see log for detailed information!" -ForegroundColor Red
  Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "   Detail Log: $logFile" -ForegroundColor Red

  if ($DEBUG_MODE) {
    Write-Host "   Debug Log: $debugLog" -ForegroundColor Red
  }

  if ($env:CI) {
    Write-Host $_.ToString()
  }

  exit 1
}
finally {
  if ($TempFolderObj) {
    Remove-Item -LiteralPath $TempFolderObj.FullName -Force -Recurse -ErrorAction SilentlyContinue
  }

  Write-Host
  Stop-Transcript | Out-Null
}
