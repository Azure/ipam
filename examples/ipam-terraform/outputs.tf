# Output Virtual Network CIDR
output "new_vnet_cidr" {
  value = data.external.ipam-reservation.result.cidr
}

# Output TAG to apply to new Virtual Network
output "new_vnet_tag" {
  value = {
    X-IPAM-RES-ID = data.external.ipam-reservation.result.id
  }
}

# Output IPAM token
# output "ipam_token" {
#   value = data.external.ipam-token.result.token
# }
