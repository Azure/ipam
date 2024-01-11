###############################################################################################################
##
## Azure IPAM Zip Deploy Archive Creation Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2

# Intake and set global parameters
param(
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true)]
  [ValidateScript({ 
      if(Test-Path -LiteralPath $_ -PathType Container) {
          return $true
      }
      elseif(Test-Path -LiteralPath $_ -PathType Leaf) {
          throw 'The Path parameter must be a folder, file paths are not allowed.'
      }
      throw 'Invalid File Path'
  })]
  [string]
  $Path,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false)]
  [string]
  $FileName = 'ipam.zip'
)

# Define minimum NodeJS and NPM versions required to build the Azure IPAM UI solution
$MIN_NODE_VERSION = [System.Version]'18.0.0'
$MIN_NPM_VERSION = [System.Version]'8.6.0'

# Set preference variables
$ErrorActionPreference = "Stop"

# Set Log File Location
$logPath = [Io.Path]::Combine('..', 'logs')
New-Item -ItemType Directory -Force -Path $logpath | Out-Null

$buildLog = Join-Path -Path $logPath -ChildPath "deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"

Start-Transcript -Path $buildLog | Out-Null

# Verify NodeJS & NPM are Installed and Meet the Minimum Version Requirements
Write-Host "INFO: Private flag set, verifying NodeJS is present and has the correct version" -ForegroundColor Green
Write-Verbose -Message "Private flag set, verifying NodeJS is present and has the correct version"

# Check for NodeJS and NPM and fetch their current versions
$npmErr = $(    
  $npmDetails = npm version --json
) 2>&1

# Extract NodeJs and NPM versions and exit if either is not detected
if($null -eq $npmErr) {
  $npmDetailsJson = [string]$npmDetails | ConvertFrom-Json

  $npmVersion = [version]$npmDetailsJson.npm
  $nodeVersion = [version]$npmDetailsJson.node
} else {
  Write-Host "ERROR: NodeJS not detected!" -ForegroundColor red
  Write-Host "ERROR: NodeJS is required to build the Azure IPAM code when automatic updates are disabled!" -ForegroundColor red
  exit
}

# Check for required NodeJS version
if($nodeVersion -lt $MIN_NODE_VERSION) {
  Write-Host "ERROR: NodeJS must be version $MIN_NODE_VERSION or greater!" -ForegroundColor red
}

# Check for required NPM version
if($npmVersion -lt $MIN_NPM_VERSION) {
  Write-Host "ERROR: NPM must be version $MIN_NPM_VERSION or greater!" -ForegroundColor red
}

# Exit if NodeJS or NPM versions do not meet the minimum version requirements
if(($nodeVersion -lt $MIN_NODE_VERSION) -or ($npmVersion -lt $MIN_NPM_VERSION)) {
  exit
}

Write-Host "INFO: Building application code and pushing via ZIP Deploy" -ForegroundColor Green
Write-Verbose -Message "Building application code and pushing via ZIP Deploy"

Write-Host "INFO: Running NPM Build..." -ForegroundColor Green
Write-Verbose -Message "INFO: Running NPM Build..."

# Create path to UI dir from script file location
$scriptPath = $MyInvocation.MyCommand.Path
$parentDir = (Get-Item $scriptPath).Directory.Parent.FullName
$uiDir = Join-Path $parentDir "ui"

# Switch to UI dir for build process
Push-Location -Path $uiDir

# Build Azure IPAM UI
$npmBuildErr = $(
  $npmBuild = npm run build --no-update-notifier
) 2>&1

# Switch back to original dir
Pop-Location

# Create the Azure IPAM ZIP Deploy archive if NPM Build was successful
if(-not $npmBuildErr) {
  Write-Host "INFO: Creating ZIP Deploy archive..." -ForegroundColor Green
  Write-Verbose -Message "INFO: Creating ZIP Deploy archive..."

  $FilePath = Join-Path -Path $Path -ChildPath $FileName

  Compress-Archive -Path ..\engine\app -DestinationPath $FilePath -Force
  Compress-Archive -Path ..\engine\requirements.txt -DestinationPath $FilePath -Update
  Compress-Archive -Path ..\engine\scripts\* -DestinationPath $FilePath -Update
  Compress-Archive -Path ..\engine\ipam-func -DestinationPath $FilePath -Update
  Compress-Archive -Path ..\engine\ipam-sentinel -DestinationPath $FilePath -Update
  Compress-Archive -Path ..\engine\host.json -DestinationPath $FilePath -Update
  Compress-Archive -Path ..\ui\dist -DestinationPath $FilePath -Update
} else {
  Write-Host "ERROR: Cannot create ZIP Deploy archive!" -ForegroundColor red
  throw $npmBuildErr
}

Write-Host "INFO: Azure IPAM Zip Deploy archive successfully created" -ForegroundColor Green
Write-Verbose -Message "Azure IPAM Zip Deploy archive successfully created"

Write-Host ""
Stop-Transcript | Out-Null
