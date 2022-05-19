###############################################################################################################
##
## Azure IPAM Infrastructure Deployment Script
##
###############################################################################################################

# Intake and set parameters
Param(
    [Parameter(Mandatory=$false)]
    [string]
    $location="westus3"
)
$logFile = "./deploy_$(Get-Date -Format `"yyyyMMddhhmmsstt`").log"

# Validate Location
$validLocations = Get-AzLocation
Function ValidateLocation {
    if ($location -in ($validLocations | Select-Object -ExpandProperty Location)) {
        foreach ($l in $validLocations) {
            if ($location -eq $l.Location) {
                $script:locationName = $l.DisplayName
            }
        }
    }
    else {
        Write-Host "ERROR: Location provided is not a valid Azure Region!" -ForegroundColor red
        exit
    }
}

ValidateLocation $location

try {
  # Deploy IPAM bicep template
  Write-Host "INFO: Deploying IPAM bicep template" -ForegroundColor green
  Write-Verbose -Message "Deploying bicep template"
  
  $deployment = New-AzSubscriptionDeployment `
  -Name "ipamInfraDeploy-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
  -Location $location `
  -TemplateFile main.bicep `
  -TemplateParameterFile main.parameters.json

  Write-Host "INFO: IPAM bicep template deployment complete" -ForegroundColor green
  Write-Verbose -Message "IPAM bicep template deployment complete"
  
}
catch {
  $_ | Out-File -FilePath $logFile -Append
  Write-Host "ERROR: Unable to deploy IPAM bicep template due to an exception, see $logFile for detailed information!" -ForegroundColor red
  exit

}

try {
  # Update service principal with single-page application configuration
  Write-Host "INFO: Updating Service Principal with SPA configuration" -ForegroundColor green
  Write-Verbose -Message "Updating Service Principal with SPA configuration"
  $spObjectId = (Get-AzADApplication -ApplicationId $deployment.Parameters["spnClientId"].Value).Id
  $appServiceEndpoint = "https://$($deployment.Outputs["appServiceHostName"].Value)"

  Update-AzADApplication -ObjectId $spObjectId -SPARedirectUri $appServiceEndpoint

  az rest --method PATCH `
  --uri "https://graph.microsoft.com/v1.0/applications/$spObjectId" `
  --headers 'Content-Type=application/json' `
  --body '{\"web\":{\"implicitGrantSettings\":{\"enableIdTokenIssuance\":true,\"enableAccessTokenIssuance\":true}}}'

  Write-Host "INFO: Service Principal SPA configuration update complete" -ForegroundColor green
  Write-Verbose -Message "Service Principal SPA configuration update complete"

}
catch {
  $_ | Out-File -FilePath $logFile -Append
  Write-Host "ERROR: Unable to Update Service Principal with SPA configuration due to an exception, see $logFile for detailed information!" -ForegroundColor red
  exit
  
}