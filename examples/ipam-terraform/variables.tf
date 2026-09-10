variable "location" {
  type        = string
  description = "The Azure location to deploy resources to."
}

variable "rg_name" {
  type        = string
  description = "Name for the new Resource Group."
}

variable "vnet_name" {
  type        = string
  description = "Name for the new Virtual Network."
}

variable "vnet_size" {
  type        = number
  description = "Reservation size as a CIDR mask (e.g. 24 for a /24)."
  default     = 24
}

variable "ipam_space" {
  type        = string
  description = "IPAM Space containing the target Block."
}

variable "ipam_block" {
  type        = string
  description = "IPAM Block to reserve address space from."
}

variable "ipam_endpoint" {
  type        = string
  description = "Base URL of your Azure IPAM instance (e.g. https://myipam.azurewebsites.net)."
}

variable "ipam_api_scope" {
  type        = string
  description = "App ID URI of the IPAM Engine App Registration (e.g. d47d5cd9-b599-4a6a-9d54-254565ff08de)."
}
