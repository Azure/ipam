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
    if (Test-Path -LiteralPath $_ -PathType Container) {
      return $true
    }
    elseif (Test-Path -LiteralPath $_ -PathType Leaf) {
      throw 'The Path parameter must be a folder, file paths are not allowed.'
    }
    throw 'Invalid File Path'
  })]
  [string]
  $Path,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false)]
  [ValidateScript({
    if ($_.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -eq -1) {
      return $true
    }
    throw 'File name contains invalid characters'
  })]
  [string]
  $FileName = 'ipam.zip'
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# Define minimum NodeJS and NPM versions required to build the Azure IPAM UI solution
$MIN_NODE_VERSION = [System.Version]'18.0.0'
$MIN_NPM_VERSION = [System.Version]'8.6.0'

# Set preference variables
$ErrorActionPreference = "Stop"

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

$buildLog = Join-Path -Path $logPath -ChildPath "build_$(get-date -format `"yyyyMMddhhmmsstt`").log"

Start-Transcript -Path $buildLog | Out-Null

try {
  Write-Host
  Write-Host "INFO: Verifying NodeJS is present and has the correct version" -ForegroundColor Green

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
    Write-Host "ERROR: NodeJS is required to build the Azure IPAM code package!" -ForegroundColor red
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

  Write-Host "INFO: Building application creating ZIP Deploy package" -ForegroundColor Green

  # Create path to UI dir from script file location
  $uiDir = Join-Path -Path $ROOT_DIR -ChildPath "ui"

  # Switch to UI dir for build process
  Push-Location -Path $uiDir

  Write-Host "INFO: Running NPM Build..." -ForegroundColor Green

  # Build Azure IPAM UI
  $npmBuildErr = $(
    $npmBuild = npm run build --no-update-notifier
  ) 2>&1

  # Switch back to original dir
  Pop-Location

  # Create the Azure IPAM ZIP Deploy archive if NPM Build was successful
  if(-not $npmBuildErr) {
    Write-Host "INFO: Creating ZIP Deploy archive..." -ForegroundColor Green

    $FilePath = Join-Path -Path $Path -ChildPath $FileName

    Compress-Archive -Path ..\engine\app -DestinationPath $FilePath -Force
    Compress-Archive -Path ..\engine\function_app.py -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\engine\requirements.txt -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\engine\host.json -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\ui\dist -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\init.sh -DestinationPath $FilePath -Update
  } else {
    Write-Host "ERROR: Cannot create ZIP Deploy archive!" -ForegroundColor red
    throw $npmBuildErr
  }

  Write-Host "INFO: Azure IPAM Zip Deploy archive successfully created" -ForegroundColor Green

  $fullPath = (Resolve-Path -Path $FilePath).Path

  Write-Host
  Write-Host "ZIP Asset Path: $fullPath" -ForegroundColor Yellow
}
catch {
  $_ | Out-File -FilePath $buildLog -Append
  Write-Host "ERROR: Unable to build Azure IPAM Zip assets due to an exception, see log for detailed information!" -ForegroundColor red
  Write-Host "Build Log: $buildLog" -ForegroundColor Red
}
finally {
  Write-Host
  Stop-Transcript | Out-Null
}
