# Azure Landing Zone with IPAM Integration

This example demonstrates how to integrate Azure IPAM into a landing zone deployment using Bicep. It automates the full **reserve → deploy → tag** workflow:

1. **Reserve** — A Bicep deployment script calls the Azure IPAM API to reserve a CIDR block of the requested size.
2. **Deploy** — The reserved CIDR is used as the address space for a new Azure virtual network.
3. **Tag** — The virtual network is tagged with the IPAM reservation ID (`X-IPAM-RES-ID`), which allows Azure IPAM to automatically detect and settle the reservation.

## Architecture

The deployment creates two resource groups and the following resources:

| Resource Group | Resources |
|----------------|-----------|
| `{prefix}-SharedSvcs-rg` | User-Assigned Managed Identity, Log Analytics Workspace, Key Vault |
| `{prefix}-NetworkSvcs-rg` | Deployment Script (IPAM reservation), Virtual Network |

The managed identity is used by the deployment script to authenticate against the Azure IPAM API. It requires `Contributor` on the network services resource group (a [documented requirement](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deployment-script-bicep) for Bicep deployment scripts).

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) or [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell)
- [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install) v0.21.1 or later
- A running Azure IPAM instance with at least one Space and Block configured
- The managed identity must be granted access to the Azure IPAM Engine API (see [Authentication](../../docs/api/README.md))

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `landingZonePrefix` | `string` | Yes | Prefix used for all resource names |
| `location` | `string` | No | Azure region (defaults to deployment location) |
| `ipamApiScope` | `string` | Yes | API scope for the IPAM Engine App Registration (e.g., `api://<client-id>`) |
| `ipamEndpoint` | `string` | Yes | Base URL of your IPAM instance (e.g., `https://myipam.azurewebsites.net`) |
| `ipamSpace` | `string` | Yes | IPAM Space containing the target Block |
| `ipamBlock` | `string` | Yes | IPAM Block to reserve address space from |
| `reservationSize` | `int` | No | CIDR mask size for the reservation (default: `24`) |

## Deployment

```bash
az deployment sub create \
  --location eastus \
  --template-file main.bicep \
  --parameters \
    landingZonePrefix='contoso' \
    ipamApiScope='api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' \
    ipamEndpoint='https://myipam.azurewebsites.net' \
    ipamSpace='CoreNetworking' \
    ipamBlock='EastUS' \
    reservationSize=24
```

## Files

| File | Description |
|------|-------------|
| `main.bicep` | Subscription-scoped orchestrator |
| `fetchAddressPrefix.bicep` | Deployment script that calls the IPAM reservation API |
| `vnet.bicep` | Virtual network with IPAM reservation tag |
| `managedIdentity.bicep` | User-assigned managed identity |
| `keyVault.bicep` | Key Vault with Azure RBAC authorization |
| `logAnalytics.bicep` | Log Analytics workspace |

## Standalone Script Examples

The [`examples/scripts/`](../scripts/) directory contains standalone Bash and PowerShell scripts for calling the Azure IPAM API outside of a Bicep or Terraform deployment.

## Related Documentation

- [Automation Patterns](../../docs/automation/README.md) — Common patterns for integrating Azure IPAM into automated workflows
- [API Documentation](../../docs/api/README.md#reservations) — Reservation API endpoints and examples
- [How-To: Reservations](../../docs/how-to/README.md#reservations) — Managing reservations through the UI
