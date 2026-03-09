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
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed
  - Required to clone the Azure IPAM GitHub repository
- [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) version 7.2.0 or later installed
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-az-ps) version 10.3.0 or later installed
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) version 2.35.0 or later installed (required only for Private ACR deployments)

> **NOTE:** The update script requires access to your existing Azure IPAM resources. Ensure you have the necessary permissions to both read the current configuration and restart/redeploy the App Service.

## Update Methods by Deployment Type

The update process varies depending on your current Azure IPAM deployment architecture:

### 1. Public Azure Container Registry (ACR) Deployments

#### Most Common Deployment Type

For deployments using the publicly hosted Azure Container Registry (`azureipam.azurecr.io`), updates are handled by simply restarting your Azure App Service or Function App to pull the latest container images.

- **Update Method**: Container restart
- **Downtime**: Minimal (during restart only)
- **Additional Requirements**: None (fully automated)

### 2. Private Azure Container Registry (ACR) Deployments

For deployments using a self-hosted Azure Container Registry within your subscription, the update process includes building new container images with the latest code and pushing them to your private registry.

- **Update Method**: Container build and deployment
- **Downtime**: During container build and restart
- **Additional Requirements**: Azure CLI authentication (as noted in Prerequisites above)

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
- **Health Check Configuration**: Missing health check configurations will be automatically added during the update
- **Legacy Detection**: Docker Compose deployments (deprecated) will be detected and the script will redirect you to the migration guide

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
PS C:\> cd .\ipam\deploy
PS C:\ipam\deploy> .\update.ps1 <OPTIONS>

# Example using PowerShell for Linux
PS /> git clone https://github.com/Azure/ipam.git
PS /> cd /ipam/deploy
PS /ipam/deploy> .\update.ps1 <OPTIONS>
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

| Parameter            | Type   | Required | Description                                                          |
|----------------------|--------|----------|----------------------------------------------------------------------|
| `-AppName`           | String | Yes      | Name of your existing Azure IPAM App Service or Function App         |
| `-ResourceGroupName` | String | Yes      | Resource group containing your App Service                           |
| `-GitHubUserName`    | String | No       | GitHub user/organization name for custom repository **<sup>1</sup>** |
| `-GitHubRepoName`    | String | No       | GitHub repository name for custom repository **<sup>1</sup>**        |
| `-ZipFileName`       | String | No       | ZIP file name to download from GitHub **<sup>1</sup>**               |
| `-ZipFilePath`       | String | No       | Path to local ZIP file for deployment **<sup>1</sup>**               |
| `-AssetFolder`       | String | No       | Directory to store downloaded ZIP file **<sup>2</sup>**              |

> **NOTE 1:** Only applicable for native (non-container) deployments. These parameters are ignored for container deployments, which are automatically built from the latest repository code.

> **NOTE 2:** Script creates a temporary directory automatically if not specified.

## Update Process Flow

The update script follows this automated process and will automatically determine the appropriate update method based on your deployment configuration:

### 1. Application Discovery and Validation

- Verifies the specified App Service or Function App exists in the subscription
- Detects the application type (App Service vs Function App, Container vs Native)
- Checks for legacy Docker Compose deployments (redirects to migration guide if found)
- Determines deployment architecture (Public ACR, Private ACR, or Native ZIP Deploy)

### 2. Health Check Configuration

- Verifies health check endpoint is configured (`/api/status`)
- Automatically adds health check configuration if missing
- Sets health check failure threshold to 2 attempts

### 3. Deployment Type Detection and Processing

#### For Public ACR Container Deployments

- Detects use of public Azure Container Registry (`azureipam.azurecr.io`) by examining `LinuxFxVersion`
- Simply restarts the application to pull latest container images from public registry
- **Process exits here** - no building or ZIP deployment needed

#### For Private ACR Container Deployments

- Validates private ACR exists in the same Resource Group
- Verifies Azure CLI version (minimum `2.35.0`) and authentication status
- Ensures Azure PowerShell and Azure CLI contexts match
- Detects container distribution type (Debian/RHEL) by querying application `/api/status` endpoint
  - App Service containers only; Function containers use a fixed Dockerfile
- Builds new container images using `az acr build` with appropriate Dockerfile
- Tags and pushes updated images to private registry (`ipam:latest` or `ipamfunc:latest`)
- Restarts the application
- Captures and logs build errors if container build fails

#### For Native ZIP Deploy Deployments

- Checks and updates Python version if it has changed between versions
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

## Monitoring the Update Process

### Update Logs

The update script generates detailed logs in the `logs` directory:

- **Update Log**: `logs/update_[timestamp].log` - Complete update process log
- **Error Log**: `logs/error_[timestamp].log` - Detailed error information if issues occur

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

**Issue**: Private ACR container build fails

**Solution**:

1. Check build logs in `logs/error_[timestamp].log` (script automatically captures detailed logs)
2. Verify ACR permissions and storage capacity
3. Review Azure Container Registry task logs in Azure Portal
4. Ensure the application's `/api/status` endpoint is accessible for container type detection
5. For manual container build instructions, see the [Contributing Guide](/contributing/README.md#building--updating-production-containers-images-using-a-private-acr)

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
WARNING: Legacy Docker Compose detected!
Please follow the migration guide...
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
