#!/bin/bash
PORT=$1

# Export IPAM Engine Environment Variables
export CLIENT_ID=$ENGINE_APP_ID
export CLIENT_SECRET=$ENGINE_APP_SECRET
export TENANT_ID=$TENANT_ID
export COSMOS_URL=$COSMOS_URL
export COSMOS_KEY=$COSMOS_KEY
export KEYVAULT_URL=$KEYVAULT_URL

# Pull Environment Variables from Parent Shell
eval $(printenv | sed -n "s/^\([^=]\+\)=\(.*\)$/export \1=\2/p" | sed 's/"/\\\"/g' | sed '/=/s//="/' | sed 's/$/"/' >> /etc/profile)

# Start the Uvicorn Server
uvicorn "app.main:app" --reload --host "0.0.0.0" --port ${PORT}
