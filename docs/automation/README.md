# Automation

This guide covers common ways to automate Azure IPAM from deployment pipelines, scheduled jobs and infrastructure as code (IaC).

## Overview

Everything in Azure IPAM is available through its REST API, so it fits well into automated workflows. The three areas that benefit most from automation are:

- **Reservations:** Claim address space from a Block before deploying infrastructure, then let Azure IPAM settle the Reservation when the tagged virtual network appears.
- **Virtual Network Associations:** Declare which Azure virtual networks and virtual hubs are tracked against each Block.
- **External Networks:** Keep Azure IPAM up to date with address space outside of Azure, such as on-premises datacenters, co-location facilities and other clouds.

The following sections cover common patterns for each of these. For how to authenticate and call the API, see the [Azure IPAM REST API Overview](/api/README.md). For what these features are and how to manage them in the UI, see [How to Use Azure IPAM](/how-to/README.md).

## Reservation Automation

[Reservations](/how-to/README.md#reservations) are the main way to integrate Azure IPAM into your IaC and deployment pipelines. You claim address space from a Block, deploy your infrastructure with the reserved CIDR range, and Azure IPAM tracks the result, with no manual steps.

For the Reservation endpoints and example API calls, see the [Reservations](/api/README.md#reservations) section of the API documentation.

### Reserve, Deploy and Tag Workflow

The core automation pattern for Reservations has three steps:

1. **Reserve:** Call `POST /api/spaces/{space}/blocks/{block}/reservations` to claim a CIDR range of the size you need, or a specific CIDR range. Azure IPAM returns the reserved range and a tag (`X-IPAM-RES-ID`).
2. **Deploy:** Create your Azure virtual network with the reserved CIDR range as its address prefix, and apply the Reservation's tag to it.
3. **Settle:** Azure IPAM checks for tagged virtual networks about once a minute. When one of the network's address prefixes is exactly the reserved CIDR, and none of its address space in the Block overlaps anything else, Azure IPAM associates the network with the Block and marks the Reservation as fulfilled. No additional API call is needed.

CIDR allocation, deployment and tracking in Azure IPAM all happen in one automated flow.

### IaC Examples

The repository includes working examples of this pattern for both Bicep and Terraform under the [`examples/`](https://github.com/Azure/ipam/tree/main/examples) directory:

- **Bicep** (`examples/azure-eslz/`): A Bicep deployment script calls the Reservation API with a managed identity, then passes the reserved CIDR range and Reservation ID to a virtual network module that applies the tag.
- **Terraform** (`examples/ipam-terraform/`): The community Azure IPAM Terraform provider creates a Reservation as a Terraform resource, then the virtual network is created with the reserved CIDR range and the Reservation's tag. See [Azure IPAM Terraform Provider](#azure-ipam-terraform-provider) for more detail.
- **Standalone scripts** (`examples/scripts/`): PowerShell and Bash scripts that call the Azure IPAM API directly to get a token and create a Reservation. Use them as a starting point for custom pipelines, one-off tasks or tooling that doesn't use Bicep or Terraform.

You can adapt these examples to your own landing zone or spoke deployment patterns.

### Multi-Block Reservations

When the Reservation can come from any of several Blocks, give a list of Block names. Azure IPAM tries them in order and creates the Reservation in the first Block with enough space. This is useful for overflow scenarios or environments with tiered address pools. See the [Create a Reservation from Multiple Blocks](/api/README.md#create-a-reservation-from-multiple-blocks) example in the API documentation.

### Self-Service Pipelines

Reservations suit self-service workflows, where application teams request address space without being Azure IPAM administrators:

1. A team triggers a pipeline, for example with a pull request or a manual run.
2. The pipeline creates a Reservation in a pre-approved Block.
3. The pipeline deploys the virtual network with the reserved CIDR range and the Reservation's tag.
4. Azure IPAM settles the Reservation once it finds the tagged virtual network.

Because users who aren't administrators can create and cancel their own Reservations, this works without making the pipeline an administrator. This applies to service principals and managed identities as well, with some limits on what a non-admin service principal can see, described in [Service Principals and Automation](/roles-permissions/README.md#service-principals-and-automation).

### Reservation Lifecycle Management

For long-running automation, consider monitoring Reservation status. A Reservation that stays at `wait` longer than expected may belong to a deployment that was abandoned or never tagged. A status of `warnCIDRMismatch` or `errCIDROverlap` means the Reservation's tag is on a virtual network that can't fulfill it, because the network's address space doesn't match the reserved CIDR or overlaps something else in the Block. These Reservations stay unsettled, and Azure IPAM fulfills them as soon as the problem is fixed. A scheduled job can list unsettled Reservations with `GET` and alert on them, or cancel them with `DELETE` if the deployment was abandoned. A job that doesn't run as an Azure IPAM administrator can only cancel Reservations it created. See the [Reservations](/api/README.md#reservations) section of the API documentation for the full set of query and delete operations.

## Virtual Network Association Automation

[Virtual Network Associations](/how-to/README.md#virtual-network-associations) map Azure virtual networks and virtual hubs to Blocks, which drives utilization tracking and overlap prevention. Any signed-in user can list a Block's associations, but adding, replacing and removing them is restricted to Azure IPAM administrators.

For the association endpoints and example API calls, see the [Virtual Network Associations](/api/README.md#virtual-network-associations) section of the API documentation.

### Declarative Association Management

`PUT /api/spaces/{space}/blocks/{block}/networks` replaces a Block's associations with the list of virtual network resource IDs you send. Networks not in the list are disassociated, and new ones are added. This fits declarative, GitOps-style workflows:

1. Keep a configuration file, such as JSON or YAML, that defines which virtual networks belong to each Block.
2. On each merge to your main branch, a pipeline reads the file and calls `PUT` on each Block's `networks` endpoint.
3. The associations in Azure IPAM always match the file.

### Post-Deployment Association

If your virtual network deployments don't use Reservations, for example because address space is allocated outside of Azure IPAM, add an association step to the end of your deployment pipeline:

1. Deploy the virtual network.
2. Call `POST /api/spaces/{space}/blocks/{block}/networks` to associate it with the right Block.

Every deployed virtual network is then tracked in Azure IPAM for utilization and overlap, even if it didn't come from a Reservation.

The `POST` call requires an Azure IPAM administrator. A pipeline that isn't an administrator can get the same result by reserving the virtual network's exact address space and tagging the virtual network with the Reservation ID, as described in [Associating an Existing Virtual Network](/how-to/README.md#associating-an-existing-virtual-network).

### Drift Detection and Reconciliation

Over time, associations can drift if virtual networks are created, deleted, or moved outside of your automated pipelines. A scheduled reconciliation job can detect and correct this:

1. **Query** the networks that can be associated with the Block, with `GET /api/spaces/{space}/blocks/{block}/available`. This list includes networks that are already associated.
2. **Query** the Block's current associations, with `GET /api/spaces/{space}/blocks/{block}/networks`. An association with `active` set to `false` points to a network that no longer exists or no longer has address space in the Block.
3. **Compare** the two lists to find networks that should be associated but aren't, and associations that are stale.
4. **Reconcile** by adding the missing associations and removing the stale ones.

This is especially useful in large environments where multiple teams deploy infrastructure independently.

## External Network Automation

[External Networks](/how-to/README.md#external-networks) represent address space outside of Azure, such as on-premises datacenters, co-location facilities and other cloud providers. Because other systems and processes often manage this information, keeping Azure IPAM up to date by hand is tedious and error-prone.

Any signed-in user can read External Networks, but creating, changing and deleting them, along with their subnets and endpoints, is restricted to Azure IPAM administrators. Synchronization and scanner pipelines therefore need to run as a service principal that has been made an administrator (see [Managing Administrators](/how-to/README.md#managing-administrators)).

For the External Network endpoints and example API calls, see the [External Networks](/api/README.md#external-networks) section of the API documentation.

### CMDB Synchronization

If your organization keeps a configuration management database (CMDB), or another source of truth for its on-premises network inventory, you can build a job that regularly exports data from it and pushes it into Azure IPAM. Azure IPAM then always reflects the current state of your networks outside Azure.

A typical sync flow:

1. **Export** the current on-premises network and host inventory from your CMDB.
2. **Map** the exported data to External Networks, their subnets and their endpoints.
3. **Compare** the data with what's in Azure IPAM, using `GET` calls.
4. **Create, update or delete** External Networks, subnets and endpoints to bring Azure IPAM in line.

`PUT` on a subnet's `endpoints` endpoint is especially useful here, because it replaces the subnet's whole list of endpoints in one call, rather than adding and deleting them one at a time.

### Network Scanner Integration

Network discovery tools, such as Nmap or the discovery features of products like Infoblox and SolarWinds, can fill in External Subnet endpoints for you. After a scan, parse the results and push them to Azure IPAM, so it shows which hosts are active on each subnet.

A basic flow:

1. **Scan** your on-premises or external subnets.
2. **Parse the results** to get host names, descriptions and IP addresses.
3. **Push the results** to Azure IPAM with `PUT` on the External Subnet's `endpoints` endpoint.

Schedule it to run regularly, for example nightly or weekly, to keep your endpoint inventory current.

### IaC and CI/CD Integration

Your IaC pipelines can create External Networks alongside your Azure resources. For example, when setting up a new site or datacenter, your deployment pipeline could:

1. Create the site's External Network and subnets in Azure IPAM.
2. Deploy the Azure side of the connection, such as VPN gateways or ExpressRoute circuits.
3. Leave the whole address plan in one source of truth.

If you keep network configuration in a version-controlled repository, a CI/CD pipeline can update Azure IPAM whenever it changes. For example, keep a JSON or YAML file that defines your external network topology, and have a pipeline step reconcile it with the Azure IPAM API on each merge.

## Azure IPAM Terraform Provider

The [Azure IPAM Terraform provider](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) (`xtratuscloud/azureipam`) is a community-maintained provider that wraps the Azure IPAM REST API and exposes it as native Terraform resources and data sources. For teams that already manage their Azure estate with Terraform, it's a declarative alternative to calling the REST API directly, covering Spaces, Blocks, Reservations, virtual network associations and External Networks. It doesn't manage External Network subnets or endpoints, so the CMDB and scanner flows above still call the REST API directly.

> **NOTE:** The provider is published and maintained by [XtratusCloud](https://github.com/XtratusCloud/terraform-provider-azureipam), not by the Azure IPAM project, and Microsoft doesn't support it. The REST API is the authoritative interface to Azure IPAM, and the snippets below are only a starting point. Always check the [provider documentation on the Terraform Registry](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) for the current, authoritative reference.

### When to Use the Provider

The provider is a good fit when:

- Your infrastructure is already managed end to end with Terraform, and you want Azure IPAM tracked the same way.
- You want your Spaces, Blocks, Reservations, associations and External Networks reconciled with `terraform plan` and `terraform apply`, rather than API calls in a pipeline step.
- You want Terraform's drift detection to catch changes made to Azure IPAM outside Terraform.

Calling the REST API directly, with the [PowerShell and Bash scripts](https://github.com/Azure/ipam/tree/main/examples/scripts) or your own tooling, is still the better choice for one-off tasks, pipelines that don't use Terraform, or environments where a community provider isn't allowed.

### Provider Configuration

The provider authenticates to Azure IPAM with a bearer token. We recommend getting the token with Azure CLI and passing it in the `AZUREIPAM_TOKEN` environment variable, so it isn't saved in the Terraform state:

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
  api_url = "https://<your-ipam-host>"
  # token sourced from AZUREIPAM_TOKEN environment variable
}
```

```bash
export AZUREIPAM_TOKEN=$(az account get-access-token \
  --scope "api://<engine-app-id>/.default" --query accessToken -o tsv)
terraform apply
```

For a working example that gets the token in the configuration instead, which stores it in the state, see [`examples/ipam-terraform/providers.tf`](https://github.com/Azure/ipam/blob/main/examples/ipam-terraform/providers.tf).

### Example: Reservation and Virtual Network

The most common pattern is the [Reserve, Deploy and Tag](#reserve-deploy-and-tag-workflow) workflow described above, as two Terraform resources. The Reservation's `cidr` output becomes the virtual network's address space, and its `tags` output is applied to the virtual network so Azure IPAM can settle the Reservation. The snippet assumes the `azurerm` provider is already configured:

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

A complete, runnable version of this example, with variables, outputs and provider configuration, is in [`examples/ipam-terraform/`](https://github.com/Azure/ipam/tree/main/examples/ipam-terraform).

### Beyond Reservations

The provider also has resources and data sources for Spaces, Blocks, virtual network associations and External Networks. Because these change with the provider rather than with this guide, the [provider's Terraform Registry page](https://registry.terraform.io/providers/XtratusCloud/azureipam/latest/docs) is the authoritative reference for the full schema, available data sources, and version compatibility notes.
