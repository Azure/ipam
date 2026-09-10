#!/bin/bash
# =====================================================================
# Azure IPAM - Get an Access Token via Bash
# =====================================================================
#
# This script demonstrates how to obtain a bearer token for the Azure
# IPAM Engine API using the Azure CLI. The token can then be used in
# subsequent API calls.
#
# For more information, see:
#   - API Documentation:   https://azure.github.io/ipam/#/api/README
#   - Automation Patterns: https://azure.github.io/ipam/#/automation/README
#
# Prerequisites:
#   - Azure CLI (az)
#   - An authenticated Azure CLI session (az login)
# =====================================================================

set -euo pipefail

# --- Configuration (edit these) ---
API_SCOPE="<Engine App Registration Client ID>"

# --- Get Token ---
token=$(az account get-access-token \
    --resource "api://${API_SCOPE}" \
    --query accessToken \
    --output tsv)

echo "${token}"
