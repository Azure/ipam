# Maintenance

## Overview

Azure IPAM needs very little ongoing care, but a few tasks keep a deployment healthy over time. This guide covers keeping the Engine app registration's client secret current and making sure the Engine can still read your Azure environment.

Unlike an [update](/update/README.md), none of these tasks change the version of Azure IPAM you are running.

The Azure PowerShell and Azure CLI steps assume you're signed in to the cloud and subscription where Azure IPAM is deployed. See [Authenticate to Azure PowerShell](/deployment/README.md#authenticate-to-azure-powershell) and [Authenticate to Azure CLI](/deployment/README.md#authenticate-to-azure-cli).

## Engine Client Secret

The *Engine* app registration authenticates to Azure with a client secret. Azure IPAM uses it both to read your Azure environment on its own behalf and to read it on behalf of signed-in users, so every request that touches Azure depends on it.

The deployment script stores the secret in Key Vault as `ENGINE-SECRET`, and the App Service or Function App reads it through a [Key Vault reference](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references) in the `ENGINE_APP_SECRET` app setting.

When the deployment script creates the secret, it is valid for **two years**. If the secret has since been rotated, or the app registration was created some other way, its lifetime may be different, so [check when it expires](#check-when-the-secret-expires) rather than relying on when Azure IPAM was deployed.

Once the secret expires, Azure IPAM can no longer reach Azure (see [AADSTS7000222 (Engine Secret Expired)](/troubleshooting/README.md#aadsts7000222-engine-secret-expired)). Rotate it before that happens.

### Check When the Secret Expires

An app registration can have more than one client secret. Microsoft Entra ID shows the first three characters of each one, which is how you can tell which secret Azure IPAM is using: it is the one whose first three characters match the value of `ENGINE-SECRET` in Key Vault.

Reading a secret value from Key Vault requires a Key Vault data-plane role. Azure IPAM's Key Vault uses Azure RBAC, and by default only the Azure IPAM managed identity has data-plane access, so you may need to assign yourself a role first. [Key Vault Secrets User](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/security#key-vault-secrets-user) is the least privileged role that can read the secret. If you are about to [rotate it](#rotate-the-secret), assign [Key Vault Secrets Officer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/security#key-vault-secrets-officer) instead, which covers both. Remove the role again when you are done.

#### Azure Portal

1. Navigate to **Microsoft Entra ID** → **App registrations** → **All applications** → your Azure IPAM **Engine** application (`ipam-engine-app` by default)
2. Select **Certificates & secrets** → **Client secrets**
3. Note the **Expires** date and the first three characters shown under **Value** for each secret

   ![Engine Client Secrets](./images/engine_client_secrets.png)

4. Navigate to your Azure IPAM **Key Vault** → **Objects** → **Secrets** → **ENGINE-SECRET**

   ![Key Vault ENGINE-SECRET](./images/engine_secret_keyvault.png)

5. Select the current version and select **Show Secret Value**, then compare its first three characters against the secrets from step 3

   ![ENGINE-SECRET Current Version](./images/engine_secret_current_version.png)
   ![ENGINE-SECRET Version Details](./images/engine_secret_current_version_details.png)

#### Azure PowerShell

```powershell
$engineAppId = "<engine-app-id>"
$vaultName = "<your-ipam-kv>"

# The Secret Azure IPAM Is Currently Using
$hint = (Get-AzKeyVaultSecret -VaultName $vaultName -Name "ENGINE-SECRET" -AsPlainText).Substring(0, 3)

# All Client Secrets on the Engine App Registration
Get-AzADAppCredential -ApplicationId $engineAppId |
  Select-Object Hint, KeyId, StartDateTime, EndDateTime, @{ Name = "InUse"; Expression = { $_.Hint -eq $hint } }
```

#### Azure CLI

```bash
appId="<engine-app-id>"
vaultName="<your-ipam-kv>"

# The Secret Azure IPAM Is Currently Using
hint=$(az keyvault secret show --vault-name "$vaultName" --name "ENGINE-SECRET" --query value --output tsv | cut -c1-3)

# All Client Secrets on the Engine App Registration
az ad app credential list --id "$appId" \
  --query "[].{hint: hint, keyId: keyId, start: startDateTime, end: endDateTime, inUse: hint=='$hint'}" \
  --output table
```

### Rotate the Secret

Rotating the secret means creating a new one alongside the existing one, switching Azure IPAM over to it, confirming it works, and only then removing the old one. Both secrets stay valid during the switch, so Azure IPAM keeps working throughout.

You will need:

- One of the following in Microsoft Entra ID, to manage the Engine app registration's secrets:
  - Owner of the Engine app registration
  - [Application Administrator](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#application-administrator)
  - [Cloud Application Administrator](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#cloud-application-administrator)
- [Key Vault Secrets Officer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/security#key-vault-secrets-officer) on the Azure IPAM Key Vault, to store the new secret. Key Vault Secrets User can only read secrets, so it isn't enough here. Assign the role to yourself for the rotation and remove it afterwards
- [Website Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/web-and-mobile#website-contributor) or [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#contributor) on the App Service or Function App, to restart it

The steps are:

1. Create a new client secret on the Engine app registration
2. Store it in Key Vault as a new version of `ENGINE-SECRET`, with its expiration date
3. Refresh Azure IPAM's Key Vault references, then restart the App Service or Function App so it loads the new value
4. Confirm that Azure IPAM can reach Azure, and if you can, that it's using the new secret
5. Remove the old client secret
6. Remove the Key Vault Secrets Officer role assignment you granted yourself

> **IMPORTANT:** A client secret's value is only shown once, when it is created. Copy the **Value**, not the **Secret ID**. Storing the Secret ID is a common mistake, and it causes [AADSTS7000215 (Engine Secret Invalid)](/troubleshooting/README.md#aadsts7000215-engine-secret-invalid).

#### Azure Portal

1. Navigate to **Microsoft Entra ID** → **App registrations** → **All applications** → your Azure IPAM **Engine** application
2. Select **Certificates & secrets** → **Client secrets** → **New client secret**
3. Enter a description, choose an expiration period that your organization's policies allow, then select **Add**

   ![Add A Client Secret](./images/engine_add_client_secret.png)

4. Copy the new secret's **Value** and note its **Expires** date

   ![Copy Client Secret](./images/engine_copy_client_secret.png)

5. Navigate to your Azure IPAM **Key Vault** → **Objects** → **Secrets** → **ENGINE-SECRET** → **New Version**

   ![Key Vault ENGINE-SECRET](./images/engine_secret_keyvault.png)
   ![New ENGINE-SECRET Version](./images/engine_secret_new_version.png)

6. Paste the value into **Secret value**, select **Set expiration date**, and enter the **Expires** date from step 4
7. Select **Create**

   ![Create New ENGINE-SECRET Version](./images/engine_secret_new_version_create.png)

8. Navigate to your Azure IPAM **App Service** or **Function App** → **Settings** → **Environment variables** and select **Pull reference values**, so it reads the new version from Key Vault
9. Select **Overview** → **Restart**
10. If the `staging` [deployment slot](/update/README.md#staging-slots) is running, repeat steps 8 and 9 for it from **Deployment slots** → **staging**
11. Confirm the rotation (see [Confirm the Rotation](#confirm-the-rotation))
12. Return to the Engine app registration's **Certificates & secrets** → **Client secrets**, and select the delete icon next to the **old** secret
13. Remove the Key Vault Secrets Officer role assignment you granted yourself

#### Azure PowerShell

```powershell
$engineAppId = "<engine-app-id>"
$vaultName = "<your-ipam-kv>"

# Create a New Secret Alongside the Existing One
# Choose a lifetime your organization's policies allow
$newSecret = New-AzADAppCredential -ApplicationId $engineAppId -EndDate (Get-Date).AddYears(2)

# Store It in Key Vault with the Same Expiration Date
Set-AzKeyVaultSecret `
  -VaultName $vaultName `
  -Name "ENGINE-SECRET" `
  -SecretValue (ConvertTo-SecureString $newSecret.SecretText -AsPlainText -Force) `
  -Expires $newSecret.EndDateTime | Out-Null

# Note the New Secret's Details, Without Its Value
$newSecret | Select-Object Hint, KeyId, EndDateTime

Remove-Variable newSecret
```

Refresh Azure IPAM's Key Vault references so it reads the new version, then restart it so it loads the new value. Each refresh should return `200`:

```powershell
# App Service
$app = Get-AzWebApp -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-app>"
(Invoke-AzRestMethod -Method POST -Path "$($app.Id)/config/configreferences/appsettings/refresh?api-version=2022-03-01").StatusCode
Restart-AzWebApp -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-app>"

# App Service Staging Slot (Only If It's Running)
(Invoke-AzRestMethod -Method POST -Path "$($app.Id)/slots/staging/config/configreferences/appsettings/refresh?api-version=2022-03-01").StatusCode
Restart-AzWebAppSlot -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-app>" -Slot "staging"

# Function App
$function = Get-AzFunctionApp -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-function>"
(Invoke-AzRestMethod -Method POST -Path "$($function.Id)/config/configreferences/appsettings/refresh?api-version=2022-03-01").StatusCode
Restart-AzFunctionApp -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-function>" -Force

# Function App Staging Slot (Only If It's Running)
(Invoke-AzRestMethod -Method POST -Path "$($function.Id)/slots/staging/config/configreferences/appsettings/refresh?api-version=2022-03-01").StatusCode
Restart-AzWebAppSlot -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-function>" -Slot "staging"
```

Once you have [confirmed the rotation](#confirm-the-rotation), remove the old secret:

```powershell
Get-AzADAppCredential -ApplicationId $engineAppId | Select-Object Hint, KeyId, StartDateTime, EndDateTime

Remove-AzADAppCredential -ApplicationId $engineAppId -KeyId "<old-key-id>"
```

#### Azure CLI

```bash
appId="<engine-app-id>"
vaultName="<your-ipam-kv>"

# Create a New Secret Alongside the Existing One
# Choose a lifetime your organization's policies allow
secret=$(az ad app credential reset --id "$appId" --append --years 2 --query password --output tsv)

# Look up the new secret's expiration date by its first three characters
# Key Vault only accepts whole seconds, so drop any fraction of a second
expires=$(az ad app credential list --id "$appId" --query "[?hint=='${secret:0:3}'].endDateTime | [0]" --output tsv | sed -E 's/\.[0-9]+Z$/Z/')

# Store It in Key Vault with the Same Expiration Date
az keyvault secret set --vault-name "$vaultName" --name "ENGINE-SECRET" --value "$secret" --expires "$expires" --output none

# Note the New Secret's Details, Without Its Value
az ad app credential list --id "$appId" --query "[?hint=='${secret:0:3}'].{hint: hint, keyId: keyId, end: endDateTime}" --output table

unset secret
```

> **IMPORTANT:** Always include `--append`. Without it, `az ad app credential reset` **removes every existing secret** on the app registration, and Azure IPAM stops working until the new secret is in place.

Refresh Azure IPAM's Key Vault references so it reads the new version, then restart it so it loads the new value:

```bash
# App Service
appResourceId=$(az webapp show --resource-group "<your-ipam-rg>" --name "<your-ipam-app>" --query id --output tsv)
az rest --method post --url "$appResourceId/config/configreferences/appsettings/refresh?api-version=2022-03-01"
az webapp restart --resource-group "<your-ipam-rg>" --name "<your-ipam-app>"

# App Service Staging Slot (Only If It's Running)
az rest --method post --url "$appResourceId/slots/staging/config/configreferences/appsettings/refresh?api-version=2022-03-01"
az webapp restart --resource-group "<your-ipam-rg>" --name "<your-ipam-app>" --slot staging

# Function App
functionResourceId=$(az functionapp show --resource-group "<your-ipam-rg>" --name "<your-ipam-function>" --query id --output tsv)
az rest --method post --url "$functionResourceId/config/configreferences/appsettings/refresh?api-version=2022-03-01"
az functionapp restart --resource-group "<your-ipam-rg>" --name "<your-ipam-function>"

# Function App Staging Slot (Only If It's Running)
az rest --method post --url "$functionResourceId/slots/staging/config/configreferences/appsettings/refresh?api-version=2022-03-01"
az functionapp restart --resource-group "<your-ipam-rg>" --name "<your-ipam-function>" --slot staging
```

Once you have [confirmed the rotation](#confirm-the-rotation), remove the old secret:

```bash
az ad app credential list --id "$appId" --query "[].{hint: hint, keyId: keyId, start: startDateTime, end: endDateTime}" --output table

az ad app credential delete --id "$appId" --key-id "<old-key-id>"
```

#### Confirm the Rotation

Confirm the rotation before removing the old secret.

The health endpoint signs in to Azure as the Engine, so it confirms that Azure IPAM can reach Azure. Look for `ok` set to `true` on the `arm` check.

```powershell
$ipamHost = "<your-ipam-host>"

$accessToken = (Get-AzAccessToken -ResourceUrl "api://<engine-app-id>").Token

$health = Invoke-RestMethod `
  -Method Get `
  -Uri "https://$ipamHost/api/health" `
  -Authentication Bearer `
  -Token $accessToken

$health.checks.arm
```

You can also call `GET /api/health` from the interactive API documentation at `https://<your-ipam-host>/api/docs`, as described in [Using the Swagger UI](/api/README.md#using-the-swagger-ui).

Both secrets stay valid until you remove the old one, so the health check passes whichever one Azure IPAM has loaded. If you can view sign-in logs in Microsoft Entra ID, for example with the [Reports Reader](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#reports-reader) or [Security Reader](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#security-reader) role, also confirm that it's using the new secret:

1. Navigate to **Microsoft Entra ID** → **Monitoring** → **Sign-in logs** → **Service principal sign-ins**
2. Use **Add filters** to show only the Engine application, and set **Time aggregate** to **1 hour**. Sign-ins are grouped by application for each period
3. Expand the most recent successful row from after the restart, then select one of the sign-ins listed under it
4. In **Activity Details: Sign-ins** → **Basic info**, confirm that **Credential key ID** matches the key ID of the new secret

Sign-ins can take a few minutes to appear. If you can't view sign-in logs, rely on the health check, having refreshed Azure IPAM's Key Vault references before restarting it.

> **NOTE:** App Service caches Key Vault reference values and [refetches them about once a day](https://learn.microsoft.com/azure/app-service/app-service-key-vault-references#rotation). Restarting on its own doesn't refetch them, which is why the steps above refresh the references first. Azure IPAM's expiration warnings follow the new version's expiration date within about 15 minutes of it being stored, even before Azure IPAM has loaded it.

#### Other Hosting Environments

If you run the Azure IPAM container yourself, for example with Docker Compose for development, the secret is supplied through the `CLIENT_SECRET` (or `ENGINE_APP_SECRET`) environment variable rather than Key Vault. Create the new secret as above, update the variable wherever your environment stores it, restart the container, confirm the rotation, and then remove the old secret.

#### Notes

The secret may also be stored in places Azure IPAM doesn't manage. The [Azure Identities (Only) Deployment](/deployment/README.md#azure-identities-only-deployment) writes it to `main.parameters.json`, and your own automation may hold a copy. Update or delete those copies when you rotate, otherwise they will stop working once the old secret is removed.

Your organization may limit how long client secrets can remain valid through an [app management policy](https://learn.microsoft.com/graph/api/resources/applicationauthenticationmethodpolicy). If creating the secret fails, choose a shorter expiration period.

### Get Notified Before the Secret Expires

Key Vault can notify you before a secret expires, but only when the secret has an expiration date. The deployment script sets one when it creates `ENGINE-SECRET`, and rotations that follow the steps above set one too. Deployments created with earlier versions of Azure IPAM don't have one, so set it yourself first.

Azure IPAM uses the same expiration date to warn you itself. Starting 30 days before it, everyone who signs in to Azure IPAM sees a [notification](/how-to/README.md#notifications) asking them to let an administrator know, and it becomes critical in the final 7 days. When `ENGINE-SECRET` has no expiration date, administrators see a reminder to set one instead. These notifications are only available when Azure IPAM reads its secret from Key Vault, as App Service and Function App deployments do. Because they rely on the date recorded in Key Vault rather than on the app registration, keep the two matching.

You can check whether `ENGINE-SECRET` has an expiration date from the **Expiration date** column under **Objects** → **Secrets** in your Azure IPAM Key Vault.

#### Set the Expiration Date

Look up the expiration date of the secret Azure IPAM is using (see [Check When the Secret Expires](#check-when-the-secret-expires)), then apply it to `ENGINE-SECRET`. Changing the expiration date doesn't create a new version of the secret, so Azure IPAM doesn't need a restart.

Changing it requires [Key Vault Secrets Officer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/security#key-vault-secrets-officer) on the Azure IPAM Key Vault, since Key Vault Secrets User can only read secrets. Remove the role again when you are done.

##### Azure Portal

1. Navigate to your Azure IPAM **Key Vault** → **Objects** → **Secrets** → **ENGINE-SECRET** and select the current version

   ![Key Vault ENGINE-SECRET](./images/engine_secret_keyvault.png)
   ![ENGINE-SECRET Current Version](./images/engine_secret_current_version2.png)

2. Select **Set expiration date** and enter the date
3. Select **Save**

   ![Set ENGINE-SECRET Expiration Date](./images/engine_secret_set_expiration.png)

##### Azure PowerShell

```powershell
$engineAppId = "<engine-app-id>"
$vaultName = "<your-ipam-kv>"

$hint = (Get-AzKeyVaultSecret -VaultName $vaultName -Name "ENGINE-SECRET" -AsPlainText).Substring(0, 3)

$credential = Get-AzADAppCredential -ApplicationId $engineAppId |
  Where-Object Hint -eq $hint |
  Sort-Object EndDateTime |
  Select-Object -First 1

Update-AzKeyVaultSecret -VaultName $vaultName -Name "ENGINE-SECRET" -Expires $credential.EndDateTime | Out-Null
```

##### Azure CLI

```bash
appId="<engine-app-id>"
vaultName="<your-ipam-kv>"

hint=$(az keyvault secret show --vault-name "$vaultName" --name "ENGINE-SECRET" --query value --output tsv | cut -c1-3)

expires=$(az ad app credential list --id "$appId" --query "[?hint=='$hint'].endDateTime | [0]" --output tsv)

# Key Vault only accepts whole seconds, so drop any fraction of a second
expires=$(sed -E 's/\.[0-9]+Z$/Z/' <<< "$expires")

az keyvault secret set-attributes --vault-name "$vaultName" --name "ENGINE-SECRET" --expires "$expires" --output none
```

#### Subscribe to Expiration Events

Key Vault publishes the following events through [Azure Event Grid](https://learn.microsoft.com/azure/key-vault/general/event-grid-overview):

| Event                                  | Raised                                       |
| :------------------------------------- | :------------------------------------------- |
| `Microsoft.KeyVault.SecretNearExpiry`  | 30 days before the current version expires   |
| `Microsoft.KeyVault.SecretExpired`     | When the current version expires             |

Send them wherever your team will see them, such as an email from a Logic App, a Teams message, or an Azure Function:

1. Navigate to your Azure IPAM **Key Vault** → **Events** → **Event Subscription**

   ![Key Vault Event Subscription](./images/key_vault_event_subscription.png)

2. Under **Event Types**, select only **Secret Near Expiry** and **Secret Expired**
3. Choose an **Endpoint Type** and endpoint, then select **Create**

   ![Key Vault Event Subscription Details](./images/key_vault_event_subscription_details.png)

Microsoft's [Key Vault and Event Grid tutorial](https://learn.microsoft.com/azure/key-vault/general/event-grid-logicapps) walks through sending these events as email with a Logic App.

> **NOTE:** With an expiration date set, `ENGINE-SECRET` satisfies the built-in Azure Policy *Key Vault secrets should have an expiration date*. The other secrets in the vault (`IDENTITY-ID`, `UI-ID`, `ENGINE-ID` and `TENANT-ID`) hold identifiers rather than credentials, don't expire, and are still reported by that policy.

## Engine Azure Access

The Engine app registration is assigned the [Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/general#reader) role on the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory), or on the Management Group specified with `-MgmtGroupId` during deployment. Azure IPAM uses this access to show administrators your Azure resources, to calculate utilization, to check new address space against existing virtual networks, and to fulfill Reservations.

If the assignment is removed, Azure IPAM keeps running but can no longer read your Azure environment on its own behalf (see [Access Denied (Engine Reader Role)](/troubleshooting/README.md#access-denied-engine-reader-role)).

### Check Reader Access

Checking the assignment requires permission to read role assignments at the Management Group scope. [Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/general#reader) at that scope is enough.

#### Azure Portal

1. Navigate to **Management groups** and select the **Tenant Root Group**, or the Management Group specified during deployment

   ![Root Management Group](./images/root_mgmt_group.png)

2. Select **Access control (IAM)** → **Check access** → **Check access**
3. Search for your Azure IPAM **Engine** application (`ipam-engine-app` by default) and select it

   ![Engine Reader Access Check](./images/engine_reader_check_access.png)

4. Confirm that **Reader** is listed among its role assignments. An assignment inherited from a parent Management Group also counts

   ![Engine Reader Access Check Details](./images/engine_reader_check_access_details.png)

#### Azure PowerShell

```powershell
$engineAppId = "<engine-app-id>"

# The Root Management Group shares its ID with the tenant
# If you deployed with -MgmtGroupId, use that Management Group's ID instead
$mgmtGroupId = (Get-AzContext).Tenant.Id
$scope = "/providers/Microsoft.Management/managementGroups/$mgmtGroupId"

# Includes assignments inherited from parent Management Groups
Get-AzRoleAssignment -ServicePrincipalName $engineAppId -RoleDefinitionName "Reader" -Scope $scope
```

#### Azure CLI

```bash
appId="<engine-app-id>"

# The Root Management Group shares its ID with the tenant
# If you deployed with -MgmtGroupId, use that Management Group's ID instead
mgmtGroupId=$(az account show --query tenantId --output tsv)
scope="/providers/Microsoft.Management/managementGroups/$mgmtGroupId"

az role assignment list --assignee "$appId" --role "Reader" --scope "$scope" --include-inherited --output table
```

If no assignment is returned, [restore it](#restore-reader-access).

### Restore Reader Access

Assigning a role at the Management Group scope requires `Microsoft.Authorization/roleAssignments/write` at that scope. [Role Based Access Control Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#role-based-access-control-administrator) is the least privileged built-in role that grants it, and [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner) and [User Access Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#user-access-administrator) grant it too.

#### Azure Portal

1. Navigate to **Management groups** and select the **Tenant Root Group**, or the Management Group specified during deployment

   ![Root Management Group](./images/root_mgmt_group.png)

2. Select **Access control (IAM)** → **Add** → **Add role assignment**

   ![Engine Reader Role Add Assignment](./images/engine_reader_add_role_assignment.png)

3. Select **Reader**, then **Next**

   ![Engine Reader Role Selection](./images/engine_reader_role_selection.png)

4. Select **User, group, or service principal** → **Select members**, search for your Azure IPAM **Engine** application, and select it

   ![Engine Role Assignment Membership](./images/engine_role_assignment_membership.png)
   ![Engine Role Assignment Membership Confirmation](./images/engine_role_assignment_membership_confirm.png)

5. Select **Review + assign**

   ![Engine Reader Role Assignment](./images/engine_reader_role_assignment.png)

#### Azure PowerShell

```powershell
$engineAppId = "<engine-app-id>"

# The Root Management Group shares its ID with the tenant
# If you deployed with -MgmtGroupId, use that Management Group's ID instead
$mgmtGroupId = (Get-AzContext).Tenant.Id
$scope = "/providers/Microsoft.Management/managementGroups/$mgmtGroupId"

New-AzRoleAssignment -ApplicationId $engineAppId -RoleDefinitionName "Reader" -Scope $scope
```

#### Azure CLI

```bash
appId="<engine-app-id>"

# The Root Management Group shares its ID with the tenant
# If you deployed with -MgmtGroupId, use that Management Group's ID instead
mgmtGroupId=$(az account show --query tenantId --output tsv)
scope="/providers/Microsoft.Management/managementGroups/$mgmtGroupId"

az role assignment create --assignee "$appId" --role "Reader" --scope "$scope"
```

> **NOTE:** New role assignments can take several minutes to take effect. Once this one has, the `arm` check returned by `/api/health` reports `ok` (see [Confirm the Rotation](#confirm-the-rotation) for how to call it).
