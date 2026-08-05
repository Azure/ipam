###############################################################################################################
##
## Azure IPAM Zip Deploy Archive Creation Script
##
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2

# Intake and set global parameters
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingPositionalParameters', '', Justification = 'npm is an external executable; its arguments are not PowerShell positional parameters.')]
param(
  [Parameter(Mandatory = $true)]
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

  [Parameter(Mandatory = $false)]
  [ValidateScript({
    if ($_.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars()) -eq -1) {
      return $true
    }
    throw 'File name contains invalid characters'
  })]
  [string]
  $FileName = 'ipam.zip',

  # Use this to use "npm install" instead of "npm ci" and direct pip to install "requirements.txt" instead of "requirements.lock.txt"
  [Parameter(Mandatory = $false)]
  [switch]
  $ManifestOnly
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# Define minimum NodeJS and NPM versions required to build the Azure IPAM UI solution
$MIN_NODE_VERSION = [version]'22.22.0'
$MIN_NPM_VERSION = [version]'10.9.2'

# Load Python version required to build the Azure IPAM UI solution
$engineAppDir = Join-Path -Path $ROOT_DIR -ChildPath "engine" -AdditionalChildPath "app"
$engineVersionFile = Join-Path -Path $engineAppDir -ChildPath "version.json"
$engineVersionJson = Get-Content -Path $engineVersionFile | ConvertFrom-Json
$PYTHON_VERSION = [version]$engineVersionJson.python

# Wheels must target the App Service runtime, not the build host. manylinux2014
# (glibc 2.17) maximizes compatibility for sovereign clouds that lag commercial.
# If pip ever reports "no matching distribution", widen to 'manylinux_2_28_x86_64'
# (glibc 2.28, still under bullseye's 2.31); the gate ceiling follows automatically.
$PIP_PLATFORM = 'manylinux2014_x86_64'

$PYTHON_TAG = "$($PYTHON_VERSION.Major).$($PYTHON_VERSION.Minor)"
$PYTHON_ABI = "cp$($PYTHON_VERSION.Major)$($PYTHON_VERSION.Minor)"

$MAX_GLIBC_VERSION = switch -Regex ($PIP_PLATFORM) {
  '^manylinux2014_' { [version]'2.17'; break }
  '^manylinux_(\d+)_(\d+)_' { [version]"$($Matches[1]).$($Matches[2])"; break }
  default { throw "Cannot derive a glibc ceiling from PIP_PLATFORM '$PIP_PLATFORM'." }
}

# Create a temporary folder path
$tempFolder = Join-Path -Path TEMP:\ -ChildPath $(New-Guid)

# Set preference variables
$ErrorActionPreference = "Stop"

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

$errorLog = Join-Path -Path $logPath -ChildPath "error_$(Get-Date -Format `"yyyyMMddhhmmsstt`").log"
$transcriptLog = Join-Path -Path $logPath -ChildPath "build_$(Get-Date -Format `"yyyyMMddhhmmsstt`").log"

Start-Transcript -Path $transcriptLog | Out-Null

try {
  Write-Host

  if ($ManifestOnly) {
    Write-Host "NOTE: " -ForegroundColor Magenta -NoNewline
    Write-Host "ManifestOnly" -ForegroundColor Cyan -NoNewline
    Write-Host " flag is set!" -ForegroundColor Magenta
  }

  Write-Host "INFO: Verifying NodeJS is present and has the correct version" -ForegroundColor Green

  # Check for NodeJS and NPM and fetch their current versions
  try {
    $npmErr = $(
      $npmDetails = npm version --json
    ) 2>&1
  } catch {
    Write-Host "ERROR: NodeJS not detected!" -ForegroundColor red
    Write-Host "ERROR: NodeJS is required to build the Azure IPAM code package!" -ForegroundColor red
    exit 1
  }

  # Extract NodeJs and NPM versions and exit if either is not detected
  if($null -eq $npmErr) {
    $npmDetailsJson = [string]$npmDetails | ConvertFrom-Json

    $npmVersion = [version]$npmDetailsJson.npm
    $nodeVersion = [version]$npmDetailsJson.node
  } else {
    Write-Host "ERROR: NodeJS not detected!" -ForegroundColor red
    Write-Host "ERROR: NodeJS is required to build the Azure IPAM code package!" -ForegroundColor red
    exit 1
  }

  # Check for required NodeJS version
  if($nodeVersion -lt $MIN_NODE_VERSION) {
    Write-Host "ERROR: NodeJS must be " -ForegroundColor red -NoNewline
    Write-Host "v$MIN_NODE_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host " or greater!" -ForegroundColor red
  }

  # Check for required NPM version
  if($npmVersion -lt $MIN_NPM_VERSION) {
    Write-Host "ERROR: NPM must be " -ForegroundColor red -NoNewline
    Write-Host "v$MIN_NPM_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host " or greater!" -ForegroundColor red
  }

  # Exit if NodeJS or NPM versions do not meet the minimum version requirements
  if(($nodeVersion -lt $MIN_NODE_VERSION) -or ($npmVersion -lt $MIN_NPM_VERSION)) {
    exit 1
  }

  Write-Host "INFO: Verifying Python is present and has the correct version" -ForegroundColor Green

  # Check for PIP and fetch the associated Python version
  try {
    $pipErr = $(
      $pipDetails = pip --version
    ) 2>&1
  } catch {
    Write-Host "ERROR: Python PIP not detected!" -ForegroundColor red
    Write-Host "ERROR: Python " -ForegroundColor red -NoNewline
    Write-Host "v$PYTHON_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host " and PIP are required to build the Azure IPAM code package!" -ForegroundColor red
    exit 1
  }

  # Extract Python version and exit if it doesn't match required version
  if($null -eq $pipErr) {
    try {
      $pythonVersion = [version]$([regex]::matches($pipDetails, '(?!=[(python ])[\d]+\.[\d]+(?=[)])').value)
    } catch {
      Write-Host "ERROR: Cannot extract Python version!" -ForegroundColor red
      Write-Host "ERROR: Python " -ForegroundColor red -NoNewline
      Write-Host "v$PYTHON_VERSION" -ForegroundColor cyan -NoNewline
      Write-Host " and PIP are required to build the Azure IPAM code package!" -ForegroundColor red
      exit 1
    }
  } else {
    Write-Host "ERROR: Python PIP not detected!" -ForegroundColor red
    Write-Host "ERROR: Python " -ForegroundColor red -NoNewline
    Write-Host "v$PYTHON_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host " and PIP are required to build the Azure IPAM code package!" -ForegroundColor red
    exit 1
  }

  # Check for required Python version
  if($pythonVersion -ne $PYTHON_VERSION) {
    Write-Host "ERROR: Python must be " -ForegroundColor red -NoNewline
    Write-Host "v$PYTHON_VERSION" -ForegroundColor cyan -NoNewline
    Write-Host "! Python " -ForegroundColor red -NoNewline
    Write-Host "v$pythonVersion" -ForegroundColor cyan -NoNewline
    Write-Host " detected." -ForegroundColor red
    exit 1
  }

  Write-Host "INFO: Building application creating ZIP Deploy package" -ForegroundColor Green

  # Create path to UI dir from script file location
  $uiDir = Join-Path -Path $ROOT_DIR -ChildPath "ui"

  # Switch to UI dir for package install process
  Push-Location -Path $uiDir

  Write-Host "INFO: Running NPM Install..." -ForegroundColor Green

  # Install Azure IPAM UI Dependencies
  try {
    # Capture all output for logging purposes
    $npmOutput = if ($ManifestOnly) {
      npm install --no-progress --no-update-notifier --no-fund --loglevel error 2>&1
    } else {
      npm ci --no-progress --no-update-notifier --no-fund --loglevel error 2>&1
    }

    # Throw error if NPM Install fails
    if ($LASTEXITCODE -ne 0) {
      throw "NPM Install failed with exit code $LASTEXITCODE. Output: $($npmOutput -join "`n")"
    }
  }
  catch {
    # Switch back to original dir before throwing error
    Pop-Location
    Write-Host "ERROR: NPM Install failed!" -ForegroundColor red
    throw $_
  }

  # Switch back to original dir
  Pop-Location

  # Switch to UI dir for build process
  Push-Location -Path $uiDir

  Write-Host "INFO: Running NPM Build..." -ForegroundColor Green

  # Build Azure IPAM UI
  try {
    # Capture all output for logging purposes
    $npmBuildOutput = npm run build --no-update-notifier 2>&1

    # Throw error if NPM Build fails
    if ($LASTEXITCODE -ne 0) {
      throw "NPM Build failed with exit code $LASTEXITCODE. Output: $($npmBuildOutput -join "`n")"
    }
  }
  catch {
    # Switch back to original dir before throwing error
    Pop-Location
    Write-Host "ERROR: NPM Build failed!" -ForegroundColor red
    throw $_
  }

  # Switch back to original dir
  Pop-Location

  # Create temporary directory
  New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

  # Create path to Engine dir from script file location
  $engineDir = Join-Path -Path $ROOT_DIR -ChildPath "engine"

  # Switch to Engine dir for build process
  Push-Location -Path $engineDir

  Write-Host "INFO: Running PIP install..." -ForegroundColor Green

  # Create temporary directory for PIP packages
  $packageDir = New-Item -ItemType Directory -Path (Join-Path -Path $tempFolder -ChildPath "packages")

  $pipTargetArgs = @(
    '--only-binary=:all:'
    '--platform', $PIP_PLATFORM
    '--implementation', 'cp'
    '--python-version', $PYTHON_TAG
    '--abi', $PYTHON_ABI
  )

  Write-Host "INFO: PIP wheel target - $($pipTargetArgs -join ' ')" -ForegroundColor Green

  # Fetch Azure IPAM Engine modules
  try {
    # Capture all output for logging purposes
    $pipOutput = if ($ManifestOnly) {
      pip install -r requirements.txt --target $packageDir.FullName @pipTargetArgs --no-warn-script-location --no-user --progress-bar off 2>&1
    } else {
      pip install -r requirements.lock.txt --target $packageDir.FullName @pipTargetArgs --no-warn-script-location --no-user --progress-bar off 2>&1
    }

    # Throw error if PIP Install fails
    if ($LASTEXITCODE -ne 0) {
      throw "PIP Install failed with exit code $LASTEXITCODE. Output: $($pipOutput -join "`n")"
    }
  }
  catch {
    # Switch back to original dir before throwing error
    Pop-Location
    Write-Host "ERROR: PIP Install failed!" -ForegroundColor red
    throw $_
  }

  # Switch back to original dir
  Pop-Location

  Write-Host "INFO: Verifying native modules match the target runtime..." -ForegroundColor Green

  $abiViolations = @()
  $glibcViolations = @()

  $nativeModules = Get-ChildItem -Path $packageDir.FullName -Recurse -File |
    Where-Object { $_.Name -match '\.(so|pyd)(\.\d+)*$' }

  foreach ($module in $nativeModules) {
    if ($module.Name -like '*.pyd') {
      $abiViolations += "$($module.Name) - Windows extension module"
      continue
    }

    if ($module.Name -match 'cpython-(\d+)') {
      if ($Matches[1] -ne "$($PYTHON_VERSION.Major)$($PYTHON_VERSION.Minor)") {
        $abiViolations += "$($module.Name) - built for cpython-$($Matches[1])"
      }
    }

    # GLIBC_x.y symbol versions are plain ASCII in the ELF dynamic string table
    $symbols = [regex]::Matches(
      [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($module.FullName)),
      'GLIBC_(\d+\.\d+)'
    )

    if ($symbols.Count -gt 0) {
      $required = @($symbols | ForEach-Object { [version]$_.Groups[1].Value } | Sort-Object)[-1]

      if ($required -gt $MAX_GLIBC_VERSION) {
        $glibcViolations += "$($module.Name) - requires glibc $required"
      }
    }
  }

  if (($abiViolations.Count -gt 0) -or ($glibcViolations.Count -gt 0)) {
    Write-Host "ERROR: Native module verification failed!" -ForegroundColor Red

    foreach ($violation in $abiViolations) {
      Write-Host "ERROR: Expected $PYTHON_ABI - $violation" -ForegroundColor Red
    }

    foreach ($violation in $glibcViolations) {
      Write-Host "ERROR: Exceeds glibc ceiling $MAX_GLIBC_VERSION - $violation" -ForegroundColor Red
    }

    throw "Native module verification failed with $($abiViolations.Count) ABI and $($glibcViolations.Count) glibc violation(s)."
  }

  Write-Host "INFO: Verified $($nativeModules.Count) native module(s) against $PYTHON_ABI and glibc <= $MAX_GLIBC_VERSION" -ForegroundColor Green

  # Create the Azure IPAM ZIP Deploy archive
  $FilePath = Join-Path -Path $Path -ChildPath $FileName

  Write-Host "INFO: Collecting asset files..." -ForegroundColor Green

  Copy-Item -Path ..\engine\app -Destination $tempFolder -Recurse
  Copy-Item -Path ..\engine\host.json -Destination $tempFolder
  Copy-Item -Path ..\engine\function_app.py -Destination $tempFolder
  Copy-Item -Path ..\ui\dist -Destination $tempFolder -Recurse
  Copy-Item -Path ..\init.sh -Destination $tempFolder

  if ($ManifestOnly) {
    Copy-Item -Path ..\engine\requirements.txt -Destination $tempFolder
  } else {
    Copy-Item -Path ..\engine\requirements.lock.txt -Destination (Join-Path -Path $tempFolder -ChildPath "requirements.txt")
  }

  Get-ChildItem -Path (Join-Path -Path $tempFolder -ChildPath "app") -Filter "__pycache__" -Recurse | Remove-Item -Recurse

  Write-Host "INFO: Creating ZIP Deploy archive..." -ForegroundColor Green

  Compress-Archive -Path (Join-Path -Path $tempFolder -ChildPath *) -DestinationPath $FilePath -Force

  Write-Host "INFO: Cleaning up temporary files..." -ForegroundColor Green

  # Cleanup temporary files
  Remove-Item -Path $tempFolder -Recurse -Force -ErrorAction SilentlyContinue

  Write-Host "INFO: Azure IPAM Zip Deploy archive successfully created" -ForegroundColor Green

  $fullPath = (Resolve-Path -Path $FilePath).Path

  Write-Host
  Write-Host "ZIP Asset Path: $fullPath" -ForegroundColor Yellow
}
catch {
  $_ | Out-File -FilePath $errorLog -Append
  Write-Host "ERROR: Unable to build Azure IPAM Zip assets due to an exception, see log for detailed information!" -ForegroundColor red
  Write-Host "Build Log: $transcriptLog" -ForegroundColor Red

  if ($env:CI) {
    Write-Host $_.ToString()
  }

  exit 1
}
finally {
  Set-Location (Get-Item $($MyInvocation.MyCommand.Path)).Directory
  Write-Host
  Stop-Transcript | Out-Null
}
