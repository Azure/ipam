# Welcome to Azure IPAM

## Overview and Architecture

Azure IPAM gives you a simple way to plan, deploy, manage and monitor the IP address space you use in Azure. It discovers how IP addresses are used across your Azure tenant, and lets you manage it all from one UI. You can also use its REST API to manage IP addresses at scale from infrastructure as code (IaC) and CI/CD pipelines. Azure IPAM is designed around the five pillars of the [Microsoft Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/).

| App Service Deployment                                                    | Function Deployment                                                        |
|-----------------------------------------------------------------:|:---------------------------------------------------------------------------|
| ![App Service Architecture](./images/ipam_architecture_full.png ':size=70%') | ![Function Architecture](./images/ipam_architecture_function.png ':size=70%') |

## Azure IPAM Infrastructure

Azure IPAM runs as a container in an App Service or a Function App. You can also deploy it without the UI, for example when you only use it from infrastructure as code. We publish the container image to a public registry, or you can build your own image and host it in a private Azure Container Registry. For details, see [Deployment](/deployment/README.md). All of the supporting infrastructure is deployed to and runs in your own Azure tenant, and none of it is shared with other Azure IPAM users, apart from the public registry.

Azure IPAM uses the following components:

- **App registrations**
  - Two app registrations:
    - The *Engine* app registration
      - Assigned the **Reader** role on the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory), so Azure IPAM can see every Azure resource for administrators and for its own work
      - Authenticates calls to the Azure IPAM API ([on-behalf-of](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow)
      - Authenticates to Azure with a client secret that must be renewed before it expires (see [Maintenance](/maintenance/README.md))
    - The *UI* app registration *(not needed without the UI)*
      - Granted **read** permissions for Microsoft Graph APIs
      - Added as a *known client application* of the *Engine* app registration
      - Signs users in to the Azure IPAM UI ([auth code](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow) flow)
- **Resource group**
  - Contains all of the Azure IPAM resources
- **App Service plan with an App Service** *(App Service deployments only)*
  - Runs the Azure IPAM container in App Service
- **App Service plan with a Function App** *(Function App deployments only)*
  - Runs the Azure IPAM container in Azure Functions
- **Storage account with a blob container** *(Function App deployments only)*
  - Stores the Function App's metadata
- **Cosmos DB**
  - The NoSQL database for Azure IPAM's data
- **Key Vault**
  - Stores the following secrets:
    - Engine app registration ID and secret
    - UI app registration ID
    - Managed identity ID
    - Azure tenant ID
- **Log Analytics workspace**
  - Collects diagnostic logs from Key Vault, Cosmos DB, and the App Service or Function App
- **User-assigned managed identity**
  - Assigned to the App Service or Function App, which uses it to read secrets from Key Vault and to access Cosmos DB
- **Container registry** *(optional)*
  - Stores a private copy of the Azure IPAM container images

## How Azure IPAM Works

Azure IPAM is designed to simplify IP address management in Azure, which is often a daunting task. It was built for use cases such as the following:

- Discover
  - Find networks, subnets and endpoints across your whole Azure tenant
  - Spot misconfigurations, such as orphaned endpoints and incorrectly configured virtual network peerings
- Organize
  - Group Azure networks into [*Spaces*](/how-to/README.md#spaces) and [*Blocks*](/how-to/README.md#blocks) that match your lines of business and enterprise CIDR assignments
  - Track how IP addresses and CIDR ranges are used
  - Map [external (non-Azure) networks](/how-to/README.md#external-networks) into your Blocks, including on-premises datacenters, co-location facilities and other cloud providers
  - Track external subnets and individual endpoints, for a complete view of your IP addresses
- Plan
  - Explore "what if" questions, such as how many subnets of a given size are available in a CIDR range
- Self-service
  - Let users reserve CIDR ranges for new virtual networks and subnets, including from code
  - Integrate with Azure template deployments (ARM and Bicep), Terraform and CI/CD pipelines

## User Interface

The UI is written in [React](https://react.dev/) and uses [Material UI](https://mui.com/) for its components. It signs users in with Microsoft Entra ID through [MSAL](https://learn.microsoft.com/entra/identity-platform/msal-overview), and gets and refreshes the tokens it uses to call the Engine API on the user's behalf.

## Backend Engine

The Engine is written in [Python](https://www.python.org/) and uses the [FastAPI](https://fastapi.tiangolo.com/) framework for its API. It queries Azure Resource Graph, either on the user's behalf or as itself, for information about Azure networking resources and their state.
