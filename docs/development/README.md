# Development

This section covers working on Azure IPAM itself: running a local development
environment and building the container images. For the patterns to follow while
changing the code, see [Conventions](/conventions/README.md). For the process of
getting a change accepted, see [Contributing](/contributing/README.md).

## Running an Azure IPAM Development Environment with Docker Compose

We have included a Docker Compose file in the root directory of the project (`docker-compose.yml`), to quickly build a fully functional Azure IPAM development environment. The Docker Compose file is also dependent on an `.env` file to correctly pass all of the required environment variables into the containers. You can use the `.env.example` file, also found at the root directory of the project, as a template to create your own `.env` file.

To start a development environment of the Azure IPAM solution via Docker Compose, run the following commands from the root directory of the project:

```shell
# Build the Container Images
docker compose build --no-cache

# Start IPAM Development Environment
docker compose up --force-recreate

# Stop & Remove Containers when Finished
docker compose rm -s -v -f
```

## Building Production Containers Images and Pushing them to DockerHub

We use Dockerfiles to build the containers for the Azure IPAM solution and have three located in the root directory of the project. One is designed for use when running inside a solution such as Azure App Services (as well as other containerized environments), one specifically designed for running inside Azure Functions, and one for RHEL-based deployments. If you choose, you can build these containers yourself and host them in DockerHub.

To do so, run the following Docker commands from the root directory of the project:

```shell
# App Services Container (Debian)
docker build --rm --no-cache -t <Repository Name>/ipam:latest -f ./Dockerfile.deb .
docker push <Repository Name>/ipam:latest

# App Services Container (RHEL)
docker build --rm --no-cache -t <Repository Name>/ipam:latest -f ./Dockerfile.rhel .
docker push <Repository Name>/ipam:latest

# Function Container
docker build --rm --no-cache -t <Repository Name>/ipamfunc:latest -f ./Dockerfile.func .
docker push <Repository Name>/ipamfunc:latest
```

## Building & Updating Production Containers Images Using a Private ACR

In addition to the DockerHub option (above), alternatively you may choose to leverage an Azure Container Registry to host your Azure IPAM containers. Also, you may have selected the `-PrivateACR` flag during the deployment of your Azure IPAM environment, and from time to time you will need to update your containers as new code is released.

Before running the update commands, you'll need to authenticate to the Azure CLI

```shell
# Authenticate to Azure CLI
az login

# Set Target Azure Subscription
az account set --subscription "<Target Subscription Name/GUID>"
```

Next, use the following commands to update the Azure IPAM containers within your private Azure Container Registry

```shell
# App Services Container (Debian)
az acr build -r <ACR Name> -t ipam:latest -f ./Dockerfile.deb .

# App Services Container (RHEL)
az acr build -r <ACR Name> -t ipam:latest -f ./Dockerfile.rhel .

# Function Container
az acr build -r <ACR Name> -t ipamfunc:latest -f ./Dockerfile.func .
```

If you're using the legacy Azure IPAM multi-container deployment (prior to v3.0.0), please use the following commands to update your containers instead

```shell
# Engine Container
az acr build -r <ACR Name> -t ipam-engine:latest -f ./engine/Dockerfile.deb ./engine

# Function Container
az acr build -r <ACR Name> -t ipam-func:latest -f ./engine/Dockerfile.func ./engine

# UI Container
az acr build -r <ACR Name> -t ipam-ui:latest -f ./ui/Dockerfile.deb ./ui

# Load Balancer Container
az acr build -r <ACR Name> -t ipam-lb:latest -f ./lb/Dockerfile ./lb
```
