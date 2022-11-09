#!/bin/bash

# REQUIREMENTS:
# JQ: sudo apt install jq
# Azure CLI: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Set execute permissions on script
# chmod +x get-ipam-token.sh

eval "$(jq -r '@sh "apiGuid=\(.apiGuid)"')"

token=$(az account get-access-token \
    --resource api://${apiGuid} \
    --query accessToken \
    --output tsv)

echo $token | jq -r '. | {token: .accessToken}'
