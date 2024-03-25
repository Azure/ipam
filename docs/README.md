# Welcome to Azure IPAM

<!-- 
Guidelines on README format: https://review.docs.microsoft.com/help/onboard/admin/samples/concepts/readme-template?branch=master

Guidance on onboarding samples to docs.microsoft.com/samples: https://review.docs.microsoft.com/help/onboard/admin/samples/process/onboarding?branch=master

Taxonomies for products and languages: https://review.docs.microsoft.com/new-hope/information-architecture/metadata/taxonomies?branch=master
-->

## Overview and Architecture

Azure IPAM was developed to give customers a simple, straightforward way to manage their IP address space in Azure. It enables end-to-end planning, deploying, managing and monitoring of your IP address space, with an intuitive user experience. Additionally, it can automatically discover IP address utilization within your Azure tenant and enables you to manage it all from a centralized UI. You can also interface with the Azure IPAM service programmatically via a RESTful API to facilitate IP address management at scale via Infrastructure as Code (IaC) and CI/CD pipelines. Azure IPAM is designed and architected based on the 5 pillars of the [Microsoft Azure Well Architected Framework](https://docs.microsoft.com/azure/architecture/framework/).

| App Service                                                      | Function                                                                   |
|-----------------------------------------------------------------:|:---------------------------------------------------------------------------|
| ![IPAM Architecture](./images/ipam_architecture_full.png ':size=70%') | ![IPAM Architecture](./images/ipam_architecture_function.png ':size=70%') |

## Azure IPAM Infrastructure

The Azure IPAM solution is delivered via a container running in Azure App Services or as an Azure Function. It can also be deployed in an API-only fashion if no UI is required (e.g. pure IaC model). The container is built and published to a public Azure Container Registry (ACR), but you may also choose to build your own container and host it in a Private Container Registry. More details on this can be found in the [Deployment](./deployment/README.md) section. All of the supporting infrastructure is deployed and runs within your Azure Tenant and none of the resources are shared with other IPAM users (outside of the publicly hosted ACR).

Here is a more specific breakdown of the components used:

- **App Registrations**
  - 2x App Registrations
    - *Engine* App Registration
      - Granted **reader** permission to the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory) to facilitate IPAM Admin operations (global visibility)
      - Authentication point for IPAM API operations ([on-behalf-of](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow) flow)
    - *UI* App Registration *(Optional if no UI is desired)*
      - Granted **read** permissions for Microsoft Graph API's
      - Added as a *known client application* for the *Engine* App Registration
      - Authentication point for the IPAM UI ([auth code](https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow) flow)
- **Resource Group**
  - Contains all Azure IPAM deployed resources
- **App Service Plan with App Service** *(AppContainer Deployment only)*
  - Runs the Azure IPAM solution as a container within App Services
- **App Service Plan with Function App** *(FunctionContainer Deployment only)*
  - Runs the Azure IPAM solution as a container within Azure Functions
- **Storage Account with Blob Container** *(FunctionContainer Deployment only)*
  - Storage for the Azure Function metadata
- **Cosmos DB**
  - Backend NoSQL datastore for the IPAM application
- **KeyVault**
  - Stores the following secrets:
    - App Registration application IDs and Secrets (Engine & UI)
    - Managed Identity ID
    - Azure Tenant ID
- **User Assigned Managed Identity**
  - Assigned to the App Service to retrieve secrets from KeyVault
- **Container Registry** *(Optional)*
  - Stores a private copy of the Azure IPAM containers

## How Azure IPAM Works

Azure IPAM has been designed as such to radically simplify the often daunting task of IP address management within Azure and was built to accommodate use cases such as the following...

- Discover
  - Identify networks, subnets and endpoints holistically across your Azure tenant
  - Visualize misconfigurations such as orphaned endpoints and improperly configured virtual network peers
- Organize
  - Group Azure networks into *Spaces* and *Blocks* aligned to internal lines of business and enterprise CIDR assignments
  - Track IP and CIDR consumption
  - Map external (non-Azure) networks to Azure CIDR ranges
- Plan
  - Explore "what if" cases such as how may subnets of a given mask are available within a given CIDR block
- Self-Service
  - Allow users to reserve CIDR blocks for new virtual network and subnet creation programatically
  - Integration with Azure template deployments (ARM/Bicep), Terraform and CI/CD pipelines

## User Interface

The front end is written in [React](https://reactjs.org/) and leverages the [Material UI](https://mui.com/) for the UI components. The UI handles AuthN/AuthZ with AzureAD via [MSAL](https://learn.microsoft.com/azure/active-directory/develop/msal-overview), and manages token acquisition & refresh for communication to the backend Engine API (on your behalf).

## Backend Engine

The engine is written in [Python](https://www.python.org/) and leverages the [FastAPI Framework](https://fastapi.tiangolo.com/) for building the APIs. It handles interfacing with Azure Resource Graph on the user's behalf to gather information about various Azure Networking related resources, and their states.
