# Azure IPAM Legacy Migration Guide

## Overview

This guide provides comprehensive instructions for migrating existing Azure IPAM deployments from Docker Compose-based App Services to modern Azure infrastructure. The migration process preserves your existing data and configuration while updating your deployment to use current Azure best practices.

**Migration is required immediately** due to Microsoft's announcement of the deprecation and eventual removal of Docker Compose support for Azure App Service. Docker Compose support is deprecated and will be removed in future App Service versions, making migration essential for continued operation and security updates. The retirement date for Docker Compose capability is **March 31, 2027**. For additional details, refer to the [Docker Compose Migration announcement](https://azure.github.io/AppService/2025/04/01/Docker-compose-migration.html).

## Who Should Migrate?

All Azure IPAM users currently running Docker Compose-based deployments should migrate ***as soon as possible***.

### Check If You Need to Migrate

To determine if your deployment requires migration, check your App Service configuration:

1. Navigate to your Azure IPAM App Service in the Azure Portal
2. Go to **Deployment** → **Deployment Center**
3. Look for the **Container Type** field
4. If it shows **Docker Compose (Preview)**, you need to migrate

![Docker Compose (Preview)](./images/verify_docker_compose.png)

Alternatively, you can check via PowerShell:

```powershell
$webApp = Get-AzWebApp -ResourceGroupName "your-resource-group" -Name "your-app-name"
$webApp.SiteConfig.LinuxFxVersion
```

If this returns a value containing `COMPOSE|` followed by Base64 content, you need to migrate.

## Prerequisites

To successfully migrate your Azure IPAM deployment, the following prerequisites must be met:

- An Azure Subscription containing your existing Azure IPAM deployment
- The following Azure RBAC Roles:
  - [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#contributor) or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner) at the Resource Group scope containing your Azure IPAM resources
  - [Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#reader) at the Subscription scope for resource discovery
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed
  - Required to clone the Azure IPAM GitHub repository
- [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) version 7.2.0 or later installed
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-az-ps) version 11.4.0 or later installed
- [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install) version 0.21.1 or later installed
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) version 2.35.0 or later installed (optional)
  - Required only if your deployment uses a private Azure Container Registry (Private ACR)

> **NOTE:** The migration script requires access to your existing Azure IPAM resources. Ensure you have the necessary permissions to both read the current configuration and modify the App Service deployment.

## Pre-Migration Backup

**Before proceeding with the migration, it is strongly recommended to back up your Azure IPAM App Service.** While the migration process is designed to preserve your existing data and configuration, having a backup ensures you can restore your App Service if any issues occur during migration.

> **Important**: App Service backups are only available in **Basic, Standard, Premium, and Isolated** pricing tiers. If your App Service is running on a Free or Shared tier, you cannot create backups and should consider upgrading your pricing tier before migration.

### Check App Service Backup Status

First, verify the backup configuration for your App Service:

1. **Navigate to your App Service** in the Azure Portal
2. Go to **Settings** → **Backups**
3. Check the backup status:
   - **Automatic backups** are always enabled for supported pricing tiers and cannot be disabled
   - If **custom backups** are configured, you'll see backup configuration details including frequency and retention
   - If **custom backups** are not configured, you'll see "Backups are not configured for this app"
   - If your App Service is on an unsupported tier, you'll see "Backups are not available for this pricing tier"

![Backup Status](./images/check_backup_status.png)

### Check Recent Backups

Verify recent backup history (both automatic and custom backups will appear here):

1. In the **Backups** section, scroll down to view **Backup History**
2. Review recent backups and verify:
   - **Status**: Ensure recent backups show "Succeeded"
   - **Date**: Confirm backups are recent
   - **Size**: Note the backup file sizes
   - **Type**: Distinguish between automatic backups and custom backups (if configured)

![Recent Backups](./images/check_recent_backups.png)

> **Note**: App Services automatically perform backups that cannot be disabled. With automatic backups configured, you cannot perform on-demand backups. You should verify that a recent backup was successfully completed before proceeding with migration.

### Configure Custom Backups (Optional)

If you want to configure custom backups with your own storage account and schedule, you can set them up before migration:

1. **Navigate to your App Service** in the Azure Portal
2. Go to **Settings** → **Backups**
3. Click **Configure Custom Backups** to set up custom backup settings
4. **Configure custom backup settings**:
   - **Storage Account**: Select or create a storage account (required)
   - **Container**: Select or create a container (e.g., "app-backups")
5. Optionally you can setup a custom back schedule by selecting the **Set Schedule** checkbox
   - **Repeats Every**: Set frequency (at least Daily recommended)
   - **Start Time**: Start time of the backup schedule
   - **Time Zone**: UTC or local (portal) time zone
   - **Retention**: Set retention period (at least 30 days recommended)
6. Click **Configure** to enable custom backups

![Configure Custom Backups](./images/configure_custom_backups.png)

### Create an On-Demand Backup

If you want to run an on-demand backup, you must first configure **Custom Backups** (see above) then proceed as follows:

1. **Navigate to your App Service** in the Azure Portal
2. Go to **Settings** → **Backups**
3. Click **Backup Now** to start the backup process
4. Monitor the backup status until it shows **Succeeded**

![Create On-Demand Backup](./images/create_on_demand_backup.png)

> **Important**:
>
> - If automatic backups are enabled, the "Backup Now" option is not available
> - Ensure you have at least one successful backup before proceeding with migration
> - If backup creation fails, resolve the issue before continuing with migration

For detailed information about App Service backups, including limitations and requirements, see the [Azure App Service backup documentation](https://learn.microsoft.com/azure/app-service/manage-backup).

## Authenticate to Azure PowerShell

Before executing the Azure IPAM migration script, you'll need to authenticate to [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-az-ps) and set the context to the subscription containing your Azure IPAM deployment.

### Connect to Azure PowerShell

```powershell
# Sign in Interactively
Connect-AzAccount

# Sign in with Device Code
Connect-AzAccount -UseDeviceAuthentication
```

> **NOTE:** If you're connecting to an Azure Cloud besides Azure Public (such as Gov, China, etc.), you may need to specify the `-Environment` flag as described in the [Azure PowerShell](https://learn.microsoft.com/powershell/module/az.accounts/connect-azaccount) documentation when using `Connect-AzAccount`

### Set the Active Subscription for Azure PowerShell

```powershell
# Set Azure PowerShell Context
Set-AzContext -Subscription "<Target Subscription Name/GUID>"

# Example with Subscription ID
Set-AzContext -Subscription "28b502e2-323f-4e57-98db-743459176557"

# Example with Subscription Name
Set-AzContext -Subscription "Contoso IPAM Subscription"
```

For additional information on authenticating with Azure PowerShell, refer to the [Azure PowerShell](https://learn.microsoft.com/powershell/azure/authenticate-azureps) documentation.

## Authenticate to Azure CLI (Optional)

If your Azure IPAM deployment uses a private Azure Container Registry, you will need to be authenticated to the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) *in addition to* Azure PowerShell. This is because the migration script will use the `az acr build` feature to build updated application containers and push them into your private Azure Container Registry.

### Connect to Azure CLI

```bash
# Sign in Interactively
az login

# Sign in with Device Code
az login --use-device-code
```

### Set the Active Subscription for Azure CLI

```bash
# Set Azure CLI Active Subscription
az account set --subscription "<Target Subscription Name/GUID>"
```

> **Important**: Ensure both Azure PowerShell and Azure CLI are authenticated to the **same subscription**. Mismatched subscription contexts can cause deployment failures during the migration process.

## Clone the GitHub Repo

```powershell
# Example using PowerShell for Windows
PS C:\> git clone https://github.com/Azure/ipam.git
PS C:\> cd .\ipam\migrate
PS C:\ipam\migrate> .\migrate.ps1 <OPTIONS>

# Example using PowerShell for Linux
PS /> git clone https://github.com/Azure/ipam.git
PS /> cd /ipam/migrate
PS /ipam/migrate> .\migrate.ps1 <OPTIONS>
```

## Migration Methods

The migration script supports two methods for resource discovery, choose the method that best fits your scenario:

1. Auto-Discovery (Recommended)

    The script automatically discovers your Azure IPAM resources by analyzing the existing App Service configuration. This is the simplest approach for most deployments.

2. Manual Resource Specification

    Use a JSON configuration file to specify exact resource details. This method is useful for complex deployments, cross-subscription resources, or when auto-discovery fails.

## Migration Process (Method 1: Auto-Discovery)

### Step 1: Run Auto-Discovery Migration

Execute the migration script with auto-discovery:

```powershell
.\migrate.ps1 -AppName "your-ipam-app-name" -ResourceGroupName "your-resource-group"
```

#### Parameters

| Parameter            | Type   | Required | Description                                                                                 |
|----------------------|--------|----------|---------------------------------------------------------------------------------------------|
| `-AppName`           | String | Yes      | Name of your existing Azure IPAM App Service                                                |
| `-ResourceGroupName` | String | Yes      | Resource group containing your App Service                                                  |
| `-ContainerType`     | String | No       | Container distro (`Debian` or `RHEL`) to build for private ACR deployments **<sup>3</sup>** |
| `-NoVerify`          | Switch | No       | Skip resource existence verification **<sup>1</sup>**                                       |
| `-Force`             | Switch | No       | Skip user confirmation prompts **<sup>2</sup>**                                             |
| `-Debug`             | Switch | No       | Write verbose Azure deployment logs to `logs/debug_[timestamp].log`                         |

> **NOTE 1:** Use with caution as this bypasses safety checks.

> **NOTE 2:** Recommended for automated deployments only.

> **NOTE 3:** Only applies to private ACR deployments, which rebuild the container image. When omitted, the distro is auto-detected by probing the source application's status API (`/api/status`). Specify it explicitly to skip that probe — for example when the application is stopped or otherwise unreachable, or when auto-detection returns the wrong distro.

### Step 2: Monitor Migration Progress

The migration script will automatically:

1. **Discover Resources**: Analyze your App Service to infer all Azure IPAM components
2. **Verify Resources**: Confirm all resources exist and are accessible
3. **Probe Status API**: Determine current container configuration and application health
4. **Deploy Updates**: Update infrastructure using Bicep templates
5. **Build Container** (Private ACR only): Build and push updated container images
6. **Restart App Service**: Apply new configuration

> **NOTE:** It may take up to 5 minutes for the Azure IPAM services to become available as the new container is downloaded and started by Azure App Services

## Migration Process (Method 2: Manual Resource Specification)

### Step 1: Create Override Configuration File

Create a JSON(C) file specifying your exact resource details:

```jsonc
[
  {
    // Web App Resource Details
    "ResourceType": "Microsoft.Web/sites",
    "ResourceName": "your-app-service-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  },
  {
    // App Service Plan Resource Details
    "ResourceType": "Microsoft.Web/serverfarms",
    "ResourceName": "your-app-service-plan-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  },
  {
    // Managed Identity Resource Details
    "ResourceType": "Microsoft.ManagedIdentity/userAssignedIdentities",
    "ResourceName": "your-managed-identity-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  },
  {
    // Log Analytics Workspace Resource Details
    "ResourceType": "Microsoft.OperationalInsights/workspaces",
    "ResourceName": "your-log-analytics-workspace-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  },
  {
    // Cosmos DB Account Resource Details
    "ResourceType": "Microsoft.DocumentDB/databaseAccounts",
    "ResourceName": "your-cosmos-db-account-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  },
  {
    // Key Vault Resource Details
    "ResourceType": "Microsoft.KeyVault/vaults",
    "ResourceName": "your-key-vault-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  },
  {
    // Container Registry Resource Details (Optional - only if using private ACR)
    "ResourceType": "Microsoft.ContainerRegistry/registries",
    "ResourceName": "your-container-registry-name",
    "ResourceGroup": "your-resource-group",
    "Subscription": "your-subscription-id"
  }
]
```

Save this file as `resources.jsonc` in the same directory as the migration script.

### Step 2: Run Manual Override Migration

Execute the migration script with your resource JSON file specified:

```powershell
.\migrate.ps1 -AppName "your-ipam-app-name" -ResourceGroupName "your-resource-group" -JsonFile "resources.jsonc"
```

#### Manual Override Parameters

| Parameter            | Type   | Required | Description                                                                                 |
|----------------------|--------|----------|---------------------------------------------------------------------------------------------|
| `-AppName`           | String | Yes      | Name of your existing Azure IPAM App Service                                                |
| `-ResourceGroupName` | String | Yes      | Resource group containing your App Service                                                  |
| `-JsonFile`          | String | Yes      | Path to your JSON override file                                                             |
| `-ContainerType`     | String | No       | Container distro (`Debian` or `RHEL`) to build for private ACR deployments **<sup>3</sup>** |
| `-NoVerify`          | Switch | No       | Skip resource existence verification **<sup>1</sup>**                                       |
| `-Force`             | Switch | No       | Skip user confirmation prompts **<sup>2</sup>**                                             |
| `-Debug`             | Switch | No       | Write verbose Azure deployment logs to `logs/debug_[timestamp].log`                         |

> **NOTE 1:** Use with caution as this bypasses safety checks.

> **NOTE 2:** Recommended for automated deployments only.

> **NOTE 3:** Only applies to private ACR deployments, which rebuild the container image. When omitted, the distro is auto-detected by probing the source application's status API (`/api/status`). Specify it explicitly to skip that probe — for example when the application is stopped or otherwise unreachable, or when auto-detection returns the wrong distro.

### Step 3: Monitor Migration Progress

The migration script will:

1. **Load Override Configuration**: Read your specified resource details
2. **Verify Resources**: Confirm all specified resources exist and are accessible
3. **Probe Status API**: Determine current container configuration and application health
4. **Deploy Updates**: Update infrastructure using Bicep templates
5. **Build Container** (Private ACR only): Build and push updated container images
6. **Restart App Service**: Apply new configuration

> **NOTE:** It may take up to 5 minutes for the Azure IPAM services to become available as the new container is downloaded and started by Azure App Services

## Migration Validation

### Post-Migration Verification

After migration completes, verify your Azure IPAM deployment:

1. **Check Application Health**:
   - Verify the App Service is healthy
   - ![Check App Service Health](./images/app_service_health.png)

2. **Check Container Configuration**:
   - Verify the App Service is no longer using Docker Compose
   - Confirm single container model
   - ![App Service Container Model](./images/app_service_container_model.png)

3. **Verify Application Accessibility**:
   - Navigate to your Azure IPAM URL
   - Confirm the application loads successfully
   - Test basic functionality (viewing IP spaces, blocks, etc.)

## Troubleshooting

### Common Issues and Solutions

#### Issue: Azure CLI authentication mismatches

**Solution**: Ensure Azure PowerShell and Azure CLI contexts match

```powershell
# Check PowerShell context
Get-AzContext
```

```bash
# Check Azure CLI context
az account show
```

#### Issue: Container build failures (Private ACR)

**Solution**:

1. Verify Azure CLI user has ACR push permissions
2. Check ACR resource availability
3. Review build logs in the script output
4. Manually build & push new containers to ACR

```shell
# App Container (Debian-based)
az acr build -r <ACR Name> -t ipam:latest -f ./Dockerfile.deb .

# App Container (RHEL-based)
az acr build -r <ACR Name> -t ipam:latest -f ./Dockerfile.rhel .
```

#### Issue: App Service fails to start after migration

**Solution**:

1. Verify that there were no errors during the Migration process
2. Check migration logs and the Deployment logs in the Azure Portal
3. Check App Service logs in Azure Portal

### Getting Help

If you encounter issues during migration:

1. **Review Migration Logs**: Check PowerShell output and log folder for detailed error messages
2. **Validate Prerequisites**: Ensure all [required permissions](#prerequisites) are in place
3. **Check Azure Status**: Verify Azure services are operational ([Azure Status](https://azure.status.microsoft/status))
4. **Contact Support**: Create an [issue](https://github.com/Azure/ipam/issues/new?template=bug_report.md) in the Azure IPAM GitHub repository

## Rollback Procedures

In the event a migration issue should occur, you can rollback to your previous configuration:

1. **Navigate to your App Service** in the Azure Portal
2. Go to **Settings** → **Backups**
3. Locate a backup from **before** the Migration script was run
4. Click **Restore** icon associated with the target backup timestamp
5. Make sure to select the **existing** deployment slot, and select **Restore Site Configuration**
6. The restoration process can take *up to 30 minutes*, and will stop/start the App Service during that time

![Restore From Backup](./images/restore_from_backup.png)

## FAQ

### Q: How long does migration take?

**A**: Typical migrations complete in 10-15 minutes, depending on:

- Number of resources to migrate
- Container build time (for private ACR)
- Network connectivity

### Q: Will there be downtime during migration?

**A**: Yes, brief downtime occurs during:

- App Service configuration updates
- Container image replacement
- App Service restart

Expected downtime: 10-15 minutes

### Q: What happens to my existing data?

**A**: All existing data is preserved:

- Cosmos DB data remains unchanged
- Key Vault secrets are maintained
- App settings are migrated
- User configurations are preserved

### Q: What if my deployment uses custom configurations?

**A**: The script handles most custom configurations automatically, however, for complex setups:

- Use the JSON override method
- Review script output carefully
- Contact support for assistance
