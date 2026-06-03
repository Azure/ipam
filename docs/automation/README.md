# Automation

## Overview

Azure IPAM exposes a full set of capabilities via its REST API, making it well suited for integration into automated workflows. The three primary areas that benefit from automation are:

- **Reservations** — Claim address space from a Block before deploying infrastructure, then let Azure IPAM automatically settle the reservation when the tagged resource appears.
- **Virtual Network Associations** — Declaratively manage which Azure virtual networks (and virtual hubs) are tracked against each Block.
- **External Networks** — Keep Azure IPAM up to date with IP address space that lives outside of Azure (on-premises, co-location, other clouds).

This section covers common automation patterns and integration strategies for each of these areas. For details on how to authenticate and call the API, see the [API](/api/README.md) documentation. For general information on these concepts and how to manage them through the UI, see the [How-To](/how-to/README.md) documentation.

## Reservation Automation

[Reservations](/how-to/README.md#reservations) are the primary mechanism for integrating Azure IPAM into your Infrastructure as Code (IaC) and deployment pipelines. They allow you to claim address space from a Block, deploy your infrastructure using the reserved CIDR, and have Azure IPAM automatically track the result — all without manual intervention.

For the full set of reservation endpoints and example API calls, see the [Reservations](/api/README.md#reservations) section of the API documentation.

### Reserve → Deploy → Tag Workflow

The core automation pattern for reservations is a three-step workflow:

1. **Reserve** — Call the reservation API to claim a CIDR of the desired size (or a specific CIDR). IPAM returns the reserved range and a tag (`X-IPAM-RES-ID`).
2. **Deploy** — Create your Azure virtual network using the reserved CIDR as its address prefix, and apply the reservation tag to the resource.
3. **Settle** — Azure IPAM's background task automatically detects the tagged virtual network and marks the reservation as fulfilled. No additional API call is needed.

This pattern ensures that CIDR allocation, infrastructure deployment, and IPAM tracking all happen in a single automated flow with no manual steps.

### IaC Examples

The repository includes working examples of this pattern for both Bicep and Terraform under the [`examples/`](https://github.com/Azure/ipam/tree/main/examples) directory:

- **Bicep** (`examples/azure-eslz/`) — Uses a Bicep deployment script to call the reservation API via a managed identity, then passes the reserved CIDR and reservation ID to a VNet module that applies the tag.
- **Terraform** (`examples/ipam-terraform/`) — Uses the community Azure IPAM Terraform provider to create a reservation as a managed Terraform resource, then creates the VNet with the reserved CIDR and applies the settlement tag. See the [Azure IPAM Terraform Provider](#azure-ipam-terraform-provider) section below for more detail.
- **Standalone Scripts** (`examples/scripts/`) — PowerShell and Bash scripts that demonstrate how to call the Azure IPAM API directly. These cover token acquisition and reservation creation, and can serve as starting points for integrating IPAM into custom pipelines, ad-hoc workflows, or tooling that doesn't use Bicep or Terraform.

These examples can be adapted to fit your own landing zone or spoke deployment patterns.

### Multi-Block Reservations

When you don't need the reservation to come from a specific Block, you can provide a list of Block names and let IPAM evaluate them in order, creating the reservation in the first Block with available space. This is useful for overflow scenarios or environments with tiered address pools. See the [Create a Reservation from Multiple Blocks](/api/README.md#create-a-reservation-from-multiple-blocks) example in the API documentation.

### Self-Service Pipelines

Reservations lend themselves well to self-service workflows where application teams can request address space without needing IPAM admin access:

1. A team triggers a pipeline (e.g., via a pull request or manual dispatch)
2. The pipeline calls the reservation API to claim a CIDR from a pre-approved Block
3. The reserved CIDR is used to deploy the VNet (with the reservation tag applied)
4. IPAM automatically settles the reservation once the tagged VNet is detected

Because non-admin users can create (and cancel) their own reservations, this pattern works without granting broad IPAM admin permissions.

### Reservation Lifecycle Management

For long-running automation, consider monitoring reservation status to catch reservations that remain in a `wait` state longer than expected. A scheduled job can list active reservations (via `GET`) and alert or clean up stale entries. Reservations can be cancelled via `DELETE` if the corresponding deployment was abandoned. See the [Reservations](/api/README.md#reservations) section of the API documentation for the full set of query and delete operations.

## Virtual Network Association Automation

[Virtual Network Associations](/how-to/README.md#virtual-network-associations) map Azure virtual networks and virtual hubs to Blocks, which drives utilization tracking and overlap prevention. All association management endpoints are restricted to Azure IPAM administrators.

For the full set of association endpoints and example API calls, see the [Virtual Network Associations](/api/README.md#virtual-network-associations) section of the API documentation.

### Declarative Association Management

The bulk replace (`PUT`) endpoint for associations accepts the complete list of virtual network resource IDs that should be associated with a Block. Any networks not in the list are disassociated, and any new ones are added. This makes it a natural fit for declarative, GitOps-style workflows:

1. Maintain a configuration file (JSON, YAML, etc.) that defines which virtual networks belong to each Block
2. On each merge to your main branch, a pipeline reads the file and calls `PUT /networks` for each Block
3. IPAM's association state always matches your declared intent

### Post-Deployment Association

If your VNet deployments don't use the reservation workflow (for example, if address space is allocated outside of IPAM), you can add an association step to the end of your deployment pipeline:

1. Deploy the virtual network
2. Call `POST /networks` to associate the new VNet with the appropriate Block

This ensures that every deployed VNet is tracked in IPAM for utilization and overlap reporting, even if it wasn't provisioned through the reservation flow.

### Drift Detection and Reconciliation

Over time, associations can drift if virtual networks are created, deleted, or moved outside of your automated pipelines. A scheduled reconciliation job can detect and correct this:

1. **Query** the available networks for a Block (`GET /available`) to find eligible VNets that are not yet associated
2. **Query** the current associations (`GET /networks`) to find stale entries pointing to deleted resources
3. **Reconcile** by adding missing associations and removing stale ones

This is particularly valuable in large environments where multiple teams deploy infrastructure independently.

## External Network Automation

[External Networks](/how-to/README.md#external-networks) represent IP address space that lives outside of Azure — on-premises datacenters, co-location facilities, other cloud providers, etc. Because this information is often managed by separate systems and processes, keeping Azure IPAM up to date manually can be tedious and error-prone.

For the full set of external network endpoints and example API calls, see the [External Networks](/api/README.md#external-networks) section of the API documentation.

### CMDB / IPAM Synchronization

If your organization maintains a Configuration Management Database (CMDB) or another source of truth for on-premises network inventory, you can build an automated synchronization process that periodically exports data from that system and pushes it into Azure IPAM. This ensures that your Azure IPAM instance always reflects the current state of your non-Azure networks.

A typical sync flow:

1. **Export** the current on-premises network and host inventory from your CMDB
2. **Map** the exported data to the External Network / Subnet / Endpoint hierarchy
3. **Reconcile** the data against what currently exists in Azure IPAM (using `GET` calls)
4. **Create, Update, or Delete** External Networks, Subnets, and Endpoints as needed to bring IPAM in sync

The **bulk replace** (`PUT`) endpoint for Subnet Endpoints is particularly useful here, as it allows you to replace the entire endpoint list in a single call rather than managing individual additions and deletions.

### Network Scanner Integration

Network scanning tools (such as Nmap, or enterprise solutions like Infoblox or SolarWinds) can be integrated to automatically populate External Subnet Endpoints. After a scan completes, the results can be parsed and pushed to Azure IPAM to maintain an up-to-date view of what hosts are active on each subnet.

A basic integration flow:

1. **Run a network scan** against your on-premises or external subnets
2. **Parse the results** to extract host names, descriptions, and IP addresses
3. **Push the results** to Azure IPAM using the bulk replace (`PUT`) endpoint for the corresponding External Subnet

This can be scheduled to run on a regular cadence (e.g., nightly or weekly) to keep your endpoint inventory current.

### IaC and CI/CD Integration

External Networks can be provisioned as part of your IaC pipelines alongside your Azure resources. For example, when standing up a new site or datacenter, your deployment pipeline could:

1. Create the corresponding External Network and Subnets in Azure IPAM
2. Deploy the Azure-side networking (VPN Gateways, ExpressRoute circuits, etc.)
3. Ensure the full address plan is captured in a single source of truth

For teams that manage network configurations through version-controlled repositories, a CI/CD pipeline can be configured to automatically update Azure IPAM whenever network definitions change — for example, by maintaining a JSON or YAML file that defines your external network topology and having a pipeline step reconcile it against the Azure IPAM API on each merge.

## Azure IPAM Terraform Provider

The [Azure IPAM Terraform provider](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) (`xtratuscloud/azureipam`) is a community-maintained provider that wraps the Azure IPAM REST API and exposes it as native Terraform resources and data sources. For teams that already manage their Azure estate with Terraform, it offers a fully declarative alternative to calling the REST API directly — covering the same surface area as the three automation areas above (reservations, virtual network associations, and external networks).

> **Note:** The provider is published and maintained by [XtratusCloud](https://github.com/XtratusCloud/terraform-provider-azureipam), not by the Azure IPAM project. It is not a Microsoft-supported component. The REST API remains the authoritative interface to Azure IPAM, and the snippets below are intended as a starting point — always refer to the [provider documentation on the Terraform Registry](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) for the current, authoritative reference.

### When to Use the Provider

The provider is a good fit when:

- Your infrastructure is already managed end-to-end with Terraform and you want IPAM state tracked the same way.
- You want reservations, associations, and external networks reconciled via `terraform plan` / `terraform apply` rather than imperative API calls in a pipeline step.
- You need Terraform's drift detection to catch out-of-band changes to IPAM objects.

Direct REST calls (via the provided [PowerShell and Bash scripts](https://github.com/Azure/ipam/tree/main/examples/scripts) or your own tooling) remain the right choice for ad-hoc operations, non-Terraform pipelines, or environments where adding a community provider isn't acceptable.

### Provider Configuration

The provider authenticates against the Azure IPAM Engine using a bearer token. The recommended pattern is to acquire the token via the Azure CLI and pass it through the `AZUREIPAM_TOKEN` environment variable so it is not persisted to Terraform state:

```hcl
terraform {
  required_providers {
    azureipam = {
      source  = "xtratuscloud/azureipam"
      version = "~> 2.0"
    }
  }
}

provider "azureipam" {
  api_url = "https://<your-ipam-host>.azurewebsites.net"
  # token sourced from AZUREIPAM_TOKEN environment variable
}
```

```bash
export AZUREIPAM_TOKEN=$(az account get-access-token \
  --resource "api://<engine-app-id>" --query accessToken -o tsv)
terraform apply
```

For a working example that obtains the token inline (with the trade-offs of storing it in state), see [`examples/ipam-terraform/providers.tf`](https://github.com/Azure/ipam/blob/main/examples/ipam-terraform/providers.tf).

### Example: Reservation and VNet

The most common usage pattern is the **reserve → deploy → tag** workflow described above, expressed as two Terraform resources. The reservation's `cidr` output is consumed as the VNet's address space, and its `tags` output is applied to the VNet so Azure IPAM can automatically settle the reservation:

```hcl
resource "azureipam_reservation" "vnet" {
  space  = "MySpace"
  blocks = ["MyBlock"]
  size   = 24
}

resource "azurerm_resource_group" "rg" {
  name     = "my-rg"
  location = "eastus"
}

resource "azurerm_virtual_network" "network" {
  name                = "my-vnet"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  address_space       = [azureipam_reservation.vnet.cidr]
  tags                = azureipam_reservation.vnet.tags
}
```

A complete, runnable version of this example — including variables, outputs, and provider configuration — is available under [`examples/ipam-terraform/`](https://github.com/Azure/ipam/tree/main/examples/ipam-terraform).

### Beyond Reservations

The provider also exposes resources and data sources for spaces, blocks, virtual network associations, and external networks. Because the resource and attribute surface evolves with the provider rather than this documentation, the [provider's Terraform Registry page](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) is the authoritative reference for the full schema, available data sources, and version compatibility notes.
