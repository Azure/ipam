###############################################################################################################
##
## Azure IPAM Service Principal Deployment Script
##
###############################################################################################################

# Set minimum version requirements
#Requires -Version 7.2
#Requires -Modules @{ ModuleName="Az"; ModuleVersion="7.5.0"}
#Requires -Modules @{ ModuleName="Microsoft.Graph"; ModuleVersion="1.9.6"}

# Set parameters
$azureSvcMgmtApiPermissions =@("41094075-9dad-400e-a0bd-54e686782033")
$azureSvcMgmtApiPermissionsScope = "user_impersonation"
$azureSvcMgmtAppId ="797f4846-ba00-4fd7-ba43-dac1f8f63013"
$logFile = "./deploy_$(get-date -format `"yyyyMMddhhmmsstt`").log"
$msGraphApiPermissions = @("06da0dbc-49e2-44d2-8312-53f166ab848a", "e1fe6dd8-ba31-4d61-89e7-88639da4683d")
$msGraphApiPermissionsScope = "Directory.Read.All User.Read"
$msGraphAppId = "00000003-0000-0000-c000-000000000000"
$spGuid = [char[]](Get-Random -InputObject @(97..122) -Count 13) -join ''
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

try {
    # Create IPAM service principal and assign it reader role at tenant root group level
    Write-Host "INFO: Creating Azure Service Principal" -ForegroundColor green
    Write-Verbose -Message "Creating Azure Service Principal"
    $sp = New-AzADServicePrincipal `
    -DisplayName "ipam-sp-$spGuid" `
    -Role "Reader" `
    -Scope "/providers/Microsoft.Management/managementGroups/$($tenantId)"

    Write-Host "INFO: Azure Service Principal created successfully" -ForegroundColor green
    Write-Verbose -Message "Azure Service Principal created successfully"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to create Azure Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Assign Microsoft Graph API permissions to IPAM service principal
    Write-Host "INFO: Assigning Microsoft Graph API permissions to IPAM Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Assigning Microsoft Graph API permissions to IPAM Service Principal"
    foreach ($i in $msGraphApiPermissions) {
        Add-AzADAppPermission `
        -ApplicationId $sp.AppId `
        -ApiId $msGraphAppId `
        -PermissionId $i
    }

    Write-Host "INFO: Microsoft Graph API permissions assigned successfully" -ForegroundColor green
    Write-Verbose -Message "Microsoft Graph API permissions assigned successfully"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to assign Microsoft Graph API permission to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Assign Azure Service Management API permissions to IPAM service principal 
    Write-Host "INFO: Assigning Azure Service Management API permissions to IPAM Service Principal" -ForegroundColor Green
    Write-Verbose -Message "Assigning Azure Service Management API permissions to IPAM Service Principal"
    foreach ($i in $azureSvcMgmtApiPermissions) {
        Add-AzADAppPermission `
        -ApplicationId $sp.AppId `
        -ApiId $azureSvcMgmtAppId `
        -PermissionId $i
    }

    Write-Host "INFO: Azure Service Management API permissions assigned successfully" -ForegroundColor green
    Write-Verbose -Message "Azure Service Management API permissions assigned successfully"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to assign Azure Service Management API permission to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

# Instantiate Microsoft Graph service principal object
$msGraphSp = Get-AzADServicePrincipal `
-ApplicationId $msGraphAppId

# Instantiate Azure Service Management service principal object
$azureSvcMgmtSp = Get-AzADServicePrincipal `
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
    -ConsentType AllPrincipals `
    | Out-Null

    Write-Host "INFO: Admin consent for Microsoft Graph API permissions granted successfully" -ForegroundColor green
    Write-Verbose -Message "Admin consent for Microsoft Graph API permissions granted successfully"
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
    -ConsentType AllPrincipals `
    | Out-Null

    Write-Host "INFO: Admin consent for Azure Service Management API permissions granted successfully" -ForegroundColor green
    Write-Verbose -Message "Admin consent for Azure Service Management API API permissions granted successfully"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to grant admin consent for Azure Service Management API permission assigned to IPAM Service Principal due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

try {
    # Populate bicep parameter file for infrastructure deployment
    Write-Host "INFO: Populating Bicep parameter file for infrastructure deployment" -ForegroundColor Green
    Write-Verbose -Message "Populating Bicep parameter file for infrastructure deployment"
    $paramFileExample = Get-Content main.parameters.example.json

    $paramFile = $paramFileExample.Replace('<SERVICE PRINCIPAL CLIENT ID>', $sp.AppId).Replace('<SERVICE PRINCIPAL SECRET>', $sp.PasswordCredentials.SecretText)

    $paramFile | Out-File -FilePath main.parameters.json

    Write-Host "INFO: Bicep parameter file populated successfully" -ForegroundColor green
    Write-Verbose -Message "Bicep parameter file populated successfully"
}
catch {
    $_ | Out-File -FilePath $logFile -Append
    Write-Host "ERROR: Unable to popule Bicep parameter File for infrastructure deployment due to an exception, see $logFile for detailed information!" -ForegroundColor red
    exit

}

Write-Host "INFO: Service Principal Deployment Complete" -ForegroundColor Green
Write-Host "INFO: Service Principal Display Name: $($sp.DisplayName)" -ForegroundColor Green
Write-Host "INFO: Service Principal App ID: $($sp.AppId)" -ForegroundColor Green
Write-Host "INFO: Service Principal Secret: $($sp.PasswordCredentials.SecretText)" -ForegroundColor Green
