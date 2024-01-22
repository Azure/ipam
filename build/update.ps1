###############################################################################################################
##
## Azure IPAM ZIP Deploy Updater Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="10.3.0"}

# Intake and set global parameters
param(
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true)]
  [string]
  $AppName,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true)]
  [string]
  $ResourceGroupName
)

# Root Directory
$ROOT_DIR = (Get-Item $($MyInvocation.MyCommand.Path)).Directory.Parent.FullName

# Minimum Required Azure CLI Version
$MIN_AZ_CLI_VER = [System.Version]'2.35.0'

# Azure IPAM Public ACR
$IPAM_PUBLIC_ACR = "azureipam.azurecr.io"

# Set preference variables
$ErrorActionPreference = "Stop"

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

$updateLog = Join-Path -Path $logPath -ChildPath "update_$(get-date -format `"yyyyMMddhhmmsstt`").log"

Function Restart-IpamApp {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName
  )

  $restartRetries = 5
  $restartSuccess = $False

  do {
    try {
      Restart-AzWebApp  -Name $AppName -ResourceGroupName $ResourceGroupName -ErrorVariable restartErr *>$null

      if ($null -ne $restartErr) {
        throw $restartErr
      }

      $restartSuccess = $True
      Write-Host "INFO: Application successfuly restarted" -ForegroundColor Green
    } catch {
      if($publishRetries -gt 0) {
        Write-Host "WARNING: Problem while restarting application! Retrying..." -ForegroundColor DarkYellow
        $restartRetries--
      } else {
        Write-Host "ERROR: Unable to restart application!" -ForegroundColor Red
        throw $_
      }
    }
  } while ($restartSuccess -eq $False -and $restartRetries -gt 0)
}

Start-Transcript -Path $updateLog | Out-Null

try {
  Write-Host
  Write-Host "INFO: Verifying application exists" -ForegroundColor Green

  $appType = ""
  $isFunction = $false
  $privateAcr = $false

  $existingApp = Get-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName -ErrorAction SilentlyContinue

  if($null -eq $existingApp) {
    Write-Host "ERROR: Application not found in current subscription!" -ForegroundColor Red
    throw "Application does not exist!"
  } else {
    $appKind = $existingApp.Kind
    $appType = $($appKind.Split(",") -contains 'functionapp') ? 'Function' : 'App'
    $isFunction = $appType -eq 'Function' ? $true : $false 
  }

  $appContainer = $existingApp.Kind.Split(",") -contains 'container'
  
  if ($appContainer) {
    $appType += "Container"
  }

  Write-Host "INFO: Application exists, detected type is " -ForegroundColor Green -NoNewline
  Write-Host $appType -ForegroundColor Cyan

  if ($appContainer) {
    $appAcr = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1].Split('/')[0]
    $privateAcr = $appAcr -eq $IPAM_PUBLIC_ACR ? $false : $true

    if (-not $privateAcr) {
      Write-Host "INFO: Deployment is using the Azure IPAM public ACR, restarting to update..." -ForegroundColor Green
      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName
      Write-Host
      exit
    }

    if($privateAcr) {
      Write-Host "INFO: Private ACR detected, verifying minimum Azure CLI version" -ForegroundColor Green

      # Verify Minimum Azure CLI Version
      $azureCliVer = [System.Version](az version | ConvertFrom-Json).'azure-cli'

      if($azureCliVer -lt $MIN_AZ_CLI_VER) {
        Write-Host "ERROR: Azure CLI must be version $MIN_AZ_CLI_VER or greater!" -ForegroundColor Red
        exit
      }

      Write-Host "INFO: Private ACR detected, verifying Azure PowerShell and Azure CLI contexts match" -ForegroundColor Green

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
  }

  if ($appContainer) {
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

    $dockerFile = Join-Path -Path $ROOT_DIR -ChildPath 'Dockerfile'
    $dockerFileFunc = Join-Path -Path $ROOT_DIR -ChildPath 'Dockerfile.func'

    if($isFunction) {
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
          -f $dockerFile $ROOT_DIR `
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

      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName
    }
  } else {
    Write-Host "INFO: Uploading ZIP Deploy archive..." -ForegroundColor Green

    $zipPath = Join-Path -Path $ROOT_DIR -ChildPath 'assets' -AdditionalChildPath "ipam.zip"

    $publishRetries = 5
    $publishSuccess = $False

    do {
      try {
        Publish-AzWebApp -ResourceGroupName $ResourceGroupName -Name $AppName -ArchivePath $zipPath -Restart -Force | Out-Null
        $publishSuccess = $True
        Write-Host "INFO: ZIP Deploy archive successfully uploaded" -ForegroundColor Green
      } catch {
        if($publishRetries -gt 0) {
          Write-Host "WARNING: Problem while uploading ZIP Deploy archive! Retrying..." -ForegroundColor DarkYellow
          $publishRetries--
        } else {
          Write-Host "ERROR: Unable to upload ZIP Deploy archive!" -ForegroundColor Red
          throw $_
        }
      }
    } while ($publishSuccess -eq $False -and $publishRetries -gt 0)

    Write-Host
    Write-Host "NOTE: Please allow ~5 minutes for the ZIP Deploy process to complete" -ForegroundColor Yellow
  }
}
catch {
  $_ | Out-File -FilePath $updateLog -Append
  Write-Host "ERROR: Unable to push Azure IPAM ZIP Deploy update due to an exception, see log for detailed information!" -ForegroundColor red
  Write-Host "Update Log: $updateLog" -ForegroundColor Red
}
finally {
  Write-Host
  Stop-Transcript | Out-Null
}
