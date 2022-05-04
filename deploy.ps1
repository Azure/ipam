###############################################################################################################
##
## Azure IPAM Deployment Script
##
###############################################################################################################

# Intake and set parameters
$azureSvcMgmtApiPermissions =@("41094075-9dad-400e-a0bd-54e686782033")
$azureSvcMgmtApiPermissionsScope = "user_impersonation"
$azureSvcMgmtAppId ="797f4846-ba00-4fd7-ba43-dac1f8f63013"
$parameters = Get-Content ./deployParams.json | ConvertFrom-Json
$location = $parameters.location
$logFile = "./deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"
$msGraphApiPermissions = @("06da0dbc-49e2-44d2-8312-53f166ab848a", "e1fe6dd8-ba31-4d61-89e7-88639da4683d")
$msGraphApiPermissionsScope = "Directory.Read.All User.Read"
$msGraphAppId = "00000003-0000-0000-c000-000000000000"
$name = $parameters.name.ToLower()
$tenantId = (Get-AzContext).Tenant.Id

# Set preference variables
$ErrorActionPreference = "Stop"

# Install Microsoft Graph module
if (Get-InstalledModule Microsoft.Graph -ErrorAction SilentlyContinue) {
    Write-Warning -Message "Microsoft Graph Module already installed, proceeding with deployment..."
}
else {
    Write-Host "INFO: Installing Microsoft Graph PowerShell SDK Module" -ForegroundColor green
    Write-Verbose -Message "Installing Microsoft Graph PowerShell SDK Module"
    Install-Module Microsoft.Graph

}

# Validate name parameter
Function ValidateName
{
    param (
    [ValidateLength(4,30)]
    [ValidatePattern('^(?!-)(?!.*--)[a-z]')]
    [parameter(Mandatory=$true)]
    [string]
    $Name
)

 write-host "Name is"$Name

}

ValidateName $Name

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
    # Create IPAM service principal
    Write-Host "INFO: Creating Azure Service Principal" -ForegroundColor green
    Write-Verbose -Message "Creating Azure Service Principal"
    $sp = New-AzADServicePrincipal `
    -DisplayName "$($Name)-sp"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to create Azure Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Assign reader role at tenant scope to IPAM service principal
    Write-Host "INFO: Assigning Reader Role at Tenant Scope to Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Assigning Reader Role at Tenant Scope to Service Principal"
    New-AzRoleAssignment `
    -RoleDefinitionName "Reader" `
    -ObjectId $sp.Id `
    -Scope "/providers/Microsoft.Management/managementGroups/$($tenantId)"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to assign Role to Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit
}

try {
    # Assign Microsoft Graph API permissions to IPAM service principal
    Write-Host "INFO: Assigning Microsoft Graph API permission to IPAM Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Assigning Microsoft Graph API permission to IPAM Service Principal"
    foreach ($i in $msGraphApiPermissions) {
        Add-AzADAppPermission `
        -ApplicationId $sp.AppId `
        -ApiId $msGraphAppId `
        -PermissionId $i
    }
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to assign Microsoft Graph API permission to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Assign Azure Service Management API permissions to IPAM service principal 
    Write-Host "INFO: Assigning Azure Service Management API permission to IPAM Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Assigning Azure Service Management API permission to IPAM Service Principal"
    foreach ($i in $azureSvcMgmtApiPermissions) {
        Add-AzADAppPermission `
        -ApplicationId $sp.AppId `
        -ApiId $azureSvcMgmtAppId `
        -PermissionId $i
    }
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to assign Azure Service Management API permission to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

# Instantiate Microsoft Graph service principal object
$msGraphSp = Get-AzureADServicePrincipal `
-ApplicationId $msGraphAppId

# Instantiate Azure Service Management service principal object
$azureSvcMgmtSp = Get-AzureADServicePrincipal `
-ApplicationId $azureSvcMgmtAppId

# Connect to Microsoft Graph
Connect-MgGraph -Scopes ("User.ReadBasic.All Application.ReadWrite.All " `
                        + "DelegatedPermissionGrant.ReadWrite.All " `
                        + "AppRoleAssignment.ReadWrite.All")

try {
    # Grant admin consent for Microsoft Graph API permissions assigned to IPAM service principal
    Write-Host "INFO: Granting admin consent for Microsoft Graph API permissions assigned to IPAM Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Microsoft Graph API permissions assigned to IPAM Service Principal"
    New-MgOauth2PermissionGrant `
    -ResourceId $msGraphSp.Id `
    -Scope $msGraphApiPermissionsScope `
    -ClientId $sp.Id `
    -ConsentType AllPrincipals
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to grant admin consent for Microsoft Graph API permission assigned to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Grant admin consent for Azure Service Management API permissions assigned to IPAM service principal
    Write-Host "INFO: Granting admin consent for Azure Service Management API permissions assigned to IPAM Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Granting admin consent for Azure Service Management API permissions assigned to IPAM Service Principal"
    New-MgOauth2PermissionGrant `
    -ResourceId $azureSvcMgmtSp.Id `
    -Scope $azureSvcMgmtApiPermissionsScope `
    -ClientId $sp.Id `
    -ConsentType AllPrincipals
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to grant admin consent for Azure Service Management API permission assigned to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Deploy IPAM bicep template
    Write-Host "INFO: Deploying IPAM bicep template" -ForegroundColor green
    Write-Verbose -Message "Deploying bicep template"
    $deploymentParameters =@{
        'name' = $name;
        'spnIdValue' = $sp.Id
        'spnSecretValue' = $sp.PasswordCredentials.SecretText
    }
    
    New-AzSubscriptionDeployment `
    -Location $location `
    -TemplateFile ./bicep/main.bicep `
    -TemplateParameterObject $deploymentParameters
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to deploy IPAM bicep template due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}
