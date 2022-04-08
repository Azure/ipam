# Install-Module -Name Az -Scope CurrentUser -Repository PSGallery -Force
# Install-Module AzureAD

# Import-Module AzureAD

# Connect-AzAccount -UseDeviceAuthentication

function Grant-AdminConsent {
    Param(
        [Parameter(Mandatory,
        ValueFromPipeline)]
        [Microsoft.Open.AzureAD.Model.DirectoryObject]
        $ADApp
    )

    $requiredResourcesAccess = (Get-AzureADApplication -ObjectId $ADApp.ObjectId).RequiredResourceAccess

    $servicePrincipal = Get-AzureADServicePrincipal -All $true | Where-Object {$_.AppId -eq $ADApp.AppId}

    if(-not $servicePrincipal) {
        $servicePrincipal = New-AzureADServicePrincipal -AppId $ADApp.AppId
    }

    $consentType = "AllPrincipals"
    $principalId = $null
    
    ForEach ($resourceAppAccess in $requiredResourcesAccess)
    {
        $delegatedPermissions = @()
        #$resourceApp - get servicePrincipal of Resource API App(ex: Microsoft Graph, Office 365 SharePoint Online)
        $resourceApp = Get-AzureADServicePrincipal -All $true | Where-Object {$_.AppId -eq $resourceAppAccess.ResourceAppId}
        ForEach ($permission in $resourceAppAccess.ResourceAccess)
        {
            if ($permission.Type -eq "Scope")
            {
                $permissionObj = $resourceApp.OAuth2Permissions | Where-Object {$_.Id -contains $permission.Id}
                $delegatedPermissions += $permissionObj.Value
            }
        }
    
        if($delegatedPermissions)
        {
            #Get existing grant entry
            $existingGrant = Get-AzureADOAuth2PermissionGrant -All $true | Where-Object { $_.ClientId -eq $servicePrincipal.ObjectId -and $_.ResourceId -eq $resourceApp.ObjectId -and  $_.PrincipalId -eq $principalId}
         
            if(!$existingGrant)
            {
                #Create new grant entry
                $postContent = @{
                    clientId    = $servicePrincipal.ObjectId
                    consentType = $consentType
                    principalId = $principalId
                    resourceId  = $resourceApp.ObjectId
                    scope       = $delegatedPermissions -Join " "
                }
    
                $requestBody = $postContent | ConvertTo-Json
                Write-Host "Grant consent for $delegatedPermissions ($($resourceApp.DisplayName))" -ForegroundColor Green
                $headers = @{Authorization = "Bearer $accessToken"}
                $response = Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/oauth2PermissionGrants" -Body $requestBody -Method POST -Headers $headers -ContentType "application/json"
            }
            else 
            {
                #Update existing grant entry
                $delegatedPermissions+=$existingGrant.Scope -Split " "
                $delegatedPermissions = $delegatedPermissions | Select-Object -Unique
                $patchContent = @{
                    scope = $delegatedPermissions -Join " "
                }
     
                $requestBody = $patchContent | ConvertTo-Json
                Write-Host "Update consent for $delegatedPermissions ($($resourceApp.DisplayName))" -ForegroundColor Green
                $headers = @{Authorization = "Bearer $accessToken"}
                $response = Invoke-RestMethod -Uri "https://graph.microsoft.com/v1.0/oauth2PermissionGrants/$($existingGrant.ObjectId)" -Body $requestBody -Method PATCH -Headers $headers -ContentType "application/json"
            }
        }
    }    
}

Connect-AzureAD -AccountId (Get-AzContext).Account.Id -AadAccessToken (Get-AzAccessToken -ResourceUrl "https://graph.windows.net/").Token

# Verify user is a Global Admin
$SignedInUser = Get-AzureADUser | Where-Object { $_.UserPrincipalName -eq (Get-AzContext).Account.Id }
$SignedInUserObjectId = $SignedInUser.ObjectId
$GlobalAdminRoleId = (Get-AzureAdDirectoryRole | Where-Object { $_.displayName -eq 'Global Administrator' }).ObjectId
$isGlobalAdmin = (Get-AzureAdDirectoryRoleMember -ObjectId $GlobalAdminRoleId).ObjectId -contains $SignedInUserObjectId

if (-not $isGlobalAdmin)  
{  
    Write-Host "Your account '$authUserId' is not a Global Admin in $TenantDomain."
    throw "Exception: GLOBAL ADMIN REQUIRED"
} 

$accesstoken = (Get-AzAccessToken -Resource "https://graph.microsoft.com/").Token

# Create React App Registration
$reactAppReg = New-AzureADApplication -DisplayName "ps-msal-react-app" -Oauth2AllowImplicitFlow $false

# Add SPA site to React App Registration
$redirectUris = @("http://localhost:3000")

$header = @{
    'Content-Type' = 'application/json'
    'Authorization' = 'Bearer ' + $accesstoken
}

$reactBody = @{
    'spa' = @{
        'redirectUris' = $redirectUris
    }
    'web' = @{
        'implicitGrantSettings' = @{
            'enableAccessTokenIssuance' = $true
            'enableIdTokenIssuance' = $true
        }
    }
    'api' = @{
        'requestedAccessTokenVersion' = 2
    }
} | ConvertTo-Json

$created = $null

do {
    try {
        $created = Invoke-RestMethod -Method Get -Uri "https://graph.microsoft.com/v1.0/applications/$($reactAppReg.ObjectId)" -Headers $header
    } catch {
        Write-Host "Waiting for React App Registration..."
        Start-Sleep 5
    }
} while ($null -eq $created)

$updated = $null

do {

    try {
        $updated = Invoke-RestMethod -Method Patch -Uri "https://graph.microsoft.com/v1.0/applications/$($reactAppReg.ObjectId)" -Headers $header -Body $reactBody
    } catch {
        Write-Host "Updating React App Registration..."
        Start-Sleep 5
    }
} while ($null -eq $updated)

# Create Python App Registration
$pythonAppReg = New-AzureADApplication -DisplayName "ps-msal-python-app"

$pythonBody = @{
    'api' = @{
        'requestedAccessTokenVersion' = 2
    }
} | ConvertTo-Json

$created = $null

do {
    try {
        $created = Invoke-RestMethod -Method Get -Uri "https://graph.microsoft.com/v1.0/applications/$($pythonAppReg.ObjectId)" -Headers $header
    } catch {
        Write-Host "Waiting for Python App Registration..."
        Start-Sleep 5
    }
} while ($null -eq $created)

$updated = $null

do {

    try {
        $updated = Invoke-RestMethod -Method Patch -Uri "https://graph.microsoft.com/v1.0/applications/$($pythonAppReg.ObjectId)" -Headers $header -Body $pythonBody
    } catch {
        Write-Host "Updating Python App Registration..."
        Start-Sleep 5
    }
} while ($null -eq $updated)

# Generate Python App Registration Secret
$startDate = Get-Date
$endDate = $startDate.AddYears(2)
$pythonAppSecret = New-AzureADApplicationPasswordCredential -ObjectId $pythonAppReg.ObjectId -CustomKeyIdentifier "secret" -StartDate $startDate -EndDate $endDate

# Assign Resource Permissions to Python App Registration
$pythonGraphPermissions = New-Object -TypeName "Microsoft.Open.AzureAD.Model.RequiredResourceAccess"
# Microsoft Graph - User.Read
$pythonGraphUserRead = New-Object -TypeName "Microsoft.Open.AzureAD.Model.ResourceAccess" -ArgumentList "e1fe6dd8-ba31-4d61-89e7-88639da4683d", "Scope"
$pythonGraphPermissions.ResourceAccess = @($pythonGraphUserRead)
$pythonGraphPermissions.ResourceAppId = "00000003-0000-0000-c000-000000000000"

$pythonAzurePermissions = New-Object -TypeName "Microsoft.Open.AzureAD.Model.RequiredResourceAccess"
# Azure Service Management - user_impersonation
$pythonAzureServiceMgmt = New-Object -TypeName "Microsoft.Open.AzureAD.Model.ResourceAccess" -ArgumentList "41094075-9dad-400e-a0bd-54e686782033", "Scope"
$pythonAzurePermissions.ResourceAccess = @($pythonAzureServiceMgmt)
$pythonAzurePermissions.ResourceAppId = "797f4846-ba00-4fd7-ba43-dac1f8f63013"

Set-AzureADApplication -ObjectId $pythonAppReg.ObjectId -RequiredResourceAccess @($pythonGraphPermissions, $pythonAzurePermissions)

# Disable default Oauth2 Permissions
$defaultOath = New-Object System.Collections.Generic.List[Microsoft.Open.AzureAD.Model.OAuth2Permission]
$defaultOath = $pythonAppReg.Oauth2Permissions | Where-Object { $_.Value -eq "user_impersonation" }
$defaultOath.IsEnabled = $false

Set-AzureADApplication -ObjectId $pythonAppReg.ObjectId -Oauth2Permissions $defaultOath

# Expose Python API & Set Oauth2 Permissions
$oauthGuid = (New-Guid).Guid
$oath = New-Object -TypeName "Microsoft.Open.AzureAD.Model.OAuth2Permission"
$oath.AdminConsentDescription = "Allows the app to access Python FastAPI Web API as the signed-in user."
$oath.AdminConsentDisplayName = "Access Python FastAPI Web API"
$oath.Id = $oauthGuid
$oath.IsEnabled = $true
$oath.Type = "User"
$oath.UserConsentDescription = "Allow the application to access Python FastAPI Web API on your behalf."
$oath.UserConsentDisplayName = "Access Python FastAPI Web API"
$oath.Value = "access_as_user"

Set-AzureADApplication -ObjectId $pythonAppReg.ObjectId -Oauth2Permissions $oath
Set-AzureADApplication -ObjectId $pythonAppReg.ObjectId -IdentifierUris "api://$($pythonAppReg.AppId)"

# Assign Resource Permissions to React App Registration
$reactGraphPermissions = New-Object -TypeName "Microsoft.Open.AzureAD.Model.RequiredResourceAccess"
# Microsoft Graph - User.Read
$reactGraphUserRead = New-Object -TypeName "Microsoft.Open.AzureAD.Model.ResourceAccess" -ArgumentList "e1fe6dd8-ba31-4d61-89e7-88639da4683d", "Scope"
# Microsoft Graph - openid
$reactGraphOpenId = New-Object -TypeName "Microsoft.Open.AzureAD.Model.ResourceAccess" -ArgumentList "37f7f235-527c-4136-accd-4a02d197296e", "Scope"
$reactGraphPermissions.ResourceAccess = @($reactGraphUserRead, $reactGraphOpenId)
$reactGraphPermissions.ResourceAppId = "00000003-0000-0000-c000-000000000000"

$reactAzurePermissions = New-Object -TypeName "Microsoft.Open.AzureAD.Model.RequiredResourceAccess"
# Python App API - access_as_user
$reactPythonApi = New-Object -TypeName "Microsoft.Open.AzureAD.Model.ResourceAccess" -ArgumentList $oauthGuid, "Scope"
$reactAzurePermissions.ResourceAccess = @($reactPythonApi)
$reactAzurePermissions.ResourceAppId = $pythonAppReg.AppId

Set-AzureADApplication -ObjectId $reactAppReg.ObjectId -RequiredResourceAccess @($reactGraphPermissions, $reactAzurePermissions)

Set-AzureADApplication -ObjectId $pythonAppReg.ObjectId -KnownClientApplications @($reactAppReg.AppId)

# Grant Admin Consent for Applicatons
$pythonAppReg | Grant-AdminConsent
$reactAppReg | Grant-AdminConsent

# Print Python App Secret
Write-Host "Python Secret: $($pythonAppSecret.Value)"
