# Azure IPAM Update Guide

## Overview

This guide covers updating an existing Azure IPAM deployment to the latest version. The update keeps your data and configuration, and brings in the latest features, security fixes and bug fixes.

The update script, `update.ps1`, works with every current deployment type. It detects how Azure IPAM is deployed and updates it in the matching way.

> **IMPORTANT:** If your deployment uses **Docker Compose**, the legacy deployment method, you can't use the update script. Follow the [Azure IPAM Legacy Migration Guide](/migration/README.md) instead to move to the current deployment architecture. The update script detects Docker Compose deployments and points you to the migration guide.

## Prerequisites

You need the following to update Azure IPAM:

- The Azure subscription containing your Azure IPAM deployment
- The following Azure roles:
  - [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#contributor) or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner) on the resource group containing your Azure IPAM resources
  - [Contributor](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#contributor) or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner) on the **subscription**, needed only to create the [staging slot](#staging-slots), because that deployment is evaluated at subscription scope. If you can't get access at subscription scope, run the update with `-SkipInfraUpdate` to skip this step.
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git), to clone the Azure IPAM repository
- [PowerShell](https://learn.microsoft.com/powershell/scripting/install/install-powershell) 7.2.0 or later
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) 11.4.0 or later
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) 2.35.0 or later (only for private Azure Container Registry deployments)

> **NOTE:** The update script reads your current configuration, and restarts or redeploys the App Service or Function App, so you need permission to do both.

## Update Methods by Deployment Type

How Azure IPAM is updated depends on how it's deployed:

### Public Azure Container Registry (ACR) Deployments

This is the most common deployment type. For deployments that use the public Azure IPAM registry (`registry.azureipam.com`, or the legacy `azureipam.azurecr.io`), the update restarts your App Service or Function App so it pulls the latest container image.

- **Update method:** container restart
- **Downtime:** a few minutes, while the application restarts
- **Additional requirements:** none

### Private Azure Container Registry (ACR) Deployments

For deployments that use your own Azure Container Registry, the update builds a new container image from the latest code and pushes it to your registry.

- **Update method:** container build and restart
- **Downtime:** a few minutes, while the application restarts after the build
- **Additional requirements:**
  - Sign in to Azure CLI, as described in [Authenticate to Azure CLI](#authenticate-to-azure-cli)
  - For an automated build, the registry must be in the App Service's resource group. Otherwise, the script describes how to update the image yourself.

### Native ZIP Deploy Deployments

For native deployments, which use ZIP Deploy to deploy the Python code to an App Service or Function App without containers.

- **Update method:** ZIP Deploy, downloading the latest GitHub release by default
- **Downtime:** about 5 minutes, while the package deploys
- **Additional requirements:** none, since the script downloads the release itself, or you can give it a local ZIP file

## Pre-Update Considerations

### Backup Recommendation

Before any update, check that your App Service or Function App has recent backups. The update is designed to keep your data and configuration, but a backup means you can restore Azure IPAM if something goes wrong.

To check your backups:

1. In the Azure portal, open your Azure IPAM App Service or Function App.
2. Select **Settings** → **Backups**.
3. Check that there are recent automatic or custom backups with a status of *Succeeded*.

> **NOTE:** Function Apps on the Consumption or Elastic Premium plans don't support automatic backups. See [Does Azure Functions support automatic backups?](https://learn.microsoft.com/azure/app-service/manage-backup?tabs=portal#does-azure-functions-support-automatic-backups) for the supported plans.

For detailed backup steps, see [Pre-Migration Backup](/migration/README.md#pre-migration-backup) in the migration guide.

### Version Updates and Compatibility

The update script handles version compatibility for you:

- **Python version updates:** If the new version of Azure IPAM uses a different Python version, the script updates your App Service or Function App configuration.
- **Version comparison:** The script compares the currently running version (via the `/api/status` endpoint) against the target version using semantic versioning, and skips the update when you're already up to date. Use `-Force` to update anyway.
  - Native deployments compare against the latest GitHub release.
  - Private ACR container deployments compare against the repository, and skip the image build when they match.
  - Public registry container deployments compare against the image's version label.
- **Downgrade protection:** If the new version is *older* than the one running, the update stops rather than rolling you back. Run it again with `-Force` to apply the older version on purpose.
  - Images built without a version stamp report `0.0.0`. These are treated as an unknown version rather than a downgrade, and the update goes ahead.
- **Health check configuration:** A missing health check is added during the update.
- **Legacy detection:** The script detects Docker Compose deployments, which are deprecated, and points you to the migration guide.

### Stopped or Unreachable Applications

The update script can run against an App Service or Function App that is stopped, or that is running but whose container failed to start. Configuration changes, image builds, and ZIP deployments are all control-plane operations and work normally, and **a stopped application is left stopped** when the update finishes.

Two details are read from the application's `/api/status` endpoint, so they can't be determined when it isn't serving requests:

| Detail           | Effect when unavailable                                                                                      |
|------------------|--------------------------------------------------------------------------------------------------------------|
| Running version  | The "already up to date" check is skipped and the update proceeds regardless                                 |
| Container distro | Private ACR image builds can't choose a Dockerfile, so supply `-ContainerType Debian` or `-ContainerType RHEL` |

Everything else, including the deployment type, the registry and the full configuration drift comparison, is read from Azure Resource Manager and isn't affected.

> **NOTE:** Probes against a stopped application are skipped outright, and probes against an unreachable one are bounded to 30 seconds, so a hung container can't stall the update.

> **NOTE:** For public registry container deployments, no restart is performed while the application is stopped, since a stopped application never pulls the image. Start the application to pick up the latest image.

## Authenticate to Azure PowerShell

Before you run `update.ps1`, sign in to [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) and select the subscription for your Azure IPAM deployment.

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

# Change to the Update Folder
cd ./ipam/update
```

Run `update.ps1` from this folder, as shown in the following sections.

## Update Scenarios and Usage

### Scenario 1: Standard Update (Public ACR or Native ZIP Deploy)

For most deployments, which use the public registry or native ZIP Deploy, run the script with just the required parameters:

```powershell
# Update with the Required Parameters
./update.ps1 -AppName "<your-ipam-app>" -ResourceGroupName "<your-ipam-rg>"
```

### Scenario 2: Private ACR Update

For deployments that use a private Azure Container Registry, the script detects the registry and builds a new container image:

```powershell
# Update a Private ACR Deployment (Detected Automatically)
./update.ps1 -AppName "<your-ipam-app>" -ResourceGroupName "<your-ipam-rg>"
```

### Scenario 3: ZIP Deploy from Custom Source

To update from a different GitHub user or repository, such as your own fork, optionally with a different ZIP file name:

```powershell
# Update from a Fork
./update.ps1 `
  -AppName "<your-ipam-app>" `
  -ResourceGroupName "<your-ipam-rg>" `
  -GitHubUserName "contoso" `
  -GitHubRepoName "ipam-fork"

# Update from a Fork with a Different ZIP File Name
./update.ps1 `
  -AppName "<your-ipam-app>" `
  -ResourceGroupName "<your-ipam-rg>" `
  -GitHubUserName "contoso" `
  -GitHubRepoName "ipam-fork" `
  -ZipFileName "ipam-custom.zip"
```

### Scenario 4: ZIP Deploy from Local File

To update from a local ZIP file, for testing or a custom build:

```powershell
# Update from a Local ZIP File
./update.ps1 `
  -AppName "<your-ipam-app>" `
  -ResourceGroupName "<your-ipam-rg>" `
  -ZipFilePath "./ipam-custom.zip"
```

### Scenario 5: ZIP Deploy with a Custom Download Folder (Optional)

By default, the script downloads the ZIP file to a temporary folder. Give it a folder of your own only if you want to choose where it's downloaded, or keep the file after the update:

```powershell
# Update with a Custom Download Folder (the Folder Must Already Exist)
./update.ps1 `
  -AppName "<your-ipam-app>" `
  -ResourceGroupName "<your-ipam-rg>" `
  -AssetFolder "./assets"
```

## Update Script Parameters

| Parameter            | Type   | Required | Description                                                                                |
|----------------------|--------|----------|--------------------------------------------------------------------------------------------|
| `-AppName`           | String | Yes      | Name of your existing Azure IPAM App Service or Function App                               |
| `-ResourceGroupName` | String | Yes      | Resource group containing your App Service or Function App                                 |
| `-GitHubUserName`    | String | No       | GitHub user or organization to download the release from **<sup>1</sup>**                 |
| `-GitHubRepoName`    | String | No       | GitHub repository to download the release from **<sup>1</sup>**                           |
| `-ZipFileName`       | String | No       | ZIP file name to download from GitHub **<sup>1</sup>**                                     |
| `-ZipFilePath`       | String | No       | Path to local ZIP file for deployment **<sup>1</sup>**                                     |
| `-AssetFolder`       | String | No       | Folder to download the ZIP file to **<sup>2</sup>**                                        |
| `-ContainerType`     | String | No       | Container distro (`Debian` or `RHEL`) to build. Overrides auto-detection **<sup>3</sup>**  |
| `-SkipInfraUpdate`   | Switch | No       | Skips creating the `staging` deployment slot                                               |
| `-Force`             | Switch | No       | Skips confirmation prompts and redeploys even if already up to date **<sup>4</sup>**       |
| `-Debug`             | Switch | No       | Writes verbose Azure deployment logs to `logs/debug_[timestamp].log`                       |

> **NOTE 1:** Only for native (non-container) deployments. Container deployments ignore these parameters: public registry deployments pull the latest published image, and private ACR deployments build from your local copy of the repository.

> **NOTE 2:** If you don't specify a folder, the script uses a temporary one.

> **NOTE 3:** Only applies to private ACR deployments, which rebuild the container image. When omitted, the distro is auto-detected by probing the application's status API (`/api/status`). Specify it to skip that probe, for example when the application is stopped or unreachable, or when auto-detection returns the wrong distro.

> **NOTE 4:** `-Force` applies **every** detected configuration change without prompting, including changes to your production site that recycle the application. It also bypasses the version comparison entirely, so it deploys a version older than the one running. Review a normal (non-forced) run first if you want to see the change plan before committing to it.

## Update Process Flow

The update script works through the following stages, choosing the update method that matches your deployment:

### Application Discovery and Validation

- Verifies the specified App Service or Function App exists in the subscription
- Detects the application type (App Service vs Function App, Container vs Native)
- Checks for legacy Docker Compose deployments (redirects to migration guide if found)
- Determines deployment architecture (Public ACR, Private ACR, or Native ZIP Deploy)

### Configuration Drift Detection and Remediation

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
- **Your customizations are preserved.** Existing values are *never* overwritten. Only settings that are missing entirely are added. Settings you have added yourself are never modified or removed.
- **Removal is tightly scoped.** Only settings that Azure IPAM owns *and* that no longer apply to your deployment type can be removed (for example, `SCM_DO_BUILD_DURING_DEPLOYMENT` on an internet-restricted cloud deployment that now uses `WEBSITE_RUN_FROM_PACKAGE`). Instance-specific settings, such as storage connection strings, the content share and Application Insights keys, are never touched.
- **Platform-managed settings are left alone.** The `DOCKER_REGISTRY_SERVER_*` settings are only required for registries that use stored credentials. Azure IPAM pulls its images anonymously (public registry) or with a managed identity (private ACR), so App Service adds and removes these settings on its own, and the update script doesn't manage them.
- **Production and the staging slot are kept in sync.** When a staging slot exists, the same configuration is applied to both, so a future slot swap can never regress your production site.
- **Safe to re-run.** A converged deployment reports *"Configuration is up to date, no changes required"* and moves straight to the code update.

> **NOTE:** Applying configuration changes recycles the application, so expect a brief interruption. Production is converged **before** the staging slot, so a newly created slot inherits the corrected configuration rather than the old one.

Use `-SkipInfraUpdate` to skip creating the staging slot. Legacy Docker Compose deployments aren't handled here. The script points them to the [migration guide](/migration/README.md).

### Deployment Type Detection and Processing

#### For Public ACR Container Deployments

- Detects use of public Azure Container Registry (`registry.azureipam.com`, or the legacy `azureipam.azurecr.io`) by examining `LinuxFxVersion`
- Compares the running version against the version label on the registry image and **skips the restart when already up to date** (override with `-Force`)
- Restarts the application to pull the latest container image from the registry
- If the registry was repointed during drift remediation, the application is already recycling and pulling the new image, so no additional restart is performed
- Nothing is built or deployed, so the update ends here

#### For Private ACR Container Deployments

- Locates the private ACR in the App Service's resource group
  - The script only attempts an automated build when the registry is in that resource group; if it is located elsewhere, the script outlines the manual image-update steps and exits cleanly (see [Container Build Failures](#container-build-failures))
- Compares the running version (via `/api/status`) against the repository and **skips the image build when already up to date** (override with `-Force`)
- Verifies Azure CLI version (minimum `2.35.0`) and authentication status
- Ensures Azure PowerShell and Azure CLI contexts match
- Resolves the container distribution type (Debian/RHEL), either from `-ContainerType` or by probing the application's `/api/status` endpoint
  - App Service containers only; Function containers use a fixed Dockerfile
  - If it can't be resolved, the script explains why and exits, listing the `-ContainerType` values to choose from
- Builds new container images using `az acr build` with appropriate Dockerfile
- Tags images with both the current version and `latest` (`ipam:<version>` + `ipam:latest`, or `ipamfunc:<version>` + `ipamfunc:latest`) and pushes them to the private registry
- Restarts the application, unless it was already stopped
- Captures and logs build errors if container build fails

#### For Native ZIP Deploy Deployments

- Compares the currently running version (via the `/api/status` endpoint) against the latest GitHub release and **skips the deployment if already up to date**
  - Use `-Force` to redeploy anyway
  - This check is also skipped when a local `-ZipFilePath` is supplied
- Downloads the latest release's ZIP file from GitHub, from the repository set by `-GitHubUserName` and `-GitHubRepoName`
- Uses the local ZIP file instead if `-ZipFilePath` is specified
- Downloads to a temporary folder if `-AssetFolder` isn't specified
- Performs ZIP Deploy to App Service using PowerShell cmdlets
- Falls back to Kudu API if standard ZIP Deploy using Azure PowerShell fails
- Handles retry logic for deployment failures (3 attempts)
- Cleans up temporary files

### Restart and Validation

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

When you run `update.ps1` against an older deployment that predates slots, the script auto-detects the missing slot and includes it in the change plan (see [Configuration Drift Detection and Remediation](#configuration-drift-detection-and-remediation)). Use `-SkipInfraUpdate` to bypass it, or `-Force` to add it without the confirmation prompt.

> **NOTE:** Adding the slot is **additive**, and your existing app-setting values are always preserved. Only missing baseline settings are backfilled.

### vNet Integration on the Staging Slot

If your production App Service or Function App uses **regional virtual network integration**, the update adds the same integration to the new slot. If it can't, for example because of subnet capacity, delegation or permissions, the slot is still created **without** virtual network integration, and the script reports the production subnet's details, with its full resource ID in the log, so you can add it yourself.

To add virtual network integration to the `staging` slot yourself:

#### Azure Portal

1. Open your App Service or Function App, select **Deployment slots**, then select the **staging** slot.
2. Select **Networking**, then add virtual network integration.
3. Select the **same virtual network and subnet** as the production site, then select **Connect**.

#### Azure CLI

```bash
az webapp vnet-integration add \
  --resource-group "<your-ipam-rg>" \
  --name "<your-ipam-app>" \
  --slot staging \
  --vnet "/subscriptions/<subscription-id>/resourceGroups/<vnet-rg>/providers/Microsoft.Network/virtualNetworks/<vnet-name>" \
  --subnet "<subnet-name>"
```

#### Azure PowerShell

```powershell
# Full Resource ID of the Production Site's Subnet
$subnetId = "/subscriptions/<subscription-id>/resourceGroups/<vnet-rg>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>"

$slot = Get-AzResource `
  -ResourceGroupName "<your-ipam-rg>" `
  -ResourceType "Microsoft.Web/sites/slots" `
  -ResourceName "<your-ipam-app>/staging"

$slot.Properties | Add-Member -NotePropertyName "virtualNetworkSubnetId" -NotePropertyValue $subnetId -Force

$slot | Set-AzResource -Force
```

> **NOTE:** The subnet must be delegated to **`Microsoft.Web/serverFarms`**. The Azure CLI command adds the delegation for you. With the Azure portal or Azure PowerShell, make sure the delegation is in place first.

> **NOTE:** If your production site routes all outbound traffic through the virtual network (the `vnetRouteAllEnabled` site property, shown in the portal under **Networking** → **Outbound traffic configuration**), apply the same setting to the `staging` slot. Otherwise, outbound connections that depend on the virtual network, such as to a Cosmos DB account or Key Vault reachable only through private endpoints, could break after a slot swap.

> **NOTE:** Regional virtual network integration is configured **per slot**. The slot stays disabled until you explicitly start and swap it, so this can be completed at any time before your first slot-based upgrade.

## Changes Not Made Automatically

Some differences between older and current deployments are deliberately left alone, either because they are harmless or because changing them requires permissions well beyond what the update script needs to do its job.

### The Legacy `COSMOS-KEY` Secret

Deployments originally created with older Azure IPAM versions (v3.0.0 and earlier) have a `COSMOS-KEY` secret in Key Vault, created by the deployment templates of the day. It was **never used by the application**, since Azure IPAM has always authenticated to Cosmos DB with its managed identity.

Removing a secret is a Key Vault **data-plane** operation. Azure IPAM's Key Vault uses Azure RBAC, and the deployment grants a data-plane role (**Key Vault Secrets User**) *only to the Azure IPAM managed identity*. Nobody else has data-plane access by default, including the person who deployed Azure IPAM. Removing the secret therefore means granting yourself **Key Vault Secrets Officer** first, which is a deliberate, auditable decision rather than something an update script should do on your behalf.

If you want to remove it:

1. Assign yourself the [Key Vault Secrets Officer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/security#key-vault-secrets-officer) role on the Azure IPAM Key Vault.
2. Confirm nothing uses the secret, such as a `COSMOS_KEY` app setting or your own automation.
3. Remove it:

   ```powershell
   Remove-AzKeyVaultSecret -VaultName "<your-ipam-kv>" -Name "COSMOS-KEY"
   ```

4. Remove the role assignment you gave yourself in step 1.

> **NOTE:** Azure IPAM Key Vaults have soft delete and purge protection enabled, so the secret is recoverable for 90 days with `Undo-AzKeyVaultSecretRemoval`.

> **IMPORTANT:** Removing the secret deletes a *stored copy* of the key, but does **not** revoke it. The Cosmos DB account key itself remains valid. If the value may have been exposed, [rotate the Cosmos DB key](https://learn.microsoft.com/azure/cosmos-db/how-to-rotate-keys) as well.

### Microsoft Entra Implicit Grant Flow

UI application registrations created by older Azure IPAM versions have the implicit grant flow enabled (**Access tokens** and **ID tokens**). Current deployments no longer set these.

This has **no effect** in Azure IPAM's configuration. These settings apply to the *Web* platform, while Azure IPAM only registers a *Single-page application* redirect URI and signs in with the authorization code flow with PKCE. You don't need to do anything, but security tools may flag it. To clear it:

1. Select **Microsoft Entra ID** → **App registrations** → your Azure IPAM **UI** application.
2. Select **Authentication**.
3. Under **Implicit grant and hybrid flows**, clear both **Access tokens** and **ID tokens**.
4. Select **Save**.

> **NOTE:** The update script doesn't change Microsoft Entra objects, because that needs app registration permissions that infrastructure operators often don't have.

## Monitoring the Update Process

### Update Logs

The update script writes detailed logs to the `logs` folder:

- **Update log:** `logs/update_[timestamp].log`, a full transcript of the console output
- **Detail log:** `logs/detail_[timestamp].log`, a structured log with error details if something goes wrong
- **Debug log:** `logs/debug_[timestamp].log`, verbose Azure deployment logs, written only with `-Debug`

### Container Build Monitoring (Private ACR)

For private ACR deployments, the container build works like this:

1. **Build start:** The script runs `az acr build` with the `--no-logs` parameter and reports that the build is queued.
2. **Build progress:** You can follow the build in the Azure portal, in the container registry's task runs.
3. **Errors:** If the build fails, the script gets the build ID from the output and fetches the detailed error logs through the REST API.

### ZIP Deploy Monitoring (Native Deployments)

For native deployments:

1. **Download:** The script calls the GitHub API to get the latest release's download URL.
2. **Upload:** The script first tries `Publish-AzWebApp`, and falls back to the Kudu API if that fails.
3. **Completion:** Allow about 5 minutes for ZIP Deploy to finish, as the script's output notes.

## Post-Update Verification

After the update, check your Azure IPAM deployment.

### Application Health Check

Check that the application is running and healthy:

![Check App Service Health](./images/app_service_health.png)

### Version Verification

Check that the update worked by calling the status API:

```powershell
# Check the Version with the Status API
$ipamHost = "<your-ipam-host>"
$status = Invoke-RestMethod -Uri "https://$ipamHost/api/status" -Method Get
Write-Host "Current Version: $($status.version)"
```

Example output:

```text
Current Version: 4.0.0
```

Example of the full response body:

```json
{
  "status": "OK",
  "version": "4.0.0",
  "stack": "AppContainer",
  "environment": "AZURE_PUBLIC",
  "start_time": "2026-03-13T16:54:15Z",
  "mode": "production",
  "container": {
    "image_id": "debian",
    "image_version": "13",
    "image_codename": "trixie",
    "image_pretty_name": "Debian GNU/Linux 13 (trixie)"
  }
}
```

`start_time` is when the engine started (UTC), so a new value confirms the application restarted. `mode` is `production` when the engine is serving normally, `staging` on a deployment slot that hasn't been swapped into production yet, or `incompatible` when this build is too old for the data in the database.

Check that the version matches the latest release on the [Azure IPAM releases page](https://github.com/Azure/ipam/releases).

### Functionality Testing

Run some basic checks:

- Sign in to Azure IPAM
- Check that your existing Spaces and Blocks are there
- Try some basic tasks, such as viewing networks and Reservations
- Check that the API responds as expected

## Troubleshooting

### Common Issues and Solutions

#### Authentication Errors

**Issue:** Azure PowerShell isn't signed in

```text
ERROR: Azure PowerShell not logged in or no subscription has been selected!
```

**Solution:**

```powershell
Connect-AzAccount
Set-AzContext -Subscription "<subscription-id>"
```

#### Private ACR Context Mismatch

**Issue:** Azure CLI and Azure PowerShell are set to different subscriptions

```text
ERROR: Azure PowerShell and Azure CLI must be set to the same context!
```

**Solution:**

```powershell
# Azure PowerShell
Set-AzContext -Subscription "<subscription-id>"

# Azure CLI
az account set --subscription "<subscription-id>"
```

#### Container Build Failures

**Issue:** The private ACR container build fails, or the registry is outside the App Service's resource group

**Solution:**

1. Check the build logs in `logs/detail_[timestamp].log`, which the script captures for you.
2. Check your permissions on the registry, and its storage capacity.
3. Review the registry's task logs in the Azure portal.
4. Make sure the application's `/api/status` endpoint responds, since the script uses it to detect the container type.
5. To build the image yourself, see the [Development Guide](/development/README.md#building-and-updating-production-container-images-using-a-private-acr)

> **NOTE:** The update script only builds the image automatically when the private ACR is in the **same resource group** as the App Service. If it's in a different resource group, the script skips the build and points you here. Build and push a new image yourself, as described in the Development Guide, then restart the App Service or Function App so it pulls the new image.

#### ZIP Deploy Failures

**Issue:** ZIP Deploy uploads fail for a native deployment

**Solution:**

1. The script retries with the Kudu API if `Publish-AzWebApp` fails.
2. Check the App Service deployment logs in the Azure portal.
3. Check that the App Service plan has enough storage space.
4. Make sure the GitHub release contains the ZIP file name you specified (`ipam.zip` by default).

#### Legacy Docker Compose Detection

**Issue:** The script detects a Docker Compose deployment

```text
Manual Migration Required
This deployment uses the legacy Docker Compose configuration, which is no longer
supported and cannot be updated automatically.

To migrate to the current single-container deployment, follow the migration guide:
  https://azure.github.io/ipam/#/migration/README
```

**Solution:** Follow the [Azure IPAM Legacy Migration Guide](/migration/README.md) instead of using the update script.

### Health Check Issues

If configuring the health check fails:

1. Check your permissions on the App Service or Function App.
2. Check that the `/api/status` endpoint responds.
3. If needed, configure the health check yourself in the Azure portal.

### Getting Help

If you encounter issues not covered in this guide:

1. Review the update logs for error details.
2. Check the [Troubleshooting](/troubleshooting/README.md) guide.
3. [Report an issue](https://github.com/Azure/ipam/issues/new?template=bug_report.yml) on GitHub, and please include the relevant log files and error messages.

## Update Best Practices

### Maintenance Windows

- Schedule updates during maintenance windows to reduce the impact
- For container deployments, expect a few minutes of downtime while the application restarts
- For ZIP deployments, allow up to 10 minutes for the whole update, including about 5 minutes of downtime while the package deploys

### Testing Updates

- Test updates in a development or test environment first
- Check that everything works there before updating production
- Take a backup before updating critical production environments

### Frequency Recommendations

- Review and apply updates monthly, or as security fixes are released
- Watch the [Azure IPAM repository](https://github.com/Azure/ipam) for release notifications
  - See [GitHub's guide on configuring repository watch settings](https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/setting-up-notifications/configuring-notifications#configuring-your-watch-settings-for-an-individual-repository) to set up custom notifications for releases only

### Rollback Planning

- Make sure recent backups are available before updating
- Know how to back up and restore your App Service or Function App
- Consider taking a manual backup before major version updates

---

For additional information about Azure IPAM deployment and management, refer to the [Deployment Guide](/deployment/README.md)
