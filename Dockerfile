# registry.access.redhat.com/ubi8/nodejs-18
# registry.access.redhat.com/ubi8/python-39

ARG BUILD_IMAGE=node:18-slim
ARG SERVE_IMAGE=python:3.9-slim

FROM $BUILD_IMAGE AS builder

ARG PORT=8080

# Set Environment Variable
ENV PORT=${PORT}

# Set the Working Directory
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

FROM $SERVE_IMAGE

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

# Set Working Directory
WORKDIR /ipam

# Install Engine Dependencies
COPY ./engine/requirements.txt /code/requirements.txt

# Upgrade PIP
RUN pip install --upgrade pip --progress-bar off

# Install Dependencies
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy Engine Code
COPY ./engine/app ./app
COPY --from=builder /app/dist ./dist

# Copy Init Script
COPY ./init.sh .

# Set Script Execute Permissions
RUN chmod +x init.sh

# Expose Ports
EXPOSE $PORT 2222

# Execute Startup Script
ENTRYPOINT ./init.sh ${PORT}
