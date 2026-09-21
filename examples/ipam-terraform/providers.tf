terraform {
  required_version = ">= 1.4.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    azureipam = {
      source  = "xtratuscloud/azureipam"
      version = "~> 2.0"
    }
  }
}

# Obtain an access token for the Azure IPAM Engine API.
#
# NOTE: The token value will be stored in Terraform state. If this is a concern
# for your environment, set the AZUREIPAM_TOKEN environment variable instead and
# remove this block (and the 'token' argument from the azureipam provider below).
# Environment variables are not persisted to state.
data "external" "ipam_token" {
  program = ["az", "account", "get-access-token",
    "--resource", "api://${var.ipam_api_scope}",
    "--query", "{accessToken:accessToken}"
  ]
}

provider "azurerm" {
  features {}
}

provider "azureipam" {
  api_url = var.ipam_endpoint
  token   = data.external.ipam_token.result.accessToken
}
