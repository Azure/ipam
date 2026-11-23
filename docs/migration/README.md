# Azure IPAM Legacy Migration Guide

## Overview

This guide covers migrating an Azure IPAM deployment that runs on App Service with Docker Compose to the current single-container deployment. The migration keeps your data and configuration.

**Migrate now.** Microsoft has deprecated Docker Compose support in App Service and retires it on **March 31, 2027**, so Azure IPAM deployments that use it will stop working and can't receive updates. For details, see the [Docker Compose migration announcement](https://azure.github.io/AppService/2025/04/01/Docker-compose-migration.html).

## Who Should Migrate?

Every Azure IPAM deployment that uses Docker Compose should migrate ***as soon as possible***.

### Check If You Need to Migrate

To check whether your deployment needs to migrate:

1. In the Azure portal, open your Azure IPAM App Service.
2. Select **Deployment** → **Deployment Center**.
3. Find the **Container Type** field.
4. If it shows **Docker Compose (Preview)**, you need to migrate.

![Docker Compose (Preview)](./images/verify_docker_compose.png)

You can also check with Azure PowerShell:

```powershell
$webApp = Get-AzWebApp -ResourceGroupName "<your-ipam-rg>" -Name "<your-ipam-app>"
$webApp.SiteConfig.LinuxFxVersion
```

If the value starts with `COMPOSE|` followed by Base64 content, you need to migrate.

## Prerequisites

You need the following to migrate Azure IPAM:

- The Azure subscription containing your Azure IPAM deployment
- The following Azure roles:
  - [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#contributor) or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner) on the subscription, to discover your Azure IPAM resources and run the subscription-level deployment
  - One of the following roles on the Azure IPAM Key Vault, or a scope above it, to reapply the managed identity's access to the Key Vault:
    - [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner)
    - [User Access Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#user-access-administrator)
    - [Role Based Access Control Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#role-based-access-control-administrator)
    - A [custom role](https://learn.microsoft.com/azure/role-based-access-control/custom-roles) that allows `Microsoft.Authorization/roleAssignments/write`
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git), to clone the Azure IPAM repository
- [PowerShell](https://learn.microsoft.com/powershell/scripting/install/install-powershell) 7.2.0 or later
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) 11.4.0 or later
- [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install) 0.21.1 or later
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) 2.35.0 or later (optional)
  - Needed only if your deployment uses a private Azure Container Registry

> **NOTE:** [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner) on the subscription covers both of the roles above.

## Pre-Migration Backup

**Back up your Azure IPAM App Service before you migrate.** The migration is designed to keep your data and configuration, but a backup means you can restore the App Service if something goes wrong.

> **IMPORTANT:** App Service backups are only available in the **Basic, Standard, Premium and Isolated** pricing tiers. If your App Service is on the Free or Shared tier, you can't create backups, so consider moving to a higher tier before you migrate.

### Check App Service Backup Status

First, check your App Service's backup configuration:

1. In the Azure portal, open your App Service.
2. Select **Settings** → **Backups**.
3. Check the backup status:
   - **Automatic backups** are always on for supported pricing tiers, and can't be turned off
   - If **custom backups** are configured, you see their details, including frequency and retention
   - If **custom backups** aren't configured, you see *Backups are not configured for this app*
   - If your App Service is on an unsupported tier, you see *Backups are not available for this pricing tier*

![Backup Status](./images/check_backup_status.png)

### Check Recent Backups

Check the recent backup history, which includes both automatic and custom backups:

1. On the **Backups** page, scroll down to **Backup History**.
2. Review the recent backups:
   - **Status:** recent backups show *Succeeded*
   - **Date:** the backups are recent
   - **Size:** note the size of each backup
   - **Type:** whether each backup is automatic or custom

![Recent Backups](./images/check_recent_backups.png)

> **NOTE:** App Service backs up apps on supported pricing tiers every hour, and these backups can't be turned off. Check that a recent backup succeeded before you migrate.

### Configure Custom Backups (Optional)

To use your own storage account and schedule, set up custom backups before you migrate:

1. In the Azure portal, open your App Service.
2. Select **Settings** → **Backups**.
3. Select **Configure Custom Backups**.
4. Enter the custom backup settings:
   - **Storage Account:** select or create a storage account (required)
   - **Container:** select or create a container, for example `app-backups`
5. To back up on a schedule, select the **Set Schedule** check box:
   - **Repeats Every:** how often to back up (at least daily is recommended)
   - **Start Time:** when the schedule starts
   - **Time Zone:** UTC or your local time zone
   - **Retention:** how long to keep backups (at least 30 days is recommended)
6. Select **Configure** to turn on custom backups.

![Configure Custom Backups](./images/configure_custom_backups.png)

### Create an On-Demand Backup

To run an on-demand backup, first [configure custom backups](#configure-custom-backups-optional), then:

1. In the Azure portal, open your App Service.
2. Select **Settings** → **Backups**.
3. Select **Backup Now** to start the backup.
4. Wait until the backup's status shows *Succeeded*.

![Create On-Demand Backup](./images/create_on_demand_backup.png)

> **IMPORTANT:**
>
> - **Backup Now** is only available once custom backups are configured
> - Make sure you have at least one successful backup before you migrate
> - If a backup fails, fix the problem before you continue with the migration

For more about App Service backups, including their limits and requirements, see [Back up and restore your app in Azure App Service](https://learn.microsoft.com/azure/app-service/manage-backup).

## Authenticate to Azure PowerShell

Before you run `migrate.ps1`, sign in to [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) and select the subscription for your Azure IPAM deployment.

### Connect to Azure PowerShell

```powershell
# Sign in Interactively
Connect-AzAccount

# Sign in with Device Code
Connect-AzAccount -UseDeviceAuthentication
```

> **NOTE:** To sign in to a cloud other than the Azure public cloud, such as Azure Government, add the [`-Environment`](https://learn.microsoft.com/powershell/module/az.accounts/connect-azaccount#-environment) parameter to `Connect-AzAccount`.

### Set the Active Subscription for Azure PowerShell

```powershell
# Set Azure PowerShell Context
Set-AzContext -Subscription "<subscription-name-or-id>"

# Example with Subscription ID
Set-AzContext -Subscription "28b502e2-323f-4e57-98db-743459176557"

# Example with Subscription Name
Set-AzContext -Subscription "Contoso IPAM Subscription"
```

For other ways to sign in, see [Sign in to Azure from Azure PowerShell](https://learn.microsoft.com/powershell/azure/authenticate-azureps).

## Authenticate to Azure CLI

If Azure IPAM uses a private Azure Container Registry, which it does when deployed with `-PrivateACR`, also sign in to [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli). The script uses `az acr build` to build the container image in that registry. Otherwise, you can skip this section.

### Connect to Azure CLI

```bash
# Sign in Interactively
az login

# Sign in with Device Code
az login --use-device-code
```

> **NOTE:** To sign in to a cloud other than the Azure public cloud, run [`az cloud set`](https://learn.microsoft.com/cli/azure/manage-clouds-azure-cli) before `az login`.

### Set the Active Subscription for Azure CLI

```bash
# Set Azure CLI Active Subscription
az account set --subscription "<subscription-name-or-id>"

# Example with Subscription ID
az account set --subscription "28b502e2-323f-4e57-98db-743459176557"

# Example with Subscription Name
az account set --subscription "Contoso IPAM Subscription"
```

> **IMPORTANT:** Set Azure CLI to the same subscription as Azure PowerShell. The script checks this when it starts.

For other ways to sign in, see [Sign in with Azure CLI](https://learn.microsoft.com/cli/azure/authenticate-azure-cli).

## Clone the GitHub Repo

```powershell
# Clone the Repository
git clone https://github.com/Azure/ipam.git

# Change to the Migrate Folder
cd ./ipam/migrate
```

Run `migrate.ps1` from this folder, as shown in the following sections.

## Migration Methods

The migration script can find your Azure IPAM resources in two ways. Choose the one that fits your deployment:

- **Auto-discovery (recommended):** The script finds your Azure IPAM resources from the existing App Service's configuration. This is the simplest method for most deployments.
- **Manual resource specification:** You list the resources in a JSON file. Use this when your Azure IPAM resources are spread across several resource groups, or when auto-discovery fails. All of the resources must be in the same subscription.

## Migration Script Parameters

| Parameter            | Type   | Required             | Description                                                                                                                     |
|----------------------|--------|----------------------|---------------------------------------------------------------------------------------------------------------------------------|
| `-AppName`           | String | Yes **<sup>4</sup>** | Name of your existing Azure IPAM App Service                                                                                    |
| `-ResourceGroupName` | String | Yes **<sup>4</sup>** | Resource group containing your App Service                                                                                      |
| `-JsonFile`          | String | No                   | Path to your JSON resource file, for [manual resource specification](#migration-process-method-2-manual-resource-specification) |
| `-ContainerType`     | String | No                   | Container distro (`Debian` or `RHEL`) to build for private ACR deployments **<sup>3</sup>**                                     |
| `-NoVerify`          | Switch | No                   | Skips checking that the resources exist **<sup>1</sup>**                                                                        |
| `-Force`             | Switch | No                   | Skips confirmation prompts **<sup>2</sup>**                                                                                     |
| `-Debug`             | Switch | No                   | Writes verbose Azure deployment logs to `logs/debug_[timestamp].log`                                                            |

> **NOTE 1:** Use with caution, since this skips safety checks.

> **NOTE 2:** Recommended for automated deployments only.

> **NOTE 3:** Only applies to private ACR deployments, which rebuild the container image. When omitted, the distro is detected by probing the source application's status API (`/api/status`). Specify it to skip that probe, for example when the application is stopped or unreachable, or when detection returns the wrong distro.

> **NOTE 4:** Not needed with `-JsonFile`, which names the App Service in its Web App entry. If you give them anyway, they must match that entry.

## Migration Process (Method 1: Auto-Discovery)

### Step 1: Run Auto-Discovery Migration

Run the migration script with auto-discovery:

```powershell
./migrate.ps1 -AppName "<your-ipam-app>" -ResourceGroupName "<your-ipam-rg>"
```

For the optional parameters, see [Migration Script Parameters](#migration-script-parameters).

### Step 2: Monitor Migration Progress

The migration script:

1. **Discovers resources:** finds all of the Azure IPAM resources from your App Service's configuration
2. **Verifies resources:** checks that every resource exists and is accessible
3. **Probes the status API:** finds the current container configuration and application health
4. **Deploys updates:** updates the infrastructure with the Bicep templates
5. **Builds the container** (private ACR only): builds and pushes a new container image
6. **Restarts the App Service:** applies the new configuration

> **NOTE:** Azure IPAM can take up to 5 minutes to become available, while App Service downloads and starts the new container.

## Migration Process (Method 2: Manual Resource Specification)

### Step 1: Create Override Configuration File

Copy `migrate/overrides.jsonc` to a new file in the `migrate` folder, for example `resources.jsonc`. Then replace the placeholders in each entry with that resource's name, resource group and subscription. The resource groups can differ from one entry to the next, but every resource must be in the same subscription.

```jsonc
[
  {
    // Web App Resource Details
    "ResourceType": "Microsoft.Web/sites",
    "ResourceName": "<your-ipam-app>",
    "ResourceGroup": "<your-ipam-rg>",
    "Subscription": "<subscription-id>"
  },
  {
    // App Service Plan Resource Details
    "ResourceType": "Microsoft.Web/serverfarms",
    "ResourceName": "<your-ipam-plan>",
    "ResourceGroup": "<your-ipam-rg>",
    "Subscription": "<subscription-id>"
  },
  {
    // Managed Identity Resource Details
    "ResourceType": "Microsoft.ManagedIdentity/userAssignedIdentities",
    "ResourceName": "<your-ipam-identity>",
    "ResourceGroup": "<your-ipam-rg>",
    "Subscription": "<subscription-id>"
  },
  {
    // Log Analytics Workspace Resource Details
    "ResourceType": "Microsoft.OperationalInsights/workspaces",
    "ResourceName": "<your-ipam-workspace>",
    "ResourceGroup": "<your-ipam-rg>",
    "Subscription": "<subscription-id>"
  },
  {
    // Cosmos DB Account Resource Details
    "ResourceType": "Microsoft.DocumentDB/databaseAccounts",
    "ResourceName": "<your-ipam-cosmos>",
    "ResourceGroup": "<your-ipam-rg>",
    "Subscription": "<subscription-id>"
  },
  {
    // Key Vault Resource Details
    "ResourceType": "Microsoft.KeyVault/vaults",
    "ResourceName": "<your-ipam-kv>",
    "ResourceGroup": "<your-ipam-rg>",
    "Subscription": "<subscription-id>"
  }
]
```

If your private ACR is in a different resource group from the App Service, also add the following entry inside the list, after the last entry, with a comma after the entry before it. You don't need it otherwise, since the script finds a public registry, or a private ACR in the App Service's resource group, by itself.

```jsonc
{
  // Container Registry Resource Details
  "ResourceType": "Microsoft.ContainerRegistry/registries",
  "ResourceName": "<your-ipam-acr>",
  "ResourceGroup": "<your-ipam-acr-rg>",
  "Subscription": "<subscription-id>"
}
```

### Step 2: Run Manual Override Migration

Run the migration script with your resource file:

```powershell
./migrate.ps1 -JsonFile "./resources.jsonc"
```

The script migrates the App Service named in the file's Web App entry, so `-AppName` and `-ResourceGroupName` aren't needed. If you give them anyway, they must match that entry, or the script stops before making any changes.

For the optional parameters, see [Migration Script Parameters](#migration-script-parameters).

### Step 3: Monitor Migration Progress

The migration script:

1. **Loads your resource file:** reads the resources you listed
2. **Verifies resources:** checks that every resource exists and is accessible
3. **Probes the status API:** finds the current container configuration and application health
4. **Deploys updates:** updates the infrastructure with the Bicep templates
5. **Builds the container** (private ACR only): builds and pushes a new container image
6. **Restarts the App Service:** applies the new configuration

> **NOTE:** Azure IPAM can take up to 5 minutes to become available, while App Service downloads and starts the new container.

## Migration Validation

### Post-Migration Verification

After the migration, check your Azure IPAM deployment:

1. **Check application health:** Check that the App Service is healthy.

   ![Check App Service Health](./images/app_service_health.png)

2. **Check the container configuration:** Check that the App Service no longer uses Docker Compose, and runs a single container.

   ![App Service Container Model](./images/app_service_container_model.png)

3. **Check that Azure IPAM works:** Open Azure IPAM, check that it loads, and try some basic tasks, such as viewing Spaces and Blocks.

## Troubleshooting

### Common Issues and Solutions

#### Azure PowerShell and Azure CLI Use Different Subscriptions

The script switches Azure CLI to the subscription Azure PowerShell uses. If that fails, check both and set them to the same subscription, as described in [Authenticate to Azure CLI](#authenticate-to-azure-cli):

```powershell
# Check the Azure PowerShell Context
Get-AzContext
```

```bash
# Check the Azure CLI Context
az account show
```

#### Container Build Fails (Private ACR)

1. Check that the account you signed in to Azure CLI with can push to the registry.
2. Check that the registry is available.
3. Review the build logs in the script's output.
4. Build and push the image yourself, as described in [Building and Updating Production Container Images Using a Private ACR](/development/README.md#building-and-updating-production-container-images-using-a-private-acr).

#### App Service Fails to Start After Migration

1. Check that the migration finished without errors.
2. Check the migration logs, and the deployment logs in the Azure portal.
3. Check the App Service logs in the Azure portal.

### Getting Help

If you encounter issues during migration:

1. **Review the migration logs:** Check the script's output and the `logs` folder for error details.
2. **Check the prerequisites:** Make sure you have all of the [required permissions](#prerequisites).
3. **Check Azure status:** Check that Azure services are working on the [Azure status](https://azure.status.microsoft/status) page.
4. **Report an issue:** [Report an issue](https://github.com/Azure/ipam/issues/new?template=bug_report.yml) on GitHub.

## Rollback Procedures

If something goes wrong with the migration, you can roll back to your previous configuration:

1. In the Azure portal, open your App Service.
2. Select **Settings** → **Backups**.
3. Find a backup from **before** you ran the migration script.
4. Select **Restore** for that backup.
5. Select the **existing** deployment slot, and select **Restore Site Configuration**.
6. The restore can take *up to 30 minutes*, and stops and starts the App Service while it runs.

![Restore From Backup](./images/restore_from_backup.png)

## FAQ

### How Long Does the Migration Take?

Most migrations take 10 to 15 minutes, depending on:

- Number of resources to migrate
- Container build time (for private ACR)
- Network connectivity

### Will There Be Downtime During the Migration?

Yes. Azure IPAM is unavailable while:

- The App Service configuration is updated
- The container image is replaced
- The App Service restarts

Expect 10 to 15 minutes of downtime.

### What Happens to My Existing Data?

All of your existing data is kept:

- Cosmos DB data remains unchanged
- Key Vault secrets are maintained
- App settings are migrated
- User configurations are preserved

### What If My Deployment Uses a Custom Configuration?

The script handles most custom configurations. For more complex ones:

- Use [manual resource specification](#migration-process-method-2-manual-resource-specification)
- Review the script's output carefully
- [Report an issue](https://github.com/Azure/ipam/issues/new?template=bug_report.yml) describing your configuration
