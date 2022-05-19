# syntax=docker/dockerfile:1
ARG VARIANT=16-bullseye
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:${VARIANT} AS builder

# set working directory
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install ui dependencies
COPY ./ui/package.json ./
COPY ./ui/package-lock.json ./

RUN npm install
RUN chmod 777 node_modules

# copy ui code
COPY ./ui/. ./

# build ui
RUN npm run build

FROM python:3.9

WORKDIR /tmp

RUN curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh
RUN bash ./nodesource_setup.sh
RUN apt install nodejs
RUN npm install -g react-inject-env

WORKDIR /code

COPY ./engine/requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./engine/app /code/app
COPY --from=builder /app/build ./app/build

COPY ./init.sh /code

EXPOSE 80

# CMD npx --yes react-inject-env set -d /code/app/build ; uvicorn "app.main:app" --reload --host "0.0.0.0" --port 80

# ENTRYPOINT npx --yes react-inject-env set -d /code/app/build

# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]

# CMD uvicorn "app.main:app" --reload --host "0.0.0.0" --port 80

CMD ["bash", "./init.sh"]
>>>>>>> cdd97baf41191e33a02c4d7de0b2faba8c91fc66
