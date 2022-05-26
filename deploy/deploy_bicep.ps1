###############################################################################################################
##
## Azure IPAM Infrastructure Deployment Script
##
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="7.5.0"}

# Intake and set global parameters
Param(
    [Parameter(Mandatory=$false)]
    [string]
    $location="westus3"
)
$logFile = "./deploy_$(Get-Date -Format `"yyyyMMddhhmmsstt`").log"

# Set preference variables
$ErrorActionPreference = "Stop"

Function validateLocation {
	$validLocations = Get-AzLocation

  	Write-Host "INFO: Validating Azure Region selected for deployment" -ForegroundColor green
  	Write-Verbose -Message "Validating Azure Region selected for deployment"

  	# Validate Azure Region
  	if ($location -in ($validLocations | Select-Object -ExpandProperty Location)) {
      	foreach ($l in $validLocations) {
          	if ($location -eq $l.Location) {
              	$script:locationName = $l.DisplayName

              	Write-Host "INFO: Azure Region validated successfully" -ForegroundColor green
              	Write-Verbose -Message "Azure Region validated successfully"
          	}
      	}
  	}
  	else {
    	Write-Host "ERROR: Location provided is not a valid Azure Region!" -ForegroundColor red
      	exit
      
  	}
}

Function deployBicep {
	Write-Host "INFO: Deploying IPAM bicep templates" -ForegroundColor green
	Write-Verbose -Message "Deploying bicep templates"

	# Deploy Bicep templates
	$global:deployment = New-AzSubscriptionDeployment `
	-Name "ipamInfraDeploy-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
	-Location $location `
	-TemplateFile main.bicep `
	-TemplateParameterFile main.parameters.json

	Write-Host "INFO: IPAM bicep templates deployed successfully" -ForegroundColor green
	Write-Verbose -Message "IPAM bicep templates deployed successfully"
}

try {
	validateLocation $location

	deployBicep

	Write-Host "WARNING: Remember to update Single-Page Application Redirect URI for UI Application with value: https://$($global:deployment.Outputs["appServiceHostName"].Value)" -ForegroundColor yellow
	Write-Verbose -Message "Remember to update Single-Page Application Redirect URI for UI Application with value: https://$($global:deployment.Outputs["appServiceHostName"].Value)" 
}
catch {
	$_ | Out-File -FilePath $logFile -Append
	Write-Host "ERROR: Unable to deploy IPAM Infrastructure due to an exception, see $logFile for detailed information!" -ForegroundColor red
	exit

}
