# Development

This page covers working on Azure IPAM itself: running a local development
environment and building the container images. For the patterns to follow while
changing the code, see [Conventions](/conventions/README.md). For the process of
getting a change accepted, see [Contributing](/contributing/README.md).

## Running an Azure IPAM Development Environment with Docker Compose

The root of the repository has a Docker Compose file, `docker-compose.yml`, that builds a complete Azure IPAM development environment. It reads the environment variables the containers need from a `.env` file. To create yours, copy `.env.example`, also in the root of the repository, to `.env` and fill in the values.

To start the development environment, run the following from the root of the repository:

```bash
# Build the Container Images
docker compose build --no-cache

# Start the Development Environment
docker compose up --force-recreate

# Stop and Remove the Containers When Finished
docker compose rm -s -v -f
```

## Building Production Container Images and Pushing Them to Docker Hub

The root of the repository has three Dockerfiles:

- **`Dockerfile.deb`:** the Debian-based image for App Service and other container platforms
- **`Dockerfile.rhel`:** the Red Hat Enterprise Linux (RHEL) based image for the same platforms
- **`Dockerfile.func`:** the image for Azure Functions

To build these images yourself and host them on Docker Hub, run the following from the root of the repository:

```bash
# App Service Container (Debian)
docker build --rm --no-cache -t "<docker-hub-namespace>/ipam:latest" -f ./Dockerfile.deb .
docker push "<docker-hub-namespace>/ipam:latest"

# App Service Container (RHEL)
docker build --rm --no-cache -t "<docker-hub-namespace>/ipam:latest" -f ./Dockerfile.rhel .
docker push "<docker-hub-namespace>/ipam:latest"

# Function Container
docker build --rm --no-cache -t "<docker-hub-namespace>/ipamfunc:latest" -f ./Dockerfile.func .
docker push "<docker-hub-namespace>/ipamfunc:latest"
```

## Building and Updating Production Container Images Using a Private ACR

You can also host the Azure IPAM images in your own Azure Container Registry. If you deployed Azure IPAM with `-PrivateACR`, its images are already there, and you need to rebuild them when a new version is released.

The [update script](/update/README.md) rebuilds them for you when the registry is in the same resource group as the App Service or Function App. Use the following commands when it isn't, or when you want to build the images yourself.

First, sign in to Azure CLI:

```bash
# Sign in to Azure CLI
az login

# Set the Target Subscription
az account set --subscription "<subscription-name-or-id>"
```

Then run the following from the root of the repository to build the images in your registry:

```bash
# App Service Container (Debian)
az acr build -r "<your-ipam-acr>" -t ipam:latest -f ./Dockerfile.deb .

# App Service Container (RHEL)
az acr build -r "<your-ipam-acr>" -t ipam:latest -f ./Dockerfile.rhel .

# Function Container
az acr build -r "<your-ipam-acr>" -t ipamfunc:latest -f ./Dockerfile.func .
```

Restart the App Service or Function App afterwards, so it pulls the new image.

If you're using the legacy multi-container deployment from before v3.0.0, use the following commands to update its images instead:

```bash
# Engine Container
az acr build -r "<your-ipam-acr>" -t ipam-engine:latest -f ./engine/Dockerfile.deb ./engine

# Function Container
az acr build -r "<your-ipam-acr>" -t ipam-func:latest -f ./engine/Dockerfile.func ./engine

# UI Container
az acr build -r "<your-ipam-acr>" -t ipam-ui:latest -f ./ui/Dockerfile.deb ./ui

# Load Balancer Container
az acr build -r "<your-ipam-acr>" -t ipam-lb:latest -f ./lb/Dockerfile ./lb
```

> **IMPORTANT:** The legacy multi-container deployment runs on Docker Compose, which App Service retires on March 31, 2027. Move to the current deployment by following the [Azure IPAM Legacy Migration Guide](/migration/README.md).
