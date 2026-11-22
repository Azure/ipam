# Azure IPAM Deployment Overview

This guide covers deploying Azure IPAM for the first time with the `deploy.ps1` script. To update an existing deployment, see the [Azure IPAM Update Guide](/update/README.md).

## Prerequisites

You need the following to deploy Azure IPAM:

- An Azure subscription to deploy Azure IPAM into
- The following Azure roles:
  - [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner) on that subscription
  - One of the following roles on the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory), to assign the Engine's service principal the **Reader** role:
    - [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#owner)
    - [User Access Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#user-access-administrator)
    - [Role Based Access Control Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/privileged#role-based-access-control-administrator)
    - A [custom role](https://learn.microsoft.com/azure/role-based-access-control/custom-roles) that allows `Microsoft.Authorization/roleAssignments/write`
- One of the following Microsoft Entra roles, to create the app registrations and grant admin consent for their API permissions:
  - [Cloud Application Administrator](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#cloud-application-administrator)
  - [Application Administrator](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#application-administrator)
  - [Global Administrator](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference#global-administrator)
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git), to clone the Azure IPAM repository
- [PowerShell](https://learn.microsoft.com/powershell/scripting/install/install-powershell) 7.2.0 or later
- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) 11.4.0 or later
- [Microsoft Graph PowerShell SDK](https://learn.microsoft.com/powershell/microsoftgraph/installation) 2.0.0 or later, with at least the `Microsoft.Graph.Authentication` and `Microsoft.Graph.Identity.SignIns` modules
  - Used to [grant admin consent](https://learn.microsoft.com/entra/identity/enterprise-apps/grant-admin-consent) to the app registrations, and checked on every run, including infrastructure-only deployments
- [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install) 0.21.1 or later
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) 2.35.0 or later (optional)
  - Needed only with `-PrivateACR`, to build the container image in your private Azure Container Registry
- [Docker Engine (Linux)](https://docs.docker.com/engine/install/) or [Docker Desktop (Windows)](https://docs.docker.com/desktop/setup/install/windows-install/) (optional)
  - Needed only to build and run the container image locally for development or testing

For a two-part deployment, only the Azure identities part needs the Root Management Group role and the Microsoft Entra role. The infrastructure part needs **Owner** on the subscription.

> **NOTE:** You can use a different [Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview) instead of the Root Management Group, but we strongly discourage it. Azure IPAM can only see the networks under the Management Group you choose, so use this only for testing or proof-of-concept deployments.

## Deployment Overview

The `deploy.ps1` script in the repository's `deploy` folder deploys Azure IPAM, using Bicep files for the Azure infrastructure. You can deploy everything at once or in two parts:

- **Single deployment:** one run does everything
  - Creates the app registrations and service principals
  - Assigns their permissions
  - Deploys the Azure infrastructure
  - Deploys Azure IPAM to an App Service or Function App, as a container from the public or a private registry, or as code with `-Native`
- **Two-part deployment:** the identities and the infrastructure are deployed separately
  - **Part 1, Azure identities only:**
    - Creates the app registrations and service principals
    - Assigns their permissions
    - Saves their details to `main.parameters.json`, for the team deploying the infrastructure
  - **Part 2, Azure infrastructure only:**
    - Reads the details from `main.parameters.json`
    - Deploys the Azure infrastructure
    - Deploys Azure IPAM to an App Service or Function App, as a container from the public or a private registry, or as code with `-Native`
    - Sets the UI app registration's redirect URI to the new address, or shows the address so someone who manages the app registration can add it

Use the two-part deployment when no single team has the permissions both to create identities in Microsoft Entra ID and to deploy the Azure infrastructure.

> **NOTE:** The Engine app registration authenticates to Azure with a client secret, which expires. See [Maintenance](/maintenance/README.md) for how to check when it expires and rotate it before then.

## Authenticate to Azure PowerShell

Before you run `deploy.ps1`, sign in to [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) and select the subscription for your Azure IPAM deployment.

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

# Change to the Deploy Folder
cd ./ipam/deploy
```

Run `deploy.ps1` from this folder, as shown in the following sections.

## Full Deployment

To deploy everything in one run, run the following from the `deploy` folder:

```powershell
./deploy.ps1 -Location "westus3"
```

You can add these optional parameters:

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `-UIAppName` | String | No | Name of the UI app registration |
| `-EngineAppName` | String | No | Name of the Engine app registration |
| `-Tags` | Hashtable | No | Tags to add to the Azure IPAM resource group |
| `-ResourceNames` | Hashtable | No | Custom names for the Azure resources, instead of the default names **<sup>1</sup>** |
| `-NamePrefix` | String | No | Prefix for the default resource names, instead of `ipam` **<sup>2</sup>** |
| `-Function` | Switch | No | Deploys Azure IPAM to a Function App instead of an App Service |
| `-PrivateACR` | Switch | No | Deploys a private Azure Container Registry and builds the container image in it |
| `-Native` | Switch | No | Deploys Azure IPAM as code with ZIP deploy instead of as a container **<sup>3</sup>** |
| `-ZipFilePath` | String | No | With `-Native`, deploys this local ZIP package instead of the latest release |
| `-ContainerType` | String | No | Container image to build with `-PrivateACR`: `Debian` (default) or `RHEL` **<sup>4</sup>** |
| `-DisableUI` | Switch | No | Deploys Azure IPAM without the UI, and doesn't create the UI app registration |
| `-MgmtGroupId` | String | No | Management Group to assign the Engine's **Reader** role on, instead of the Root Management Group **<sup>5</sup>** |

> **NOTE 1:** Include every name the deployment type needs, as shown in the examples below. Check your names against [Naming Rules and Restrictions for Azure Resources](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules) so they're valid and unique.

> **NOTE 2:** Up to seven characters, because the prefix is part of the names of several resource types with different maximum lengths.

> **NOTE 3:** `-Native` downloads the latest Azure IPAM release from GitHub, which may be newer than the copy of the repository you're deploying from. Use `-ZipFilePath` to deploy a specific package instead. `-Native` can't be combined with `-PrivateACR` or `-ContainerType`.

> **NOTE 4:** The `RHEL` option is for environments that require Red Hat Enterprise Linux, such as government, DoD or other controlled environments. In most cases the default `Debian` image is enough. The public Azure IPAM registry only provides the Debian image, so `RHEL` requires `-PrivateACR`, and `-ContainerType` can't be combined with `-Function` or `-Native`.

> **NOTE 5:** We strongly discourage using a [Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview) other than the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory). Azure IPAM can only see the networks under the Management Group you choose, so use this only for testing or proof-of-concept deployments.

**Change the names of the app registrations:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -UIAppName "my-ui-app-reg" `
  -EngineAppName "my-engine-app-reg"
```

**Change the name prefix for the Azure resources:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -NamePrefix "devipam"
```

**Add tags to the resource group:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -Tags @{owner = 'ipamadmin@example.com'; environment = 'development'}
```

**Deploy to a Function App:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -Function
```

**Deploy with a private container registry:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -PrivateACR
```

**Use custom resource names:**

```powershell
$ResourceNames = @{
  appServiceName = 'myappservice01'
  appServicePlanName = 'myappserviceplan01'
  cosmosAccountName = 'mycosmosaccount01'
  cosmosContainerName = 'mycontainer01'
  cosmosDatabaseName = 'mydatabase01'
  keyVaultName = 'mykeyvault01'
  workspaceName = 'myworkspace01'
  managedIdentityName = 'mymanagedid01'
  resourceGroupName = 'myresourcegroup01'
}

./deploy.ps1 `
  -Location "westus3" `
  -ResourceNames $ResourceNames
```

**Use custom resource names with a private container registry:**

```powershell
$ResourceNames = @{
  appServiceName = 'myappservice01'
  appServicePlanName = 'myappserviceplan01'
  cosmosAccountName = 'mycosmosaccount01'
  cosmosContainerName = 'mycontainer01'
  cosmosDatabaseName = 'mydatabase01'
  keyVaultName = 'mykeyvault01'
  workspaceName = 'myworkspace01'
  managedIdentityName = 'mymanagedid01'
  resourceGroupName = 'myresourcegroup01'
  containerRegistryName = 'mycontainerregistry01'
}

./deploy.ps1 `
  -Location "westus3" `
  -ResourceNames $ResourceNames `
  -PrivateACR
```

**Use custom resource names with a Function App:**

```powershell
$ResourceNames = @{
  functionName = 'myfunction01'
  functionPlanName = 'myfunctionplan01'
  cosmosAccountName = 'mycosmosaccount01'
  cosmosContainerName = 'mycontainer01'
  cosmosDatabaseName = 'mydatabase01'
  keyVaultName = 'mykeyvault01'
  workspaceName = 'myworkspace01'
  managedIdentityName = 'mymanagedid01'
  resourceGroupName = 'myresourcegroup01'
  storageAccountName = 'mystorageaccount01'
}

./deploy.ps1 `
  -Location "westus3" `
  -ResourceNames $ResourceNames `
  -Function
```

## Azure Identities (Only) Deployment

To create only the Azure identities, run the following from the `deploy` folder:

```powershell
./deploy.ps1 -AppsOnly
```

You can add these optional parameters:

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `-UIAppName` | String | No | Name of the UI app registration |
| `-EngineAppName` | String | No | Name of the Engine app registration |
| `-DisableUI` | Switch | No | Doesn't create the UI app registration, so Azure IPAM is deployed without the UI |
| `-MgmtGroupId` | String | No | Management Group to assign the Engine's **Reader** role on, instead of the Root Management Group **<sup>1</sup>** |

> **NOTE 1:** We strongly discourage using a [Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview) other than the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory). Azure IPAM can only see the networks under the Management Group you choose, so use this only for testing or proof-of-concept deployments.

**Change the names of the app registrations:**

```powershell
./deploy.ps1 `
  -AppsOnly `
  -UIAppName "my-ui-app-reg" `
  -EngineAppName "my-engine-app-reg"
```

**Create the identities without a UI (API only):**

```powershell
./deploy.ps1 `
  -AppsOnly `
  -DisableUI
```

The script saves the app registration IDs and the Engine app registration's secret to `main.parameters.json`, which you use for the infrastructure-only deployment.

> **NOTE:** Because `main.parameters.json` contains the Engine app registration's secret, store it securely. If you keep it after the deployment, update it whenever you [rotate the secret](/maintenance/README.md#rotate-the-secret).

## Infrastructure Stack (Only) Deployment

To deploy only the infrastructure, put the `main.parameters.json` file created by the [Azure Identities (Only) Deployment](#azure-identities-only-deployment) in your `deploy` folder. You can also create your own from `main.parameters.example.json`. The script only reads `uiAppId`, `engineAppId`, `engineAppSecret` and `engineAppSecretExpiry` from it. Set everything else, such as the name prefix or deployment type, with the parameters below.

> **NOTE:** `engineAppSecretExpiry` is the expiration date of the Engine app registration's secret, which the script applies to the secret in Key Vault. It's optional in your own parameter file. If you include it, use UTC in the format `yyyy-MM-ddTHH:mm:ssZ`. Otherwise, remove it.

When your parameter file is ready, run the following from the `deploy` folder:

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json
```

> **NOTE:** At the end of the deployment, the script sets the UI app registration's redirect URI to the new App Service or Function App address. If you don't have permission to change the app registration, the script shows the address instead. Ask someone who manages the UI app registration to add it as a **Single-page application** redirect URI.

You can add these optional parameters:

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `-Tags` | Hashtable | No | Tags to add to the Azure IPAM resource group |
| `-ResourceNames` | Hashtable | No | Custom names for the Azure resources, instead of the default names **<sup>1</sup>** |
| `-NamePrefix` | String | No | Prefix for the default resource names, instead of `ipam` **<sup>2</sup>** |
| `-Function` | Switch | No | Deploys Azure IPAM to a Function App instead of an App Service |
| `-PrivateACR` | Switch | No | Deploys a private Azure Container Registry and builds the container image in it |
| `-Native` | Switch | No | Deploys Azure IPAM as code with ZIP deploy instead of as a container **<sup>3</sup>** |
| `-ZipFilePath` | String | No | With `-Native`, deploys this local ZIP package instead of the latest release |
| `-ContainerType` | String | No | Container image to build with `-PrivateACR`: `Debian` (default) or `RHEL` **<sup>4</sup>** |

> **NOTE 1:** Include every name the deployment type needs, as shown in the examples below. Check your names against [Naming Rules and Restrictions for Azure Resources](https://learn.microsoft.com/azure/azure-resource-manager/management/resource-name-rules) so they're valid and unique.

> **NOTE 2:** Up to seven characters, because the prefix is part of the names of several resource types with different maximum lengths.

> **NOTE 3:** `-Native` downloads the latest Azure IPAM release from GitHub, which may be newer than the copy of the repository you're deploying from. Use `-ZipFilePath` to deploy a specific package instead. `-Native` can't be combined with `-PrivateACR` or `-ContainerType`.

> **NOTE 4:** The `RHEL` option is for environments that require Red Hat Enterprise Linux, such as government, DoD or other controlled environments. In most cases the default `Debian` image is enough. The public Azure IPAM registry only provides the Debian image, so `RHEL` requires `-PrivateACR`, and `-ContainerType` can't be combined with `-Function` or `-Native`.

**Change the name prefix for the Azure resources:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -NamePrefix "devipam"
```

**Add tags to the resource group:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -Tags @{owner = 'ipamadmin@example.com'; environment = 'development'}
```

**Deploy to a Function App:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -Function
```

**Deploy with a private container registry:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -PrivateACR
```

**Use custom resource names:**

```powershell
$ResourceNames = @{
  appServiceName = 'myappservice01'
  appServicePlanName = 'myappserviceplan01'
  cosmosAccountName = 'mycosmosaccount01'
  cosmosContainerName = 'mycontainer01'
  cosmosDatabaseName = 'mydatabase01'
  keyVaultName = 'mykeyvault01'
  workspaceName = 'myworkspace01'
  managedIdentityName = 'mymanagedid01'
  resourceGroupName = 'myresourcegroup01'
}

./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -ResourceNames $ResourceNames
```

**Use custom resource names with a private container registry:**

```powershell
$ResourceNames = @{
  appServiceName = 'myappservice01'
  appServicePlanName = 'myappserviceplan01'
  cosmosAccountName = 'mycosmosaccount01'
  cosmosContainerName = 'mycontainer01'
  cosmosDatabaseName = 'mydatabase01'
  keyVaultName = 'mykeyvault01'
  workspaceName = 'myworkspace01'
  managedIdentityName = 'mymanagedid01'
  resourceGroupName = 'myresourcegroup01'
  containerRegistryName = 'mycontainerregistry01'
}

./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -ResourceNames $ResourceNames `
  -PrivateACR
```

**Use custom resource names with a Function App:**

```powershell
$ResourceNames = @{
  functionName = 'myfunction01'
  functionPlanName = 'myfunctionplan01'
  cosmosAccountName = 'mycosmosaccount01'
  cosmosContainerName = 'mycontainer01'
  cosmosDatabaseName = 'mydatabase01'
  keyVaultName = 'mykeyvault01'
  workspaceName = 'myworkspace01'
  managedIdentityName = 'mymanagedid01'
  resourceGroupName = 'myresourcegroup01'
  storageAccountName = 'mystorageaccount01'
}

./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -ResourceNames $ResourceNames `
  -Function
```
