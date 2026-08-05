# Azure IPAM Update Guide

## Overview

This guide provides comprehensive instructions for updating existing Azure IPAM deployments to the latest version. The update process preserves your existing data and configuration while updating your deployment with the latest features, security patches, and bug fixes from the Azure IPAM project.

The Azure IPAM update script (`update.ps1`) supports multiple deployment architectures and automatically detects your current configuration to perform the appropriate update method.

> **Important**: If your deployment uses **Docker Compose** (legacy deployment method), you cannot use this update script. Docker Compose deployments must use the [Migration Guide](/migration/README.md) to upgrade to modern deployment architecture. The update script will automatically detect Docker Compose deployments and redirect you to the migration guide.

## Prerequisites

To successfully update your Azure IPAM deployment, ensure the following prerequisites are met:

- An Azure Subscription containing your existing Azure IPAM deployment
- The following Azure RBAC Roles:
  - [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#contributor) or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner) at the Resource Group scope containing your Azure IPAM resources
  - [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#contributor) or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner) at the **Subscription** scope, required only to create the [staging slot](#staging-slots) — its additive deployment is evaluated at subscription scope. If you cannot grant subscription-scope access, run the update with `-SkipInfraUpdate` to bypass this step.
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed
  - Required to clone the Azure IPAM GitHub repository
- [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) version 7.2.0 or later installed
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-az-ps) version 11.4.0 or later installed
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) version 2.35.0 or later installed (required only for Private ACR deployments)

> **NOTE:** The update script requires access to your existing Azure IPAM resources. Ensure you have the necessary permissions to both read the current configuration and restart/redeploy the App Service.

## Update Methods by Deployment Type

The update process varies depending on your current Azure IPAM deployment architecture:

### 1. Public Azure Container Registry (ACR) Deployments

#### Most Common Deployment Type

For deployments using the publicly hosted Azure Container Registry (`registry.azureipam.com`, or the legacy `azureipam.azurecr.io`), updates are handled by simply restarting your Azure App Service or Function App to pull the latest container images.

- **Update Method**: Container restart
- **Downtime**: Minimal (during restart only)
- **Additional Requirements**: None (fully automated)

### 2. Private Azure Container Registry (ACR) Deployments

For deployments using a self-hosted Azure Container Registry within your subscription, the update process includes building new container images with the latest code and pushing them to your private registry.

- **Update Method**: Container build and deployment
- **Downtime**: During container build and restart
- **Additional Requirements**:
  - Azure CLI authentication (as noted in Prerequisites above)
  - The registry must reside in the App Service's resource group for automated builds (otherwise the script provides manual image-update guidance)

### 3. Native ZIP Deploy Deployments

For "native" deployments that use ZIP Deploy functionality to deploy Python code directly to Azure App Services or Function Apps without containers.

- **Update Method**: ZIP Deploy (downloads from GitHub releases by default)
- **Downtime**: During ZIP deployment process (~5 minutes)
- **Additional Requirements**: None (downloads automatically from GitHub releases, or you can provide a local ZIP file path)

## Pre-Update Considerations

### Backup Recommendation

Before performing any update, it is strongly recommended to verify that your Azure App Service has recent backups available. While the update process is designed to preserve your existing data and configuration, having a backup ensures you can restore your service if any issues occur.

To check your backup status:

1. Navigate to your Azure IPAM App Service in the Azure Portal
2. Go to **Settings** → **Backups**
3. Verify that recent automatic or custom backups are available and show "Succeeded" status

> **Note**: If your deployment uses Azure Functions on Consumption or Elastic Premium plans, automatic backups are not supported. See [Azure Functions backup documentation](https://learn.microsoft.com/azure/app-service/manage-backup?tabs=portal#does-azure-functions-support-automatic-backups) for details on supported tiers.

For detailed backup instructions, refer to the [Migration Guide backup section](/migration/README.md#pre-migration-backup).

### Version Updates & Compatibility

The update script automatically handles version compatibility, including:

- **Python Version Updates**: If the target Azure IPAM version uses a different Python version, the script will automatically update your App Service configuration
- **Version Comparison**: The script compares the currently running version (via the `/api/status` endpoint) against the target version using semantic versioning, and skips the update when already up to date (override with `-Force`)
  - Native deployments compare against the latest GitHub release
  - Private ACR container deployments compare against the repository and skip the image build when they match
  - Public registry container deployments compare against the image's version label
- **Downgrade Protection**: If the target version is *older* than the version currently running, the update stops rather than rolling you back. Re-run with `-Force` to apply the older version deliberately
  - Images built without a version stamp report `0.0.0`; these are treated as an unknown version rather than a downgrade, and the update proceeds normally
- **Health Check Configuration**: Missing health check configurations will be automatically added during the update
- **Legacy Detection**: Docker Compose deployments (deprecated) will be detected and the script will redirect you to the migration guide

### Stopped or Unreachable Applications

The update script can run against an App Service or Function App that is stopped, or that is running but whose container failed to start. Configuration changes, image builds, and ZIP deployments are all control-plane operations and work normally, and **a stopped application is left stopped** when the update finishes.

Two details are read from the application's `/api/status` endpoint, so they can't be determined when it isn't serving requests:

| Detail           | Effect when unavailable                                                                                      |
|------------------|--------------------------------------------------------------------------------------------------------------|
| Running version  | The "already up to date" check is skipped and the update proceeds regardless                                 |
| Container distro | Private ACR image builds can't select a Dockerfile — supply `-ContainerType Debian` or `-ContainerType RHEL` |

Everything else — deployment type, container vs native, registry, and the full configuration drift comparison — is read from Azure Resource Manager and is unaffected.

> **NOTE:** Probes against a stopped application are skipped outright, and probes against an unreachable one are bounded to 30 seconds, so a hung container cannot stall the update.

> **NOTE:** For public registry container deployments, no restart is performed while the application is stopped, since a stopped application never pulls the image. Start the application to pick up the latest image.

## Authentication Setup

### Authenticate to Azure PowerShell

Before executing the update script, authenticate to [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-az-ps) and set the context to the subscription containing your Azure IPAM deployment.

#### Connect to Azure PowerShell

```powershell
# Sign in Interactively
Connect-AzAccount

# Sign in with Device Code
Connect-AzAccount -UseDeviceAuthentication
```

> **NOTE:** If you're connecting to an Azure Cloud besides Azure Public (such as Gov, China, etc.), you may need to specify the `-Environment` flag as described in the [Azure PowerShell documentation](https://learn.microsoft.com/powershell/module/az.accounts/connect-azaccount) when using `Connect-AzAccount`

#### Set the Active Subscription for Azure PowerShell

```powershell
# Set Azure PowerShell Context
Set-AzContext -Subscription "<Target Subscription Name/GUID>"

# Example with Subscription ID
Set-AzContext -Subscription "28b502e2-323f-4e57-98db-743459176557"

# Example with Subscription Name
Set-AzContext -Subscription "Contoso IPAM Subscription"
```

### Authenticate to Azure CLI (Private ACR Only)

If your Azure IPAM deployment uses a private Azure Container Registry, you must also authenticate to the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) in addition to Azure PowerShell. This is required because the update script uses `az acr build` to build and push updated container images.

#### Connect to Azure CLI

```bash
# Sign in Interactively
az login

# Sign in with Device Code
az login --use-device-code
```

#### Set the Active Subscription for Azure CLI

```bash
# Set Azure CLI Active Subscription
az account set --subscription "<Target Subscription Name/GUID>"
```

> **Important**: Ensure both Azure PowerShell and Azure CLI are authenticated to the **same subscription**. Mismatched subscription contexts can cause deployment failures during the container build process.

## Clone the GitHub Repository

Clone the Azure IPAM repository to access the update script:

```powershell
# Example using PowerShell for Windows
PS C:\> git clone https://github.com/Azure/ipam.git
PS C:\> cd .\ipam\update
PS C:\ipam\update> .\update.ps1 <OPTIONS>

# Example using PowerShell for Linux
PS /> git clone https://github.com/Azure/ipam.git
PS /> cd /ipam/update
PS /ipam/update> .\update.ps1 <OPTIONS>
```

## Update Scenarios and Usage

### Scenario 1: Standard Update (Public ACR or Native ZIP Deploy)

For most deployments using the public Azure Container Registry or native ZIP deploy, a simple restart or deployment is sufficient:

```powershell
# Basic update with required parameters
.\update.ps1 -AppName "your-ipam-app" -ResourceGroupName "your-ipam-rg"
```

### Scenario 2: Private ACR Update

For deployments using a private Azure Container Registry, the script will automatically detect this and build new containers:

```powershell
# Private ACR deployments (automatically detected)
.\update.ps1 -AppName "your-ipam-app" -ResourceGroupName "your-ipam-rg"
```

### Scenario 3: ZIP Deploy from Custom Source

To update from a specific GitHub repository or user (potentially with custom ZIP filename):

```powershell
# Update from custom GitHub source
.\update.ps1 `
  -AppName "your-ipam-app" `
  -ResourceGroupName "your-ipam-rg" `
  -GitHubUserName "your-corp" `
  -GitHubRepoName "ipam-fork"

# Update from custom GitHub source with different ZIP file name
.\update.ps1 `
  -AppName "your-ipam-app" `
  -ResourceGroupName "your-ipam-rg" `
  -GitHubUserName "your-corp" `
  -GitHubRepoName "ipam-fork" `
  -ZipFileName "ipam-custom.zip"
```

### Scenario 4: ZIP Deploy from Local File

To update using a local ZIP file (for testing or custom builds):

```powershell
# Update from local ZIP file
.\update.ps1 `
  -AppName "your-ipam-app" `
  -ResourceGroupName "your-ipam-rg" `
  -ZipFilePath "C:\temp\ipam-custom.zip"
```

### Scenario 5: ZIP Deploy to Custom Directory (Optional)

By default, the script automatically creates a temporary directory for downloading ZIP files. You only need to specify a custom directory if you want to control the download location or preserve the ZIP file after the update:

```powershell
# Update with custom asset folder (folder must already exist)
# Useful for debugging or when you want to keep the downloaded ZIP file
.\update.ps1 `
  -AppName "your-ipam-app" `
  -ResourceGroupName "your-ipam-rg" `
  -AssetFolder "C:\ipam\assets"
```

## Update Script Parameters

| Parameter            | Type   | Required | Description                                                                                |
|----------------------|--------|----------|--------------------------------------------------------------------------------------------|
| `-AppName`           | String | Yes      | Name of your existing Azure IPAM App Service or Function App                               |
| `-ResourceGroupName` | String | Yes      | Resource group containing your App Service                                                 |
| `-GitHubUserName`    | String | No       | GitHub user/organization name for custom repository **<sup>1</sup>**                       |
| `-GitHubRepoName`    | String | No       | GitHub repository name for custom repository **<sup>1</sup>**                              |
| `-ZipFileName`       | String | No       | ZIP file name to download from GitHub **<sup>1</sup>**                                     |
| `-ZipFilePath`       | String | No       | Path to local ZIP file for deployment **<sup>1</sup>**                                     |
| `-AssetFolder`       | String | No       | Directory to store downloaded ZIP file **<sup>2</sup>**                                    |
| `-ContainerType`     | String | No       | Container distro (`Debian` or `RHEL`) to build. Overrides auto-detection **<sup>3</sup>**  |
| `-SkipInfraUpdate`   | Switch | No       | Skip creation of the `staging` deployment slot                                             |
| `-Force`             | Switch | No       | Skip confirmation prompts and force a redeploy even if already up to date **<sup>4</sup>** |
| `-Debug`             | Switch | No       | Write verbose Azure deployment logs to `logs/debug_[timestamp].log`                        |

> **NOTE 1:** Only applicable for native (non-container) deployments. These parameters are ignored for container deployments, which are automatically built from the latest repository code.

> **NOTE 2:** Script creates a temporary directory automatically if not specified.

> **NOTE 3:** Only applies to private ACR deployments, which rebuild the container image. When omitted, the distro is auto-detected by probing the application's status API (`/api/status`). Specify it explicitly to skip that probe — for example when the application is stopped or otherwise unreachable, or when auto-detection returns the wrong distro.

> **NOTE 4:** `-Force` applies **every** detected configuration change without prompting, including changes to your production site that recycle the application. It also bypasses the version comparison entirely, so it will deploy a version older than the one currently running. Review a normal (non-forced) run first if you want to see the change plan before committing to it.

## Update Process Flow

The update script follows this automated process and will automatically determine the appropriate update method based on your deployment configuration:

### 1. Application Discovery and Validation

- Verifies the specified App Service or Function App exists in the subscription
- Detects the application type (App Service vs Function App, Container vs Native)
- Checks for legacy Docker Compose deployments (redirects to migration guide if found)
- Determines deployment architecture (Public ACR, Private ACR, or Native ZIP Deploy)

### 2. Configuration Drift Detection and Remediation

Azure IPAM has evolved since earlier releases, and a deployment created with an older version can differ from what a fresh deployment produces today. Before updating any code, the script compares your deployment against the **current** deployment templates, shows you exactly what differs, and asks for approval before changing anything.

Detection is based entirely on the **actual state of your Azure resources**, not on which version you originally deployed, so each difference is evaluated independently. A deployment that is already partially current only sees the items it actually needs.

Drift that may be detected and remediated:

| Item                     | Description                                                                                           |
|--------------------------|-------------------------------------------------------------------------------------------------------|
| Container image registry | Repoints legacy (`azureipam.azurecr.io`) or development registries to `registry.azureipam.com`        |
| Runtime stack            | Aligns the Python version with the version the current release targets                                |
| Startup command          | Aligns the App Service startup command with the current release                                       |
| Health check             | Configures the `/api/status` health check endpoint if missing                                         |
| App settings             | Adds any missing baseline settings, and removes settings that no longer apply to your deployment type |
| Staging slot             | Creates the `staging` deployment slot if missing (see [Staging Slots](#staging-slots))                |
| Slot-specific settings   | Marks Function App content-share settings so they never follow a slot swap                            |

Key behaviors:

- **Nothing is changed without your approval.** The full list of changes is displayed first, then you are prompted to continue. Use `-Force` to apply without prompting.
- **Your customizations are preserved.** Existing values are *never* overwritten — only entirely missing settings are added. Settings you have added yourself are never modified or removed.
- **Removal is tightly scoped.** Only settings that Azure IPAM owns *and* that no longer apply to your deployment type can be removed (for example, `SCM_DO_BUILD_DURING_DEPLOYMENT` on an internet-restricted cloud deployment that now uses `WEBSITE_RUN_FROM_PACKAGE`). Instance-specific settings — storage connection strings, content share, and Application Insights keys — are never touched.
- **Platform-managed settings are left alone.** The `DOCKER_REGISTRY_SERVER_*` settings are only required for registries that use stored credentials. Azure IPAM pulls its images anonymously (public registry) or with a managed identity (private ACR), so App Service adds and removes these settings on its own and the update script does not manage them.
- **Production and the staging slot are kept in sync.** When a staging slot exists, the same configuration is applied to both, so a future slot swap can never regress your production site.
- **Safe to re-run.** A converged deployment reports *"Configuration is up to date, no changes required"* and moves straight to the code update.

> **NOTE:** Applying configuration changes recycles the application, so expect a brief interruption. Production is converged **before** the staging slot, so a newly created slot inherits the corrected configuration rather than the old one.

Use `-SkipInfraUpdate` to skip creating the staging slot. Legacy Docker Compose deployments are not handled here — they are redirected to the [migration guide](https://azure.github.io/ipam/#/migration/README).

### 3. Deployment Type Detection and Processing

#### For Public ACR Container Deployments

- Detects use of public Azure Container Registry (`registry.azureipam.com`, or the legacy `azureipam.azurecr.io`) by examining `LinuxFxVersion`
- Compares the running version against the version label on the registry image and **skips the restart when already up to date** (override with `-Force`)
- Restarts the application to pull the latest container image from the registry
- If the registry was repointed during drift remediation, the application is already recycling and pulling the new image, so no additional restart is performed
- **Process exits here** - no building or ZIP deployment needed

#### For Private ACR Container Deployments

- Locates the private ACR in the App Service's resource group
  - The script only attempts an automated build when the registry is in that resource group; if it is located elsewhere, the script outlines the manual image-update steps and exits cleanly (see [Container Build Failures](#container-build-failures))
- Compares the running version (via `/api/status`) against the repository and **skips the image build when already up to date** (override with `-Force`)
- Verifies Azure CLI version (minimum `2.35.0`) and authentication status
- Ensures Azure PowerShell and Azure CLI contexts match
- Resolves the container distribution type (Debian/RHEL), either from `-ContainerType` or by probing the application's `/api/status` endpoint
  - App Service containers only; Function containers use a fixed Dockerfile
  - If it cannot be resolved, the script explains why and exits with the `-ContainerType` values to choose from
- Builds new container images using `az acr build` with appropriate Dockerfile
- Tags images with both the current version and `latest` (`ipam:<version>` + `ipam:latest`, or `ipamfunc:<version>` + `ipamfunc:latest`) and pushes them to the private registry
- Restarts the application, unless it was already stopped
- Captures and logs build errors if container build fails

#### For Native ZIP Deploy Deployments

- Compares the currently running version (via the `/api/status` endpoint) against the latest GitHub release and **skips the deployment if already up to date**
  - Use `-Force` to redeploy anyway
  - This check is also skipped when a local `-ZipFilePath` is supplied
- Downloads latest release ZIP from GitHub (using GitHubUserName/GitHubRepoName parameters)
- Alternatively uses provided local ZIP file if ZipFilePath is specified
- Creates temporary directory for ZIP file if AssetFolder not provided
- Performs ZIP Deploy to App Service using PowerShell cmdlets
- Falls back to Kudu API if standard ZIP Deploy using Azure PowerShell fails
- Handles retry logic for deployment failures (3 attempts)
- Cleans up temporary files

### 4. Restart and Validation

- Restarts the App Service or Function App
- Implements retry logic for restart failures
- Provides status updates throughout the process

## Staging Slots

Current Azure IPAM deployments provision a **`staging` [deployment slot](https://learn.microsoft.com/azure/app-service/deploy-staging-slots)** alongside the production site.

This additional deployment slot:

- Runs on the **same App Service Plan** at no additional plan cost
- Reuses the **same managed identity**, so it inherits Key Vault and Cosmos DB access automatically
- Is created **disabled** so it consumes no runtime capacity until needed
- Mirrors production, making it a safe target for future **slot-swap** upgrades (deploy to the slot, validate, then swap)

When you run `update.ps1` against an older deployment that predates slots, the script auto-detects the missing slot and includes it in the change plan (see [Configuration Drift Detection and Remediation](#2-configuration-drift-detection-and-remediation)). Use `-SkipInfraUpdate` to bypass it, or `-Force` to add it without the confirmation prompt.

> **NOTE:** Adding the slot is **additive**, and your existing app-setting values are always preserved. Only missing baseline settings are backfilled.

### vNet Integration on the Staging Slot

If your production App Service or Function App uses **regional vNet integration**, the update replicates that integration onto the new slot automatically. If it cannot be applied automatically (for example, due to subnet capacity, delegation, or permissions), the slot is still created **without** vNet integration and the script reports the production subnet details (writing the full subnet resource ID to the log) for manual remediation.

To add vNet integration to the `staging` slot manually:

#### Azure Portal

1. Navigate to your App Service / Function App → **Deployment slots** → select the **staging** slot
2. Go to **Networking** → **vNet integration** → **Add vNet integration**
3. Select the **same vNet and subnet** used by the production site, then **Connect**

#### Azure CLI

```bash
az webapp vnet-integration add \
  --resource-group "<your-ipam-rg>" \
  --name "<your-ipam-app>" \
  --slot staging \
  --vnet "/subscriptions/<sub-id>/resourceGroups/<vnet-rg>/providers/Microsoft.Network/virtualNetworks/<vnet-name>" \
  --subnet "<subnet-name>"
```

#### Azure PowerShell

```powershell
# Full resource ID of the subnet used by the production site
$subnetId = "/subscriptions/<sub-id>/resourceGroups/<vnet-rg>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>"

$slot = Get-AzResource `
  -ResourceGroupName "<your-ipam-rg>" `
  -ResourceType "Microsoft.Web/sites/slots" `
  -ResourceName "<your-ipam-app>/staging"

$slot.Properties | Add-Member -NotePropertyName "virtualNetworkSubnetId" -NotePropertyValue $subnetId -Force

$slot | Set-AzResource -Force
```

> **NOTE:** The subnet must be delegated to **`Microsoft.Web/serverFarms`**. The Azure CLI command adds this delegation automatically; with the Azure Portal or Azure PowerShell, ensure the delegation is in place first.

> **NOTE:** If your production site routes all outbound traffic through the vNet (the `vnetRouteAllEnabled` site property, shown in the portal under **Networking** → **Outbound traffic configuration**), apply the same setting to the `staging` slot. Otherwise, outbound connectivity that depends on the vNet — for example, reaching private-endpoint-only Cosmos DB or Key Vault — could break after a slot swap.

> **NOTE:** Regional vNet integration is configured **per slot**. The slot stays disabled until you explicitly start and swap it, so this can be completed at any time before your first slot-based upgrade.

## Changes Not Made Automatically

Some differences between older and current deployments are deliberately left alone, either because they are harmless or because changing them requires permissions well beyond what the update script needs to do its job.

### The Legacy `COSMOS-KEY` Secret

Deployments originally created with older Azure IPAM versions (v3.0.0 and earlier) have a `COSMOS-KEY` secret in Key Vault, created by the deployment templates of the day. It was **never wired to the application** — Azure IPAM has always authenticated to Cosmos DB with its managed identity — so it sits unused.

Removing a secret is a Key Vault **data-plane** operation. Azure IPAM's Key Vault uses Azure RBAC, and the deployment grants a data-plane role (**Key Vault Secrets User**) *only to the Azure IPAM managed identity*. Nobody else — including the person who deployed Azure IPAM — has data-plane access by default. Cleaning this up therefore means granting yourself **Key Vault Secrets Officer** first, which is a deliberate, auditable decision rather than something an update script should do on your behalf.

If you want to remove it:

1. Assign yourself the [Key Vault Secrets Officer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#key-vault-secrets-officer) role on the Azure IPAM Key Vault
2. Confirm nothing references the secret (no `COSMOS_KEY` app setting, no custom automation)
3. Remove it:

   ```powershell
   Remove-AzKeyVaultSecret -VaultName "<your-ipam-kv>" -Name "COSMOS-KEY"
   ```

4. Remove the role assignment you granted yourself in step 1

> **NOTE:** Azure IPAM Key Vaults have soft delete and purge protection enabled, so the secret is recoverable for 90 days with `Undo-AzKeyVaultSecretRemoval`.

> **IMPORTANT:** Removing the secret deletes a *stored copy* of the key — it does **not** revoke it. The Cosmos DB account key itself remains valid. If the value may have been exposed, [rotate the Cosmos DB key](https://learn.microsoft.com/azure/cosmos-db/secure-access-to-data#key-rotation) as well.

### Microsoft Entra Implicit Grant Flow

UI application registrations created by older Azure IPAM versions have the implicit grant flow enabled (**Access tokens** and **ID tokens**). Current deployments no longer set these.

This is **inert** in Azure IPAM's configuration: the flags apply to the *Web* platform, while Azure IPAM only registers a *Single-page application* redirect URI, and authentication uses the authorization code flow with PKCE. No action is required — but security tooling may flag it, and it can be cleared manually:

1. Navigate to **Microsoft Entra ID** → **App registrations** → your Azure IPAM **UI** application
2. Select **Authentication**
3. Under **Implicit grant and hybrid flows**, clear both **Access tokens** and **ID tokens**
4. Select **Save**

> **NOTE:** The update script does not change Microsoft Entra objects. Doing so would require application-registration permissions that infrastructure operators frequently do not have.

## Monitoring the Update Process

### Update Logs

The update script generates detailed logs in the `logs` directory:

- **Update Log**: `logs/update_[timestamp].log` - Complete console transcript of the update process
- **Detail Log**: `logs/detail_[timestamp].log` - Structured, detailed log including error information if issues occur
- **Debug Log**: `logs/debug_[timestamp].log` - Verbose Azure deployment logs (only written when `-Debug` is specified)

### Container Build Monitoring (Private ACR)

For private ACR deployments, monitor the container build process:

1. **Build Initiation**: Script uses `az acr build` with `--no-logs` flag and reports build queue status
2. **Build Progress**: Monitor in Azure Portal → Container Registry → Tasks
3. **Error Handling**: If build fails, script extracts Build ID from output and fetches detailed error logs via REST API

### ZIP Deploy Monitoring (Native Deployments)

For native deployments:

1. **GitHub Download**: Script calls GitHub API to get latest release asset download URL
2. **ZIP Upload**: First attempts standard `Publish-AzWebApp`, falls back to Kudu API if needed
3. **Completion**: Allow ~5 minutes for ZIP Deploy process to complete (shown as note in script output)

## Post-Update Verification

After the update completes, verify your Azure IPAM deployment:

### 1. Application Health Check

Verify the application is running and healthy:

![Check App Service Health](./images/app_service_health.png)

### 2. Version Verification

Check that the update was successful by querying the status API:

```powershell
# Check version information via status API
$appUrl = "https://your-ipam-app.azurewebsites.net"
$status = Invoke-RestMethod -Uri "$appUrl/api/status" -Method Get
Write-Host "Current Version: $($status.version)"
```

**Example Output:**

```text
Current Version: 3.5.0
```

**Full API Response Body (Example):**

```json
{
  "status": "OK",
  "version": "3.5.0",
  "stack": "AppContainer",
  "environment": "AZURE_PUBLIC",
  "container": {
    "image_id": "debian",
    "image_version": "13",
    "image_codename": "trixie",
    "image_pretty_name": "Debian GNU/Linux 13 (trixie)"
  }
}
```

Verify the version matches the expected updated version from the [Azure IPAM releases page](https://github.com/Azure/ipam/releases).

### 3. Functionality Testing

Perform basic functionality tests:

- Log into the application
- Verify pre-existing IP address Spaces & Blocks are visible
- Test basic IPAM operations (view networks, reservations, etc.)
- Confirm API endpoints respond as expected

## Troubleshooting

### Common Issues and Solutions

#### Authentication Errors

**Issue**: PowerShell authentication failures

```text
ERROR: Azure PowerShell not logged in or no subscription has been selected!
```

**Solution**:

```powershell
Connect-AzAccount
Set-AzContext -Subscription "your-subscription-id"
```

#### Private ACR Context Mismatch

**Issue**: Azure CLI and PowerShell context mismatch

```text
ERROR: Azure PowerShell and Azure CLI must be set to the same context!
```

**Solution**:

```powershell
# PowerShell
Set-AzContext -Subscription "your-subscription-id"

# CLI
az account set --subscription "your-subscription-id"
```

#### Container Build Failures

**Issue**: Private ACR container build fails, or the registry is located outside the App Service's resource group

**Solution**:

1. Check build logs in `logs/detail_[timestamp].log` (script automatically captures detailed logs)
2. Verify ACR permissions and storage capacity
3. Review Azure Container Registry task logs in Azure Portal
4. Ensure the application's `/api/status` endpoint is accessible for container type detection
5. For manual container build instructions, see the [Contributing Guide](/contributing/README.md#building--updating-production-containers-images-using-a-private-acr)

> **NOTE:** The update script will only attempt an automated build when the private ACR resides in the **same resource group** as the App Service. If your registry is in a different resource group, the script skips the build and directs you here — build and push a new image manually using the Contributing Guide instructions above, then restart the App Service or Function App to pull the new image.

#### ZIP Deploy Failures

**Issue**: ZIP Deploy upload failures for native deployments

**Solution**:

1. Script automatically retries with Kudu API if standard `Publish-AzWebApp` fails
2. Check App Service deployment logs in Azure Portal
3. Verify sufficient storage space in App Service plan
4. Ensure GitHub release contains the specified ZIP file name (default: `ipam.zip`)

#### Legacy Docker Compose Detection

**Issue**: Script detects Docker Compose deployment

```text
Manual Migration Required
This deployment uses the legacy Docker Compose configuration, which is no longer
supported and cannot be updated automatically.

To migrate to the current single-container deployment, follow the migration guide:
  https://azure.github.io/ipam/#/migration/README
```

**Solution**: Use the [Migration Guide](/migration/README.md) instead of the update script

### Health Check Issues

If health check configuration fails:

1. Verify App Service permissions
2. Check that `/api/status` endpoint is responding
3. Manually configure health check in Azure Portal if needed

### Getting Help

If you encounter issues not covered in this guide:

1. Review the update logs for detailed error information
2. Check the [Troubleshooting Guide](/troubleshooting/README.md)
3. Open an issue on the [Azure IPAM GitHub repository](https://github.com/Azure/ipam/issues)
4. Include relevant log files and error messages in your issue report

## Update Best Practices

### Maintenance Windows

- Schedule updates during maintenance windows to minimize impact
- For container deployments, expect 2-5 minutes of downtime during restart
- For ZIP deployments, allow up to 10 minutes for the complete process

### Testing Updates

- Test updates in a development or staging environment first
- Verify application functionality before updating production deployments
- Create a snapshot backup before updating critical production environments

### Frequency Recommendations

- Review and apply updates monthly or as code/security patches are released
- Watch the [Azure IPAM repository](https://github.com/Azure/ipam) for release notifications
  - See [GitHub's guide on configuring repository watch settings](https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/setting-up-notifications/configuring-notifications#configuring-your-watch-settings-for-an-individual-repository) to set up custom notifications for releases only

### Rollback Planning

- Ensure recent backups are available before updating
- Understand your App Service backup and restore procedures
- Consider creating a manual backup before major version updates

---

For additional information about Azure IPAM deployment and management, refer to the [Deployment Guide](/deployment/README.md)
