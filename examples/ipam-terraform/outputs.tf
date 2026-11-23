output "reservation_id" {
  description = "The IPAM reservation ID."
  value       = azureipam_reservation.vnet.id
}

output "reserved_cidr" {
  description = "The reserved CIDR block assigned to the virtual network."
  value       = azureipam_reservation.vnet.cidr
}

output "vnet_id" {
  description = "The Azure resource ID of the deployed virtual network."
  value       = azurerm_virtual_network.network.id
}
