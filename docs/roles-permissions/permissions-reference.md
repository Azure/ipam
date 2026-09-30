# Permissions Reference

## Overview

Every action that Azure IPAM restricts is controlled by a named **permission**. A **role** is a set of permissions, and what you can do depends on the role you hold. For the principles behind these decisions, see [Roles & Permissions](/roles-permissions/README.md).

There are currently two fixed roles:

| Role          | Permissions                          |
|---------------|--------------------------------------|
| Administrator | Every permission on this page        |
| User          | `associations/read`, `externals/read` |

The User role holds only two permissions, but that doesn't make it read-only. Everything described in [What Every User Can Do](#what-every-user-can-do) needs no permission at all, so the permissions below mostly cover administration and the wider views that go with it.

Roles can't be changed or assigned yet. Assignable roles are planned for v5.0.0, when these permissions will become the building blocks of custom roles.

> **Note:** Upon initial deployment, no administrators are defined and every signed-in user is treated as an administrator, holding every permission. Once at least one administrator is designated, everyone else holds the User role.

## Naming

Permissions are named `resource/action`, where the action is one of `read`, `create`, `update` or `delete`. Some permissions add `/all`, which extends the action beyond your own items. For example, `reservations/read/all` lets you see every user's Reservations in full, not only your own.

## What Every User Can Do

These actions need no permission, so they're available to every signed-in user, whatever their role:

- View Spaces and Blocks, including their utilization.
- Find available address space and check for overlaps with the tools API (`nextAvailableVNet`, `nextAvailableSubnet` and `cidrCheck`). These always consider every network within Azure IPAM's scope, so the answers are complete.
- Create Reservations, view and cancel their own, and see every other user's pending Reservations without their ID or description.
- View Azure resources in the Discover section and through `/azure`, limited to what their own Azure permissions allow.
- View the virtual networks available to associate with a Block, limited to what their own Azure permissions allow.
- View notifications, and view and change their own settings.

## Permissions

Paths are relative to the `/api` base path, as in the [API documentation](/api/README.md). Where a permission changes what a response contains, rather than whether you can call a route, it's described under **Decisions**.

### Spaces

| Permission       | Allows                                                                         | Routes and Decisions                                                                                                                                           | Held By       |
|------------------|--------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| `spaces/create`  | Create Spaces.                                                                 | `POST /spaces`                                                                                                                                                 | Administrator |
| `spaces/update`  | Change a Space's name or description.                                          | `PATCH /spaces/{space}`                                                                                                                                        | Administrator |
| `spaces/delete`  | Delete Spaces.                                                                 | `DELETE /spaces/{space}`                                                                                                                                       | Administrator |
| `spaces/expand`  | Request Spaces and Blocks with their networks expanded to full Azure details. | The `expand=true` query parameter on `GET /spaces`, `GET /spaces/{space}`, `GET /spaces/{space}/blocks` and `GET /spaces/{space}/blocks/{block}`. Without it, `expand=true` returns `403`. | Administrator |

### Blocks

| Permission      | Allows                          | Routes and Decisions                     | Held By       |
|-----------------|---------------------------------|------------------------------------------|---------------|
| `blocks/create` | Create Blocks.                  | `POST /spaces/{space}/blocks`            | Administrator |
| `blocks/update` | Change a Block's name or CIDR.  | `PATCH /spaces/{space}/blocks/{block}`   | Administrator |
| `blocks/delete` | Delete Blocks.                  | `DELETE /spaces/{space}/blocks/{block}`  | Administrator |

### Block Network Associations

| Permission            | Allows                                          | Routes and Decisions                                     | Held By       |
|-----------------------|-------------------------------------------------|----------------------------------------------------------|---------------|
| `associations/read`   | List the networks associated with a Block.      | `GET /spaces/{space}/blocks/{block}/networks`            | Administrator, User |
| `associations/create` | Associate a network with a Block.               | `POST /spaces/{space}/blocks/{block}/networks`           | Administrator |
| `associations/update` | Replace the networks associated with a Block.   | `PUT /spaces/{space}/blocks/{block}/networks`            | Administrator |
| `associations/delete` | Remove networks from a Block.                   | `DELETE /spaces/{space}/blocks/{block}/networks`         | Administrator |

Users can still associate a virtual network they own without `associations/create`, by creating a Reservation and tagging the virtual network with its ID. See [Using the Reservation Tag](/how-to/README.md#using-the-reservation-tag).

### External Networks

Each of these permissions covers External Networks and their subnets and endpoints. The routes below all begin with `/spaces/{space}/blocks/{block}/externals`, shown as `…`.

| Permission         | Allows                                                        | Routes and Decisions                                                                                                                                                                                                  | Held By       |
|--------------------|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| `externals/read`   | Read External Networks, and their subnets and endpoints.      | `GET …`, `GET …/{external}`, `GET …/{external}/subnets`, `GET …/{external}/subnets/{subnet}`, `GET …/{external}/subnets/{subnet}/endpoints` and `GET …/{external}/subnets/{subnet}/endpoints/{endpoint}` | Administrator, User |
| `externals/create` | Create External Networks, and their subnets and endpoints.    | `POST …`, `POST …/{external}/subnets` and `POST …/{external}/subnets/{subnet}/endpoints`                                                                                                                              | Administrator |
| `externals/update` | Change External Networks, and their subnets and endpoints.    | `PATCH …/{external}`, `PATCH …/{external}/subnets/{subnet}`, `PUT …/{external}/subnets/{subnet}/endpoints` and `PATCH …/{external}/subnets/{subnet}/endpoints/{endpoint}`                                         | Administrator |
| `externals/delete` | Delete External Networks, and their subnets and endpoints.    | `DELETE …/{external}`, `DELETE …/{external}/subnets/{subnet}`, `DELETE …/{external}/subnets/{subnet}/endpoints` and `DELETE …/{external}/subnets/{subnet}/endpoints/{endpoint}`                                   | Administrator |

### Reservations

Creating Reservations, viewing and cancelling your own, and seeing other users' pending Reservations without their ID or description, needs no permission. These permissions extend those actions to Reservations created by other users.

| Permission                | Allows                                                 | Routes and Decisions                                                                                                                                                                                                                                                         | Held By       |
|---------------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| `reservations/read/all`   | See every user's Reservations in full, not only your own. | **Decisions:** without it, the Reservations included in Spaces and Blocks (`GET /spaces`, `GET /spaces/{space}`, `GET /spaces/{space}/blocks` and `GET /spaces/{space}/blocks/{block}`) and the Reservation lists (`GET /spaces/{space}/reservations` and `GET /spaces/{space}/blocks/{block}/reservations`) include another user's Reservation only while it's pending, with its `id` and `desc` (and `tag`, where present) set to `null`. `GET /spaces/{space}/blocks/{block}/available` names another user's Reservation in `blocked_by` with a `null` name, and `GET /spaces/{space}/blocks/{block}/reservations/{reservation}` returns `403` for a Reservation you didn't create. | Administrator |
| `reservations/delete/all` | Cancel every user's Reservations, not only your own.   | **Decision:** without it, `DELETE /spaces/{space}/blocks/{block}/reservations` and `DELETE /spaces/{space}/blocks/{block}/reservations/{reservation}` return `403` if any Reservation in the request was created by someone else.                                                  | Administrator |

### Azure

| Permission       | Allows                                                                                     | Routes and Decisions                                                                                                                                                                                                                                                                                                                                                                                           | Held By       |
|------------------|--------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|
| `azure/read/all` | See Azure resources through Azure IPAM's own access, beyond your own Azure permissions. | **Decisions:** with it, the Azure resource listings (`/azure` and the Discover section) and `GET /spaces/{space}/blocks/{block}/available` use Azure IPAM's own access and cover its whole scope. Without it, they use your own Azure permissions. `POST /tools/cidrCheck` always checks every network, but without this permission it leaves out the name, ID, resource group, subscription and tenant of any overlapping network that isn't associated with a Block. `POST /tools/nextAvailableSubnet` accepts a virtual network that isn't associated with a Block only if you can see it through your own Azure permissions, and returns `400` for it if you're signed in as a service principal. | Administrator |

### Administration

| Permission          | Allows                                          | Routes and Decisions                                          | Held By       |
|---------------------|-------------------------------------------------|---------------------------------------------------------------|---------------|
| `admins/read`       | List Azure IPAM administrators.                 | `GET /admin/admins` and `GET /admin/admins/{objectId}`        | Administrator |
| `admins/create`     | Add Azure IPAM administrators.                  | `POST /admin/admins`                                          | Administrator |
| `admins/update`     | Replace the list of Azure IPAM administrators.  | `PUT /admin/admins`                                           | Administrator |
| `admins/delete`     | Remove Azure IPAM administrators.               | `DELETE /admin/admins/{objectId}`                             | Administrator |
| `exclusions/read`   | List excluded subscriptions.                    | `GET /admin/exclusions`                                       | Administrator |
| `exclusions/create` | Exclude subscriptions.                          | `POST /admin/exclusions`                                      | Administrator |
| `exclusions/update` | Replace the list of excluded subscriptions.     | `PUT /admin/exclusions`                                       | Administrator |
| `exclusions/delete` | Stop excluding a subscription.                  | `DELETE /admin/exclusions/{subscriptionId}`                   | Administrator |

### Users and Notifications

| Permission             | Allows                        | Routes and Decisions                                   | Held By       |
|------------------------|-------------------------------|--------------------------------------------------------|---------------|
| `users/read`           | List every Azure IPAM user.   | `GET /users`                                           | Administrator |
| `notifications/update` | Resolve notifications.        | `POST /notifications/{notification_id}/resolve`        | Administrator |

## Responses When a Permission Is Missing

If you call a route without the permission it requires, Azure IPAM returns `403 Forbidden` with the detail `API restricted to admins.`. If you set `expand=true` without `spaces/expand`, the detail is `Expand parameter can only be used by admins.`. Permissions that change what a response contains, such as `reservations/read/all`, don't cause an error. The response simply includes less.

In the [interactive API documentation](/api/README.md), operations that need a permission the User role doesn't hold are marked **(Admin Only)**.
