###############################################################################################################
##
## Azure IPAM ZIP Deploy Updater Script
##
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az.Accounts"; ModuleVersion="2.13.0" }
#Requires -Modules @{ ModuleName="Az.Functions"; ModuleVersion="4.0.6" }
#Requires -Modules @{ ModuleName="Az.Websites"; ModuleVersion="3.1.1" }
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
  [switch]
  $SkipInfraUpdate,

  [Parameter(Mandatory = $false)]
  [switch]
  $Force
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# Minimum Required Azure CLI Version
$MIN_AZ_CLI_VER = [System.Version]'2.35.0'

# Azure IPAM-managed registries. Element [0] is the current registry; any other entry
# (legacy production or the dev/test registry) is auto-repointed to [0].
$IPAM_PUBLIC_ACR = @("registry.azureipam.com", "azureipam.azurecr.io", "azureipamdev.azurecr.io")

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

function Set-HealthCheck {
  param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName
  )

  Set-AzResource `
    -ResourceGroupName $ResourceGroupName `
    -ResourceType "Microsoft.Web/sites/config" `
    -ResourceName "${AppName}/web" `
    -ApiVersion "2023-12-01" `
    -Properties @{ healthCheckPath = "/api/status" } `
    -Force `
    | Out-Null

  $existing = @{}

  $site = Get-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName
  $site.SiteConfig.AppSettings | ForEach-Object { $existing[$_.Name] = $_.Value }
  $existing["WEBSITE_HEALTHCHECK_MAXPINGFAILURES"] = "2"

  Set-AzWebApp `
    -ResourceGroupName $ResourceGroupName `
    -Name $AppName `
    -AppSettings $existing `
    | Out-Null
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

    return $version
  } catch {
    Write-LogFile -Message "Unable to read OCI version label from ${Registry}/${Repository}:${Tag} - $($_.Exception.Message)" -Level "WARNING"
    return $null
  }
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

function Update-IpamInfrastructure {
  <#
    Auto-detected infrastructure update that brings an existing Azure IPAM deployment in
    line with current deployments by adding any missing infrastructure. Today this adds a
    'staging' slot; additional infrastructure updates can be added here over time.

    The production site is never modified. Resources are created from an additive Bicep
    template (update/main.bicep) that mirrors production (runtime stack, vNet) and enforces
    only the PRESENCE of baseline app settings (existing values are always preserved).

    An infrastructure-update failure is non-fatal: it warns and returns so the normal
    production update can still proceed.
  #>
  param(
    [Parameter(Mandatory = $true)]
    $ExistingApp,
    [Parameter(Mandatory = $true)]
    [string]$AppName,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $true)]
    [string]$AppType,
    [Parameter(Mandatory = $true)]
    [bool]$IsFunction,
    [Parameter(Mandatory = $true)]
    [bool]$IsContainer,
    [Parameter(Mandatory = $false)]
    [switch]$Force
  )

  $SLOT_NAME = "staging"
  $UNSUPPORTED_TIERS = @('Free', 'Shared', 'Basic', 'Dynamic')

  try {
    # 1. Skip if a staging slot already exists (idempotent / re-runnable)
    $existingSlot = Get-AzWebAppSlot `
      -ResourceGroupName $ResourceGroupName `
      -Name $AppName `
      -Slot $SLOT_NAME `
      -ErrorAction SilentlyContinue

    if ($existingSlot) {
      Write-Host "ℹ️ Infrastructure is already up to date, no updates required" -ForegroundColor Cyan
      return
    }

    Write-Section -Title "Azure IPAM Infrastructure Update"
    Write-Host "This deployment is missing infrastructure that newer Azure IPAM deployments" -ForegroundColor Gray
    Write-Host "include. The following updates will be applied additively to make future updates" -ForegroundColor Gray
    Write-Host "and version changes safer. The production site will not be modified." -ForegroundColor Gray
    Write-Host

    # 2. Verify the App Service Plan tier supports deployment slots
    Write-Host "🔍 Verifying App Service Plan supports slots..." -ForegroundColor Cyan -NoNewline
    $planResource = Get-AzResource -ResourceId $ExistingApp.ServerFarmId -ExpandProperties -ErrorAction SilentlyContinue

    if (-not $planResource) {
      Write-Host " ⚠️ Unable to resolve" -ForegroundColor Yellow
      Write-Host "     Skipping infrastructure update." -ForegroundColor Yellow
      return
    }

    $planTier = $planResource.Sku.tier
    if ([string]::IsNullOrWhiteSpace($planTier)) { $planTier = $planResource.Sku.Tier }

    if ($planTier -in $UNSUPPORTED_TIERS) {
      Write-Host " ❌ Unsupported ($planTier)" -ForegroundColor Red
      Write-Host "     The '$planTier' tier does not support deployment slots (requires Standard or higher)." -ForegroundColor Yellow
      Write-Host "     Skipping infrastructure update." -ForegroundColor Yellow
      return
    }
    Write-Host " ✅ Supported ($planTier)" -ForegroundColor Green

    # 3. Verify a user-assigned managed identity is present (slot reuses it for KeyVault/Cosmos)
    Write-Host "🔍 Verifying managed identity..." -ForegroundColor Cyan -NoNewline
    $userAssignedIds = $ExistingApp.Identity.UserAssignedIdentities

    if (-not $userAssignedIds -or $userAssignedIds.Count -eq 0) {
      Write-Host " ❌ Missing" -ForegroundColor Red
      Write-Host "     No user-assigned managed identity found; skipping infrastructure update." -ForegroundColor Yellow
      return
    }

    $managedIdentityId = @($userAssignedIds.Keys)[0]
    $miResource = Get-AzResource -ResourceId $managedIdentityId -ExpandProperties -ErrorAction SilentlyContinue
    $managedIdentityClientId = $miResource.Properties.clientId

    if ([string]::IsNullOrWhiteSpace($managedIdentityClientId)) {
      Write-Host " ❌ Unresolved" -ForegroundColor Red
      Write-Host "     Could not resolve the managed identity client ID; skipping infrastructure update." -ForegroundColor Yellow
      return
    }
    Write-Host " ✅ Verified" -ForegroundColor Green

    # 4. Verify the baseline app settings are present (non-standard deployments are skipped)
    Write-Host "🔍 Verifying baseline configuration..." -ForegroundColor Cyan -NoNewline
    $appSettings = $ExistingApp.SiteConfig.AppSettings

    $cosmosDbUri  = Get-AppSettingValue -AppSettings $appSettings -Name 'COSMOS_URL'
    $databaseName = Get-AppSettingValue -AppSettings $appSettings -Name 'DATABASE_NAME'
    $containerName = Get-AppSettingValue -AppSettings $appSettings -Name 'CONTAINER_NAME'
    $keyVaultUri  = Get-AppSettingValue -AppSettings $appSettings -Name 'KEYVAULT_URL'
    $azureEnv     = Get-AppSettingValue -AppSettings $appSettings -Name 'AZURE_ENV'
    $runFromPkg   = Get-AppSettingValue -AppSettings $appSettings -Name 'WEBSITE_RUN_FROM_PACKAGE'

    $missingSettings = @()
    if ([string]::IsNullOrWhiteSpace($cosmosDbUri))  { $missingSettings += 'COSMOS_URL' }
    if ([string]::IsNullOrWhiteSpace($keyVaultUri))  { $missingSettings += 'KEYVAULT_URL' }
    if ([string]::IsNullOrWhiteSpace($databaseName)) { $missingSettings += 'DATABASE_NAME' }
    if ([string]::IsNullOrWhiteSpace($containerName)) { $missingSettings += 'CONTAINER_NAME' }

    if ($missingSettings.Count -gt 0) {
      Write-Host " ❌ Incomplete" -ForegroundColor Red
      Write-Host "     Missing baseline app settings: $($missingSettings -join ', ')." -ForegroundColor Yellow
      Write-Host "     This does not look like a standard Azure IPAM deployment; skipping infrastructure update." -ForegroundColor Yellow
      return
    }
    Write-Host " ✅ Verified" -ForegroundColor Green

    # 5. Derive remaining deployment characteristics
    $linuxFxVersion = $ExistingApp.SiteConfig.LinuxFxVersion
    $runFromPackage = ($runFromPkg -eq '1')
    $azureCloud = [string]::IsNullOrWhiteSpace($azureEnv) ? 'AZURE_PUBLIC' : $azureEnv

    $privateAcr = $false
    $privateAcrUri = ''

    if ($IsContainer) {
      $appAcr = $linuxFxVersion.Split('|')[1].Split('/')[0]
      if ($appAcr -notin $IPAM_PUBLIC_ACR) {
        $privateAcr = $true
        $privateAcrUri = $appAcr
      }
    }

    # Mirror production's ACR authentication method (managed identity vs admin/anonymous)
    # rather than inferring it from the registry name.
    $acrUseManagedIdentity = [bool]$ExistingApp.SiteConfig.AcrUseManagedIdentityCreds

    $prodSubnetId = $ExistingApp.VirtualNetworkSubnetId
    $hasVnet = -not [string]::IsNullOrWhiteSpace($prodSubnetId)

    # 6. Assemble the resourceDetails object expected by update/main.bicep
    $resourceDetails = @{
      appServiceName          = $AppName
      appServiceRG            = $ResourceGroupName
      appServicePlanId        = $ExistingApp.ServerFarmId
      managedIdentityId       = $managedIdentityId
      managedIdentityClientId = $managedIdentityClientId
      cosmosDbUri             = $cosmosDbUri
      databaseName            = $databaseName
      containerName           = $containerName
      keyVaultUri             = $keyVaultUri
      linuxFxVersion          = $linuxFxVersion
      isFunction              = $IsFunction
      deployAsContainer       = $IsContainer
      privateAcr              = $privateAcr
      privateAcrUri           = $privateAcrUri
      acrUseManagedIdentity   = $acrUseManagedIdentity
      runFromPackage          = $runFromPackage
    }

    # 7. Summary + confirmation gate
    $stackParts = $linuxFxVersion.Split('|')
    $runtimeDisplay = switch ($stackParts[0]) {
      'PYTHON' { "Python $($stackParts[1])" }
      'DOCKER' { "Container ($($stackParts[1]))" }
      default  { $linuxFxVersion }
    }

    Write-Host
    Write-Host "Detected environment:" -ForegroundColor Yellow
    $detected = [ordered]@{
      'Application'      = $AppName
      'Resource Group'  = $ResourceGroupName
      'Deployment Type' = $AppType
      'Runtime Stack'   = $runtimeDisplay
      'Private ACR'     = $privateAcr ? "Yes ($privateAcrUri)" : 'No'
      'vNet Integration' = $hasVnet ? 'Yes' : 'No'
    }
    foreach ($entry in $detected.GetEnumerator()) {
      Write-Host ("  {0,-17}: " -f $entry.Key) -ForegroundColor Cyan -NoNewline
      Write-Host $entry.Value -ForegroundColor White
    }

    Write-Host
    Write-Host "Will be created:" -ForegroundColor Yellow
    $toCreate = [ordered]@{
      'Deployment Slot' = "$SLOT_NAME (disabled)"
    }
    if ($hasVnet) {
      $toCreate['vNet Integration'] = 'Yes (mirrored from production)'
    }
    foreach ($entry in $toCreate.GetEnumerator()) {
      Write-Host ("  {0,-17}: " -f $entry.Key) -ForegroundColor Cyan -NoNewline
      Write-Host $entry.Value -ForegroundColor White
    }
    Write-Host

    if (-not $Force) {
      $proceed = Get-UserConfirmation -PromptText "Apply the infrastructure update now?"
      if (-not $proceed) {
        Write-Host "ℹ️ Infrastructure update skipped by user" -ForegroundColor Cyan
        return
      }
    }

    # 8. Deploy the additive slot template (with graceful vNet fallback)
    $bicepPath = Join-Path -Path $ROOT_DIR -ChildPath "update" -AdditionalChildPath "main.bicep"

    if (-not (Test-Path -Path $bicepPath)) {
      Write-Host "⚠️ Infrastructure template not found at '$bicepPath'; skipping infrastructure update" -ForegroundColor Yellow
      return
    }

    $deploymentParameters = @{
      location        = $ExistingApp.Location
      azureCloud      = $azureCloud
      replicateVnet   = $true
      resourceDetails = $resourceDetails
    }

    $deployment = $null
    $vnetManual = $false

    Write-Host "🚀 Applying infrastructure update (this may take a few minutes)..." -ForegroundColor Cyan

    # Capture the Azure deployment debug stream to the debug log when -Debug is set
    $DebugPreference = $debugSetting

    try {
      $deployment = New-AzSubscriptionDeployment `
        -Name "ipamSlotMigrate-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
        -Location $ExistingApp.Location `
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
        Write-Host "  ℹ️ vNet integration could not be applied; retrying without it..." -ForegroundColor Cyan
        Write-LogFile -Message "Slot deployment failed; retrying without vNet integration." -Level "ERROR" -ErrorRecord $deployError

        $deploymentParameters.replicateVnet = $false
        $vnetManual = $true

        $deployment = New-AzSubscriptionDeployment `
          -Name "ipamSlotMigrate-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
          -Location $ExistingApp.Location `
          -TemplateFile $bicepPath `
          -TemplateParameterObject $deploymentParameters `
          -ErrorAction Stop 5>$($DEBUG_MODE ? $debugLog : $null)
      }
      else {
        throw $deployError
      }
    }

    $DebugPreference = 'SilentlyContinue'

    Write-Section -Title "Infrastructure Update Complete"
    Write-Host "✅ Deployment slot '$SLOT_NAME' created (disabled)" -ForegroundColor Green

    # vNet replication outcome / manual remediation guidance
    if ($hasVnet) {
      $vnetReplicated = -not $vnetManual -and [bool]$deployment.Outputs.vnetReplicated.Value

      if ($vnetReplicated) {
        Write-Host "✅ vNet integration replicated to the staging slot" -ForegroundColor Green
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
        Write-Host "   to the '$SLOT_NAME' slot using the subnet below:" -ForegroundColor Yellow
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
        Write-LogFile -Message "vNet integration was not applied to the '$SLOT_NAME' slot automatically." -Level "WARNING"
        Write-LogFile -Message "To make the slot swap-ready, manually add regional vNet integration using subnet: $prodSubnetId" -Level "WARNING"
      }
    }
  }
  catch {
    # Infrastructure update is best-effort: never block the core production update
    Write-LogFile -Message "Infrastructure update failed (non-fatal): $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_

    Write-Section -Title "Infrastructure Update Failed"
    Write-Host "⚠️ The infrastructure update could not be completed." -ForegroundColor Yellow
    Write-Host "   The application update will continue — only this one-time step was skipped." -ForegroundColor Yellow
    Write-Host "   This is most often caused by insufficient deployment permissions at the" -ForegroundColor Yellow
    Write-Host "   subscription scope. Review the prerequisites, or re-run with -SkipInfraUpdate" -ForegroundColor Yellow
    Write-Host "   to bypass this step entirely." -ForegroundColor Yellow
    Write-Host
    Write-Host ("   {0,-13}: " -f 'Prerequisites') -ForegroundColor Yellow -NoNewline
    Write-Host "https://azure.github.io/ipam/#/update/README?id=prerequisites" -ForegroundColor Cyan
    Write-Host ("   {0,-13}: " -f 'Detail Log') -ForegroundColor Yellow -NoNewline
    Write-Host $logFile -ForegroundColor Gray
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
    throw "Application does not exist!"
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

  if ($null -eq $existingApp.SiteConfig.HealthCheckPath) {
    Write-Host "⚠️ Health check missing; adding application health check..." -ForegroundColor Yellow
    Set-HealthCheck -ResourceGroupName $ResourceGroupName -AppName $AppName
    Write-Host "  ✅ Health check configured" -ForegroundColor Green
  }

  # Auto-detected infrastructure updates (additive; production site is never modified).
  # Today this provisions the 'staging' slot; future infrastructure updates can be
  # added here under the same -SkipInfraUpdate switch.
  if (-not $SkipInfraUpdate) {
    Update-IpamInfrastructure `
      -ExistingApp $existingApp `
      -AppName $AppName `
      -ResourceGroupName $ResourceGroupName `
      -AppType $appType `
      -IsFunction $isFunction `
      -IsContainer $isContainer `
      -Force:$Force
  }

  if ($isContainer) {
    Write-Section -Title "Updating Container Deployment"

    $appAcr = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1].Split('/')[0]
    $privateAcr = $appAcr -in $IPAM_PUBLIC_ACR ? $false : $true

    if (-not $privateAcr) {
      $currentPublicAcr = $IPAM_PUBLIC_ACR[0]

      if ($appAcr -ne $currentPublicAcr) {
        Write-Host "🔍 Repointing Azure IPAM public ACR (" -ForegroundColor Cyan -NoNewline
        Write-Host "$appAcr" -ForegroundColor White -NoNewline
        Write-Host ") to " -ForegroundColor Cyan -NoNewline
        Write-Host "$currentPublicAcr" -ForegroundColor White -NoNewline
        Write-Host "..." -ForegroundColor Cyan -NoNewline

        $existingApp.SiteConfig.LinuxFxVersion = $existingApp.SiteConfig.LinuxFxVersion.Replace($appAcr, $currentPublicAcr)
        $existingApp | Set-AzWebApp | Out-Null

        Write-Host " ✅ Migrated" -ForegroundColor Green

        # Updating LinuxFxVersion already recycles the App Service and pulls the image from
        # the new registry, so no explicit restart is needed here.
        Write-Section -Title "Azure IPAM Update Complete"
        Write-Host "✅ Azure IPAM registry updated; the App Service is restarting to pull the latest image" -ForegroundColor Green
        Write-Host "ℹ️ Please allow a few minutes for the container to restart and load the updated image" -ForegroundColor Cyan
        Write-Host
        exit
      }

      # Determine whether a restart is required. With -Force, restart unconditionally to pull
      # the latest image. Otherwise compare the running version against the OCI version label
      # on the public image and skip the restart when already current. If the label can't be
      # read (older, pre-OCI images), fall back to restarting to pull the latest image.
      $restartNeeded = $true
      $latestVersion = $null

      if (-not $Force) {
        Write-Host "🔍 Comparing the running version with the public registry..." -ForegroundColor Cyan -NoNewline

        # Parse repo:tag from the image reference so we handle both the app (ipam) and
        # function (ipamfunc) images.
        $imageRef = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1]
        $repoAndTag = $imageRef.Substring($imageRef.IndexOf('/') + 1)
        $imageRepository = $repoAndTag.Split(':')[0]
        $imageTag = ($repoAndTag -split ':', 2)[1]
        if ([string]::IsNullOrWhiteSpace($imageTag)) { $imageTag = 'latest' }

        $runningVersion = Get-RunningVersion -ExistingApp $existingApp
        $latestVersion = Get-RegistryImageVersion -Registry $currentPublicAcr -Repository $imageRepository -Tag $imageTag

        if ($runningVersion -and $latestVersion -and ($runningVersion -eq $latestVersion)) {
          Write-Host " ✅ Up to date (v$latestVersion)" -ForegroundColor Green
          $restartNeeded = $false
        }
        elseif ($runningVersion -and $latestVersion) {
          Write-Host " ⚠️ Update available (v$runningVersion -> v$latestVersion)" -ForegroundColor Yellow
        }
        else {
          Write-Host " ℹ️ Unknown" -ForegroundColor Cyan
        }
      }

      if (-not $restartNeeded) {
        Write-Section -Title "Azure IPAM Update Complete"
        Write-Host "✅ Azure IPAM is already running the latest version (v$latestVersion)" -ForegroundColor Green
        Write-Host
        exit
      }

      Write-Host "ℹ️ Deployment is using the Azure IPAM public ACR; restarting to pull the latest image" -ForegroundColor Cyan
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

        if ($runningVersion -and ($runningVersion -eq $ipamVersion)) {
          Write-Host " ✅ Up to date (v$ipamVersion)" -ForegroundColor Green

          Write-Section -Title "Azure IPAM Update Complete"
          Write-Host "✅ Azure IPAM is already running the latest version (v$ipamVersion)" -ForegroundColor Green
          Write-Host
          exit
        }
        elseif ($runningVersion) {
          Write-Host " ⚠️ Update available (v$runningVersion -> v$ipamVersion)" -ForegroundColor Yellow
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
    }
  }

  $skipZipDeploy = $false

  if (-not $isContainer) {
    Write-Section -Title "Updating Native (ZIP Deploy) Application"

    # Compare the running version with the latest release (GitHub download path only)
    if (-not $ZipFilePath -and -not $Force) {
      Write-Host "🔍 Comparing deployed version with the latest release..." -ForegroundColor Cyan -NoNewline

      $runningVersion = Get-RunningVersion -ExistingApp $existingApp
      $latestVersion = Get-LatestReleaseVersion -GitHubUserName $GitHubUserName -GitHubRepoName $GitHubRepoName

      $runningClean = $runningVersion -replace '^v', ''
      $latestClean = $latestVersion -replace '^v', ''

      if ($runningClean -and $latestClean -and ($runningClean -eq $latestClean)) {
        Write-Host " ✅ Up to date (v$runningClean)" -ForegroundColor Green
        $skipZipDeploy = $true
      }
      elseif ($runningClean -and $latestClean) {
        Write-Host " ⚠️ Update available (v$runningClean -> v$latestClean)" -ForegroundColor Yellow
      }
      else {
        Write-Host " ℹ️ Unable to determine; proceeding with deploy" -ForegroundColor Cyan
      }
    }

    if (-not $skipZipDeploy) {
      Write-Host "🔍 Verifying application Python version..." -ForegroundColor Cyan -NoNewline

      $engineFolder = Join-Path -Path $ROOT_DIR -ChildPath 'engine'
      $engineVersionFile = Join-Path -Path $engineFolder -ChildPath "app" -AdditionalChildPath 'version.json'
      $enginePythonVersion = $(Get-Content -Path $engineVersionFile | ConvertFrom-Json).python

      $appPythonVersion = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1]

      if($enginePythonVersion -ne $appPythonVersion) {
        Write-Host " ⚠️ Changed (v$appPythonVersion -> v$enginePythonVersion)" -ForegroundColor Yellow
        Write-Host "🔍 Updating application Python version..." -ForegroundColor Cyan -NoNewline

        $existingApp.SiteConfig.LinuxFxVersion = "PYTHON|$enginePythonVersion"
        $existingApp | Set-AzWebApp | Out-Null

        Write-Host " ✅ Updated" -ForegroundColor Green

        Start-Sleep -Seconds 10
      }
      else {
        Write-Host " ✅ Up to date (v$appPythonVersion)" -ForegroundColor Green
      }
    }
  }

  if ($isContainer) {
    Write-Section -Title "Building Container Image"

    # $ipamVersion was resolved from the repo during the private ACR checks above and
    # is used below to tag the image (mirrors the CI convention: <version> + latest).
    # The running-vs-repo comparison and up-to-date short-circuit already happened there.

    if (-not $isFunction) {
      Write-Host "🔍 Detecting container distro..." -ForegroundColor Cyan -NoNewline

      $appUri = $existingApp.HostNames[0]
      $statusUri = "https://${appUri}/api/status"

      try {
        $status = Invoke-RestMethod -Method Get -Uri $statusUri -ErrorVariable statusErr -ErrorAction SilentlyContinue
      } catch {
        Write-Host " ❌ Failed" -ForegroundColor Red
        Write-Host "  ❌ Unable to detect container distro!" -ForegroundColor Red
        throw $_
      }

      $containerType = $status.container.image_id
      Write-Host " ✅ $containerType" -ForegroundColor Green
    }

    $containerMap = @{
      debian = @{
        Extension = 'deb'
        Port = 80
        Images = @{
          Build = 'node:22-slim'
          Serve = 'python:3.11-slim'
        }
      }
      rhel = @{
        Extension = 'rhel'
        Port = 8080
        Images = @{
          Build = 'registry.access.redhat.com/ubi9/nodejs-22'
          Serve = 'registry.access.redhat.com/ubi9/python-311'
        }
      }
    }

    if($containerType) {
      $dockerFile = 'Dockerfile.' + $containerMap[$containerType].Extension
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

      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName -Function
    } else {
      Write-Host "🚀 Building and pushing App container image (" -ForegroundColor Cyan -NoNewline
      Write-Host "$containerType" -ForegroundColor White -NoNewline
      Write-Host ")..." -ForegroundColor Cyan -NoNewline

      $appBuildOutput = $(
        az acr build -r $acrName `
          -t ipam:$ipamVersion `
          -t ipam:latest `
          -f $dockerFilePath $ROOT_DIR `
          --build-arg PORT=$($containerMap[$ContainerType].Port) `
          --build-arg BUILD_IMAGE=$($containerMap[$containerType].Images.Build) `
          --build-arg SERVE_IMAGE=$($containerMap[$containerType].Images.Serve) `
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

      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName
    }

    if(-not $containerBuildError) {
      Write-Section -Title "Azure IPAM Update Complete"
      Write-Host "✅ Azure IPAM solution updated successfully" -ForegroundColor Green
      Write-Host "ℹ️ Please allow a few minutes for the container to restart and load the updated image" -ForegroundColor Cyan
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
    Write-Host "✅ Azure IPAM is already running the latest version (v$runningClean)" -ForegroundColor Green
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
