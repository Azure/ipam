## Contributing
This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

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