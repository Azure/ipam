# Welcome to IPAM!

<!-- 
Guidelines on README format: https://review.docs.microsoft.com/help/onboard/admin/samples/concepts/readme-template?branch=master

Guidance on onboarding samples to docs.microsoft.com/samples: https://review.docs.microsoft.com/help/onboard/admin/samples/process/onboarding?branch=master

Taxonomies for products and languages: https://review.docs.microsoft.com/new-hope/information-architecture/metadata/taxonomies?branch=master
-->

## IPAM Overview and Architecture
IPAM was developed to give customers a simple, straightforward way to manage their IP address space in Azure.  IPAM enables end-to-end planning, deploying, managing and monitoring of your IP address space, with an intuitive user experience. IPAM automatically discovers IP address utilization in your Azure tenant and enables you to manage it all from a central user interface. You can also interface with IPAM programatically via a REST API to facilitate IP address management at scale via Infrastructure as Code. IPAM is designed and architected based on the 5 pillars of the [Microsoft Azure Well Architected Framework](https://docs.microsoft.com/en-us/azure/architecture/framework/). 

![IPAM Architecture](./images/ipam_architecture.png ':size=70%')

### IPAM Infrastructure
There are two major components to the IPAM solution. The first is the two container images that make up the IPAM application. These containers are maintained and hosted by the IPAM team. They are housed in a publicly accessible Azure Container Registry. The deployment workflow knows where and how to retrieve the container images. That being said, the application code is available in this project, so you can build your own container images if you'd like. More on that in the [Contributing](./contributing/README.md) section. The second component of the solution is the infrastructure to run the application which is maintained and hosted by you. This component is made up of the following: 

- **App Registrations**
  - two App Registrations are deployed as part of the solution:
    - engine app registration, used to:
      - expose the backend engine portion of the application
      - perform Resource Graph calls for retrieving IP address utilization information. This App Registration is granted the "Reader" role at the Tenant Root level in order to perform said Resource Graph calls on the user's behalf. More on this in our How-To section
    - UI app registration, used to:
      - expose the single page front end application
      - handle authentication requests to Azure AD on behalf of the user
      - handle authorization request to the backend engine on behalf of the user
- **Resource Group** 
  - to house all Azure infrastructure related resources
- **App Service Plan with App Service**
  - to run the two containers that make up the IPAM application or...
- **App Service Plan with Function App**
  - to run the backend engine container as an Azure Function
- **Storage Account with Blob Container**
  - to store NGINX related configuration data
- **Cosmos DB**
  - used as the backend data store for the IPAM application
- **Key Vault**
  - to store the following secrets:
    - App Registration application IDs and passwords
    - Cosmos DB read-write key
    - Azure Tenant ID
- **User Assigned Managed Identity**
  - used by App Service to retrieve secrets from Key Vault and NGINX configuration data from the Storage Account

## How IPAM Works

As mentioned above, the IPAM application is made up of two containers, one that runs the front end user interface, and the other that runs the backend engine. We designed IPAM as such to accomodate the following use cases...
- A user interface is not needed or you plan on providing your own user interface
- You plan on interfacing with IPAM exclusively via the REST API.
- You plan on running the backend engine in a lighter weight fashion such as Azure Funtions or Azure Container Instances

### The User Interface Container
The front end is written in [Node.js](https://nodejs.org/en/) and we leverage the [React JavaScript Library](https://reactjs.org/) for the user interface. It handles interfacing with Azure AD from an Authentication/Authorization to ensure data presented is based on the user's Azure RBAC context. 

### The Backend Engine Container
The engine is written in [Python](https://www.python.org/) and we leverage the [FastAPI Framework](https://fastapi.tiangolo.com/) for building the APIs. It handles interfacing with Azure Resource Graph on the user's behalf to perform all Azure Networking Resource related calls. 