# Automation

## Overview

Azure IPAM exposes a full set of capabilities via its REST API, making it well suited for integration into automated workflows. Whether you're looking to keep Azure IPAM in sync with an external source of truth, populate it from network discovery tools, or incorporate it into your Infrastructure as Code (IaC) pipelines, the API provides the building blocks to do so.

This section covers common automation patterns and integration strategies for Azure IPAM. For details on how to authenticate and call the API, please see the [API](/api/README.md) documentation.

## External Network Automation

[External Networks](/how-to/README.md#external-networks) are a natural fit for automation. Because they represent IP address space that lives outside of Azure (on-premises datacenters, co-location facilities, other cloud providers, etc.), they are often managed by separate systems and processes. Keeping Azure IPAM up to date with that information manually can be tedious and error-prone — automation solves that problem.

Below are a few patterns to consider when automating External Network management.

### CMDB / IPAM Synchronization

If your organization maintains a Configuration Management Database (CMDB) or another source of truth for on-premises network inventory, you can build an automated synchronization process that periodically exports data from that system and pushes it into Azure IPAM via the API. This ensures that your Azure IPAM instance always reflects the current state of your non-Azure networks.

A typical sync flow might look like:

1. **Export** the current on-premises network and host inventory from your CMDB
2. **Map** the exported data to the External Network / Subnet / Endpoint hierarchy
3. **Reconcile** the data against what currently exists in Azure IPAM (using `GET` calls)
4. **Create, Update, or Delete** External Networks, Subnets, and Endpoints as needed to bring IPAM in sync

The **bulk replace** (`PUT`) endpoint for Subnet Endpoints is particularly useful here, as it allows you to replace the entire endpoint list in a single call rather than managing individual additions and deletions. For more details on this API call, see the [External Networks](/api/README.md#external-networks) section of the API documentation.

### Network Scanner Integration

Network scanning tools (such as Nmap, or enterprise solutions like Infoblox or SolarWinds) can be integrated to automatically populate External Subnet Endpoints. After a scan completes, the results can be parsed and pushed to Azure IPAM to maintain an up-to-date view of what hosts are active on each subnet.

A basic integration flow would be:

1. **Run a network scan** against your on-premises or external subnets
2. **Parse the results** to extract host names, descriptions, and IP addresses
3. **Push the results** to Azure IPAM using the bulk replace (`PUT`) endpoint for the corresponding External Subnet

This can be scheduled to run on a regular cadence (e.g., nightly or weekly) to keep your endpoint inventory current.

### Infrastructure as Code (IaC)

External Networks can be provisioned as part of your IaC pipelines alongside your Azure resources. For example, when standing up a new site or datacenter, your deployment pipeline could:

1. Create the corresponding External Network and Subnets in Azure IPAM
2. Deploy the Azure-side networking (VPN Gateways, ExpressRoute circuits, etc.)
3. Ensure the full address plan is captured in a single source of truth

This approach ensures that your IP address management stays in lockstep with your infrastructure deployments and that no address space is left unaccounted for.

### CI/CD Pipeline Integration

For teams that manage network configurations through version-controlled repositories, a CI/CD pipeline can be configured to automatically update Azure IPAM whenever network definitions change. This could be triggered by pull request merges that modify network configuration files, ensuring that IPAM stays in sync with your intended network state.

A simple example of this would be maintaining a JSON or YAML file that defines your external network topology, and having a pipeline step that reads that file and reconciles it against the Azure IPAM API on each merge to `main`.
