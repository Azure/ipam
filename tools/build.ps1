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
$MIN_NODE_VERSION = [version]'18.0.0'
$MIN_NPM_VERSION = [version]'8.6.0'

# Load Python version required to build the Azure IPAM UI solution
$engineAppDir = Join-Path -Path $ROOT_DIR -ChildPath "engine" -AdditionalChildPath "app"
$engineVersionFile = Join-Path -Path $engineAppDir -ChildPath "version.json"
$engineVersionJson = Get-Content -Path $engineVersionFile | ConvertFrom-Json
$PYTHON_VERSION = [version]$engineVersionJson.python

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
    Write-Host "ERROR: NodeJS must be " -ForegroundColor red -NoNewline
    Write-Host "v$MIN_NODE_VERSION" -ForegroundColor cyan -NoNewline
    Wrire-Host " or greater!" -ForegroundColor red
  }

  # Check for required NPM version
  if($npmVersion -lt $MIN_NPM_VERSION) {
    Write-Host "ERROR: NPM must be " -ForegroundColor red -NoNewline
    Write-Host "v$MIN_NPM_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host " or greater!" -ForegroundColor red
  }

  # Exit if NodeJS or NPM versions do not meet the minimum version requirements
  if(($nodeVersion -lt $MIN_NODE_VERSION) -or ($npmVersion -lt $MIN_NPM_VERSION)) {
    exit
  }

  Write-Host "INFO: Verifying Python is present and has the correct version" -ForegroundColor Green

  # Check for PIP and fetch the associated Python version
  $pipErr = $(    
    $pipDetails = pip --version
  ) 2>&1

  # Extract Python version and exit if it doesn't match required version
  if($null -eq $pipErr) {
    $pythonVersion = [version]$([regex]::matches($pipDetails, '(?!=[(python ])[\d]+\.[\d]+(?=[)])').value)
  } else {
    Write-Host "ERROR: Python PIP not detected!" -ForegroundColor red
    Write-Host "ERROR: Python " -ForegroundColor red -NoNewline
    Write-Host "v$PYTHON_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host " and PIP are required to build the Azure IPAM code package!" -ForegroundColor red
    exit
  }

  # Check for required Python version
  if($pythonVersion -ne $PYTHON) {
    Write-Host "ERROR: Python must be " -ForegroundColor red -NoNewline
    Write-Host "v$PYTHON_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host "! Python " -ForegroundColor red -NoNewline
    Write-Host "v$pythonVersion" -ForegroundColor cyan -NoNewline
    Write-Host " detected." -ForegroundColor red
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

  # Exit if NPM Build fails
  if($npmBuildErr) {
    Write-Host "ERROR: NPM Build failed!" -ForegroundColor red
    throw $npmBuildErr
  }

  # Create path to Engine dir from script file location
  $engineDir = Join-Path -Path $ROOT_DIR -ChildPath "engine"

  # Switch to Engine dir for build process
  Push-Location -Path $engineDir

  Write-Host "INFO: Running PIP install..." -ForegroundColor Green

  # Remove package directory if it exists
  if(Test-Path -Path TEMP:\packages) {
    Remove-Item -Path TEMP:\packages -Recurse -Force
  }

  # Create temporary directory for PIP packages
  $packageDir = New-Item -ItemType Directory -Path TEMP:\packages

  # Fetch Azure IPAM Engine modules
  $pipInstallErr = $(
    $pipInstall = pip install -r requirements.txt --target $packageDir.FullName --progress-bar off
  ) 2>&1

  # Switch back to original dir
  Pop-Location

  # Exit if PIP Install fails
  if($pipInstallErr) {
    Write-Host "ERROR: PIP Install failed!" -ForegroundColor red
    throw $pipInstallErr
  }

  # Create the Azure IPAM ZIP Deploy archive if NPM Build was successful
  if((-not $npmBuildErr) -and (-not $pipInstallErr)) {
    Write-Host "INFO: Creating ZIP Deploy archive..." -ForegroundColor Green

    $FilePath = Join-Path -Path $Path -ChildPath $FileName

    Compress-Archive -Path $packageDir.FullName -DestinationPath $FilePath -Force
    Compress-Archive -Path ..\engine\app -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\engine\function_app.py -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\engine\requirements.txt -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\engine\host.json -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\ui\dist -DestinationPath $FilePath -Update
    Compress-Archive -Path ..\init.sh -DestinationPath $FilePath -Update
  } else {
    Write-Host "ERROR: Cannot create ZIP Deploy archive!" -ForegroundColor red
    exit
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
