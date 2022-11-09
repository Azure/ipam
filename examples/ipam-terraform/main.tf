# Get new CIDR and TAG from IPAM API
data "external" "ipam-reservation" {
  program = ["bash", "${path.root}/scripts/new-ipam-reservation.sh"]
  query = {
    apiGuid   = var.ipam_api_guid
    appName   = var.ipam_app_name
    ipamSpace = var.ipam_space
    ipamBlock = var.ipam_block
    vnetSize  = var.vnet_size
  }
}

# Create a Resource Group
resource "azurerm_resource_group" "rg" {
  name     = var.rg_name
  location = var.location
}

# Create a Virtual Network within the Resource Group
resource "azurerm_virtual_network" "network" {
  name                = var.vnet_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  address_space       = [data.external.ipam-reservation.result.cidr]

  tags = {
    X-IPAM-RES-ID = data.external.ipam-reservation.result.id
  }
}

# Get a Token for the IPAM scope
# data "external" "ipam-token" {
#   program = ["bash", "${path.root}/scripts/get-ipam-token.sh"]
#   query = {
#     apiGuid = var.ipam_api_guid
#   }
# }
