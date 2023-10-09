#!/bin/bash
PORT=$1

# Export IPAM UI Environment Variables
export VITE_AZURE_ENV=$AZURE_ENV
export VITE_UI_ID=$UI_APP_ID
export VITE_ENGINE_ID=$ENGINE_APP_ID
export VITE_TENANT_ID=$TENANT_ID

# Export IPAM Engine Environment Variables
export CLIENT_ID=$ENGINE_APP_ID
export CLIENT_SECRET=$ENGINE_APP_SECRET
export TENANT_ID=$TENANT_ID
export COSMOS_URL=$COSMOS_URL
export COSMOS_KEY=$COSMOS_KEY
export KEYVAULT_URL=$KEYVAULT_URL

# Pull Environment Variables from Parent Shell
eval $(printenv | sed -n "s/^\([^=]\+\)=\(.*\)$/export \1=\2/p" | sed 's/"/\\\"/g' | sed '/=/s//="/' | sed 's/$/"/' >> /etc/profile)

# Start the SSH Service
/usr/sbin/sshd

# Set Container OS Image as Environment Variable
test -e /etc/os-release && os_release='/etc/os-release' || os_release='/usr/lib/os-release'
. "${os_release}"

VITE_CONTAINER_IMAGE=${PRETTY_NAME}
export VITE_CONTAINER_IMAGE

# Create env.js File from Environment Variables
printenv | grep REACT_APP_ > /tmp/react_app_

while IFS='=' read -r name value;
do
  new_name=$(echo "$name" | sed "s/REACT_APP_/VITE_/g")
  export "$new_name=$value"
done < /tmp/react_app_

printenv | grep VITE_ > /tmp/vite_

echo "window.env = {" > env.js

while IFS='=' read -r name value;
do
  echo "  \"$name\": \"$value\"," >> env.js
done < /tmp/vite_

echo "}" >> env.js

mv env.js ./dist/

# Start the Uvicorn Server
uvicorn "app.main:app" --reload --host "0.0.0.0" --port ${PORT}
