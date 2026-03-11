# Terraform with IPAM Reservation

This example demonstrates how to integrate Azure IPAM into a Terraform deployment using the community [Azure IPAM Terraform provider](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs). It automates the full **reserve → deploy → tag** workflow:

1. **Reserve** — The `azureipam_reservation` resource claims a CIDR block of the requested size from Azure IPAM.
2. **Deploy** — The reserved CIDR is used as the address space for a new Azure virtual network.
3. **Tag** — The reservation's auto-generated tags (including `X-IPAM-RES-ID`) are applied to the virtual network, allowing Azure IPAM to automatically settle the reservation.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.4.0
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (used to obtain an access token)
- An authenticated Azure CLI session (`az login`)
- A running Azure IPAM instance with at least one Space and Block configured

## Providers

| Provider | Source | Version |
|----------|--------|---------|
| [azurerm](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs) | `hashicorp/azurerm` | `~> 3.0` |
| [azureipam](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) | `xtratuscloud/azureipam` | `~> 2.0` |

## Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `location` | `string` | Yes | Azure region for the deployment |
| `rg_name` | `string` | Yes | Resource group name |
| `vnet_name` | `string` | Yes | Virtual network name |
| `vnet_size` | `number` | No | CIDR mask size for the reservation (default: `24`) |
| `ipam_space` | `string` | Yes | IPAM Space containing the target Block |
| `ipam_block` | `string` | Yes | IPAM Block to reserve address space from |
| `ipam_endpoint` | `string` | Yes | Base URL of your IPAM instance (e.g., `https://myipam.azurewebsites.net`) |
| `ipam_api_scope` | `string` | Yes | App ID URI of the IPAM Engine App Registration |

## Usage

Copy the example variables file and fill in your values:

```bash
cp example.tfvars terraform.tfvars
# Edit terraform.tfvars with your values
```

Then deploy:

```bash
terraform init
terraform plan
terraform apply
```

## Authentication

The provider obtains an access token via `az account get-access-token`. This requires an active Azure CLI session.

> **Security note:** When using the `data "external"` block, the access token is stored in Terraform state. The token is short-lived (~1 hour) which limits its exposure, but if storing credentials in state is a concern for your environment you should use the environment variable approach described below instead. Always ensure your state backend is appropriately secured (e.g. encrypted storage, restricted access).

For CI/CD pipelines or environments where you prefer to keep credentials out of state, set the `AZUREIPAM_TOKEN` environment variable and remove the `data "external"` block and `token` argument from the provider configuration in `providers.tf`:

```bash
export AZUREIPAM_TOKEN=$(az account get-access-token --resource "api://<your-api-scope>" --query accessToken -o tsv)
terraform apply
```

## Files

| File | Description |
|------|-------------|
| `main.tf` | IPAM reservation and Azure resources |
| `providers.tf` | Provider configuration and authentication |
| `variables.tf` | Input variable definitions |
| `outputs.tf` | Output definitions |
| `example.tfvars` | Example variable values |

## Standalone Script Examples

The [`examples/scripts/`](../scripts/) directory contains standalone Bash and PowerShell scripts for calling the Azure IPAM API outside of Terraform. These are useful for ad-hoc operations or integration into other tooling.

## Related Documentation

- [Automation Patterns](../../docs/automation/README.md) — Common patterns for integrating Azure IPAM into automated workflows
- [API Documentation](../../docs/api/README.md#reservations) — Reservation API endpoints and examples
- [How-To: Reservations](../../docs/how-to/README.md#reservations) — Managing reservations through the UI
