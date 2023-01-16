# Welcome to IPAM!

<!-- 
Guidelines on README format: https://review.docs.microsoft.com/help/onboard/admin/samples/concepts/readme-template?branch=master

Guidance on onboarding samples to docs.microsoft.com/samples: https://review.docs.microsoft.com/help/onboard/admin/samples/process/onboarding?branch=master

Taxonomies for products and languages: https://review.docs.microsoft.com/new-hope/information-architecture/metadata/taxonomies?branch=master
-->

## Overview and Architecture
IPAM was developed to give customers a simple, straightforward way to manage their IP address space in Azure.  IPAM enables end-to-end planning, deploying, managing and monitoring of your IP address space, with an intuitive user experience. IPAM automatically discovers IP address utilization in your Azure tenant and enables you to manage it all from a centralized UI. You can also interface with IPAM programmatically via a RESTful API to facilitate IP address management at scale via Infrastructure as Code (IaC). IPAM is designed and architected based on the 5 pillars of the [Microsoft Azure Well Architected Framework](https://docs.microsoft.com/en-us/azure/architecture/framework/).

| Full (App Service)                                               | Function                                                                   |
:-----------------------------------------------------------------:|:---------------------------------------------------------------------------:
| ![IPAM Architecture](./images/ipam_architecture_full.png ':size=70%') | ![IPAM Architecture](./images/ipam_architecture_function.png ':size=70%') |

## IPAM Infrastructure
The IPAM solution is comprised of containers running on Azure App Services. IPAM can also be deployed in an API-only fashion with an Azure Function if no UI is required (e.g. pure IaC model). The containers are built and published to a public Azure Container Registry (ACR), but you may also choose to build your own containers and host them in your own registry. More details on this can be found in the [Contributing](./contributing/README.md) section. All of the supporting infrastructure is deployed and runs within your Azure Tenant, none of the resources are shared with other IPAM users (outside of the public ACR).

Here is a more specific breakdown of the components used:

- **App Registrations**
  - 2x App Registrations
    - *Engine* App Registration
      - Granted **reader** permission to the root management group to facilitate IPAM Admin operations (global visibility)
      - Authentication point for IPAM API operations ([on-behalf-of](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow) flow)
    - *UI* App Registration
      - Granted **read** permissions for Microsoft Graph API's
      - Added as a *known client application* for the *Engine* App Registration
      - Authentication point for the IPAM UI ([auth code](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow) flow)
- **Resource Group**
  - House all Azure infrastructure related resources
- **App Service Plan with App Service**
  - Run the IPAM Engine & UI containers or...
- **App Service Plan with Function App**
  - Run IPAM Engine as an Azure Function
- **Storage Account with Blob Container**
  - When deployed as an App Service, this account stores the NGINX related configuration data
  - When deployed as an Azure Function, this account stores the Function metadata
- **Cosmos DB**
  - Backend NoSQL datastore for the IPAM application
- **KeyVault**
  - Stores the following secrets:
    - App Registration application IDs and Secrets (Engine & UI)
    - Cosmos DB read-write key
    - Azure Tenant ID
- **User Assigned Managed Identity**
  - Assigned to the App Service to retrieve secrets from KeyVault and NGINX configuration data from the Storage Account

## How IPAM Works

As mentioned above, the IPAM application is made up of two containers, one that runs the front end user interface, and the other that runs the backend engine. IPAM has been designed as such to accommodate the following use cases...

- A user interface is not needed or you plan on providing your own user interface (API-only)
- You plan on interfacing with IPAM exclusively via the RESTful API
- You plan on running the backend engine in a lightweight fashion, such as Azure Functions or Azure Container Instances

## User Interface

The front end is written in [React](https://reactjs.org/) and we leverage the [Material UI](https://mui.com/) for the UI components. The UI handles AuthN/AuthZ with AzureAD via [MSAL](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-overview), and manages token acquisition & refresh for communication to the backend Engine API (on your behalf).

## Backend Engine

The engine is written in [Python](https://www.python.org/) and we leverage the [FastAPI Framework](https://fastapi.tiangolo.com/) for building the APIs. It handles interfacing with Azure Resource Graph on the user's behalf to gather information about various Azure Networking related resources, and their states.
