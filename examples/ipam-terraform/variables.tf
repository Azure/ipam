variable "location" {
  description = "The Azure location to deploy resources to."
}

variable "rg_name" {
  description = "Name for the new Resource Group."
}

variable "vnet_name" {
  description = "Name for the new Virtual Network."
}

variable "vnet_size" {
  description = "Size of the new Virtual Network (Subnet Mask bits)."
}

variable "ipam_space" {
  description = "Space in which to create a new CIDR reservation."
}

variable "ipam_block" {
  description = "Block in which to create a new CIDR reservation."
}

variable "ipam_api_guid" {
  description = "GUID for the Exposed API on the Engine App Registration."
}

variable "ipam_app_name" {
  description = "Name of the App Service or Function running the IPAM Engine."
}
