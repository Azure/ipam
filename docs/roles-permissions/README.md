# Roles & Permissions

## Overview

Access in Azure IPAM is based on roles. There are currently two. **Administrators** set up and maintain your address plan, and **users** work within it. Administrators can also do everything a user can. You can see which roles you hold in **Profile**, in the menu under your avatar.

When Azure IPAM is deployed, it's granted read-only access to your Azure environment. By default this covers your whole tenant through the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory), though you can choose a different management group during [deployment](/deployment/README.md). Azure IPAM uses this access to account for every applicable network when it plans and checks address space, so its answers are accurate for everyone. It never uses it to show you more of Azure than you can already see.

What Azure IPAM shows you falls into three kinds of information, each with its own rule:

- **Azure resources** are shown as your own Azure permissions allow. Azure IPAM brings them together in one place, but never widens what you can see. Administrators see everything within Azure IPAM's scope.
- **The address plan** is shared with everyone who uses Azure IPAM. It's made up of Spaces, Blocks, External Networks, Reservations and the networks associated with each Block. When an administrator associates a network with a Block, its name, subscription, resource group and address space become part of the plan. Its subnets and endpoints don't, and remain Azure resources.
- **Answers about address space**, such as utilization, overlap checks and the next available range, account for every network within Azure IPAM's scope, so they're the same no matter who asks.

## Guiding Principles

These principles apply everywhere: in the UI, through the API, and in automation. If two of them ever pull in different directions, the one listed first takes precedence.

- **Security comes first.** Azure IPAM is never a way around your Azure permissions. It doesn't use its own access to show you Azure resources you can't otherwise see.
- **Every answer is complete.** When Azure IPAM finds available address space or checks for overlaps, it considers every applicable network within its scope, no matter who is asking. You may be told that a range is in use without being told what is using it.
- **The address plan is shared.** Spaces, Blocks, External Networks, pending Reservations and associated networks are visible to every signed-in user. Associating a network with a Block is a deliberate decision to make it part of the plan, so its name, subscription, resource group and address space become visible to all users. A few details stay with the person who created them, such as a Reservation's ID and description.
- **Everything else stays with Azure.** Azure resources that aren't part of the plan, including the subnets and endpoints of associated networks, are shown to each user only as their own Azure permissions allow. Administrators see everything within Azure IPAM's scope.
- **Administrators shape the plan, and users work within it.** Administrators create Spaces, Blocks and External Networks, and manage associations. Users reserve address space and associate the networks they own.
- **Nothing is silently left out.** If you aren't allowed to see the details of something, Azure IPAM still tells you that the address space is in use, rather than quietly leaving it out. It never presents part of the plan as missing or broken because you can't see it in Azure.
- **The same object looks the same everywhere.** Whether you view a Block in the UI or retrieve it through the API, you see the same information.

## What Administrators and Users Can Do

The table below lists common tasks and who can perform them.

| Task                                                              | Administrators | Users                                                                                         |
|-------------------------------------------------------------------|----------------|-----------------------------------------------------------------------------------------------|
| Find available address space and check a CIDR for overlaps        | Yes            | Yes                                                                                           |
| Create Reservations, and cancel your own                          | Yes            | Yes                                                                                           |
| Associate a virtual network you own with a Block                  | Yes            | Yes, [through a Reservation](/how-to/README.md#associating-an-existing-virtual-network)       |
| Cancel another user's Reservation                                 | Yes            | No                                                                                            |
| Associate any virtual network with a Block, or remove one         | Yes            | No                                                                                            |
| Create, change and delete Spaces, Blocks and External Networks    | Yes            | No                                                                                            |
| Manage administrators and subscription exclusions                 | Yes            | No                                                                                            |
| [Act on notifications](/how-to/README.md#acting-on-a-notification), such as switching container registries | Yes | No |

In the UI, users can open every section of the menu except **Admin**. The **Configure** pages are read-only for them, apart from **Reservations**.

## What Each Role Sees

| What                                                   | Administrators                         | Users                                                               |
|--------------------------------------------------------|----------------------------------------|---------------------------------------------------------------------|
| Spaces and Blocks, including their utilization         | All                                    | All                                                                 |
| External Networks                                      | All                                    | All                                                                 |
| Virtual networks associated with a Block               | All                                    | All, including their address space                                  |
| Subnets and endpoints of associated networks           | Everything within Azure IPAM's scope   | What their own Azure permissions allow                              |
| Pending Reservations                                   | All, in full                           | All, but only their own include the ID and description              |
| Settled Reservations                                   | All                                    | Their own                                                           |
| Azure resources that aren't associated with a Block    | Everything within Azure IPAM's scope   | What their own Azure permissions allow                              |
| Networks reported by an overlap check                  | In full                                | In full if associated with a Block, otherwise only the overlapping ranges |
| Notifications                                          | All                                    | All, except those meant only for administrators                     |

A Reservation's ID stays with the person who created it because the ID is what claims the address space. Any virtual network tagged with the ID, and matching the reserved CIDR, fulfills the Reservation.

The **Discover** pages show Azure resources, so users see only what their own Azure permissions allow there, even for networks associated with a Block. A Block's utilization still counts every network associated with it.

## Service Principals and Automation

Automation often signs in to Azure IPAM as a service principal or managed identity rather than as a person. Service principals hold roles the same way users do: one added on the [Admins](/how-to/README.md#managing-administrators) page is an administrator, and any other is a user.

There is one difference. Azure IPAM shows a user the Azure resources they can access by asking Azure on their behalf, using the [on-behalf-of](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow, and Azure only supports that flow for people. A service principal that isn't an administrator therefore has no view of Azure through Azure IPAM:

- Everything held in Azure IPAM works as it does for a user, including Spaces, Blocks, External Networks, associated networks and the service principal's own Reservations.
- Finding available address space and checking for overlaps work as well, although `nextAvailableSubnet` only accepts virtual networks associated with a Block.
- Requests that list Azure resources, including the virtual networks available to associate with a Block, fail.

Automation that reserves address space and tags what it deploys, as described in [Reservation Automation](/automation/README.md#reservation-automation), doesn't need to be an administrator. If it needs to read Azure resources, or to work with virtual networks that aren't associated with a Block, add its service principal as an administrator.
