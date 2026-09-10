# Placeholder Screenshots for Documentation

The following screenshots are needed for various documentation pages. Each filename corresponds to an image reference in `../README.md`.

---

## Administration

- [ ] `ipam_admin_user_search.png` — Admin page with the User/Principal toggle set to **User**, showing the "User Search" label in the search bar
- [ ] `ipam_admin_principal_search.png` — Admin page with the toggle set to **Principal**, showing the "Principal Search" label in the search bar
- [ ] `ipam_admin_search_results.png` — Admin search bar with a name typed and the autocomplete dropdown showing matching results

---

## Reservations

### Navigation & Page Layout

- [ ] `resv_nav_configure_reservations.png` — IPAM sidebar showing Configure → Reservations navigation path
- [ ] `resv_configure_page.png` — Full Reservations page with Space/Block/Network selectors and empty grid (showing "Please Select a Space & Block")

### Viewing Reservations

- [ ] `resv_grid_with_data.png` — Reservations grid populated with several reservations in various states (waiting, fulfilled, cancelled)
- [ ] `resv_toggle_filter.png` — Action menu showing the "Showing Active" / "Showing All" toggle option

### Creating Reservations

- [ ] `resv_new_reservation_menu.png` — Action menu showing the "New Reservation" option
- [ ] `resv_create_by_size.png` — Create Reservation dialog with the "By Size" radio selected, showing the Mask dropdown, Reverse Search toggle, and Smallest CIDR toggle
- [ ] `resv_create_by_cidr.png` — Create Reservation dialog with the "By CIDR" radio selected, showing the CIDR text field

### Managing Reservations

- [ ] `resv_copy_id.png` — Reservation row showing the copy icon in the actions column (ideally with the tooltip visible)
- [ ] `resv_cancel_selected.png` — Reservations grid with one or more rows selected via checkboxes, showing the red Remove (X) button in the upper-right

### Reservation Screenshot Tips

- Use realistic data (e.g., reservations like "10.1.5.0/24" with descriptions like "Project Alpha vNET")
- Include reservations in multiple statuses if possible (Waiting, Fulfilled, Cancelled) for the grid screenshot
- For the Create dialog screenshots, show both radio options clearly — one with "By Size" selected and one with "By CIDR" selected
- Make sure the Space/Block selectors are populated so users can see the full context

---

## External Networks

- [ ] `ext_nav_configure_externals.png` — IPAM sidebar showing Configure → Externals navigation path
- [ ] `ext_configure_page.png` — Full Externals configuration page with Space/Block selectors, External Networks grid (top), and Subnets grid (bottom)

## External Networks (CRUD)

- [ ] `ext_add_network_menu.png` — Action menu showing "Add Network" option on the External Networks grid
- [ ] `ext_add_network_dialog.png` — Add External Network dialog with Name, Description, and Size/CIDR fields
- [ ] `ext_edit_network_menu.png` — Action menu showing "Edit Network" option (with a network selected)
- [ ] `ext_edit_network_dialog.png` — Edit External Network dialog with pre-populated fields
- [ ] `ext_delete_network_menu.png` — Action menu showing "Delete Network" option
- [ ] `ext_delete_network_dialog.png` — Delete External Network confirmation dialog (ideally showing the Force Delete checkbox)

## External Subnets (CRUD)

- [ ] `ext_subnets_grid.png` — Subnets grid populated with subnets for a selected External Network
- [ ] `ext_add_subnet_menu.png` — Action menu showing "Add Subnet" option on the Subnets grid
- [ ] `ext_add_subnet_dialog.png` — Add External Subnet dialog
- [ ] `ext_edit_subnet_dialog.png` — Edit External Subnet dialog
- [ ] `ext_delete_subnet_dialog.png` — Delete External Subnet confirmation dialog

## External Endpoints

- [ ] `ext_manage_endpoints_menu.png` — Action menu showing "Manage Endpoints" option on the Subnets grid
- [ ] `ext_manage_endpoints_dialog.png` — Full Manage Endpoints dialog showing the add/edit form at top and endpoints grid at bottom
- [ ] `ext_add_endpoint_form.png` — Close-up of the endpoint add form with Name, Description, and IP Address (showing the IP dropdown with available addresses)
- [ ] `ext_save_endpoints.png` — Manage Endpoints dialog with staged changes ready to save

## External Network Screenshot Tips

- Use a realistic-looking dataset (e.g., "OnPrem-DC1" with subnets like "ServerVLAN", "DesktopVLAN" and endpoints like "db-server-01")
- Ensure the Space/Block selectors are populated in all screenshots so users can see the full context
- For the Force Delete screenshots, show both the initial state and the confirmed state if possible

---

## Virtual Hubs (vHubs)

- [ ] `discover_vhubs.png` — Discover → vHubs tab showing the vHubs data grid with columns: Name, Virtual WAN, Block, Prefixes, Resource Group (ideally with at least one vHub associated to a Block)
