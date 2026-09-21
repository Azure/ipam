# Example Scripts

Standalone scripts for interacting with the Azure IPAM API. These are not used by the [Bicep](../azure-eslz/) or [Terraform](../ipam-terraform/) examples — they are provided as reference implementations for teams that want to integrate Azure IPAM into their own tooling or ad-hoc workflows.

## Scripts

| Script | Language | Description |
|--------|----------|-------------|
| `New-IpamReservation.ps1` | PowerShell | Create a CIDR reservation in a given Space and Block |
| `new-ipam-reservation.sh` | Bash | Create a CIDR reservation in a given Space and Block |
| `get-ipam-token.sh` | Bash | Obtain a bearer token for the Azure IPAM Engine API |

## Prerequisites

**PowerShell scripts** require:

- [Azure PowerShell](https://learn.microsoft.com/powershell/azure/install-azure-powershell) (Az module)
- An authenticated session (`Connect-AzAccount`)

> **Note:** As of [Azure PowerShell v14](https://learn.microsoft.com/powershell/azure/release-notes-azureps#1400---may-2025), `Get-AzAccessToken` returns the `.Token` property as a `SecureString`. The PowerShell examples in this folder use the v14+ syntax. If you are using an earlier version, wrap the result with `ConvertTo-SecureString ... -AsPlainText -Force`.

**Bash scripts** require:

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- [jq](https://jqlang.github.io/jq/) (for JSON parsing)
- An authenticated session (`az login`)

## Usage

Each script contains configuration variables at the top that you'll need to edit before running (IPAM endpoint, API scope, Space, Block, etc.). See the comments in each script for details.

## Related Documentation

- [API Documentation](../../docs/api/README.md) — Full API reference
- [Automation Patterns](../../docs/automation/README.md) — Common integration strategies
