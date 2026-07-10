###############################################################################################################
##
## Azure IPAM Solution Migration Script
##
## This script migrates existing Azure IPAM deployments from Docker Compose to modern Azure infrastructure
## by discovering current resources, validating their configuration, and deploying updated Bicep templates
## while preserving existing data and configuration settings.
##
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az.Accounts"; ModuleVersion="2.16.0" }
#Requires -Modules @{ ModuleName="Az.KeyVault"; ModuleVersion="5.2.1" }
#Requires -Modules @{ ModuleName="Az.Monitor"; ModuleVersion="5.1.0" }
#Requires -Modules @{ ModuleName="Az.Resources"; ModuleVersion="6.16.0" }
#Requires -Modules @{ ModuleName="Az.Websites"; ModuleVersion="3.2.0" }
#Requires -Modules @{ ModuleName="Az.ContainerRegistry"; ModuleVersion="4.1.3" }

# Intake and set global parameters
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]
  $AppName,

  [Parameter(Mandatory = $true)]
  [string]
  $ResourceGroupName,

  [Parameter(Mandatory = $false)]
  [ValidateScript({
    if (-not ($_ | Test-Path) ) {
      throw [System.ArgumentException]::New("The specified 'JsonFile' path does not exist.")
    }
    if (-not ($_ | Test-Path -PathType Leaf) ) {
      throw [System.ArgumentException]::New("The 'JsonFile' argument must be a path to a file, not a folder.")
    }
    if ($_ -notmatch "(\.json|\.jsonc)$") {
      throw [System.ArgumentException]::New("The file specified in the 'JsonFile' argument must be of type json or jsonc.")
    }
    try {
      $content = Get-Content -Path $_ -Raw -ErrorAction Stop
      $null = ConvertFrom-Json -InputObject $content -ErrorAction Stop
    }
    catch {
      throw [System.ArgumentException]::New("The file specified in the 'JsonFile' argument contains invalid JSON.")
    }
    return $true
  })]
  [System.IO.FileInfo]
  $JsonFile,

  [Parameter(Mandatory = $false)]
  [switch]
  $NoVerify,

  [Parameter(Mandatory = $false)]
  [switch]
  $Force,

  [Parameter(Mandatory = $false)]
  [ValidateSet('Debian', 'RHEL')]
  [string]
  $ContainerType
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# Minimum Required Azure CLI Version - Required for ACR build functionality
$MIN_AZ_CLI_VER = [System.Version]'2.35.0'

# Azure IPAM Public ACR (element [0] is the current/preferred registry; remaining values are legacy registries retained for backward-compatible detection)
$IPAM_PUBLIC_ACR = @("registry.azureipam.com", "azureipam.azurecr.io")

# Set preference variables
$ErrorActionPreference = "Stop"
$DebugPreference = 'SilentlyContinue'

# Check for Debug Flag (native -Debug common parameter)
$DEBUG_MODE = [bool]$PSCmdlet.MyInvocation.BoundParameters["Debug"].IsPresent
$debugSetting = $DEBUG_MODE ? 'Continue' : 'SilentlyContinue'

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

# Initialize detailed logging system
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$transcriptLog = Join-Path -Path $logPath -ChildPath "migrate_$timestamp.log"
$logFile = Join-Path -Path $logPath -ChildPath "detail_$timestamp.log"
$debugLog = Join-Path -Path $logPath -ChildPath "debug_$timestamp.log"

# Logging function
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

  # Optionally write to console (for backwards compatibility)
  if ($ToConsole) {
    switch ($Level) {
      "ERROR" { Write-Host $Message -ForegroundColor Red }
      "WARNING" { Write-Host $Message -ForegroundColor Yellow }
      "SUCCESS" { Write-Host $Message -ForegroundColor Green }
      default { Write-Host $Message }
    }
  }
}

# Global variables set during resource discovery
$location = $null      # Azure region extracted from source WebApp
$azureCloud = $null    # Azure cloud environment (AZURE_PUBLIC, AZURE_US_GOV, etc.)
$privateAcr = $false   # Flag indicating if private ACR is used vs public registry

# Helper Functions
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

  Write-Host "🔄 Restarting application..." -ForegroundColor Cyan

  do {
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
      Write-Host "  ✅ Application restarted successfully" -ForegroundColor Green
    } catch {
      if($restartRetries -gt 0) {
        Write-Host "  ⚠️ Restart failed, retrying..." -ForegroundColor Yellow
        $restartRetries--
      } else {
        Write-Host "  ❌ Unable to restart application!" -ForegroundColor Red
        throw $_
      }
    }
  } while ($restartSuccess -eq $False -and $restartRetries -gt 0)
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

function Get-RegistryHost {
  <#
    Extracts the container registry host from an App Service LinuxFxVersion value.
    Handles both the legacy Docker Compose form ('COMPOSE|<base64>') by decoding the
    compose file and reading the IPAM image reference, and the single-container form
    ('DOCKER|<host>/<repo>:<tag>'). Returns the host (e.g. 'azureipam.azurecr.io',
    'contoso.azurecr.io') or $null when it cannot be determined.
  #>
  param(
    [Parameter(Mandatory = $true)]
    [string]$LinuxFxVersion
  )

  if ($LinuxFxVersion.StartsWith("COMPOSE|")) {
    $base64 = $LinuxFxVersion.Substring($LinuxFxVersion.IndexOf('|') + 1)
    try {
      $compose = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($base64))
    }
    catch {
      throw [System.InvalidOperationException]::new("Failed to decode the Docker Compose content from LinuxFxVersion: $($_.Exception.Message)", $_.Exception)
    }

    # Capture the registry host preceding the IPAM image reference (e.g. '<host>/ipam-engine:latest')
    if ($compose -match 'image:\s*"?(?<host>[^\s"/]+)/ipam') {
      return $Matches['host']
    }

    return $null
  }
  elseif ($LinuxFxVersion.StartsWith("DOCKER|")) {
    return $LinuxFxVersion.Split('|')[1].Split('/')[0]
  }

  return $null
}

function Resolve-RegistryConfig {
  <#
    Classifies a container registry into one of three cases:
      - PublicManaged  : the Azure IPAM public registry (current or legacy) -> new public registry, anonymous.
      - PrivateManaged : a private ACR our automation produced. In auto-discovery this is an ACR co-located
                         in the App Service's resource group; in JSON override mode the caller passes the
                         customer-declared ACR resource id, which we trust (trust-but-verify happens elsewhere).
      - Divergent      : anything else (foreign registry, cross-RG ACR, etc.) - not a state our automation
                         produces. The caller decides how to handle (auto-discovery stops with guidance).
  #>
  param(
    [Parameter(Mandatory = $false)]
    [string]$RegistryHost,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $false)]
    [string]$AcrResourceId
  )

  # Case 1: Azure IPAM public registry (current or legacy)
  if ($RegistryHost -in $IPAM_PUBLIC_ACR) {
    return [PSCustomObject]@{
      Mode          = 'PublicManaged'
      RegistryHost  = $RegistryHost
      AcrResourceId = $null
    }
  }

  # Override path: trust an explicitly-declared ACR resource regardless of resource group
  if (-not [string]::IsNullOrWhiteSpace($AcrResourceId)) {
    return [PSCustomObject]@{
      Mode          = 'PrivateManaged'
      RegistryHost  = $RegistryHost
      AcrResourceId = $AcrResourceId
    }
  }

  # Case 2: private ACR co-located in the same resource group as the App Service
  $acrName = $RegistryHost.Split('.')[0]
  $acr = Get-AzContainerRegistry -Name $acrName -ResourceGroupName $ResourceGroupName -ErrorAction SilentlyContinue

  if ($acr) {
    return [PSCustomObject]@{
      Mode          = 'PrivateManaged'
      RegistryHost  = $RegistryHost
      AcrResourceId = $acr.Id
    }
  }

  # Case 3: not a configuration our automation produces
  return [PSCustomObject]@{
    Mode          = 'Divergent'
    RegistryHost  = $RegistryHost
    AcrResourceId = $null
  }
}

function Resolve-ContainerType {
  <#
    Resolves the container distro ('Debian' or 'RHEL') used to select the Dockerfile for the
    private-ACR image build. An explicit -ContainerType override always wins; otherwise the
    value auto-detected from the source app's /api/status (container.image_id) is normalized.
    Throws when neither is available so the caller can fail early rather than build the wrong image.
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

  throw [System.InvalidOperationException]::new("Unable to auto-detect the container distro from the source application's status API. Re-run the migration with the -ContainerType parameter (Debian or RHEL) to specify it explicitly.")
}

function New-ResourceId {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Resource
  )

  # Validate input object
  if ($null -eq $Resource) {
    throw [System.ArgumentNullException]::new("Resource", "Resource parameter cannot be null")
  }

  # Validate required properties exist
  $requiredProperties = @('Subscription', 'ResourceGroup', 'ResourceType', 'ResourceName')
  $missingProperties = @()

  foreach ($property in $requiredProperties) {
    if (-not $Resource.PSObject.Properties[$property]) {
      $missingProperties += $property
    }
    elseif ([string]::IsNullOrWhiteSpace($Resource.$property)) {
      throw [System.ArgumentException]::new("Resource property '$property' cannot be null or empty", "Resource")
    }
  }

  if ($missingProperties.Count -gt 0) {
    $availableProperties = $Resource.PSObject.Properties.Name -join ', '
    throw [System.ArgumentException]::new("Resource object is missing required properties: $($missingProperties -join ', '). Available properties: $availableProperties", "Resource")
  }

  return "/subscriptions/$($Resource.Subscription)/resourceGroups/$($Resource.ResourceGroup)/providers/$($Resource.ResourceType)/$($Resource.ResourceName)"
}

function Get-Subdomain {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  try {
    $uri = [System.Uri]::new($Url)
    $serviceName = $uri.Host.Split('.')[0]

    if ([string]::IsNullOrWhiteSpace($serviceName)) {
      throw [System.ArgumentException]::new("Could not extract subdomain from URL hostname: '$($uri.Host)'", "Url")
    }

    return $serviceName
  }
  catch [System.UriFormatException] {
    throw [System.ArgumentException]::new("Invalid URL format: '$Url'. Please verify the URL is valid.", "Url")
  }
}

function Get-ResourceDetailsFromId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceId
  )

  if ([string]::IsNullOrWhiteSpace($ResourceId)) {
    throw [System.ArgumentException]::new("ResourceId cannot be null or empty", "ResourceId")
  }

  $parts = $ResourceId.Split('/')
  if ($parts.Length -lt 9) {
    throw [System.ArgumentException]::new("Invalid ResourceId format: '$ResourceId'", "ResourceId")
  }

  return [PSCustomObject]@{
    SubscriptionId    = $parts[2]
    ResourceGroupName = $parts[4]
    ResourceType     = "$($parts[6])/$($parts[7])"
    ResourceName     = $parts[8]
    FullResourceId   = $ResourceId
  }
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

  # Azure management endpoint mapping for different cloud environments
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

function Get-WebAppDetail {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $true)]
    [string]$AppName
  )

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Discovering Azure IPAM Resources..." -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  $missingResources = @()
  $discoveredCount = 0
  $totalExpectedResources = 7  # All resources including Container Registry

  # Get the WebApp resource (single call)
  Write-Host "🔍 Discovering Web App '$AppName'..." -ForegroundColor Cyan -NoNewline
  Write-LogFile -Message "Starting Web App discovery for '$AppName' in resource group '$ResourceGroupName'" -Level "INFO"
  try {
    $webApp = Get-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName -ErrorAction Stop
    Write-Host " ✅ Found" -ForegroundColor Green
    Write-LogFile -Message "Successfully discovered Web App '$AppName'" -Level "SUCCESS"
    $discoveredCount++
  }
  catch {
    Write-Host " ❌ Missing" -ForegroundColor Red
    Write-LogFile -Message "Failed to discover Web App '$AppName': $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
    $missingResources += [PSCustomObject]@{
      ResourceType = "Web App"
      ResourceName = $AppName
      Error = $_.Exception.Message
    }
    throw [System.InvalidOperationException]::new("Failed to find Web App '$AppName' in resource group '$ResourceGroupName': $($_.Exception.Message)", $_.Exception)
  }

  # Extract User-Assigned Managed Identity - Required for Azure IPAM authentication
  Write-Host "🔍 Discovering User-Assigned Managed Identity..." -ForegroundColor Cyan -NoNewline
  Write-LogFile -Message "Starting Managed Identity discovery for WebApp '$AppName'" -Level "INFO"
  try {
    $userAssignedIdentities = $webApp.Identity.UserAssignedIdentities
    if ($userAssignedIdentities.Count -eq 0) {
      throw [System.InvalidOperationException]::new("No User-Assigned Managed Identity found for WebApp '$AppName' in resource group '$ResourceGroupName'. This is required for migration.")
    }
    # Take first identity if multiple exist - Azure IPAM typically uses single identity
    $managedIdentityResourceId = $userAssignedIdentities.Keys | Select-Object -First 1
    $managedIdentityName = $managedIdentityResourceId.Split('/')[-1]
    Write-Host " ✅ Found '$managedIdentityName'" -ForegroundColor Green
    Write-LogFile -Message "Successfully discovered Managed Identity '$managedIdentityName' with Resource ID: $managedIdentityResourceId" -Level "SUCCESS"
    $discoveredCount++
  }
  catch {
    Write-Host " ❌ Missing" -ForegroundColor Red
    Write-LogFile -Message "Failed to discover Managed Identity: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
    $missingResources += [PSCustomObject]@{
      ResourceType = "Managed Identity"
      ResourceName = "Unknown"
      Error = $_.Exception.Message
    }
    throw $_.Exception
  }

  # Extract Log Analytics Workspace ResourceId from diagnostic settings (required)
  Write-Host "🔍 Discovering Log Analytics Workspace configuration..." -ForegroundColor Cyan -NoNewline
  Write-LogFile -Message "Starting Log Analytics Workspace discovery from diagnostic settings" -Level "INFO"
  try {
    $diagnosticSettings = Get-AzDiagnosticSetting -ResourceId $webApp.Id -ErrorAction SilentlyContinue
    if (-not $diagnosticSettings) {
      throw [System.InvalidOperationException]::new("No diagnostic settings found for WebApp '$AppName'. Log Analytics configuration is required for migration.")
    }

    $logAnalyticsWorkspaceId = $diagnosticSettings |
      ForEach-Object { $_.WorkspaceId } |
      Where-Object { $_ } |
      Select-Object -First 1

    if (-not $logAnalyticsWorkspaceId) {
      throw [System.InvalidOperationException]::new("No Log Analytics Workspace configured in diagnostic settings for WebApp '$AppName'. This is required for migration.")
    }
    $logAnalyticsWorkspaceName = $logAnalyticsWorkspaceId.Split('/')[-1]
    Write-Host " ✅ Found '$logAnalyticsWorkspaceName'" -ForegroundColor Green
    Write-LogFile -Message "Successfully discovered Log Analytics Workspace '$logAnalyticsWorkspaceName' with Resource ID: $logAnalyticsWorkspaceId" -Level "SUCCESS"
    $discoveredCount++
  }
  catch {
    Write-Host " ❌ Missing" -ForegroundColor Red
    Write-LogFile -Message "Failed to discover Log Analytics Workspace: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
    $missingResources += [PSCustomObject]@{
      ResourceType = "Log Analytics Workspace"
      ResourceName = "Unknown"
      Error = $_.Exception.Message
    }
    throw $_.Exception
  }

  # Get app settings once for efficiency across multiple lookups
  $appSettings = $webApp.SiteConfig.AppSettings

  # Extract CosmosDB Account Name from COSMOS_URL and find the actual resource
  # Azure IPAM stores all IP address data in Cosmos DB
  Write-Host "🔍 Discovering Cosmos DB Account configuration..." -ForegroundColor Cyan -NoNewline
  Write-LogFile -Message "Starting Cosmos DB Account discovery" -Level "INFO"
  try {
    $cosmosSetting = $appSettings | Where-Object { $_.Name -eq "COSMOS_URL" }
    if (-not $cosmosSetting) {
      throw [System.ArgumentException]::new("No COSMOS_URL environment variable found for WebApp '$AppName'. This is required for migration.", "COSMOS_URL")
    }
    Write-LogFile -Message "Found COSMOS_URL setting: $($cosmosSetting.Value)" -Level "INFO"
    $cosmosDbAccountName = Get-Subdomain -Url $cosmosSetting.Value
    Write-LogFile -Message "Extracted Cosmos DB account name: $cosmosDbAccountName" -Level "INFO"

    # Get current Azure PowerShell context for subscription ID
    $azContext = Get-AzContext
    if (-not $azContext -or -not $azContext.Subscription) {
      throw [System.InvalidOperationException]::new("No active Azure PowerShell context found. Please run Connect-AzAccount to authenticate.")
    }
    $subscriptionId = $azContext.Subscription.Id
    Write-LogFile -Message "Using subscription ID: $subscriptionId" -Level "INFO"

    # Search all Cosmos DB accounts in subscription since resource group may differ
    # This handles scenarios where Cosmos DB was deployed in a different RG
    $cosmosApiUri = "https://management.azure.com/subscriptions/$subscriptionId/providers/Microsoft.DocumentDB/databaseAccounts?api-version=2025-04-15"
    Write-LogFile -Message "Querying Cosmos DB accounts via REST API: $cosmosApiUri" -Level "INFO"
    $cosmosResponse = Invoke-AzRestMethod -Uri $cosmosApiUri -Method GET

    if ($cosmosResponse.StatusCode -ne 200) {
      throw [System.InvalidOperationException]::new("Failed to retrieve Cosmos DB accounts from subscription '$subscriptionId'. Status: $($cosmosResponse.StatusCode)")
    }

    $cosmosData = $cosmosResponse.Content | ConvertFrom-Json
    $cosmosAccounts = $cosmosData.value
    Write-LogFile -Message "Found $($cosmosAccounts.Count) Cosmos DB accounts in subscription" -Level "INFO"

    if ($cosmosAccounts.Count -eq 0) {
      throw [System.InvalidOperationException]::new("No Cosmos DB accounts found in subscription '$subscriptionId'.")
    }

    # Prioritize exact name match, fallback to hostname match for flexibility
    $matchedAccount = $cosmosAccounts | Where-Object { $_.name -eq $cosmosDbAccountName }
    Write-LogFile -Message "Exact name match result: $(if ($matchedAccount) { $matchedAccount.name } else { 'No match' })" -Level "INFO"

    if (-not $matchedAccount) {
      # If no exact match, try to find by URL hostname match
      $targetHostname = ([System.Uri]::new($cosmosSetting.Value)).Host
      Write-LogFile -Message "Attempting hostname match for: $targetHostname" -Level "INFO"
      $matchedAccount = $cosmosAccounts | Where-Object {
        $_.properties.documentEndpoint -and ([System.Uri]::new($_.properties.documentEndpoint)).Host -eq $targetHostname
      }
      Write-LogFile -Message "Hostname match result: $(if ($matchedAccount) { $matchedAccount.name } else { 'No match' })" -Level "INFO"
    }

    if (-not $matchedAccount) {
      $availableAccounts = $cosmosAccounts | ForEach-Object { "$($_.name) (Endpoint: $($_.properties.documentEndpoint))" }
      Write-LogFile -Message "Available Cosmos DB accounts: $($availableAccounts -join ', ')" -Level "ERROR"
      throw [System.InvalidOperationException]::new("No Cosmos DB account found matching name '$cosmosDbAccountName' or URL '$($cosmosSetting.Value)'. Available accounts: $($availableAccounts -join ', ')")
    }

    Write-Host " ✅ Found '$($matchedAccount.name)'" -ForegroundColor Green
    Write-LogFile -Message "Successfully discovered Cosmos DB Account '$($matchedAccount.name)' with Resource ID: $($matchedAccount.id)" -Level "SUCCESS"
    $cosmosDbResourceId = $matchedAccount.id
    $discoveredCount++
  }
  catch {
    Write-Host " ❌ Missing" -ForegroundColor Red
    Write-LogFile -Message "Failed to discover Cosmos DB Account: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
    $missingResources += [PSCustomObject]@{
      ResourceType = "Cosmos DB Account"
      ResourceName = if ($cosmosDbAccountName) { $cosmosDbAccountName } else { "Unknown" }
      Error = $_.Exception.Message
    }
    throw [System.InvalidOperationException]::new("Failed to find Cosmos DB resource for URL '$($cosmosSetting.Value)': $($_.Exception.Message)", $_.Exception)
  }

  # Extract KeyVault Name from KEYVAULT_URL and find the actual resource (required)
  Write-Host "🔍 Discovering Key Vault configuration..." -ForegroundColor Cyan -NoNewline
  try {
    $keyVaultSetting = $appSettings | Where-Object { $_.Name -eq "KEYVAULT_URL" }
    if (-not $keyVaultSetting) {
      throw [System.ArgumentException]::new("No KEYVAULT_URL environment variable found for WebApp '$AppName'. This is required for migration.", "KEYVAULT_URL")
    }
    $keyVaultName = Get-Subdomain -Url $keyVaultSetting.Value

    # Search all Key Vaults in subscription since resource group may differ
    $keyVaults = Get-AzKeyVault -ErrorAction Stop

    if ($keyVaults.Count -eq 0) {
      throw [System.InvalidOperationException]::new("No Key Vaults found in subscription '$subscriptionId'.")
    }

    # Prioritize exact name match, fallback to hostname match for flexibility
    $matchedVault = $keyVaults | Where-Object { $_.VaultName -eq $keyVaultName }

    if (-not $matchedVault) {
      # If no exact match, try to find by URL hostname match
      $targetHostname = ([System.Uri]::new($keyVaultSetting.Value)).Host
      $matchedVault = $keyVaults | Where-Object {
        $_.VaultUri -and ([System.Uri]::new($_.VaultUri)).Host -eq $targetHostname
      }
    }

    if (-not $matchedVault) {
      $availableVaults = $keyVaults | ForEach-Object { "$($_.VaultName) (URI: $($_.VaultUri))" }
      throw [System.InvalidOperationException]::new("No Key Vault found matching name '$keyVaultName' or URL '$($keyVaultSetting.Value)'. Available vaults: $($availableVaults -join ', ')")
    }

    Write-Host " ✅ Found '$($matchedVault.VaultName)'" -ForegroundColor Green
    $keyVaultResourceId = $matchedVault.ResourceId
    $discoveredCount++
  }
  catch {
    Write-Host " ❌ Missing" -ForegroundColor Red
    $missingResources += [PSCustomObject]@{
      ResourceType = "Key Vault"
      ResourceName = if ($keyVaultName) { $keyVaultName } else { "Unknown" }
      Error = $_.Exception.Message
    }
    throw [System.InvalidOperationException]::new("Failed to find Key Vault resource for URL '$($keyVaultSetting.Value)': $($_.Exception.Message)", $_.Exception)
  }

  # Extract App Service Plan name (required)
  Write-Host "🔍 Discovering App Service Plan configuration..." -ForegroundColor Cyan -NoNewline
  try {
    if (-not $webApp.ServerFarmId) {
      throw [System.InvalidOperationException]::new("No App Service Plan found for WebApp '$AppName'. This is required for migration.")
    }
    $appServicePlanName = $webApp.ServerFarmId.Split('/')[-1]
    Write-Host " ✅ Found '$appServicePlanName'" -ForegroundColor Green
    $discoveredCount++
  }
  catch {
    Write-Host " ❌ Missing" -ForegroundColor Red
    $missingResources += [PSCustomObject]@{
      ResourceType = "App Service Plan"
      ResourceName = "Unknown"
      Error = $_.Exception.Message
    }
    throw $_.Exception
  }

  # Determine the container registry from the Docker Compose configuration and classify it.
  # Azure IPAM deployments use one of two registries our automation produces: the public
  # Azure IPAM registry, or a private ACR co-located in the App Service's resource group.
  Write-Host "🔍 Discovering Container Registry configuration..." -ForegroundColor Cyan -NoNewline
  $containerRegistryResourceId = $null
  try {
    $linuxFxVersion = $webApp.SiteConfig.LinuxFxVersion

    if ([string]::IsNullOrWhiteSpace($linuxFxVersion) -or -not $linuxFxVersion.StartsWith("COMPOSE|")) {
      throw [System.InvalidOperationException]::new("WebApp '$AppName' is not a Docker Compose deployment. This script migrates legacy Docker Compose deployments to the modern single-container model; if this app is already a single-container deployment, use update.ps1 instead.")
    }

    $registryHost = Get-RegistryHost -LinuxFxVersion $linuxFxVersion
    if ([string]::IsNullOrWhiteSpace($registryHost)) {
      throw [System.InvalidOperationException]::new("Unable to determine the container registry from the Docker Compose configuration for WebApp '$AppName'.")
    }

    $registryConfig = Resolve-RegistryConfig -RegistryHost $registryHost -ResourceGroupName $ResourceGroupName
    $containerRegistryResourceId = $registryConfig.AcrResourceId

    switch ($registryConfig.Mode) {
      'PublicManaged'  { Write-Host " ✅ Public registry ($registryHost)" -ForegroundColor Green; $discoveredCount++ }
      'PrivateManaged' { Write-Host " ✅ Private ACR ($registryHost)" -ForegroundColor Green; $discoveredCount++ }
      'Divergent'      { Write-Host " ⚠️ Non-standard ($registryHost)" -ForegroundColor Yellow }
    }
  }
  catch {
    Write-Host " ❌ Error" -ForegroundColor Red
    Write-LogFile -Message "Failed to discover Container Registry: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
    $missingResources += [PSCustomObject]@{
      ResourceType = "Container Registry"
      ResourceName = "LinuxFxVersion"
      Error = $_.Exception.Message
    }
    throw $_.Exception
  }

  # Set global variables for Location, Azure Cloud and registry mode for use in later functions
  $script:location = $webApp.Location
  $script:azureCloud = Get-AppSettingValue -AppSettings $appSettings -Name 'AZURE_ENV'
  $script:registryMode = $registryConfig.Mode
  $script:registryHost = $registryConfig.RegistryHost
  $script:privateAcr = ($registryConfig.Mode -eq 'PrivateManaged')

  # Divergent registry: the container registry could not be resolved automatically (not the
  # public registry, and no matching ACR in the App Service's resource group). Stop and direct
  # the user to supply the exact configuration via the -JsonFile override.
  if ($registryConfig.Mode -eq 'Divergent') {
    Write-Section -Title "Container Registry Not Detected"
    Write-Host "The container registry '$registryHost' could not be resolved automatically. It is not" -ForegroundColor Yellow
    Write-Host "the Azure IPAM public registry, and no matching Azure Container Registry was found in" -ForegroundColor Yellow
    Write-Host "resource group '$ResourceGroupName'." -ForegroundColor Yellow
    Write-Host
    Write-Host "Re-run the migration with the -JsonFile override to specify the container registry and" -ForegroundColor Yellow
    Write-Host "resource details explicitly. For guidance, see:" -ForegroundColor Yellow
    Write-Host "  https://azure.github.io/ipam/#/migration/README" -ForegroundColor Cyan
    Write-Host
    exit
  }

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Discovery Summary: $discoveredCount/$totalExpectedResources resources found" -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  # If any resources are missing, display details and throw error
  if ($missingResources.Count -gt 0) {
    Write-Host
    Write-Host "❌ Missing Resources Details:" -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Red

    foreach ($missing in $missingResources) {
      Write-Host "Resource Type: $($missing.ResourceType)" -ForegroundColor Yellow
      Write-Host "Resource Name: $($missing.ResourceName)" -ForegroundColor White
      Write-Host "Error: $($missing.Error)" -ForegroundColor Red
      Write-Host "----------------------------------------------------" -ForegroundColor Red
    }

    $missingCount = $missingResources.Count
    $missingNames = $missingResources | ForEach-Object { "$($_.ResourceType) '$($_.ResourceName)'" }

    throw [System.InvalidOperationException]::new("Resource discovery failed. $missingCount out of $totalExpectedResources resources could not be found: $($missingNames -join ', '). Please ensure all resources exist and are properly configured.")
  }
  else {
    Write-Host "✅ All required resources discovered successfully!" -ForegroundColor Green
  }

  Write-Host

  return [PSCustomObject]@{
    WebAppResourceId             = $webApp.Id
    ManagedIdentityResourceId    = $managedIdentityResourceId
    LogAnalyticsWorkspaceId      = $logAnalyticsWorkspaceId
    CosmosDbResourceId           = $cosmosDbResourceId
    KeyVaultResourceId           = $keyVaultResourceId
    AppServicePlanResourceId     = $webApp.ServerFarmId
    ContainerRegistryResourceId  = $containerRegistryResourceId
  }
}

function Format-WebAppDetailsTable {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Details
  )

  # Define resource types and their property names
  $resourceMap = @{
    "Web App" = "WebAppResourceId"
    "Managed Identity" = "ManagedIdentityResourceId"
    "Log Analytics Workspace" = "LogAnalyticsWorkspaceId"
    "Cosmos DB Account" = "CosmosDbResourceId"
    "Key Vault" = "KeyVaultResourceId"
    "App Service Plan" = "AppServicePlanResourceId"
  }

  $tableData = foreach ($resourceType in $resourceMap.Keys) {
    $resourceId = $Details.($resourceMap[$resourceType])
    if (-not [string]::IsNullOrWhiteSpace($resourceId)) {
      $resourceDetails = Get-ResourceDetailsFromId -ResourceId $resourceId
      [PSCustomObject]@{
        ResourceType = $resourceType
        ResourceName = $resourceDetails.ResourceName
        ResourceGroup = $resourceDetails.ResourceGroupName
        Subscription = $resourceDetails.SubscriptionId
      }
    }
  }

  # Handle Container Registry separately
  if (-not [string]::IsNullOrWhiteSpace($Details.ContainerRegistryResourceId)) {
    $containerRegistryDetails = Get-ResourceDetailsFromId -ResourceId $Details.ContainerRegistryResourceId
    $tableData += [PSCustomObject]@{
      ResourceType = "Container Registry"
      ResourceName = $containerRegistryDetails.ResourceName
      ResourceGroup = $containerRegistryDetails.ResourceGroupName
      Subscription = $containerRegistryDetails.SubscriptionId
    }
  }
  elseif ($Details.PSObject.Properties.Name -contains "ContainerRegistryResourceId") {
    $tableData += [PSCustomObject]@{
      ResourceType = "Container Registry"
      ResourceName = "azureipam (Public)"
      ResourceGroup = "N/A"
      Subscription = "N/A"
    }
  }

  Write-Host "=====================================================" -ForegroundColor Red
  Write-Host "Resource Summary Table:" -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Red
  $tableData | Format-Table -AutoSize
  Write-Host "=====================================================" -ForegroundColor Red
  Write-Host
}

function Test-ResourceExistence {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$ResourceDetails
  )

  # Define property names and their corresponding display names
  $resourcePropertyMap = @{
    "WebAppResourceId"             = "Web App"
    "ManagedIdentityResourceId"    = "Managed Identity"
    "LogAnalyticsWorkspaceId"      = "Log Analytics Workspace"
    "CosmosDbResourceId"           = "Cosmos DB Account"
    "KeyVaultResourceId"           = "Key Vault"
    "AppServicePlanResourceId"     = "App Service Plan"
    "ContainerRegistryResourceId"  = "Container Registry"
  }

  # Validate input parameter
  if ($null -eq $ResourceDetails) {
    throw [System.ArgumentException]::new("ResourceDetails parameter cannot be null.", "ResourceDetails")
  }

  if ($ResourceDetails -isnot [PSCustomObject]) {
    throw [System.ArgumentException]::new("ResourceDetails parameter must be a PSCustomObject. Received type: $($ResourceDetails.GetType().Name)", "ResourceDetails")
  }

  # Get all Resource ID properties from the input object (including ContainerRegistryResourceId even if null)
  $resourceIdProperties = $ResourceDetails.PSObject.Properties | Where-Object {
    $_.Name -in $resourcePropertyMap.Keys -and
    ($_.Name -eq "ContainerRegistryResourceId" -or -not [string]::IsNullOrWhiteSpace($_.Value))
  }

  if ($resourceIdProperties.Count -eq 0) {
    $availableProperties = $ResourceDetails.PSObject.Properties | ForEach-Object { $_.Name }
    $expectedProperties = $resourcePropertyMap.Keys
    throw [System.ArgumentException]::new("No valid Resource ID properties found in the provided object. Expected properties: $($expectedProperties -join ', '). Available properties: $($availableProperties -join ', ').", "ResourceDetails")
  }

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Verifying Resource Existence..." -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  $missingResources = @()
  $verifiedCount = 0
  $totalCount = $resourceIdProperties.Count

  foreach ($property in $resourceIdProperties) {
    $resourceId = $property.Value

    if ([string]::IsNullOrWhiteSpace($resourceId)) {
      # Special handling for ContainerRegistryResourceId - it can be null (indicating public ACR)
      if ($property.Name -eq "ContainerRegistryResourceId") {
        Write-Host "🔍 Verifying Container Registry..." -ForegroundColor Cyan -NoNewline
        Write-Host " ℹ️ Skipped (using public registry)" -ForegroundColor Cyan
        $verifiedCount++
        continue
      }
      else {
        Write-Host "⚠️  Skipping empty resource ID for property: $($property.Name)" -ForegroundColor Yellow
        continue
      }
    }

    try {
      # Get display name from property mapping
      $displayName = $resourcePropertyMap[$property.Name]

      # Extract resource details for additional info
      $resourceInfo = Get-ResourceDetailsFromId -ResourceId $resourceId

      Write-Host "🔍 Verifying $displayName '$($resourceInfo.ResourceName)'..." -ForegroundColor Cyan -NoNewline

      # Test resource existence
      $resource = Get-AzResource -ResourceId $resourceId -ErrorAction SilentlyContinue

      if ($resource) {
        Write-Host " ✅ Verified" -ForegroundColor Green
        $verifiedCount++
      }
      else {
        Write-Host " ❌ Missing" -ForegroundColor Red
        $missingResources += [PSCustomObject]@{
          ResourceType = $displayName
          ResourceName = $resourceInfo.ResourceName
          ResourceGroup = $resourceInfo.ResourceGroupName
          Subscription = $resourceInfo.SubscriptionId
          ResourceId = $resourceId
        }
      }
    }
    catch {
      Write-Host " ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
      $displayName = $resourcePropertyMap[$property.Name]
      $resourceInfo = Get-ResourceDetailsFromId -ResourceId $resourceId

      $missingResources += [PSCustomObject]@{
        ResourceType = $displayName
        ResourceName = $resourceInfo.ResourceName
        ResourceGroup = $resourceInfo.ResourceGroupName
        Subscription = $resourceInfo.SubscriptionId
        ResourceId = $resourceId
        Error = $_.Exception.Message
      }
    }
  }

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Verification Summary: $verifiedCount/$totalCount resources found" -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  # If any resources are missing, display details and throw error
  if ($missingResources.Count -gt 0) {
    Write-Host
    Write-Host "❌ Missing Resources Details:" -ForegroundColor Red
    Write-Host "=====================================================" -ForegroundColor Red

    foreach ($missing in $missingResources) {
      Write-Host "Resource Type: $($missing.ResourceType)" -ForegroundColor Yellow
      Write-Host "Resource Name: $($missing.ResourceName)" -ForegroundColor White
      Write-Host "Resource Group: $($missing.ResourceGroup)" -ForegroundColor White
      Write-Host "Subscription: $($missing.Subscription)" -ForegroundColor White
      Write-Host "Resource ID: $($missing.ResourceId)" -ForegroundColor Gray
      if ($missing.Error) {
        Write-Host "Error: $($missing.Error)" -ForegroundColor Red
      }
      Write-Host "----------------------------------------------------" -ForegroundColor Red
    }

    Write-Host

    $missingCount = $missingResources.Count
    $missingNames = $missingResources | ForEach-Object { "$($_.ResourceType) '$($_.ResourceName)'" }

    throw [System.InvalidOperationException]::new("Resource verification failed. $missingCount out of $totalCount resources could not be found or accessed: $($missingNames -join ', '). Please ensure all resources exist and you have appropriate permissions.")
  }
  else {
    Write-Host "✅ All resources verified successfully!" -ForegroundColor Green
  }

  Write-Host
}

function Read-JsonData {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.FileInfo]
    $JsonFilePath
  )

  $DATA_MAP = @{
    "Web App" = @{
      ResourceType = "Microsoft.Web/sites"
      Required = $true
    }
    "App Service Plan" = @{
      ResourceType = "Microsoft.Web/serverfarms"
      Required = $true
    }
    "Managed Identity" = @{
      ResourceType = "Microsoft.ManagedIdentity/userAssignedIdentities"
      Required = $true
    }
    "Log Analytics Workspace" = @{
      ResourceType = "Microsoft.OperationalInsights/workspaces"
      Required = $true
    }
    "Cosmos DB Account" = @{
      ResourceType = "Microsoft.DocumentDB/databaseAccounts"
      Required = $true
    }
    "Key Vault" = @{
      ResourceType = "Microsoft.KeyVault/vaults"
      Required = $true
    }
    "Container Registry" = @{
      ResourceType = "Microsoft.ContainerRegistry/registries"
      Required = $false
    }
  }

  $jsonData = Get-Content -Path $JsonFilePath.FullName -Raw | ConvertFrom-Json

  $resourceTypes = $jsonData | ForEach-Object { $_.ResourceType }

  # Extract required and optional resource types from DATA_MAP
  $requiredResourceTypes = $DATA_MAP.Values | Where-Object { $_.Required -eq $true } | ForEach-Object { $_.ResourceType }
  $optionalResourceTypes = $DATA_MAP.Values | Where-Object { $_.Required -eq $false } | ForEach-Object { $_.ResourceType }
  $allValidResourceTypes = $requiredResourceTypes + $optionalResourceTypes

  # Check for missing required resource types
  $missingRequired = $requiredResourceTypes | Where-Object { $_ -notin $resourceTypes }
  $invalidTypes = $resourceTypes | Where-Object { $_ -notin $allValidResourceTypes }

  if ($missingRequired.Count -gt 0 -or $invalidTypes.Count -gt 0) {
    $errorMessages = @()
    if ($missingRequired.Count -gt 0) {
      $errorMessages += "Missing required resource types: $($missingRequired -join ', ')"
    }
    if ($invalidTypes.Count -gt 0) {
      $errorMessages += "Invalid resource types found: $($invalidTypes -join ', ')"
    }

    $errorMessage = "The JSON file '$($JsonFilePath.Name)' has resource type issues. $($errorMessages -join '. ')"
    throw [System.ArgumentException]::New($errorMessage, "JsonFilePath")
  }

  # Create a hashtable to store resources by type for easy lookup
  $resourceLookup = @{}
  foreach ($resource in $jsonData) {
    $resourceLookup[$resource.ResourceType] = $resource
  }

  # Build Resource IDs using the helper function
  $resourceIds = @{}
  $requiredResourceTypes + $optionalResourceTypes | ForEach-Object {
    $resource = $resourceLookup[$_]
    if ($resource) {
      $resourceIds[$_] = New-ResourceId -Resource $resource
    }
  }

  # Return PSCustomObject matching the structure from Get-WebAppDetail
  return [PSCustomObject]@{
    WebAppResourceId             = $resourceIds["Microsoft.Web/sites"]
    ManagedIdentityResourceId    = $resourceIds["Microsoft.ManagedIdentity/userAssignedIdentities"]
    LogAnalyticsWorkspaceId      = $resourceIds["Microsoft.OperationalInsights/workspaces"]
    CosmosDbResourceId           = $resourceIds["Microsoft.DocumentDB/databaseAccounts"]
    KeyVaultResourceId           = $resourceIds["Microsoft.KeyVault/vaults"]
    AppServicePlanResourceId     = $resourceIds["Microsoft.Web/serverfarms"]
    ContainerRegistryResourceId  = $resourceIds["Microsoft.ContainerRegistry/registries"]
  }
}

function Get-WebAppStatusDetail {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Details
  )

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Probing WebApp Status API..." -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  try {
    $webAppDetails = Get-ResourceDetailsFromId -ResourceId $Details.WebAppResourceId

    Write-Host "🔍 Getting WebApp hostname..." -ForegroundColor Cyan -NoNewline
    $webApp = Get-AzWebApp -ResourceGroupName $webAppDetails.ResourceGroupName -Name $webAppDetails.ResourceName -ErrorAction Stop

    if (-not $webApp.HostNames -or $webApp.HostNames.Count -eq 0) {
      throw [System.InvalidOperationException]::new("No hostnames found for WebApp '$($webAppDetails.ResourceName)'.")
    }

    $appUri = $webApp.HostNames[0]
    Write-Host " ✅ Found '$appUri'" -ForegroundColor Green

    $statusApiUrl = "https://$appUri/api/status"
    Write-Host "🔍 Querying status API..." -ForegroundColor Cyan -NoNewline

    $statusResponse = Invoke-RestMethod -Uri $statusApiUrl -Method GET -TimeoutSec 30 -ErrorAction Stop
    Write-Host " ✅ Success" -ForegroundColor Green

    # Simplified property extraction - PowerShell 7.2+ supports null-conditional operators
    $containerStack = $statusResponse.stack
    $containerImage = $statusResponse.container?.image_id

    if (-not $containerStack) {
      Write-Warning "No 'stack' property found in status API response."
    }

    if (-not $containerImage) {
      Write-Warning "No 'image_id' property found in container object."
    }

    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "✅ Status API probing completed successfully!" -ForegroundColor Green
    Write-Host

    return [PSCustomObject]@{
      ContainerStack = $containerStack
      ContainerImage = $containerImage
      StatusApiUrl = $statusApiUrl
    }
  }
  catch [System.Net.WebException] {
    Write-Host " ❌ Network Error" -ForegroundColor Red
    throw [System.InvalidOperationException]::new("Failed to connect to status API at '$statusApiUrl'. Error: $($_.Exception.Message). This may indicate the WebApp is not running or the status API endpoint is not available.", $_.Exception)
  }
  catch {
    Write-Host " ❌ Error" -ForegroundColor Red
    throw [System.InvalidOperationException]::new("Failed to probe status API at '$statusApiUrl': $($_.Exception.Message).", $_.Exception)
  }
}

function ConvertTo-MigrationObject {
  param(
    [Parameter(Mandatory = $true)]
    [PSCustomObject]$Details
  )

  # Create a mapping of resource types to their property names
  $resourceMapping = @{
    webApp = "WebAppResourceId"
    managedIdentity = "ManagedIdentityResourceId"
    logAnalytics = "LogAnalyticsWorkspaceId"
    appServicePlan = "AppServicePlanResourceId"
    cosmosDb = "CosmosDbResourceId"
    keyVault = "KeyVaultResourceId"
    containerRegistry = "ContainerRegistryResourceId"
  }

  # Extract all resource details at once for efficiency
  $resourceDetails = @{}
  foreach ($key in $resourceMapping.Keys) {
    $resourceId = $Details.($resourceMapping[$key])
    if (-not [string]::IsNullOrWhiteSpace($resourceId)) {
      $resourceDetails[$key] = Get-ResourceDetailsFromId -ResourceId $resourceId
    }
  }

  # Get WebApp settings for Cosmos DB configuration
  $webApp = Get-AzWebApp -ResourceGroupName $resourceDetails.webApp.ResourceGroupName -Name $resourceDetails.webApp.ResourceName -ErrorAction Stop
  $appSettings = $webApp.SiteConfig.AppSettings

  # Extract Cosmos DB names with Azure IPAM defaults if environment variables missing
  $databaseNameSetting = $appSettings | Where-Object { $_.Name -eq "DATABASE_NAME" }
  $containerNameSetting = $appSettings | Where-Object { $_.Name -eq "CONTAINER_NAME" }

  # Use Azure IPAM default values if environment variables are not found
  if (-not $databaseNameSetting) {
    Write-Warning "No DATABASE_NAME environment variable found for WebApp '$($resourceDetails.webApp.ResourceName)'. Using default value 'ipam-db'."
    $cosmosDatabaseName = "ipam-db"
  }
  else {
    $cosmosDatabaseName = $databaseNameSetting.Value
  }

  if (-not $containerNameSetting) {
    Write-Warning "No CONTAINER_NAME environment variable found for WebApp '$($resourceDetails.webApp.ResourceName)'. Using default value 'ipam-ctr'."
    $cosmosContainerName = "ipam-ctr"
  }
  else {
    $cosmosContainerName = $containerNameSetting.Value
  }

  return @{
    appService = @{
      appServiceName = $resourceDetails.webApp.ResourceName
      appServiceRG = $resourceDetails.webApp.ResourceGroupName
    }
    appServicePlan = @{
      appServicePlanName = $resourceDetails.appServicePlan.ResourceName
      appServicePlanRG = $resourceDetails.appServicePlan.ResourceGroupName
    }
    cosmosAccount = @{
      cosmosAccountName = $resourceDetails.cosmosDb.ResourceName
      cosmosAccountRG = $resourceDetails.cosmosDb.ResourceGroupName
      cosmosContainerName = $cosmosContainerName
      cosmosDatabaseName = $cosmosDatabaseName
    }
    keyVault = @{
      keyVaultName = $resourceDetails.keyVault.ResourceName
      keyVaultRG = $resourceDetails.keyVault.ResourceGroupName
    }
    logAnalytics = @{
      workspaceName = $resourceDetails.logAnalytics.ResourceName
      workspaceRG = $resourceDetails.logAnalytics.ResourceGroupName
    }
    managedIdentity = @{
      managedIdentityName = $resourceDetails.managedIdentity.ResourceName
      managedIdentityRG = $resourceDetails.managedIdentity.ResourceGroupName
    }
    # Handle optional container registry details (PowerShell 7.2+ null-conditional operator)
    containerRegistry = @{
      containerRegistryName = $resourceDetails.containerRegistry?.ResourceName
      containerRegistryRG = $resourceDetails.containerRegistry?.ResourceGroupName
    }
  }
}

function Deploy-Bicep {
  param(
    [Parameter(Mandatory = $false)]
    [PSCustomObject]$Details
  )

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Deploying IPAM Migration Templates..." -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  Write-LogFile -Message "=== Starting Bicep Deployment ===" -Level "INFO"
  Write-LogFile -Message "Location: $script:location" -Level "INFO"
  Write-LogFile -Message "Azure Cloud: $script:azureCloud" -Level "INFO"
  Write-LogFile -Message "Private ACR: $script:privateAcr" -Level "INFO"
  Write-LogFile -Message "Resource Details: $(ConvertTo-Json $Details -Depth 5 -Compress)" -Level "INFO"

  try {
    # Instantiate deployment parameter object
    Write-Host "📄 Preparing deployment parameters..." -ForegroundColor Cyan -NoNewline
    $deploymentParameters = @{
      location = $script:location
      azureCloud = $script:azureCloud
      privateAcr = $script:privateAcr
      resourceDetails = $Details
    }
    Write-LogFile -Message "Deployment parameters prepared: $(ConvertTo-Json $deploymentParameters -Depth 5 -Compress)" -Level "INFO"
    Write-Host " ✅ Success" -ForegroundColor Green

    # Generate unique deployment name
    $deploymentName = "ipamInfraMigrate-$(Get-Date -Format `"yyyyMMddhhmmsstt`")"
    Write-LogFile -Message "Generated deployment name: $deploymentName" -Level "INFO"
    Write-Host "🚀 Starting Bicep deployment..." -ForegroundColor Cyan -NoNewline

    # Verify main.bicep file exists
    $bicepPath = Join-Path -Path $ROOT_DIR -ChildPath "migrate\main.bicep"
    if (-not (Test-Path -Path $bicepPath)) {
      Write-LogFile -Message "Bicep template not found at: $bicepPath" -Level "ERROR"
      throw [System.InvalidOperationException]::new("Bicep template file not found at path: $bicepPath")
    }
    Write-LogFile -Message "Bicep template verified at: $bicepPath" -Level "INFO"

    # Deploy IPAM bicep template
    Write-LogFile -Message "Executing New-AzDeployment with template: main.bicep" -Level "INFO"

    # Capture the Azure deployment debug stream to the debug log when -Debug is set
    $DebugPreference = $debugSetting

    $deployment = New-AzDeployment `
      -Name $deploymentName `
      -Location $script:location `
      -TemplateFile main.bicep `
      -TemplateParameterObject $deploymentParameters `
      -ErrorAction Stop 5>$($DEBUG_MODE ? $debugLog : $null)

    $DebugPreference = 'SilentlyContinue'

    Write-Host " ✅ Success" -ForegroundColor Green
    Write-LogFile -Message "Bicep deployment completed successfully" -Level "SUCCESS"
    Write-LogFile -Message "Deployment result: $(ConvertTo-Json $deployment -Depth 3 -Compress)" -Level "INFO"

    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "✅ IPAM migration templates deployed successfully!" -ForegroundColor Green
    Write-Host

    return $deployment
  }
  catch {
    Write-Host " ❌ Failed" -ForegroundColor Red
    Write-Host
    Write-Host "❌ IPAM Bicep template deployment failed!" -ForegroundColor Red
    Write-LogFile -Message "Bicep deployment failed: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
    throw [System.InvalidOperationException]::new("Failed to deploy IPAM Bicep templates: $($_.Exception.Message)", $_.Exception)
  }
}

function Build-ContainerImage {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ContainerType,
    [Parameter(Mandatory = $true)]
    [string]$TargetAcrResourceId,
    [Parameter(Mandatory = $true)]
    [string]$WebAppResourceId
  )

  Write-Host "=====================================================" -ForegroundColor Blue
  Write-Host "Building and Pushing Container Image..." -ForegroundColor Yellow
  Write-Host "=====================================================" -ForegroundColor Blue

  Write-LogFile -Message "=== Starting Container Image Build ===" -Level "INFO"
  Write-LogFile -Message "Target ACR Resource ID: $TargetAcrResourceId" -Level "INFO"
  Write-LogFile -Message "Container Type: $ContainerType" -Level "INFO"

  try {
    # Extract ACR details from Resource ID
    Write-LogFile -Message "Extracting ACR details from Resource ID" -Level "INFO"
    $acrDetails = Get-ResourceDetailsFromId -ResourceId $TargetAcrResourceId
    $targetAcrName = $acrDetails.ResourceName
    $acrResourceGroup = $acrDetails.ResourceGroupName
    $subscriptionId = $acrDetails.SubscriptionId
    Write-LogFile -Message "ACR Details - Name: $targetAcrName, ResourceGroup: $acrResourceGroup, Subscription: $subscriptionId" -Level "INFO"

    # Determine container type from the container details
    Write-LogFile -Message "Container type: $ContainerType" -Level "INFO"

    # Container configuration mapping (kept in sync with deploy.ps1)
    $containerMap = @{
      Debian = @{
        Extension = 'deb'
        Port      = 8080
        Images    = @{
          Build = 'node:22-slim'
          Serve = 'python:3.11-slim'
        }
      }
      RHEL = @{
        Extension = 'rhel'
        Port      = 8080
        Images    = @{
          Build = 'registry.access.redhat.com/ubi9/nodejs-22'
          Serve = 'registry.access.redhat.com/ubi9/python-311'
        }
      }
    }

    # Validate container type
    if (-not $containerMap.ContainsKey($ContainerType)) {
      $availableTypes = $containerMap.Keys -join ', '
      Write-LogFile -Message "Invalid container type '$ContainerType'. Available types: $availableTypes" -Level "ERROR"
      throw [System.InvalidOperationException]::new("Unsupported container type '$ContainerType'. Supported types are: $availableTypes")
    }

    # Determine Dockerfile path
    $dockerFile = 'Dockerfile.' + $containerMap[$containerType].Extension
    $dockerFilePath = Join-Path -Path $ROOT_DIR -ChildPath $dockerFile
    Write-LogFile -Message "Dockerfile path determined: $dockerFilePath" -Level "INFO"

    # Verify Dockerfile exists
    if (-not (Test-Path -Path $dockerFilePath)) {
      Write-LogFile -Message "Dockerfile not found at path: $dockerFilePath" -Level "ERROR"
      throw [System.InvalidOperationException]::new("Dockerfile not found at path '$dockerFilePath'. Please ensure the required Dockerfile exists for container type '$containerType'.")
    }
    Write-LogFile -Message "Dockerfile verified at path: $dockerFilePath" -Level "SUCCESS"

    Write-Host "🔨 Building IPAM container image (" -ForegroundColor Cyan -NoNewline
    Write-Host "$containerType" -ForegroundColor Yellow -NoNewline
    Write-Host ")..." -ForegroundColor Cyan -NoNewline

    # Log build parameters for troubleshooting
    $buildArgs = @{
      Port = $containerMap[$containerType].Port
      BuildImage = $containerMap[$containerType].Images.Build
      ServeImage = $containerMap[$containerType].Images.Serve
    }
    Write-LogFile -Message "ACR build parameters: $(ConvertTo-Json $buildArgs -Compress)" -Level "INFO"
    Write-LogFile -Message "Build command: az acr build -r $targetAcrName -t ipam:latest -f $dockerFilePath $ROOT_DIR --build-arg PORT=$($buildArgs.Port) --build-arg BUILD_IMAGE=$($buildArgs.BuildImage) --build-arg SERVE_IMAGE=$($buildArgs.ServeImage) --no-logs" -Level "INFO"

    # Execute ACR build command
    $appBuildOutput = $(
      az acr build -r $targetAcrName `
        -t ipam:latest `
        -f $dockerFilePath $ROOT_DIR `
        --build-arg PORT=$($containerMap[$containerType].Port) `
        --build-arg BUILD_IMAGE=$($containerMap[$containerType].Images.Build) `
        --build-arg SERVE_IMAGE=$($containerMap[$containerType].Images.Serve) `
        --no-logs
    ) *>&1

    Write-LogFile -Message "ACR build command exit code: $LASTEXITCODE" -Level "INFO"
    Write-LogFile -Message "ACR build output: $($appBuildOutput -join ' ')" -Level "INFO"

    # Check build result
    if ($LASTEXITCODE -ne 0) {
      Write-Host " ❌ Failed" -ForegroundColor Red
      Write-LogFile -Message "ACR build failed with exit code: $LASTEXITCODE" -Level "ERROR"

      # Extract build ID for error logging
      $buildId = [regex]::Matches($appBuildOutput, "(?<=Queued a build with ID: )[\w]*").Value.Trim()
      Write-LogFile -Message "Extracted build ID: $buildId" -Level "INFO"

      if ($buildId) {
        Write-Host "📋 Fetching build logs for ID: $buildId..." -ForegroundColor Cyan -NoNewline
        Write-LogFile -Message "Attempting to fetch detailed build logs for build ID: $buildId" -Level "INFO"

        try {
          # Get current subscription and resource group for the ACR
          $azContext = Get-AzContext
          $currentSubscriptionId = $azContext.Subscription.Id
          Write-LogFile -Message "Current PowerShell context subscription: $currentSubscriptionId" -Level "INFO"

          # Validate we're working with the same subscription
          if ($subscriptionId -ne $currentSubscriptionId) {
            Write-Warning "ACR is in subscription '$subscriptionId' but current context is '$currentSubscriptionId'. This may affect log retrieval."
            Write-LogFile -Message "Subscription mismatch detected - ACR: $subscriptionId, Current: $currentSubscriptionId" -Level "WARNING"
          }

          # Fetch detailed build logs
          Write-LogFile -Message "Calling Get-BuildLog function for detailed error analysis" -Level "INFO"
          $buildLogs = Get-BuildLog -SubscriptionId $subscriptionId -ResourceGroupName $acrResourceGroup -RegistryName $targetAcrName -BuildId $buildId -AzureCloud $script:azureCloud

          Write-Host " ✅ Success" -ForegroundColor Green
          # Write-Host "📋 Build logs retrieved successfully:" -ForegroundColor Yellow
          # Write-Host $buildLogs -ForegroundColor Gray
          Write-LogFile -Message "=== DETAILED BUILD LOGS ===" -Level "ERROR"
          Write-LogFile -Message $buildLogs -Level "ERROR"
          Write-LogFile -Message "=== END BUILD LOGS ===" -Level "ERROR"

          $errorMessage = "Container build failed with exit code $LASTEXITCODE. Build ID: $buildId. Detailed logs retrieved above."
        }
        catch {
          Write-Host " ❌ Failed" -ForegroundColor Red
          Write-Host "⚠️ Failed to retrieve build logs: $($_.Exception.Message)" -ForegroundColor Yellow
          Write-LogFile -Message "Failed to retrieve build logs: $($_.Exception.Message)" -Level "ERROR" -ErrorRecord $_
          $errorMessage = "Container build failed with exit code $LASTEXITCODE. Build ID: $buildId. Output: $($appBuildOutput -join ' '). Failed to retrieve detailed logs: $($_.Exception.Message)"
        }
      }
      else {
        Write-LogFile -Message "No build ID found in ACR build output" -Level "ERROR"
        $errorMessage = "Container build failed with exit code $LASTEXITCODE. Output: $($appBuildOutput -join ' '). No build ID found in output."
      }

      Write-LogFile -Message "Final error message: $errorMessage" -Level "ERROR"
      throw [System.InvalidOperationException]::new($errorMessage)
    }
    else {
      Write-Host " ✅ Success" -ForegroundColor Green
      Write-LogFile -Message "ACR build completed successfully" -Level "SUCCESS"
    }

    # Generate new image reference
    $newImageReference = "$targetAcrName.azurecr.io/ipam:latest"

    # Restart the WebApp to pick up the new image (non-fatal: the image is already pushed)
    try {
      $webAppDetails = Get-ResourceDetailsFromId -ResourceId $WebAppResourceId
      Restart-IpamApp -AppName $webAppDetails.ResourceName -ResourceGroupName $webAppDetails.ResourceGroupName
    }
    catch {
      Write-Warning "WebApp restart failed: $($_.Exception.Message). You may need to manually restart the WebApp to apply the new container image."
    }

    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "✅ Container image build and push completed successfully!" -ForegroundColor Green
    Write-Host

    # Return only the image reference string
    return $newImageReference
  }
  catch {
    # Write-Host
    Write-Host "❌ Container image build and push failed!" -ForegroundColor Red
    throw [System.InvalidOperationException]::new("Failed to build and push container image: $($_.Exception.Message)", $_.Exception)
  }
}

# Log script start
Write-LogFile -Message "=== Azure IPAM Migration Script Started ===" -Level "INFO"
Write-LogFile -Message "Parameters: AppName=$AppName, ResourceGroupName=$ResourceGroupName, JsonFile=$JsonFile, NoVerify=$NoVerify, Force=$Force" -Level "INFO"
Write-LogFile -Message "Root Directory: $ROOT_DIR" -Level "INFO"
Write-LogFile -Message "Log File: $logFile" -Level "INFO"

# Begin capturing the full console session to the transcript (always stopped in the finally block)
Start-Transcript -Path $transcriptLog | Out-Null

# Console output start
Write-Host

if ($DEBUG_MODE) {
  Write-Host "🐛 Debug mode enabled — verbose Azure logs will be written to:" -ForegroundColor Gray
  Write-Host "   $debugLog" -ForegroundColor Gray
  Write-Host
}

try {

  # Determine resource discovery method based on whether JSON override file is provided
  if ([string]::IsNullorEmpty($JsonFile)) {
    # Auto-discovery mode: Extract configuration from existing WebApp
    Write-Host "⚙️ Auto-Discovering Resource Details from WebApp Config..." -ForegroundColor Magenta
    Write-Host
    Write-LogFile -Message "Starting auto-discovery mode for ResourceGroup: $ResourceGroupName, AppName: $AppName" -Level "INFO"

    $details = Get-WebAppDetail -ResourceGroupName $ResourceGroupName -AppName $AppName
    Write-LogFile -Message "Auto-discovery completed successfully" -Level "SUCCESS"

    # Display the table summary
    Format-WebAppDetailsTable -Details $details
  }
  else {
    # Override mode: Use administrator-provided JSON configuration
    Write-Host "📄 Reading Resource Overrides from specified JSON File: " -ForegroundColor Magenta -NoNewline
    Write-Host "$($JsonFile.FullName)" -ForegroundColor Yellow
    Write-Host
    Write-LogFile -Message "Using JSON override mode with file: $($JsonFile.FullName)" -Level "INFO"

    $jsonFilePath = Get-Item -Path $script:JsonFile
    $details = Read-JsonData -JsonFilePath $jsonFilePath
    Write-LogFile -Message "JSON override data loaded successfully" -Level "SUCCESS"

    # Establish registry context from the live App Service and the customer-declared resources.
    # We trust the declared structure/location but still resolve (and later verify) the registry.
    $overrideWebAppInfo = Get-ResourceDetailsFromId -ResourceId $details.WebAppResourceId
    $overrideWebApp = Get-AzWebApp -ResourceGroupName $overrideWebAppInfo.ResourceGroupName -Name $overrideWebAppInfo.ResourceName -ErrorAction Stop

    $registryHost = Get-RegistryHost -LinuxFxVersion $overrideWebApp.SiteConfig.LinuxFxVersion
    $registryConfig = Resolve-RegistryConfig -RegistryHost $registryHost -ResourceGroupName $overrideWebAppInfo.ResourceGroupName -AcrResourceId $details.ContainerRegistryResourceId

    $script:location = $overrideWebApp.Location
    $script:azureCloud = Get-AppSettingValue -AppSettings $overrideWebApp.SiteConfig.AppSettings -Name 'AZURE_ENV'
    $script:registryMode = $registryConfig.Mode
    $script:registryHost = $registryConfig.RegistryHost
    $script:privateAcr = ($registryConfig.Mode -eq 'PrivateManaged')

    # Display the table summary
    Format-WebAppDetailsTable -Details $details
  }

  # User confirmation before proceeding with migration
  if (-not $Force -and -not (Get-UserConfirmation -Message "Please confirm the above resources should be used for the conversion process." -PromptText "Is this information accurate?")) {
    exit 1
  }

  # Verify resource existence before proceeding (unless NoVerify switch is set)
  if ($NoVerify -eq $false) {
    # Verify that all resources exist before proceeding
    Test-ResourceExistence -ResourceDetails $details
  }

  # Resolve the container distro for the private-ACR image build (the public path never builds).
  # An explicit -ContainerType wins; otherwise auto-detect from the source app's status API. Fail
  # early here so we don't deploy and only then discover we cannot build the correct image.
  $effectiveContainerType = $null
  if ($script:privateAcr) {
    if ([string]::IsNullOrWhiteSpace($ContainerType)) {
      $containerDetails = Get-WebAppStatusDetail -Details $details
      $effectiveContainerType = Resolve-ContainerType -Override $ContainerType -ProbedImage $containerDetails.ContainerImage
    }
    else {
      $effectiveContainerType = Resolve-ContainerType -Override $ContainerType
    }

    Write-Host "ℹ️ Container distro: $effectiveContainerType" -ForegroundColor Cyan
    Write-Host
  }

  # Azure CLI validation only required for private ACR scenarios (for ACR build command)
  if($script:privateAcr) {
    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "Verifying Azure CLI Configuration..." -ForegroundColor Yellow
    Write-Host "=====================================================" -ForegroundColor Blue

    # Verify Minimum Azure CLI Version
    Write-Host "🔍 Checking Azure CLI version..." -ForegroundColor Cyan -NoNewline
    try {
      $azureCliVer = [System.Version](az version | ConvertFrom-Json).'azure-cli'

      if($azureCliVer -lt $MIN_AZ_CLI_VER) {
        Write-Host " ❌ Version $azureCliVer (Required: $MIN_AZ_CLI_VER or greater)" -ForegroundColor Red
        throw [System.InvalidOperationException]::new("Azure CLI must be version $MIN_AZ_CLI_VER or greater! Current version: $azureCliVer")
      }
      else {
        Write-Host " ✅ v$azureCliVer" -ForegroundColor Green
      }
    }
    catch {
      Write-Host " ❌ Error checking version" -ForegroundColor Red
      throw [System.InvalidOperationException]::new("Failed to verify Azure CLI version: $($_.Exception.Message)", $_.Exception)
    }

    # Verify Azure PowerShell and Azure CLI Contexts Match
    # This ensures ACR build operations target the correct subscription
    Write-Host "🔍 Verifying Azure CLI authentication..." -ForegroundColor Cyan -NoNewline
    try {
      $azureCliContext = $(az account show | ConvertFrom-Json) 2>$null

      if(-not $azureCliContext) {
        Write-Host " ❌ Not authenticated" -ForegroundColor Red
        throw [System.InvalidOperationException]::new("Azure CLI not logged in or no subscription has been selected!")
      }
      else {
        Write-Host " ✅ Authenticated" -ForegroundColor Green
      }
    }
    catch {
      Write-Host " ❌ Authentication failed" -ForegroundColor Red
      throw [System.InvalidOperationException]::new("Azure CLI authentication verification failed: $($_.Exception.Message)", $_.Exception)
    }

    # Synchronize Azure PowerShell and CLI contexts to prevent deployment/build mismatches
    Write-Host "🔍 Verifying Azure CLI context..." -ForegroundColor Cyan -NoNewline
    try {
      $azureCliSub = $azureCliContext.id
      $azurePowerShellSub = (Get-AzContext).Subscription.Id

      if ($azurePowerShellSub -ne $azureCliSub) {
        Write-Host " ❌ Context Mismatch" -ForegroundColor Red
        Write-Host "   ↳Azure PowerShell: $azurePowerShellSub" -ForegroundColor Gray
        Write-Host "   ↳Azure CLI: $azureCliSub" -ForegroundColor Gray

        Write-Host "🔧 Switching Azure CLI context..." -ForegroundColor Cyan -NoNewline

        $null = az account set --subscription $azurePowerShellSub 2>&1
        if ($LASTEXITCODE -ne 0) {
          Write-Host " ❌ Failed" -ForegroundColor Red
          throw "Failed to switch Azure CLI context to subscription '$azurePowerShellSub'"
        }

        Write-Host " ✅ Success" -ForegroundColor Green
      }
      else {
        Write-Host " ✅ Synchronized" -ForegroundColor Green
      }
    }
    catch {
      Write-Host " ❌ Context verification failed" -ForegroundColor Red
      throw [System.InvalidOperationException]::new("Failed to verify context synchronization: $($_.Exception.Message)", $_.Exception)
    }

    Write-Host "=====================================================" -ForegroundColor Blue
    Write-Host "✅ Azure CLI configuration verified successfully!" -ForegroundColor Green
    Write-Host
  }

  Write-Host "🔄 Converting Resource Details to Migration Object..." -ForegroundColor Cyan
  # Transform discovered resource details into format expected by Bicep templates
  $migrationObject = ConvertTo-MigrationObject -Details $details
  Write-Host

  # Final user confirmation before executing deployment and container operations
  if (-not $Force -and -not (Get-UserConfirmation -Message "Please confirm you are ready to proceed with the Azure IPAM migration process." -PromptText "Proceed with migration?")) {
    Write-LogFile -Message "User declined to proceed with migration" -Level "INFO"
    exit 1
  }

  Write-LogFile -Message "User confirmed migration process, beginning deployment phase" -Level "INFO"

  # Deploy Bicep templates to update Azure IPAM infrastructure
  Write-LogFile -Message "Starting Bicep template deployment" -Level "INFO"
  Deploy-Bicep -Details $migrationObject | Out-Null
  Write-LogFile -Message "Bicep template deployment completed successfully" -Level "SUCCESS"

  # Build and push container image to target ACR (if using private ACR)
  if ($script:privateAcr) {
    Write-LogFile -Message "Private ACR enabled, proceeding with container image build" -Level "INFO"
    # Get target ACR resource ID from the details object
    $targetAcrResourceId = $details.ContainerRegistryResourceId

    if ([string]::IsNullOrWhiteSpace($targetAcrResourceId)) {
      Write-Warning "Private ACR is enabled but no target ACR resource ID found in details object. Skipping container image build and push."
      Write-LogFile -Message "Private ACR enabled but no target ACR resource ID found, skipping container build" -Level "WARNING"
    }
    else {
      Write-LogFile -Message "Building and pushing container image to ACR: $targetAcrResourceId" -Level "INFO"
      # Build custom container image and push to private ACR, then restart WebApp
      $newImageReference = Build-ContainerImage -ContainerType $effectiveContainerType -TargetAcrResourceId $targetAcrResourceId -WebAppResourceId $details.WebAppResourceId
      Write-Host "🎉 Migration complete!" -ForegroundColor Green
      Write-LogFile -Message "Migration completed successfully with private ACR. New image reference: $newImageReference" -Level "SUCCESS"
    }
  }
  else {
    # Using public Azure IPAM registry - no custom build required
    Write-Host "🎉 Migration completed using public Azure IPAM registry!" -ForegroundColor Green
    Write-LogFile -Message "Migration completed successfully using public Azure IPAM registry" -Level "SUCCESS"
  }

  Write-LogFile -Message "=== Azure IPAM Migration Script Completed Successfully ===" -Level "SUCCESS"
}
catch {
  Write-LogFile -Message "=== CRITICAL ERROR: Migration Failed ===" -Level "ERROR" -ErrorRecord $_
  Write-Host
  Write-Host "💥 Migration failed! Check the log file for details." -ForegroundColor Red
  Write-Host "📋 Log file location: $logFile" -ForegroundColor Yellow
  if ($DEBUG_MODE) {
    Write-Host "🐛 Debug log location: $debugLog" -ForegroundColor Yellow
  }
  throw
}
finally {
  Stop-Transcript | Out-Null
}

Write-Host
