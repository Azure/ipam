###############################################################################################################
##
## Azure IPAM ZIP Deploy Updater Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2

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

# Set preference variables
$ErrorActionPreference = "Stop"

# Set Log File Location
$logPath = Join-Path -Path $ROOT_DIR -ChildPath "logs"
New-Item -ItemType Directory -Path $logpath -Force | Out-Null

$updateLog = Join-Path -Path $logPath -ChildPath "update_$(get-date -format `"yyyyMMddhhmmsstt`").log"

Start-Transcript -Path $updateLog | Out-Null

try {
  Write-Host
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
