###############################################################################################################
##
## Azure IPAM Solution Deployment Script
## 
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="7.5.0"}
#Requires -Modules @{ ModuleName="Microsoft.Graph"; ModuleVersion="1.9.6"}

# Intake and set global parameters
Param(
	[Parameter(Mandatory=$true)]
  	[string]$location="westus3",
  	[Parameter(Mandatory=$true)]
  	[string]$namePrefix="ipam",
  	[Parameter(Mandatory=$false)]
  	[string]$tags
)
$engineApiGuid = New-Guid
$logFile = "./deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"
$tenantId = (Get-AzContext).Tenant.Id

# Set preference variables
$ErrorActionPreference = "Stop"

Function validateLocation {
    # Validate Azure Region
    Write-Host "INFO: Validating Azure Region selected for deployment" -ForegroundColor green
    Write-Verbose -Message "Validating Azure Region selected for deployment"
  
    $validLocations = Get-AzLocation
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

Function deployEngineApplication {
    $azureSvcMgmtApiPermissionsScope = "user_impersonation"
    $azureSvcMgmtAppId ="797f4846-ba00-4fd7-ba43-dac1f8f63013"
    $msGraphApiPermissionsScope = "offline_access openid profile User.Read"
    $msGraphAppId = "00000003-0000-0000-c000-000000000000"
    $engineResourceAccess = [System.Collections.ArrayList]@(
        @{
            ResourceAppId = "00000003-0000-0000-c000-000000000000";
            ResourceAccess = @(
                @{
                    Id = "7427e0e9-2fba-42fe-b0c0-848c9e6a8182";
                    Type = "Scope"
                },
                @{
                    Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d";
                    Type = "Scope"
                },
                @{
                    Id = "37f7f235-527c-4136-accd-4a02d197296e";
                    Type = "Scope"
                },
                @{
                    Id = "14dad69e-099b-42c9-810b-d002981feec1";
                    Type = "Scope"
                }
            )
        },
        @{
            ResourceAppId = "797f4846-ba00-4fd7-ba43-dac1f8f63013";
            ResourceAccess = @(
                @{
                    Id = "41094075-9dad-400e-a0bd-54e686782033";
                    Type = "Scope"
                }
            )
        }
    )

    # Create IPAM engine application
    Write-Host "INFO: Creating Azure IPAM Engine Service Principal" -ForegroundColor green
    Write-Verbose -Message "Creating Azure IPAM Engine Service Principal"
    $global:engineApp = New-AzADApplication `
    -DisplayName "ipam-engine-app" `
    -RequiredResourceAccess $engineResourceAccess

    # Update IPAM engine application with API endpoint
    Update-AzADApplication -ApplicationId $global:engineApp.AppId -IdentifierUri "api://$($global:engineApp.AppId)"
    
    # Create IPAM engine service principal
    $engineSpn = New-AzADServicePrincipal `
    -ApplicationObject $global:engineApp `
    -Role "Reader" `
    -Scope "/providers/Microsoft.Management/managementGroups/$($tenantId)"

    # Create IPAM engine service principal credential
    $global:engineSecret = New-AzADAppCredential -ApplicationObject $global:engineApp -StartDate (Get-Date) -EndDate (Get-Date).AddYears(2)

    Write-Host "INFO: Azure IPAM Engine Application & Service Principal created successfully" -ForegroundColor green
    Write-Verbose -Message "Azure IPAM Engine Application & Service Principal created successfully"
    
    # Instantiate Microsoft Graph service principal object
    $msGraphSpn = Get-AzADServicePrincipal `
    -ApplicationId $msGraphAppId

    # Instantiate Azure Service Management service principal object
    $azureSvcMgmtSpn = Get-AzADServicePrincipal `
    -ApplicationId $azureSvcMgmtAppId

    # Grant admin consent for Microsoft Graph API permissions assigned to IPAM engine application
    Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM Engine Application" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Microsoft Graph API permissions assigned to IPAM Engine Application"
    New-MgOauth2PermissionGrant `
    -ResourceId $msGraphSpn.Id `
    -Scope $msGraphApiPermissionsScope `
    -ClientId $engineSpn.Id `
    -ConsentType AllPrincipals `
    | Out-Null

    Write-Host "INFO: Admin consent for Microsoft Graph API permissions granted successfully" -ForegroundColor green
    Write-Verbose -Message "Admin consent for Microsoft Graph API permissions granted successfully"

    # Grant admin consent for Azure Service Management API permissions assigned to IPAM application
    Write-Host "INFO: Granting admin consent for Azure Service Management API permissions assigned to IPAM ENgine Application" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Azure Service Management API permissions assigned to IPAM Engine Application"
    New-MgOauth2PermissionGrant `
    -ResourceId $azureSvcMgmtSpn.Id `
    -Scope $azureSvcMgmtApiPermissionsScope `
    -ClientId $engineSpn.Id `
    -ConsentType AllPrincipals `
    | Out-Null

    Write-Host "INFO: Admin consent for Azure Service Management API permissions granted successfully" -ForegroundColor green
    Write-Verbose -Message "Admin consent for Azure Service Management API API permissions granted successfully"

}

Function deployUiApplication {
    $engineApiPermissionsScope = "access_as_user"
    $msGraphAppId = "00000003-0000-0000-c000-000000000000"
    $msGraphApiPermissionsScope = "Directory.Read.All openid User.Read"
    $uiResourceAccess = [System.Collections.ArrayList]@(
        @{
            ResourceAppId = "00000003-0000-0000-c000-000000000000";
            ResourceAccess = @(
                @{
                    Id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d";
                    Type = "Scope"
                },
                @{
                    Id = "37f7f235-527c-4136-accd-4a02d197296e";
                    Type = "Scope"
                },
                @{
                    Id = "06da0dbc-49e2-44d2-8312-53f166ab848a";
                    Type = "Scope"
                }
            )
        },
        @{
            ResourceAppId = $global:engineApp.AppId;
            ResourceAccess = @(
                @{
                    Id = $engineApiGuid;
                    Type = "Scope"
                }
            )           
        }
    )
    $uiWebSettings = @{
        ImplicitGrantSetting = @{
            EnableAccessTokenIssuance = $true
            EnableIdTokenIssuance = $true
        }
    }

    # Create IPAM UI Application
    Write-Host "INFO: Creating Azure IPAM UI Application" -ForegroundColor green
    Write-Verbose -Message "Creating Azure IPAM UI Application"
    $global:uiApp = New-AzADApplication `
    -DisplayName "ipam-ui-app" `
    -Web $uiWebSettings `
    -RequiredResourceAccess $uiResourceAccess

    # Create IPAM UI service principal
    $uiSpn = New-AzADServicePrincipal -ApplicationObject $global:uiApp

    Write-Host "INFO: Azure IPAM UI Application & Service Principal created successfully" -ForegroundColor green
    Write-Verbose -Message "Azure IPAM UI Application & Service Principal created successfully"
    
    # Instantiate Microsoft Graph service principal object
    $msGraphSpn = Get-AzADServicePrincipal `
    -ApplicationId $msGraphAppId

    # Instantiate Azure IPAM engine service principal object
    $engineSpn = Get-AzADServicePrincipal `
    -ApplicationId $global:engineApp.AppId

    # Grant admin consent for Microsoft Graph API permissions assigned to IPAM UI application
    Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI Application" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Microsoft Graph API permissions assigned to IPAM UI Application"
    New-MgOauth2PermissionGrant `
    -ResourceId $msGraphSpn.Id `
    -Scope $msGraphApiPermissionsScope `
    -ClientId $uiSpn.Id `
    -ConsentType AllPrincipals `
    | Out-Null

    Write-Host "INFO: Admin consent for Microsoft Graph API permissions granted successfully" -ForegroundColor green
    Write-Verbose -Message "Admin consent for Microsoft Graph API permissions granted successfully"

    # Grant admin consent for Azure Service Management API permissions assigned to IPAM application
    Write-Host "INFO: Granting admin consent for Azure IPAM Engine API permissions assigned to IPAM UI Application" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Azure IPAM Engine API permissions assigned to IPAM UI Application"
    New-MgOauth2PermissionGrant `
    -ResourceId $engineSpn.Id `
    -Scope $engineApiPermissionsScope `
    -ClientId $uiSpn.Id `
    -ConsentType AllPrincipals `
    | Out-Null

    Write-Host "INFO: Admin consent for Azure IPAM Engine API permissions granted successfully" -ForegroundColor green
    Write-Verbose -Message "Admin consent for Azure IPAM Engine API API permissions granted successfully"

}

Function updateEngineApplication {
    $engineApiSettings = @{
        KnownClientApplication = @(
          $global:uiApp.AppId
        )
        Oauth2PermissionScope = @(
        	@{
            	AdminConsentDescription = "Allows the IPAM UI to access IPAM Engine API as the signed-in user."
				AdminConsentDisplayName = "Access IPAM Engine API"
				Id = $engineApiGuid
				IsEnabled = $true
				Type = "User"
				UserConsentDescription = "Allow the IPAM UI to access IPAM Engine API on your behalf."
				UserConsentDisplayName = "Access IPAM Engine API"
				Value = "access_as_user"
          	}
        )
        RequestedAccessTokenVersion = 2
    }

    # Update IPAM engine application API settings
    Write-Host "INFO: Updating Azure IPAM Engine Application" -ForegroundColor green
    Write-Verbose -Message "Updating Azure IPAM Engine Application"
    Update-AzADApplication -ApplicationId $global:engineApp.AppId -Api $engineApiSettings

    
    Write-Host "INFO: Updated Azure IPAM Engine Application successfully" -ForegroundColor green
    Write-Verbose -Message "Updated Azure IPAM Engine Application successfully"

}

Function deployBicep {
    Write-Host "INFO: Deploying IPAM bicep templates" -ForegroundColor green
    Write-Verbose -Message "Deploying bicep templates"

	# Instantiate deployment parameter object
    $deploymentParameters = @{
        'engineAppId' = $global:engineApp.AppId
        'engineAppSecret' = $global:engineSecret.SecretText
        'namePrefix' = $namePrefix
        'uiAppId' = $global:uiApp.AppId
    }

    # If tags are defined, add them to deployment parameters object
    if ($tags) {
        $tagsParameter = $tags | ConvertFrom-Json -AsHashtable
    
        $deploymentParameters.Add('tags',$tagsParameter)
    }

	# Deploy IPAM bicep template
    $global:deployment = New-AzSubscriptionDeployment `
    -Name "ipamInfraDeploy-$(Get-Date -Format `"yyyyMMddhhmmsstt`")" `
    -Location $location `
    -TemplateFile main.bicep `
    -TemplateParameterObject $deploymentParameters

	Write-Host "INFO: IPAM bicep templates deployed successfully" -ForegroundColor green
	Write-Verbose -Message "IPAM bicep template deployed successfully"
    
}

Function updateUiApplication {
    Write-Host "INFO: Updating UI Application with SPA configuration" -ForegroundColor green
    Write-Verbose -Message "Updating UI Application with SPA configuration"
  
    $uiAppId = $global:deployment.Parameters["uiAppId"].Value
    $appServiceEndpoint = "https://$($global:deployment.Outputs["appServiceHostName"].Value)"
  
	# Update UI Application with single-page application configuration
    Update-AzADApplication -ApplicationId $uiAppId -SPARedirectUri $appServiceEndpoint 
  
    Write-Host "INFO: UI Application SPA configuration update complete" -ForegroundColor green
    Write-Verbose -Message "UI Application SPA configuration update complete"
  
}

try {
    # Connect to Microsoft Graph
    $accesstoken = (Get-AzAccessToken -Resource "https://graph.microsoft.com/").Token

    Connect-MgGraph -AccessToken $accesstoken

    validateLocation $location

    deployEngineApplication

    deployUiApplication

    updateEngineApplication

    deployBicep

    updateUiApplication

	Write-Host "INFO: Azure IPAM Solution deployed successfully" -ForegroundColor green
	Write-Verbose -Message "Azure IPAM Solution deployed successfully"

}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to deploy Azure IPAM solution due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}
