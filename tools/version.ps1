###############################################################################################################
##
## Azure IPAM Version Update Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2

# Intake and set global parameters
[CmdletBinding(DefaultParameterSetName = 'Explicit')]
param(
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true,
    ParameterSetName = 'Explicit')]
  [System.Version]
  $Version,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Implicit')]
  [switch]
  $BumpMajor,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Implicit')]
  [switch]
  $BumpMinor,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false,
    ParameterSetName = 'Implicit')]
  [switch]
  $BumpBuild
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# Set preference variables
$ErrorActionPreference = "Stop"

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

$versionLog = Join-Path -Path $logPath -ChildPath "version_$(get-date -format `"yyyyMMddhhmmsstt`").log"

$versionSuccess = $false

Start-Transcript -Path $versionLog | Out-Null

try {
  Write-Host
  Write-Host "NOTE: Version Update Type: $($PSCmdlet.ParameterSetName)" -ForegroundColor Magenta

  # Create path to adjacent directories from script file location
  $scriptPath = $MyInvocation.MyCommand.Path
  $parentDir = (Get-Item $scriptPath).Directory.Parent.FullName
  $uiDir = Join-Path -Path $parentDir -ChildPath "ui"
  $engineDir = Join-Path -Path $parentDir -ChildPath "engine" -AdditionalChildPath "app"
  $docsDir = Join-Path -Path $parentDir -ChildPath "docs"

  Write-Host "INFO: Reading version from UI package.json file" -ForegroundColor Green

  # Read version from UI package.json
  $packageJsonFile = Join-Path -Path $uiDir -ChildPath "package.json"
  $packageJsonContent = Get-Content -Path $packageJsonFile | ConvertFrom-Json
  $packageJsonVersion = $packageJsonContent.version

  Write-Host "INFO: Reading version from Engine version.json file" -ForegroundColor Green

  # Read version from Engine version.json
  $engineVersionFile = Join-Path -Path $engineDir -ChildPath "version.json"
  $engineVersionContent = Get-Content -Path $engineVersionFile | ConvertFrom-Json
  $engineVersion = $engineVersionContent.version 

  Write-Host "INFO: Reading version from Docs _coverpage.md file" -ForegroundColor Green

  # Read version from Docs coverpage.md
  $versionPattern = "(?<=<small>).*(?=<\/small>)"
  $coverpageFile = Join-Path -Path $docsDir -ChildPath "_coverpage.md"
  $coverpageContent = Get-Content -Path $coverpageFile
  $coverpageVersion = ($coverpageContent | Select-String $versionPattern).Matches.Groups[0].Value

  if ($PSCmdlet.ParameterSetName -eq 'Explicit') {
    $updatedVersion = "{0}.{1}.{2}" -f $Version.Major, $Version.Minor, $Version.Build
  }

  if ($PSCmdlet.ParameterSetName -eq 'Implicit') {
    Write-Host "INFO: Calculating new version number" -ForegroundColor Green

    $currentVersions = @($packageJsonVersion, $engineVersion, $coverpageVersion)
    $notEqual = $currentVersions -ne $currentVersions[0]

    if($notEqual) {
      Write-Host "ERROR: The current versions do not match" -ForegroundColor Red
      Write-Host "ERROR: UI: $packageJsonVersion" -ForegroundColor Red
      Write-Host "ERROR: Engine: $engineVersion" -ForegroundColor Red
      Write-Host "ERROR: Docs: $coverpageVersion" -ForegroundColor Red
      Write-Host "ERROR: Cannot implicitly bump versions" -ForegroundColor Red

      throw [System.ArgumentException]::New("Current file versions do not match.")
    } else {
      $currVer = [System.Version]$currentVersions[0]
    }

    $majorVersion = $currVer.Major
    $minorVersion = $currVer.Minor
    $buildVersion = $currVer.Build

    if($BumpMajor) {
      $majorVersion += 1
      $minorVersion = 0
      $buildVersion = 0
    }

    if($BumpMinor) {
      $minorVersion += 1
      $buildVersion = 0
    }

    if($BumpBuild) {
      $buildVersion += 1
    }

    $updatedVersion = "{0}.{1}.{2}" -f $majorVersion, $minorVersion, $buildVersion
  }

  Write-Host "INFO: Updating version for UI package.json file" -ForegroundColor Green

  # Update version for UI package.json
  $packageJsonContent.version = $updatedVersion
  $packageJsonContent | ConvertTo-Json | Set-Content -Path $packageJsonFile

  Write-Host "INFO: Updating version for Engine version.json file" -ForegroundColor Green

  # Update version for Engine version.json
  $engineVersionContent.version = $updatedVersion
  $engineVersionContent | ConvertTo-Json | Set-Content -Path $engineVersionFile

  Write-Host "INFO: Updating version for Docs coverpage.md file" -ForegroundColor Green

  # Update version for Docs coverpage.md
  $coverpageContent = $coverpageContent -replace $versionPattern, $updatedVersion
  $coverpageContent | Set-Content -Path $coverpageFile

  Write-Host "INFO: Azure IPAM versions successfully updated" -ForegroundColor Green
  Write-Host
  Write-Host "Updated Version -> v$updatedVersion" -ForegroundColor Yellow

  $script:versionSuccess = $true
}
catch {
  $_ | Out-File -FilePath $versionLog -Append
  Write-Host "ERROR: Unable to update Azure IPAM component versions due to an exception, see log for detailed information!" -ForegroundColor red
  Write-Host "Version Log: $versionLog" -ForegroundColor Red
}
finally {
  Write-Host
  Stop-Transcript | Out-Null

  if ($script:versionSuccess) {
    Write-Output "ipamVersion=$updatedVersion" >> $Env:GITHUB_OUTPUT
  }
}
