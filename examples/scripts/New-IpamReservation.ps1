# =====================================================================
# Azure IPAM - Create a CIDR Reservation via PowerShell
# =====================================================================
#
# This script demonstrates how to call the Azure IPAM Reservation API
# using Azure PowerShell. It creates a reservation of the specified
# size in the given Space and Block, and returns the reserved CIDR
# and reservation ID.
#
# The reservation ID should be applied as a tag (X-IPAM-RES-ID) on
# the Azure virtual network created with the reserved CIDR. Azure IPAM
# will automatically detect the tag and settle the reservation.
#
# For more information, see:
#   - API Documentation:  https://azure.github.io/ipam/#/api/README
#   - Automation Patterns: https://azure.github.io/ipam/#/automation/README
#
# Prerequisites:
#   - Azure PowerShell (Az module)
#   - An authenticated Azure session (Connect-AzAccount)
# =====================================================================

# --- Configuration ---
$engineClientId  = '<Engine App Registration Client ID>'
$ipamEndpoint    = 'https://<your-ipam-app>.azurewebsites.net'
$space           = 'ExampleSpace'
$block           = 'ExampleBlock'
$reservationSize = 24  # CIDR mask size (e.g. 24 = /24)

# --- Authenticate ---
$accessToken = ConvertTo-SecureString `
    (Get-AzAccessToken -ResourceUrl "api://$engineClientId").Token `
    -AsPlainText

$headers = @{
    'Accept'       = 'application/json'
    'Content-Type' = 'application/json'
}

# --- Create Reservation ---
$body = @{
    size = $reservationSize
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Method 'Post' `
    -Uri "$ipamEndpoint/api/spaces/$space/blocks/$block/reservations" `
    -Authentication 'Bearer' `
    -Token $accessToken `
    -Headers $headers `
    -Body $body

# --- Output ---
Write-Output "Reserved CIDR : $($response.cidr)"
Write-Output "Reservation ID: $($response.id)"
Write-Output ""
Write-Output "Apply the following tag to your virtual network:"
Write-Output "  X-IPAM-RES-ID = $($response.id)"
