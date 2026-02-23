# How to Use IPAM

## Authentication and Authorization

![IPAM Homepage](./images/home_page.png)

IPAM leverages the [Microsoft Authentication Library (MSAL)](https://docs.microsoft.com/azure/active-directory/develop/msal-overview) in order to authenticate users. It uses your existing Azure AD credentials to authenticate you and leverages your existing Azure RBAC permissions to authorize what information is visible from within the IPAM tool.

IPAM has the concept of an **IPAM Administrator**. While using the IPAM tool as an administrator, you are viewing Azure resources through the permissions of the Engine Service Principal which, by default, has [Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#reader) at the [Tenant Root Management Group](https://learn.microsoft.com/azure/governance/management-groups/overview#root-management-group-for-each-directory) level (unless specified otherwise at deployment time). Upon initial deployment, no IPAM administrators are set which has the effect of **all** users having administrative rights. You can define who within your Azure AD Tenant should be designated as an IPAM administrator via the **Admin** section of the menu blade.

![IPAM Admins](./images/ipam_admin_admins.png)

IPAM administrators have the ability to configure create/update [Spaces](#spaces) and [Blocks](#blocks) via the **Configure** section of the menu blade (more on that below). Once at least one IPAM administrator is set, non-admin users will only see resources in IPAM they already have access to from the Azure Portal, and the administrative functions of the IPAM tool will no longer be available to them.

![IPAM Admins Config](./images/ipam_administrators_config.png)

## Subscription Exclusion/Inclusion

As an IPAM administrator, you have the ability to include/exclude subscriptions from the IPAM view. To do so, expand the **Admin** section of the menu blade and select **Subscriptions**.

![IPAM Admin Subscriptions](./images/ipam_admin_subscriptions.png)

From this screen, you can select Subscriptions which are to be <u>**excluded**</u> from IPAM by clicking on them. Once selected for exclusion, the subscription will be highlighted in **red**. Don't forget to click **save** in the upper-right once complete.

![IPAM Admin Subscriptions Config](./images/ipam_admin_subscriptions_config.png)

## Spaces

A **Space** represents a logical grouping of *unique* IP address space. **Spaces** can contain both contiguous and non-contiguous IP address CIDR blocks. A **Space** cannot contain any overlapping CIDR blocks. As an IPAM user, you can get to the **Spaces** tab via the **Discover** section of the menu blade. From the **Spaces** tab, you can see utilization metrics for each **Space**.

![IPAM Spaces](./images/discover_spaces.png)

As an IPAM Administrator, you can add **Spaces** via the **Configure** section of the menu blade. Clicking on the 3 ellipses will bring up a menu of **Space** operations. Select **Add Space**.

![IPAM Add Space](./images/add_space.png)

Give the new **Space** a name and a description, then click **Create** to create a new **Space**.

![IPAM Add Space Details](./images/add_space_details.png)

## Blocks

A **Block** represents an IP address CIDR range. It can contain vNETs whose address space resides within the defined CIDR range of the **Block**. **Blocks** cannot contain vNETs with overlapping address space. As an IPAM user, you can get to the **Blocks** tab via the **Discover** section of the menu blade. From the **Blocks** tab, you can see utilization metrics for each **Block**.

![IPAM Blocks](./images/discover_blocks.png)

As an IPAM Administrator, you can add **Blocks** via the **Configure** section of the menu blade. After selecting which **Space** you want to add a **Block** to, clicking on the 3 ellipses will bring up a menu of **Block** operations. Select **Add Block**.

![IPAM Add Block](./images/add_block.png)

Give the new **Block** a name a valid CIDR range, then click **Create** to create add a new **Block** to the target **Space**.

![IPAM Add Block Details](./images/add_block_details.png)

## Virtual Network Association

As an IPAM Administrator, you can associate Azure virtual networks to **Blocks**. To associate a virtual network to a **Block**, select the **Block** you want to associate the virtual network to, then click on the 3 ellipses to bring up a menu of **Block** operations. Select **Virtual Networks**.

![IPAM Associate vNETs](./images/virtual_network_association.png)

Place a checkmark next to the virtual networks you'd like to associate to the target **Block**, or un-check virtual networks you'd like to disassociate from the target **Block**, then click **Apply**.

![IPAM Associate vNETs Details](./images/virtual_network_association_details.png)

## Reservations

A **Reservation** allows you to claim a CIDR range within a **Block** before you actually create an Azure virtual network. Think of it like placing a hold on address space — the reserved CIDR is excluded from future allocations (including new reservations, virtual network associations, and External Networks) until the reservation is either fulfilled or cancelled.

Reservations are useful when you need to coordinate network creation across teams or processes. For example, a platform team might reserve a /24 for a project team that isn't ready to deploy their virtual network yet. The reserved space is guaranteed to be available when they need it.

### How Reservations Work

When you create a reservation, IPAM finds the next available CIDR range of the requested size within the target Block and marks it as reserved. The reservation is assigned a unique **Reservation ID** and a status of **Waiting**. From there, the reservation follows a lifecycle:

1. **Waiting** — The reservation is active and the CIDR is held. IPAM is watching for a virtual network tagged with the reservation ID.
2. **Fulfilled** — A virtual network with the reservation's `X-IPAM-RES-ID` tag was discovered, its address space matches the reserved CIDR, and it has been automatically associated with the Block.
3. **Cancelled by User** — An administrator or the user who created the reservation manually cancelled it.
4. **Cancelled by Timeout** — The reservation expired based on the configured timeout policy.
5. **Warning: CIDR Mismatch** — A virtual network with the reservation's tag was found, but its address space does not match the reserved CIDR.
6. **Error: CIDR Overlap** — A virtual network with an overlapping CIDR has already been associated with the Block through another path. (Legacy status value: `errCIDRExists`; new status value: `errCIDROverlap`.)

> **Tip:** When a reservation is fulfilled, the response includes a `tag` object containing `X-IPAM-RES-ID`. Apply this tag to your new virtual network and IPAM will automatically detect it, associate the vNET with the Block, and mark the reservation as fulfilled.

### Reservation Permissions

Both IPAM administrators and regular users can create and manage reservations. However, non-admin users can only see and manage reservations they created themselves. Administrators can view and manage all reservations across all users.

### Managing Reservations via the UI

Reservations are managed from the **Configure** section of the IPAM menu blade. Navigate to **Configure → Reservations** to access the Reservations management interface.

![Reservations Navigation](./images/resv_nav_configure_reservations.png)

#### The Reservations Page

The Reservations page displays a data grid of all reservations for the selected Block. At the top of the page, you'll find selectors for **Space**, **Block**, and a read-only **Network** field that shows the Block's CIDR range.

![Reservations Page](./images/resv_configure_page.png)

You must select both a **Space** and a **Block** before you can view or manage reservations.

> **Shortcut:** You can also navigate directly to Reservations from the **Basics** tab. Select a Block, open the action menu (3 ellipses), and choose **Reservations**. This will take you to the Reservations tab with the Space and Block pre-selected.

#### Viewing Reservations

The data grid shows the following information for each reservation:

- **CIDR** — The reserved CIDR range
- **Created By** — The user or service principal that created the reservation
- **Description** — An optional description provided at creation time
- **Creation Date** — When the reservation was created
- **Settled Date** — When the reservation was fulfilled or cancelled (hidden by default)
- **Settled By** — Who or what settled the reservation (hidden by default)
- **Status** — A status icon indicating the current state of the reservation

![Reservations Grid](./images/resv_grid_with_data.png)

#### Filtering Active vs. Settled Reservations

By default, the grid shows only **active** (unsettled) reservations. To view all reservations including those that have been fulfilled or cancelled, open the action menu (3 ellipses) and click **Showing Active** to toggle to **Showing All**. Click it again to switch back to active-only view.

![Toggle Reservation Filter](./images/resv_toggle_filter.png)

#### Creating a Reservation

To create a new reservation, open the action menu (3 ellipses) and select **New Reservation**. You must have a Space and Block selected before this option becomes available.

![New Reservation Menu](./images/resv_new_reservation_menu.png)

The **Create Reservation** dialog gives you two ways to specify the CIDR range:

**By Size (default):**

Select this option to have IPAM automatically find the next available CIDR of the requested size. Choose a subnet **Mask** from the dropdown (available masks are based on the Block's CIDR range). You can also configure two optional search behaviors:

- **Reverse Search** — When enabled, IPAM allocates from the *end* of the Block rather than the beginning. This is useful when you want to keep the beginning of the Block available for larger allocations.
- **Smallest CIDR** — When enabled, IPAM uses the smallest available contiguous block that fits the requested size, rather than the first one it finds. This helps avoid fragmenting large open ranges.

![Create Reservation By Size](./images/resv_create_by_size.png)

**By CIDR:**

Select this option to request a specific CIDR range. Enter the CIDR in standard notation (e.g., `10.1.5.0/24`). The CIDR must be within the Block's range and cannot overlap any existing virtual networks, reservations, or External Networks.

![Create Reservation By CIDR](./images/resv_create_by_cidr.png)

Optionally, you can add a **Description** to help identify the purpose of the reservation.

Click **Create** to submit the reservation. On success, you'll see a confirmation notification and the new reservation will appear in the grid.

#### Copying a Reservation ID

Each active reservation has a copy icon in the actions column. Click it to copy the **Reservation ID** to your clipboard. You'll need this ID to tag your virtual network so IPAM can automatically associate it with the Block when the vNET is created.

![Copy Reservation ID](./images/resv_copy_id.png)

> **Tip:** The copy icon is only available for unsettled reservations. Once a reservation is fulfilled or cancelled, the ID is no longer actionable.

#### Cancelling Reservations

To cancel one or more reservations, select them using the checkboxes in the grid, then click the **Remove** button (red X icon) in the upper-right corner of the page.

![Cancel Reservations](./images/resv_cancel_selected.png)

Cancelled reservations are not hard-deleted — they are marked as **Cancelled by User** and remain visible when viewing all reservations. This provides an audit trail of reservation activity.

### Using the Reservation Tag

The key to the reservation workflow is the `X-IPAM-RES-ID` tag. When you create a reservation, IPAM returns a tag value in the response. Apply this tag to the Azure virtual network you create with the reserved CIDR:

```
Tag Key:   X-IPAM-RES-ID
Tag Value: <reservation-id>
```

IPAM's background reconciliation process periodically scans for virtual networks with this tag. When it finds a match, it:

1. Verifies the vNET's address space against the reserved CIDR
2. Associates the vNET with the Block
3. Marks the reservation as **Fulfilled**

This tag-based approach means you can create the reservation through IPAM and then create the virtual network through any mechanism you prefer — Azure Portal, CLI, PowerShell, Terraform, Bicep, or any other IaC tool.

### Managing Reservations via the API

All reservation operations are also available through the Azure IPAM REST API. For the full list of available endpoints and example calls, please see the [CIDR Reservations](/api/README.md#cidr-reservations) section of the API documentation.

### Tips and Best Practices

- **Use descriptions**: Always add a description when creating a reservation so it's clear what the reservation is for, especially in environments with multiple teams
- **Copy the tag immediately**: After creating a reservation, copy the Reservation ID right away and store it somewhere accessible. You'll need it to tag your virtual network.
- **Match your CIDR exactly**: When creating a vNET to fulfill a reservation, make sure the vNET's address space matches the reserved CIDR exactly. A mismatch will result in a warning status.
- **Monitor reservation status**: Check in on your reservations periodically. A reservation stuck in "Waiting" may indicate the vNET was created without the proper tag.
- **Use Reverse Search for large Blocks**: If you have a large Block and want to avoid fragmenting the beginning of the range, enable **Reverse Search** to allocate from the end.
- **Use Smallest CIDR to reduce fragmentation**: Enable **Smallest CIDR** when you want to preserve larger contiguous ranges for future use

## vNETs, Subnets, and Endpoints

As an IPAM user, you can view IP address utilization information and detailed Azure resource related information for **vNETs**, **Subnets**, and **Endpoints** you have existing Azure RBAC access to.

### Virtual Networks

For **vNETs**, you can find the name, view the parent **Block** (if assigned), utilization metrics, and the **vNET** address space(s).

![IPAM vNETs](./images/discover_vnets.png)

By clicking to expand the **vNET** details, you can find more granular **vNET** information and are presented the option to view the **vNET** resource directly in the Azure Portal by clicking on **VIEW IN PORTAL**.

![IPAM vNETs Details](./images/discover_vnets_details.png)

### Subnets

For **Subnets**, you can find the name, view the parent **vNET**, utilization metrics, and the **Subnet** address range.

![IPAM Subnets](./images/discover_subnets.png)

By clicking to expand the **Subnet** details, you can find more granular **Subnet** information and are presented the option to view the **Subnet** resource directly in the Azure Portal by clicking on **VIEW IN PORTAL**.

![IPAM Subnets Details](./images/discover_subnets_details.png)

### Endpoints

For **Endpoints**, you can find the name, view the parent **vNET** and **Subnet**, Resource Group, and the private IP of the **Endpoint**

![IPAM Endpoints](./images/discover_endpoints.png)

By clicking to expand the **Endpoint** details, you can find more granular **Endpoint** information (which varies based on the endpoint type) and are presented the option to view the **Endpoint** resource directly in the Azure Portal by clicking on **VIEW IN PORTAL**.

![IPAM Endpoints Details](./images/discover_endpoints_details.png)

## External Networks

Azure IPAM is primarily designed to discover and manage IP address space within Azure. However, many organizations also need to track IP address utilization for networks that exist **outside of Azure**. This could include on-premises datacenter networks, co-location facilities, other cloud providers, or any IP space that is part of your overall enterprise addressing scheme but is not natively managed by Azure.

**External Networks** in Azure IPAM were designed to address this need. They allow you to:

- **Map non-Azure CIDR ranges** within your existing Blocks to indicate that the address space is allocated elsewhere
- **Define subnets** within those external networks to represent the various network segments where endpoints reside
- **Track individual endpoints** within those subnets, including their names, descriptions, and IP addresses
- **Prevent address conflicts** by accounting for externally managed IP space when planning new Azure network deployments or creating CIDR reservations

> **Note:** External Network management is an **IPAM Administrator** function. Only users designated as IPAM admins can create, modify, or delete External Networks, Subnets, and Endpoints. However, all users with access to IPAM can view the Manage Endpoints dialog for external subnets.

### How External Networks Fit Into the IPAM Hierarchy

External Networks live within the existing **Space → Block** hierarchy. A **Block** represents a CIDR range and can contain Azure virtual networks, CIDR reservations, *and* External Networks. The full hierarchy looks like this:

```
Space
└── Block (e.g. 10.0.0.0/16)
    ├── Azure Virtual Networks
    ├── CIDR Reservations
    └── External Networks (e.g. 10.0.100.0/24)
        └── External Subnets (e.g. 10.0.100.0/26)
            └── External Endpoints (e.g. 10.0.100.5)
```

When Azure IPAM calculates available address space within a Block (for example, when creating a new CIDR reservation or evaluating utilization), it accounts for External Networks alongside Azure virtual networks and existing reservations. This ensures that externally allocated space is never accidentally double-assigned.

### Managing External Networks via the UI

External Networks are managed from the **Configure** section of the IPAM menu blade. Navigate to **Configure → Externals** to access the External Networks management interface.

![External Networks Navigation](./images/ext_nav_configure_externals.png)

#### The Externals Configuration Page

The Externals page presents a split-pane view. The upper half displays **External Networks** for the selected Block, and the lower half displays **Subnets** for the currently selected External Network.

At the top of the page, you'll find selectors for **Space** and **Block**. You must select both a Space and a Block before you can view or manage External Networks.

![Externals Configuration Page](./images/ext_configure_page.png)

#### Adding an External Network

To add a new External Network, first select the target **Space** and **Block** using the dropdowns at the top. Then, open the action menu (3 ellipses) on the External Networks grid and select **Add Network**.

![Add External Network Menu](./images/ext_add_network_menu.png)

You will be presented with a dialog to define the new External Network:

- **Name**: A unique name for the external network (up to 64 characters; alphanumerics, underscores, hyphens, and periods are allowed)
- **Description**: A description of the external network (up to 128 characters; alphanumerics, spaces, underscores, hyphens, slashes, and periods are allowed)
- **CIDR**: You can specify the network size in one of two ways:
  - **Add by Size**: Select a subnet mask size, and IPAM will automatically assign the next available CIDR within the Block
  - **Add by CIDR**: Specify an exact CIDR range (must be within the parent Block and cannot overlap existing virtual networks, reservations, or other external networks)

![Add External Network Dialog](./images/ext_add_network_dialog.png)

Once created, the External Network will appear in the grid, and its CIDR range will be accounted for in the Block's utilization metrics.

#### Editing an External Network

To edit an existing External Network, select the network in the grid, then open the action menu and select **Edit Network**.

![Edit External Network Menu](./images/ext_edit_network_menu.png)

You can update the **Name**, **Description**, and **CIDR** of the External Network. The same validation rules apply as when creating a new network — the updated CIDR must remain within the parent Block and cannot overlap other allocated space.

![Edit External Network Dialog](./images/ext_edit_network_dialog.png)

#### Deleting an External Network

To delete an External Network, select it in the grid, open the action menu, and select **Delete Network**.

![Delete External Network Menu](./images/ext_delete_network_menu.png)

You will be asked to confirm the deletion. If the External Network contains subnets, you will need to enable the **Force Delete** option and confirm a second time before the deletion proceeds.

![Delete External Network Dialog](./images/ext_delete_network_dialog.png)

### Managing External Subnets

External Subnets represent the individual network segments within an External Network. These could correspond to physical subnets in an on-premises datacenter, VLANs, or any other logical network division.

#### Viewing External Subnets

When you select an External Network in the upper grid, the lower grid will populate with its associated Subnets. Each subnet displays its **Name**, **Description**, and **Address Range** (CIDR).

![External Subnets Grid](./images/ext_subnets_grid.png)

#### Adding an External Subnet

With an External Network selected, open the action menu on the Subnets grid and select **Add Subnet**.

![Add External Subnet Menu](./images/ext_add_subnet_menu.png)

Define the subnet with the following details:

- **Name**: A unique name within the parent External Network (up to 64 characters)
- **Description**: A description of the subnet (up to 128 characters)
- **CIDR**: Specify either by **size** (automatic assignment) or by **exact CIDR** (must fall within the parent External Network's CIDR range and cannot overlap sibling subnets)

![Add External Subnet Dialog](./images/ext_add_subnet_dialog.png)

#### Editing an External Subnet

Select a Subnet in the lower grid, open the action menu, and select **Edit Subnet** to modify its name, description, or CIDR.

![Edit External Subnet Dialog](./images/ext_edit_subnet_dialog.png)

#### Deleting an External Subnet

Select a Subnet, open the action menu, and choose **Remove Subnet**. If the subnet contains endpoints, you will need to use the **Force Delete** option.

![Delete External Subnet Dialog](./images/ext_delete_subnet_dialog.png)

### Managing External Endpoints

External Endpoints represent individual hosts or devices within an External Subnet. This is where you can track specific machines, appliances, or services along with their IP assignments.

#### Opening the Manage Endpoints View

Select a Subnet in the lower grid, then open the action menu and select **Manage Endpoints**. This opens a full-width dialog for managing all endpoints within the selected subnet.

![Manage Endpoints Menu](./images/ext_manage_endpoints_menu.png)

#### The Manage Endpoints Dialog

The Manage Endpoints dialog is divided into two sections:

1. **Add/Edit Form** (top): Fields for **Name**, **Description**, and **IP Address** with an action button to add or update an endpoint
2. **Existing Endpoints Grid** (bottom): A data grid showing all current endpoints with their names, descriptions, and IP addresses

![Manage Endpoints Dialog](./images/ext_manage_endpoints_dialog.png)

#### Adding an Endpoint

Fill in the endpoint details in the form at the top of the dialog:

- **Name**: A unique name for the endpoint (up to 64 characters)
- **Description**: A description of the endpoint (up to 128 characters)
- **IP Address**: Select an available IP address from the dropdown, or choose **\<auto\>** to have IPAM assign the next available IP within the subnet

Click **Add** to stage the endpoint. You can add multiple endpoints before saving.

![Add Endpoint Form](./images/ext_add_endpoint_form.png)

> **Tip:** The IP Address dropdown automatically shows only the available (unassigned) IP addresses within the subnet's CIDR range.

#### Editing an Endpoint

Click on an existing endpoint row in the grid to load it into the form at the top. Modify the desired fields, then click **Update** to stage the change.

#### Deleting Endpoints

Each endpoint row in the grid has a delete action. Click the delete icon on the row you want to remove to stage it for deletion.

#### Saving Endpoint Changes

All endpoint changes (additions, updates, and deletions) are staged locally in the dialog. Once you are satisfied with the changes, click **Save** to commit them all at once. This replaces the full endpoint list for the subnet in a single operation.

![Save Endpoints](./images/ext_save_endpoints.png)

### Managing External Networks via the API

All External Network operations are also exposed via the Azure IPAM REST API. You can manage External Networks, Subnets, and Endpoints programmatically just as you would any other IPAM resource. For the full list of available API endpoints and example calls, please see the [External Networks](/api/README.md#external-networks) section of the API documentation.

Additionally, for guidance on integrating External Network management into automated workflows, see the [Automation](/automation/README.md) documentation.

### Tips and Best Practices

- **Use descriptive names**: Name your External Networks and Subnets in a way that makes their physical or logical location immediately clear (e.g., `DC1-Floor2-ServerVLAN`, `AWS-US-East-1-VPC`)
- **Keep it current**: External Networks are only as useful as they are accurate. Consider automating synchronization with your existing network management tools
- **Leverage auto-assignment**: When adding endpoints, use the auto-assign IP feature (`ip: null` in the API, or `<auto>` in the UI) to let IPAM track the next available address
- **Plan before you allocate**: Since External Network CIDRs are accounted for in Block utilization calculations, adding them *before* creating new Azure virtual networks ensures you won't accidentally overlap
- **Use force delete judiciously**: The force delete option on External Networks and Subnets will remove all child objects. Use it carefully, especially in production environments
