# syntax=docker/dockerfile:1
FROM node:16-slim AS builder

# Set Working Directory
WORKDIR /app

# Add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# Install UI Dependencies
COPY ./ui/package.json ./
COPY ./ui/package-lock.json ./

RUN npm install
RUN chmod 777 node_modules

# Copy UI Code
COPY ./ui/. ./

# Build IPAM UI
RUN npm run build

FROM python:3.9-slim

# Set Working Directory
WORKDIR /tmp

# Install OpenSSH and set the password for root to "Docker!"
RUN apt update
RUN apt install openssh-server -y \
      && echo "root:Docker!" | chpasswd 

# Enable SSH root login with Password Authentication
# RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/g' /etc/ssh/sshd_config

# Copy 'sshd_config File' to /etc/ssh/
COPY sshd_config /etc/ssh/

RUN ssh-keygen -A
RUN mkdir /var/run/sshd

# Install NodeJS 16.x
RUN apt install curl -y
RUN curl -sL https://deb.nodesource.com/setup_16.x -o nodesource_setup.sh
RUN bash ./nodesource_setup.sh
RUN apt install nodejs
RUN npm install -g react-inject-env

# Set Working Directory
WORKDIR /code

# Install Engine Dependencies
COPY ./engine/requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy Engine Code
COPY ./engine/app /code/app
COPY --from=builder /app/build ./app/build

# Copy Init Script
COPY ./init.sh /code

# Expose Ports
EXPOSE 80 2222

# Execute Init Script
CMD ["bash", "./init.sh"]

# CMD npx --yes react-inject-env set -d /code/app/build ; uvicorn "app.main:app" --reload --host "0.0.0.0" --port 80
