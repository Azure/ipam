# Roles & Permissions

## Overview

Access in Azure IPAM is based on roles. There are currently two. **Administrators** set up and maintain your address plan, and **users** work within it. Administrators can also do everything a user can.

When Azure IPAM is deployed, it's granted read-only access to your Azure environment. By default this covers your whole tenant through the [Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory), though you can choose a different management group during [deployment](/deployment/README.md). This access lets Azure IPAM account for every network within its scope when it plans and checks address space, so the answers it gives are accurate. It's never used to widen what you can see. The principles below describe how Azure IPAM keeps those two goals in balance.

## Guiding Principles

These principles apply everywhere: in the UI, through the API, and in automation. If two of them ever pull in different directions, the one listed first takes precedence.

- **Security comes first.** Azure IPAM uses its access to give you accurate answers, never to show you Azure resources your own Azure permissions don't allow.
- **Every answer is complete.** When Azure IPAM finds available address space or checks for overlaps, it considers every network within its scope, no matter who is asking. You may be told that a range is in use without being told what is using it.
- **What's in Azure IPAM is shared.** Spaces, Blocks, External Networks, pending Reservations and associated networks are visible to every signed-in user, so associating a virtual network with a Block makes its details visible to all users. A few details stay with the person who created them, such as a Reservation's ID and description.
- **Everything else stays with Azure.** Virtual networks that aren't associated with a Block are shown to each user only as their own Azure permissions allow. Administrators see everything within Azure IPAM's scope.
- **Administrators shape the plan, and users work within it.** Administrators create Spaces, Blocks and External Networks, and manage associations. Users reserve address space and associate the networks they own.
- **Nothing is silently left out.** If you aren't allowed to see the details of something, Azure IPAM still tells you that the address space is in use, rather than quietly leaving it out.
- **The same object looks the same everywhere.** Whether you view a Block in the UI or retrieve it through the API, you see the same information.
