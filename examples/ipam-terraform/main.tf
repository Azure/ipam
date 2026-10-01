# Reserve address space from Azure IPAM
resource "azureipam_reservation" "vnet" {
  space  = var.ipam_space
  blocks = [var.ipam_block]
  size   = var.vnet_size
}

# Create a Resource Group
resource "azurerm_resource_group" "rg" {
  name     = var.rg_name
  location = var.location
}

# Create a Virtual Network using the reserved CIDR.
# The reservation tags include X-IPAM-RES-ID, which allows Azure IPAM
# to automatically detect and settle the reservation.
resource "azurerm_virtual_network" "network" {
  name                = var.vnet_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  address_space       = [azureipam_reservation.vnet.cidr]

  tags = azureipam_reservation.vnet.tags
}
