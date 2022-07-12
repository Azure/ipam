## IPAM Deployment Overview

### Prerequisites
To successfully deploy the solution, the following prerequisites must be met:
- An Azure Subscription to deploy the solution to
- The following Azure RBAC Roles:
    - Owner at the above mentioned Subscription scope
    - User Access Aministrator at the Tenant scope (needed to grant app registrations and managed identity RBAC permissions)
    - Global Administrator (needed if you will be handling app registration deployment)
- PowerShell version 7.2.4 or later installed
- Azure PowerShell version 7.5.0 or later installed
- Bicep CLI version 0.6.18 or later installed
- Docker Desktop installed (only needed if youare building your own container images and running them locally)
- Azure CLI version 2.37.0 or later installed (only needed if you are building your own container images and pushing them to Azure Container Registry)


### Deploying the Solution:
The IPAM solution is deployed via a PowerShell deployment script, `deploy.ps1`,  found in the `deploy` directory of the project. The infrastructure stack is defined via Azure Bicep files. The deployment can be performed via your local machine or from the development container found in the project. You have the following 3 options for deployment:
- deploy app registrations only
- deploy infrastructure stack only
- deploy the entire solution (app registrations + infrastructure stack)

The above mentioned deployment options were provided in the event that you do not have the necessary permissions in Azure AD to deploy app registrations. This way, you can have your Azure AD administrator deploy the app registrations and then you can perform the infrastructure deployment. If you do have the necessary permissions in Azure AD, then you have the option to deploy the entire solution on your own. 

### App Registration Deployment
To deploy App Registrations only, run the following from within the `deploy` directory:

```ps1
./deploy.ps1 -AppsOnly
````

You have the ability to pass optional flags to the deployment script:
  - -UIAppName "ipam-ui-example" (changes the name of the UI app registration)
  - -EngineAppName "ipam-engine-example" (changes the name of the Engine app registration)
  - -NoConsent (skips granting admin consent of the ui & engine app registrations)
  - -SubscriptionScope (attaches the engine service principal as a reader to the current subscription from Get-AzContext instead of the Tenant root)

```ps1
./deploy.ps1 `
  -AppsOnly `
  -UIAppName "my-ui-app-reg" `
  -EngineAppName "my-engine-app-reg" `
  -NoConsent `
  -SubscriptionScope
```
As part of the app registration deployment, a `main.parameters.json` file is generated with pre-populated parameters for the app registration IDs as well as the engine app registration secret. This parameter file will then be used to perform the infrastructure deployment.

### Infrastructure Stack Deployment
To deploy infrastructure only, ensure you have the auto-generated `main.parameters.json` file created by the app registration deployment in your `deploy` directory or, alternatively, you can generate your own using `main.parameters.example.json` as an example template. Then run the following from within the `deploy` directory:

```ps1
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -TemplateOnly
 ```

You have the ability to pass optional flags to the deployment script:
  - -Tags @{​​​​​​​tagKey1 = 'tagValue1'; tagKey2 = 'tagValue2'}​​​​​​​​ (attaches the hashtable as tags on the deployed IPAM resource group)
  - -NamePrefix "testipam" (replaces the default resource prefix of "ipam" with an alternative prefix)

```ps1
./deploy.ps1 `
  -Location "westus3" `
  -ParameterFile ./main.parameters.json `
  -TemplateOnly `
  -Tags @{owner = 'ipamadmin@example.com'; environment = 'development'} `
  -NamePrefix "devipam"
```
### Full Deployment
To deploy the full solution, run the following from within the `deploy` directory:

```ps1
./deploy.ps1 -Location "westus3" 
 ```

You have the ability to pass optional flags to the deployment script:
  - -UIAppName "ipam-ui-example" (changes the name of the UI app registration)
  - -EngineAppName "ipam-engine-example" (changes the name of the Engine app registration)
  - -NoConsent (skips granting admin consent of the ui & engine app registrations)
  - -SubscriptionScope (attaches the engine service principal as a reader to the current subscription from Get-AzContext instead of the Tenant root)
  - -Tags @{​​​​​​​tagKey1 = 'tagValue1'; tagKey2 = 'tagValue2'}​​​​​​​​ (attaches the hashtable as tags on the deployed IPAM resource group)
  - -NamePrefix "testipam" (replaces the default resource prefix of "ipam" with an alternative prefix)


```ps1
./deploy.ps1 `
  -Location "westus3" `
  -UIAppName "my-ui-app-reg" `
  -EngineAppName "my-engine-app-reg" `
  -NoConsent `
  -SubscriptionScope `
  -Tags @{owner = 'ipamadmin@example.com'; environment = 'development'} `
  -NamePrefix "devipam"
```
