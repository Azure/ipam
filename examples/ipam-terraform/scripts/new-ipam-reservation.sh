#!/bin/bash

# REQUIREMENTS:
# JQ: sudo apt install jq
# Azure CLI: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Set execute permissions on script
# chmod +x new-ipam-reservation.sh

eval "$(jq -r '@sh "apiGuid=\(.apiGuid) appName=\(.appName) ipamSpace=\(.ipamSpace) ipamBlock=\(.ipamBlock) vnetSize=\(.vnetSize)"')"

token=$(az account get-access-token \
    --resource api://${apiGuid} \
    --query accessToken \
    --output tsv)

# Could use this to get just the token as an output instead
# echo $token | jq -r '. | {token: .accessToken}'

resv=$(curl -X POST https://${appName}.azurewebsites.net/api/spaces/${ipamSpace}/blocks/${ipamBlock}/reservations \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{ \""size\"": ${vnetSize} }" \
    -s)

echo $resv | jq -r '. | {id: .id, cidr: .cidr}'
