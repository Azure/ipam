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

## Building and Running Your Own Container Images
The IPAM application code is available to you via this project. We do maintain and host both the engine and UI container images for you, but if you'd like to build your own images, here are instructions on how to do so.


### Engine Container
You can build a development or production image. To do so, run the following Docker commands from within the `engine` directory of this project.

To build a development image:
```shell
docker build --rm --no-cache -t ipam-engine -f Dockerfile.dev .
docker build --rm --build-arg PORT=8000 --no-cache -t ipam-engine -f Dockerfile.dev .
```
To build a production image:
```shell
docker build --rm --no-cache -t ipam-engine -f Dockerfile.prod .
docker build --rm --build-arg PORT=80 --no-cache -t ipam-engine -f Dockerfile.prod .
```
To run your container in development mode on Linux:
```shell
docker run -it --rm -v ${​​​​​​​​PWD}​​​​​​​​/app:/code/app --env-file .env -p 8000:80 ipam-engine:latest
```
To run your container in development mode on Windows:
```shell
docker run -it --rm -v %cd%/app:/code/app --env-file .env -p 8000:80 ipam-engine:latest
```
To push your container image to DockerHub:
```shell
docker tag ipam-engine <Repository Name>/ipam-engine:latest
docker push <Repository Name>/ipam-engine:latest
```
To push your container image to Azure Container Registry, run the following Azure CLI commands:
```shell
az login --use-device-code
az account set --subscription <Subscription ID>
az acr build -r <Azure Container Registry Name> -f .\Dockerfile.prod -t ipam-engine:latest .
```

### UI Container
You can build a development or production image. To do so, run the following Docker commands from within the `ui` directory of this project.

To build a development image:
```shell
docker build --rm --no-cache -t ipam-ui -f Dockerfile.dev .
docker build --rm --build-arg PORT=3000 --no-cache -t ipam-ui -f Dockerfile.dev .
```
To build a production image:
```shell
docker build --rm --no-cache -t ipam-ui -f Dockerfile.prod .
docker build --rm --build-arg PORT=80 --no-cache -t ipam-ui -f Dockerfile.prod .
```
To run your container in development mode on Linux:
```shell
docker run -it --rm -v ${​​​​​​​​PWD}​​​​​​​​/app:/code/app --env-file .env -p 3000:80 ipam-ui:latest
```
To run your container in development mode on Windows:
```shell
docker run -it --rm -v %cd%/app:/code/app --env-file .env -p 3000:80 ipam-ui:latest
```
To push your container image to DockerHub:
```shell
docker tag ipam-ui <Repository Name>/ipam-ui:latest
docker push <Repository Name>/ipam-ui:latest
```
To push your container image to Azure Container Registry, run the following Azure CLI commands:
```shell
az login --use-device-code
az account set --subscription <Subscription ID>
az acr build -r <Azure Container Registry Name> -f .\Dockerfile.prod -t ipam-ui:latest .
```
### Running an IPAM Development Environment with Docker Compose
We have included a Docker Compose file in the root directory of the project, `docker-compose.yml`, to run the complete solution easily. The Compose file is also dependant on an `env` file. You can use the `env.example` file, also found at the root directory of the project, as a template to create your own `env` file. 

To run a development environment of the IPAM solution via Docker Compose, run the following commands from the root directory of the project:
```shell
docker compose build --no-cache
docker compose up --force-recreate
docker compose rm -s -v -f
```
### Building Production Containers Images and Pushing them to DockerHub
We have included a Docker file at the root directory of the project, `Dockerfile`, so you can build and push the production containers all at once. 

To do so, run the following Docker commands from the root directory of the project:
 ```shell
docker build --rm --no-cache -t ipam .
docker tag ipam <Repository Name>/ipam:latest
docker push <Repository Name>/ipam:latest
```