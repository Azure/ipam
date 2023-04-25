# IPAM Deployment Overview

## Prerequisites

To successfully deploy the solution, the following prerequisites must be met:

- An Azure Subscription (to deploy the solution into)
- The following Azure RBAC Roles:
  - [Owner](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#owner) at the above mentioned Subscription scope
  - One of the following roles at the [Root Management Group](https://learn.microsoft.com/en-us/azure/governance/management-groups/overview#root-management-group-for-each-directory) scope (needed to grant App Registrations and Managed Identity RBAC permissions):
    - [Owner](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#owner)
    - [User Access Administrator](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#user-access-administrator)
    - [Custom Role](https://learn.microsoft.com/en-us/azure/role-based-access-control/custom-roles) with *allow* permissions of `Microsoft.Authorization/roleAssignments/write`
  - [Global Administrator](https://learn.microsoft.com/en-us/azure/active-directory/roles/permissions-reference#global-administrator) (needed to grant admin consent for the App Registration API permissions)
- [PowerShell](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell) version 7.2.0 or later installed
- [Azure PowerShell](https://learn.microsoft.com/en-us/powershell/azure/install-az-ps) version 8.0.0 or later installed
- [Microsoft Graph PowerShell SDK](https://learn.microsoft.com/en-us/powershell/microsoftgraph/installation) version 1.9.6 or later installed
  - Required for *Full* or *Apps Only* deployments to grant [Admin Consent](https://learn.microsoft.com/en-us/azure/active-directory/manage-apps/grant-admin-consent) to the App Registrations
- [Bicep CLI](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install) version 0.10.161 or later installed
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) version 2.35.0 or later installed (optional)
  - Required only if you are building your own container images and pushing them to Azure Container Registry (Private ACR)
- Docker (Linux) / Docker Desktop (Windows) installed (optional)
  - Required only if you are building your own container images and running them locally for development/testing purposes

## Deployment Overview

The Azure IPAM solution is deployed via a PowerShell deployment script, `deploy.ps1`,  found in the `deploy` directory of the project. The infrastructure stack is defined via Azure Bicep files. The deployment can be performed via your local machine or from the development container found in the project. You have the following options for deployment:

- Two-part deployment
  - Part 1: App Registrations only
    - Configuration details are saved to a `parameters.json` file which will be shared with the infrastructure team
  - Part 2: Infrastructure Stack only
    - UI and Engine containers hosted in App Service or...
    - Engine container hosted in an Azure Function
- Deploy the entire solution (App Registrations + Azure Infrastructure)
  - UI and Engine containers hosted in App Service or...
  - Engine container hosted in an Azure Function

The two-part deployment option is provided in the event that a single team doesn't have the necessary permissions to deploy both the App Registrations in Azure AD, and the Azure infrastructure stack. In the event that you do have all of the the necessary permissions in Azure AD and on the Azure infrastructure side, then you have the option to deploy the entire solution all at once.

## Authenticate to Azure PowerShell

Before executing the Azure IPAM deployment script, you'll need to authenticate to [Azure PowerShell](https://learn.microsoft.com/en-us/powershell/azure/install-az-ps) and set the context to the target subscription in which you'd like to deploy the solution.

### Connect to Azure PowerShell

```powershell
# Sign in Interactively
Connect-AzAccount

# Sign in with Device Code
Connect-AzAccount -UseDeviceAuthentication
```

### Set the Active Subscription for Azure PowerShell

```powershell
# Set Azure PowerShell Context
Set-AzContext -Subscription "<Target Subscription Name/GUID>"

# Example with Subscription ID
Set-AzContext -Subscription "28b502e2-323f-4e57-98db-743459176557"

# Example with Subscription Name
Set-AzContext -Subscription "Contoso IPAM Subscription"
```

For additional information on authenticating with Azure PowerShell, refer to the documentation [here](https://learn.microsoft.com/en-us/powershell/azure/authenticate-azureps)

## Authenticate to Azure CLI (Optional)

If you are using the `-PrivateACR` switch, you will need to be authenticated to the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) *in addition to* Azure PowerShell. This is because the deployment script will use the `az acr build` feature to build the application containers and push them into the private Azure Container Registry and the equivalent commands are current not available via Azure PowerShell.

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

# Example with Subscription ID
az account set --subscription "28b502e2-323f-4e57-98db-743459176557"

# Example with Subscription Name
az account set --subscription "Contoso IPAM Subscription"
```

For additional information on authenticating with Azure CLI, refer to the documentation [here](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli)

## Clone the Github Repo

```powershell
# Example using PowerShell for Windows
PS C:\> git clone https://github.com/Azure/ipam.git
PS C:\> cd .\ipam\deploy
PS C:\ipam\deploy> .\deploy.ps1 <OPTIONS>

# Example using PowerShell for Linux
PS /> git clone https://github.com/Azure/ipam.git
PS /> cd /ipam/deploy
PS /ipam/deploy> .\deploy.ps1 <OPTIONS>
```

## Full Deployment

To deploy the full solution, run the following from within the `deploy` directory:

```powershell
./deploy.ps1 -Location "westus3" 
 ```

You have the ability to pass optional flags to the deployment script:

| Parameter                                       | Description                                                               |
| :---------------------------------------------- | :------------------------------------------------------------------------ |
| `-UIAppName <name>`                             | Changes the name of the UI app registration                               |
| `-EngineAppName <name>`                         | Changes the name of the Engine app registration                           |
| `-Tags @{​​​​​​<tag> = '​<value>'; ​<tag> = '​<value>'}` | Attaches the hashtable as tags on the deployed IPAM resource group        |
| `-ResourceNames @{​​​​​​<resource1> = '​<name>'; ​<resource2> = '​<name>'}` | Overrides default resource names with custom names **<sup>1,2</sup>** |
| `-NamePrefix <prefix>`                          | Replaces the default resource prefix of "ipam" with an alternative prefix **<sup>3</sup>** |
| `-AsFunction`                                   | Deploys the engine container only to an Azure Function                    |
| `-PrivateACR`                                   | Deploys a private Azure Container Registry and builds the IPAM containers |

> **NOTE 1:** The required values will vary based on the deployment type.

> **NOTE 2:** This must include ALL required resource names as shown below. Please review the [Naming Rules And Restrictions For Azure Resources](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules) documentation to ensure your custom names are compliant and unique.

> **NOTE 3:** Maximum of seven (7) characters. This is because the prefix is used to generate names for several different Azure resource types with varying maximum lengths.

**Customize the Management Group that the App Registrions have access to. Default is Tenant Root Group:**

```powershell
./deploy.ps1 `
  -ManagementGroupID "my-custom-management-group"
  -Location "westus3" `
```

**Customize the name of the App Registrations:**

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

**Add custom tags to the Azure resources:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -Tags @{owner = 'ipamadmin@example.com'; environment = 'development'}
```

**Deploy IPAM solution as an Azure Function:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -AsFunction
```

**Deploy IPAM solution with a private Container Registry:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -PrivateACR
```

**Override default resource names with custom resource names:**

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

**Override default resource names with custom resource names and deploy as an Azure Function:**

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
  -ResourceNames $ResourceNames
  -PrivateACR
```

**Override default resource names with custom resource names and use a private Container Registry:**

```powershell
$ResourceNames = @{
  functionName = 'myfunction01'
  appServicePlanName = 'myappserviceplan01'
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
  -ResourceNames $ResourceNames
  -AsFunction
```

## App Registration Only Deployment

To deploy App Registrations only, run the following from within the `deploy` directory:

```powershell
./deploy.ps1 -AppsOnly
````

You have the ability to pass optional flags to the deployment script:

| Parameter               | Description                                                                                         |
| :---------------------- | :-------------------------------------------------------------------------------------------------- |
| `-UIAppName <name>`     | Changes the name of the UI app registration                                                         |
| `-EngineAppName <name>` | Changes the name of the Engine app registration                                                     |
| `-AsFunction`           | Indicates that this solution will be deployed as an Azure Function, no UI App Registration required |

**Customize the name of the App Registrations:**

```powershell
./deploy.ps1 `
  -AppsOnly `
  -UIAppName "my-ui-app-reg" `
  -EngineAppName "my-engine-app-reg"
```

**Deploy IPAM solution as an Azure Function:**

```powershell
./deploy.ps1 `
  -AppsOnly `
  -AsFunction
```

As part of the app registration deployment, a `main.parameters.json` file is generated with pre-populated parameters for the app registration IDs as well as the engine app registration secret. This parameter file will then be used to perform the infrastructure deployment.

## Infrastructure Stack (Only) Deployment

To deploy infrastructure only, ensure you have the auto-generated `main.parameters.json` file created by the [App Registration Only](#app-registration-only-deployment) deployment in your `deploy` directory. Alternatively, you can generate your own using `main.parameters.example.json` as an example template.

Once your parameters file is ready, run the following from within the `deploy` directory:

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json
 ```

You have the ability to pass optional flags to the deployment script:

| Parameter                                       | Description                                                               |
| :---------------------------------------------- | :------------------------------------------------------------------------ |
| `-Tags @{​​​​​​<tag> = '​<value>'; ​<tag> = '​<value>'}`​ | Attaches the hashtable as tags on the deployed IPAM resource group        |
| `-ResourceNames @{​​​​​​<resource1> = '​<name>'; ​<resource2> = '​<name>'}` | Overrides default resource names with custom names **<sup>1,2</sup>** |
| `-NamePrefix <prefix>`                          | Replaces the default resource prefix of "ipam" with an alternative prefix **<sup>3</sup>** |
| `-PrivateACR`                                   | Deploys a private Azure Container Registry and builds the IPAM containers |

> **NOTE 1:** The required values will vary based on the deployment type.

> **NOTE 2:** This must include ALL required resource names as shown below. Please review the [Naming Rules And Restrictions For Azure Resources](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules) documentation to ensure your custom names are compliant and unique.

> **NOTE 3:** Maximum of seven (7) characters. This is because the prefix is used to generate names for several different Azure resource types with varying maximum lengths.

**Add custom tags to the Azure resources:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -Tags @{owner = 'ipamadmin@example.com'; environment = 'development'}
```

**Change the name prefix for the Azure resources:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -NamePrefix "devipam"
```

**Deploy IPAM solution with a private Container Registry:**

```powershell
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -PrivateACR
```

**Override default resource names with custom resource names:**

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

**Override default resource names with custom resource names and use a private Container Registry:**

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
  -ResourceNames $ResourceNames
  -PrivateACR
```

**Override default resource names with custom resource names and deploy as an Azure Function:**

```powershell
$ResourceNames = @{
  functionName = 'myappservice01'
  appServicePlanName = 'myappserviceplan01'
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
  -ResourceNames $ResourceNames
```

> **NOTE:** Use this format when the `-AsFunction` flag was used during the *App Registration Only* step above
