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

# Intake and set global parameters
param(
  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true)]
  [string]
  $AppName,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $true)]
  [string]
  $ResourceGroupName,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory=$false)]
  [string]
  $GitHubUserName = "Azure",

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory=$false)]
  [string]
  $GitHubRepoName = "ipam",

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory=$false)]
  [ValidateScript({
    $IndexOfInvalidChar = $_.IndexOfAny([System.IO.Path]::GetInvalidFileNameChars())
    if (-Not ($IndexOfInvalidChar -eq -1)) {
      throw [System.ArgumentException]::New("The 'ZipFileName' argument contains one or more invalid characters.")
    }
    if(-Not ($_ -match "(\.zip)")) {
      throw [System.ArgumentException]::New("The 'ZipFileName' argument must be of type zip.")
    }
    return $true
  })]
  [string]
  $ZipFileName = "ipam.zip",

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory=$false)]
  [ValidateScript({
    if(-Not ($_ | Get-Item) ) {
      throw [System.ArgumentException]::New("AssetFolder does not exist, please provide a pre-existing folder.")
    }
    return $true 
  })]
  [System.IO.DirectoryInfo]
  $AssetFolder,

  [Parameter(ValueFromPipelineByPropertyName = $true,
    Mandatory = $false)]
  [ValidateScript({
    if(-Not ($_ | Test-Path) ) {
      throw [System.ArgumentException]::New("Target file or does not exist.")
    }
    if(-Not ($_ | Test-Path -PathType Leaf) ) {
      throw [System.ArgumentException]::New("The 'ZipFilePath' argument must be a file, folder paths are not allowed.")
    }
    if($_ -notmatch "(\.zip)") {
      throw [System.ArgumentException]::New("The file specified in the 'ZipFilePath' argument must be of type zip.")
    }
    return $true 
  })]
  [System.IO.FileInfo]
  $ZipFilePath
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
$errorLog = Join-Path -Path $logPath -ChildPath "error_$(get-date -format `"yyyyMMddhhmmsstt`").log"

$containerBuildError = $false

$TempFolderObj = $null

Function Get-BuildLogs {
  Param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory=$true)]
    [string]$RegistryName,
    [Parameter(Mandatory=$true)]
    [string]$BuildId
  )

  $msArmMap = @{
    AZURE_PUBLIC         = "management.azure.com"
    AZURE_US_GOV         = "management.usgovcloudapi.net"
    AZURE_US_GOV_SECRET  = "management.azure.microsoft.scloud"
    AZURE_GERMANY        = "management.microsoftazure.de"
    AZURE_CHINA          = "management.chinacloudapi.cn"
  };

  $accessToken = (Get-AzAccessToken).Token | ConvertTo-SecureString -AsPlainText

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

Function Restart-IpamApp {
  Param(
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
      Write-Host "INFO: Application successfuly restarted" -ForegroundColor Green
    } catch {
      if($restartRetries -gt 0) {
        Write-Host "WARNING: Problem while restarting application! Retrying..." -ForegroundColor Yellow
        $restartRetries--
      } else {
        Write-Host "ERROR: Unable to restart application!" -ForegroundColor Red
        throw $_
      }
    }
  } while ($restartSuccess -eq $False -and $restartRetries -gt 0)
}

Function Get-ZipFile {
  Param(
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

    Write-Host "INFO: Target GitHub Repo is " -ForegroundColor Green -NoNewline
    Write-Host "$GitHubUserName/$GitHubRepoName" -ForegroundColor Cyan
    Write-Host "INFO: Fetching download URL..." -ForegroundColor Green

    $GHResponse = Invoke-WebRequest -Method GET -Uri $GitHubURL
    $JSONResponse = $GHResponse.Content | ConvertFrom-Json
    $AssetList = $JSONResponse.assets
    $Asset = $AssetList | Where-Object { $_.name -eq $ZipFileName }
    $DownloadURL = $Asset.browser_download_url

    Write-Host "INFO: Downloading ZIP Archive to " -ForegroundColor Green -NoNewline
    Write-Host $ZipFilePath -ForegroundColor Cyan

    Invoke-WebRequest -Uri $DownloadURL -OutFile $ZipFilePath
  } catch {
    Write-Host "ERROR: Unable to download ZIP Deploy archive!" -ForegroundColor Red
    throw $_
  }
}

Function Publish-ZipFile {
  Param(
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
    Write-Host "INFO: Using Kudu API for ZIP Deploy" -ForegroundColor Green
  }

  $publishRetries = 3
  $publishSuccess = $False

  if ($UseAPI) {
    $accessToken = (Get-AzAccessToken).Token
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
      Write-Host "INFO: ZIP Deploy archive successfully uploaded" -ForegroundColor Green
    } catch {
      if($publishRetries -gt 0) {
        Write-Host "WARNING: Problem while uploading ZIP Deploy archive! Retrying..." -ForegroundColor Yellow
        $publishRetries--
      } else {
        Write-Host "ERROR: Unable to upload ZIP Deploy archive!" -ForegroundColor Red
        throw $_
      }
    }
  } while ($publishSuccess -eq $False -and $publishRetries -ge 0)
}

Start-Transcript -Path $updateLog | Out-Null

try {
  Write-Host
  Write-Host "INFO: Verifying application exists" -ForegroundColor Green

  $appType = ""
  $isFunction = $false
  $privateAcr = $false
  $acrName = ""

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
      exit
    }

    if($privateAcr) {
      $acrName = $appAcr.Split('.')[0]

      Write-Host "INFO: Deployment is using a private ACR (" -ForegroundColor Green -NoNewline
      Write-Host "$acrName" -ForegroundColor Cyan -NoNewline
      Write-Host ")" -ForegroundColor Green
      Write-Host "INFO: Verifying ACR is in current Resource Group" -ForegroundColor Green

      $acrDetails = Get-AzContainerRegistry `
        -Name $acrName `
        -ResourceGroupName $ResourceGroupName `
        -ErrorVariable acrErr `
        -ErrorAction SilentlyContinue

      if ($acrErr) {
        Write-Host "ERROR: Private ACR not found in current Resource Group!" -ForegroundColor Red
        throw $acrErr
      }

      $acrName = $acrDetails.Name

      Write-Host "INFO: Verifying minimum Azure CLI version" -ForegroundColor Green

      # Verify Minimum Azure CLI Version
      $azureCliVer = [System.Version](az version | ConvertFrom-Json).'azure-cli'

      if($azureCliVer -lt $MIN_AZ_CLI_VER) {
        Write-Host "ERROR: Azure CLI must be version $MIN_AZ_CLI_VER or greater!" -ForegroundColor Red
        exit
      }

      Write-Host "INFO: Verifying Azure PowerShell and Azure CLI contexts match" -ForegroundColor Green

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

  if (-not $appContainer) {
    Write-Host "INFO: Verifying application Python version" -ForegroundColor Green

    $engineFolder = Join-Path -Path $ROOT_DIR -ChildPath 'engine'
    $engineVersionFile = Join-Path -Path $engineFolder -ChildPath "app" -AdditionalChildPath 'version.json'
    $enginePythonVersion = $(Get-Content -Path $engineVersionFile | ConvertFrom-Json).python

    $appPythonVersion = $existingApp.SiteConfig.LinuxFxVersion.Split('|')[1]

    if($enginePythonVersion -ne $appPythonVersion) {
      Write-Host "WARNING: Python version has changed (" -ForegroundColor Yellow -NoNewline
      Write-Host "v$appPythonVersion -> v$enginePythonVersion" -ForegroundColor Cyan -NoNewline
      Write-Host ")" -ForegroundColor Yellow
      Write-Host "INFO: Updating application Python version..." -ForegroundColor Green

      $existingApp.SiteConfig.LinuxFxVersion = "PYTHON|$enginePythonVersion"
      $existingApp | Set-AzWebApp | Out-Null

      Start-Sleep -Seconds 10
    }
  }

  if ($appContainer) {
    if (-not $isFunction) {
      Write-Host "INFO: Detecting container distro..." -ForegroundColor Green

      $appUri = $existingApp.HostNames[0]
      $statusUri = "https://${appUri}/api/status"
      $status = Invoke-RestMethod -Method Get -Uri $statusUri -ErrorVariable statusErr -ErrorAction SilentlyContinue

      if ($statusErr) {
        Write-Host "ERROR: Unable to detect container distro!" -ForegroundColor Red
        throw $statusErr
      }

      $containerType = $status.container.image_id
    }

    Write-Host "INFO: Building and pushing container images to Azure Container Registry" -ForegroundColor Green

    $containerMap = @{
      debian = @{
        Extension = 'deb'
        Port = 80
        Images = @{
          Build = 'node:18-slim'
          Serve = 'python:3.9-slim'
        }
      }
      rhel = @{
        Extension = 'rhel'
        Port = 8080
        Images = @{
          Build = 'registry.access.redhat.com/ubi8/nodejs-18'
          Serve = 'registry.access.redhat.com/ubi8/python-39'
        }
      }
    }

    if($containerType) {
      $dockerFile = 'Dockerfile.' + $containerMap[$containerType].Extension
      $dockerFilePath = Join-Path -Path $ROOT_DIR -ChildPath $dockerFile
    }

    $dockerFileFunc = Join-Path -Path $ROOT_DIR -ChildPath 'Dockerfile.func'

    if($isFunction) {
      Write-Host "INFO: Building Function container..." -ForegroundColor Green

      $funcBuildOutput = $(
        az acr build -r $acrName `
        -t ipamfunc:latest `
        -f $dockerFileFunc $ROOT_DIR `
        --no-logs
      ) *>&1

      if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Container build process failed, fetching error logs..." -ForegroundColor Red

        $buildId = [regex]::Matches($funcBuildOutput, "(?<=Queued a build with ID: )[\w]*").Value.Trim()

        $buildLogs = Get-BuildLogs `
          -SubscriptionId (Get-AzContext).Subscription.Id `
          -ResourceGroupName $ResourceGroupName `
          -RegistryName $acrName `
          -BuildId $buildId

        $buildLogs | Out-File -FilePath $errorLog -Append

        $script:containerBuildError = $true
      } else {
        Write-Host "INFO: Function container image build and push completed successfully" -ForegroundColor Green
      }

      Write-Host "INFO: Restarting Function App" -ForegroundColor Green

      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName -Function
    } else {
      Write-Host "INFO: Building App container (" -ForegroundColor Green -NoNewline
      Write-Host "$containerType" -ForegroundColor Cyan -NoNewline
      Write-Host ")..." -ForegroundColor Green

      $appBuildOutput = $(
        az acr build -r $acrName `
          -t ipam:latest `
          -f $dockerFilePath $ROOT_DIR `
          --build-arg PORT=$($containerMap[$ContainerType].Port) `
          --build-arg BUILD_IMAGE=$($containerMap[$containerType].Images.Build) `
          --build-arg SERVE_IMAGE=$($containerMap[$containerType].Images.Serve) `
          --no-logs
      ) *>&1

      if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Container build process failed, fetching error logs..." -ForegroundColor Red

        $buildId = [regex]::Matches($appBuildOutput, "(?<=Queued a build with ID: )[\w]*").Value.Trim()

        $buildLogs = Get-BuildLogs `
          -SubscriptionId (Get-AzContext).Subscription.Id `
          -ResourceGroupName $ResourceGroupName `
          -RegistryName $acrName `
          -BuildId $buildId

        $buildLogs | Out-File -FilePath $errorLog -Append

        $script:containerBuildError = $true
      } else {
        Write-Host "INFO: App container image build and push completed successfully" -ForegroundColor Green
      }

      Write-Host "INFO: Restarting App Service" -ForegroundColor Green

      Restart-IpamApp -AppName $AppName -ResourceGroupName $ResourceGroupName
    }

    if(-not $containerBuildError) {
      Write-Host "INFO: Azure IPAM Solution updated successfully" -ForegroundColor Green
    } else {
      Write-Host "WARNING: Azure IPAM Solution deployed with errors, see logs for details!" -ForegroundColor Yellow
      Write-Host "Run Log: $transcriptLog" -ForegroundColor Yellow
      Write-Host "Error Log: $errorLog" -ForegroundColor Yellow
    }
  } else {
    if (-Not $ZipFilePath) {
      if (-Not $AssetFolder) {
        try {
          # Create a temporary folder path
          $TempFolder = Join-Path -Path TEMP:\ -ChildPath $(New-Guid)

          # Create directory if not exists
          $script:TempFolderObj = New-Item -ItemType Directory -Path $TempFolder -Force

          $script:AssetFolder = $TempFolderObj
        } catch {
          Write-Host "ERROR: Unable to create temp directory to store ZIP archive!" -ForegroundColor Red
          throw $_
        }
      } else {
        $script:AssetFolder = Get-Item -Path $AssetFolder
      }

      Write-Host "INFO: Fetching latest ZIP Deploy archive..." -ForegroundColor Green

      Get-ZipFile -GitHubUserName $GitHubUserName -GitHubRepoName $GitHubRepoName -ZipFileName $ZipFileName -AssetFolder $AssetFolder

      $script:ZipFilePath = Join-Path -Path $AssetFolder.FullName -ChildPath $ZipFileName
    } else {
      $script:ZipFilePath = Get-Item -Path $ZipFilePath
    }

    Write-Host "INFO: Uploading ZIP Deploy archive..." -ForegroundColor Green

    try {
      Publish-ZipFile -AppName $AppName -ResourceGroupName $ResourceGroupName -ZipFilePath $ZipFilePath
    } catch {
      Write-Host "SWITCH: Retrying ZIP Deploy with Kudu API..." -ForegroundColor Blue
      Publish-ZipFile -AppName $AppName -ResourceGroupName $ResourceGroupName -ZipFilePath $ZipFilePath -UseAPI
    }

    if ($TempFolderObj) {
      Write-Host "INFO: Cleaning up temporary directory" -ForegroundColor Green
      Remove-Item -LiteralPath $TempFolderObj.FullName -Force -Recurse -ErrorAction SilentlyContinue
      $script:TempFolderObj = $null
    }

    Write-Host
    Write-Host "NOTE: Please allow ~5 minutes for the ZIP Deploy process to complete" -ForegroundColor Yellow
  }
}
catch {
  $_ | Out-File -FilePath $errorLog -Append
  Write-Host "ERROR: Unable to update Azure IPAM application, see log for detailed information!" -ForegroundColor red
  Write-Host "Update Log: $errorLog" -ForegroundColor Red

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
