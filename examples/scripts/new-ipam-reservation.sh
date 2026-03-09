#!/bin/bash
# =====================================================================
# Azure IPAM - Create a CIDR Reservation via Bash
# =====================================================================
#
# This script demonstrates how to call the Azure IPAM Reservation API
# using the Azure CLI and curl. It creates a reservation of the
# specified size in the given Space and Block, and prints the reserved
# CIDR and reservation ID.
#
# The reservation ID should be applied as a tag (X-IPAM-RES-ID) on
# the Azure virtual network created with the reserved CIDR. Azure IPAM
# will automatically detect the tag and settle the reservation.
#
# For more information, see:
#   - API Documentation:   https://azure.github.io/ipam/#/api/README
#   - Automation Patterns: https://azure.github.io/ipam/#/automation/README
#
# Prerequisites:
#   - Azure CLI (az)
#   - jq
#   - An authenticated Azure CLI session (az login)
# =====================================================================

set -euo pipefail

# --- Configuration (edit these) ---
API_SCOPE="<Engine App Registration Client ID>"
IPAM_ENDPOINT="https://<your-ipam-app>.azurewebsites.net"
SPACE="ExampleSpace"
BLOCK="ExampleBlock"
SIZE=24  # CIDR mask size (e.g. 24 = /24)

# --- Authenticate ---
token=$(az account get-access-token \
    --resource "api://${API_SCOPE}" \
    --query accessToken \
    --output tsv)

# --- Create Reservation ---
response=$(curl -sS -X POST \
    "${IPAM_ENDPOINT}/api/spaces/${SPACE}/blocks/${BLOCK}/reservations" \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{\"size\": ${SIZE}}")

# --- Output ---
echo "${response}" | jq '{id: .id, cidr: .cidr}'

echo ""
echo "Apply the following tag to your virtual network:"
echo "  X-IPAM-RES-ID = $(echo "${response}" | jq -r '.id')"
