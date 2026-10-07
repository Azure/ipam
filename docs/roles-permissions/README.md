# Roles & Permissions

## Overview

Access in Azure IPAM is based on roles. There are currently two. **Administrators** set up and maintain your address plan, and **users** work within it. Administrators can also do everything a user can.

When Azure IPAM is deployed, it's granted read-only access to your Azure environment. By default this covers your whole tenant through the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory), though you can choose a different management group during [deployment](/deployment/README.md). This access lets Azure IPAM account for every applicable network within its scope when it plans and checks address space, so the answers it gives are accurate. It's never used to widen what you can see. The principles below describe how Azure IPAM keeps those two goals in balance.

## Guiding Principles

These principles apply everywhere: in the UI, through the API, and in automation. If two of them ever pull in different directions, the one listed first takes precedence.

- **Security comes first.** Azure IPAM uses its access to give you accurate answers, never to show you Azure resources your own Azure permissions don't allow.
- **Every answer is complete.** When Azure IPAM finds available address space or checks for overlaps, it considers every applicable network within its scope, no matter who is asking. You may be told that a range is in use without being told what is using it.
- **What's in Azure IPAM is shared.** Spaces, Blocks, External Networks, pending Reservations and associated networks are visible to every signed-in user, so associating a virtual network with a Block makes its details visible to all users. A few details stay with the person who created them, such as a Reservation's ID and description.
- **Everything else stays with Azure.** Virtual networks that aren't associated with a Block are shown to each user only as their own Azure permissions allow. Administrators see everything within Azure IPAM's scope.
- **Administrators shape the plan, and users work within it.** Administrators create Spaces, Blocks and External Networks, and manage associations. Users reserve address space and associate the networks they own.
- **Nothing is silently left out.** If you aren't allowed to see the details of something, Azure IPAM still tells you that the address space is in use, rather than quietly leaving it out.
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
| Act on notifications, such as switching container registries      | Yes            | No                                                                                            |

In the UI, users can open every section of the menu except **Admin**. The **Configure** pages are read-only for them, apart from **Reservations**.

## What Each Role Sees

| What                                                   | Administrators                         | Users                                                               |
|--------------------------------------------------------|----------------------------------------|---------------------------------------------------------------------|
| Spaces and Blocks, including their utilization         | All                                    | All                                                                 |
| External Networks                                      | All                                    | All                                                                 |
| Virtual networks associated with a Block               | All, in full                           | All, in full                                                        |
| Pending Reservations                                   | All, in full                           | All, but only their own include the ID and description              |
| Settled Reservations                                   | All                                    | Their own                                                           |
| Azure resources that aren't associated with a Block    | Everything within Azure IPAM's scope   | What their own Azure permissions allow                              |
| Networks reported by an overlap check                  | In full                                | In full if associated with a Block, otherwise only the overlapping ranges |

A Reservation's ID stays with the person who created it because the ID is what claims the address space. Any virtual network tagged with the ID, and matching the reserved CIDR, fulfils the Reservation.

## Service Principals and Automation

Automation often signs in to Azure IPAM as a service principal or managed identity rather than as a person. Service principals hold roles the same way users do: one added on the [Admins](/how-to/README.md#managing-administrators) page is an administrator, and any other is a user.

There is one difference. Azure IPAM shows a user the Azure resources they can access by asking Azure on their behalf, using the [on-behalf-of](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow, and Azure only supports that flow for people. A service principal that isn't an administrator therefore has no view of Azure through Azure IPAM:

- Everything held in Azure IPAM works as it does for a user, including Spaces, Blocks, External Networks, associated networks and the service principal's own Reservations.
- Finding available address space and checking for overlaps work as well, although `nextAvailableSubnet` only accepts virtual networks associated with a Block.
- Requests that list Azure resources, including the virtual networks available to associate with a Block, fail.

Automation that reserves address space and tags what it deploys, as described in [Reservation Automation](/automation/README.md#reservation-automation), doesn't need to be an administrator. If it needs to read Azure resources, or to work with virtual networks that aren't associated with a Block, add its service principal as an administrator.
