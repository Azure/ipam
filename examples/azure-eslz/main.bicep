targetScope = 'subscription'

@description('Landing Zone Prefix')
param landingZonePrefix string

@description('Deployment Location')
param location string = deployment().location

@description('API Scope for Access Token (e.g. api://<Engine Client ID>)')
param ipamApiScope string

@description('Azure IPAM Endpoint (e.g. https://myipam.azurewebsites.net)')
param ipamEndpoint string

@description('IPAM Space')
param ipamSpace string

@description('IPAM Block')
param ipamBlock string

@description('Reservation size as a CIDR mask (e.g. 24 for a /24)')
param reservationSize int = 24

// Deterministic suffix for resource naming (stable across redeployments)
var uniqueSuffix = uniqueString(subscription().subscriptionId, landingZonePrefix, location)
var logAnalyticsWorkspaceName = '${landingZonePrefix}-law-${uniqueSuffix}'
var managedIdentityName = '${landingZonePrefix}-mi-${uniqueSuffix}'
var keyVaultName = '${landingZonePrefix}-kv-${uniqueSuffix}'
var networkSvcsResourceGroupName = '${landingZonePrefix}-NetworkSvcs-rg'
var sharedSvcsResourceGroupName = '${landingZonePrefix}-SharedSvcs-rg'
var vnetName = '${landingZonePrefix}-vnet-${uniqueSuffix}'

// Resource Groups
resource sharedSvcsResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  location: location
  name: sharedSvcsResourceGroupName
}

resource networkSvcsResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  location: location
  name: networkSvcsResourceGroupName
}

// Managed Identity
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: sharedSvcsResourceGroup
  params: {
    managedIdentityName: managedIdentityName
    location: location
  }
}

// Log Analytics Workspace
module logAnalytics 'logAnalytics.bicep' = {
  name: 'logAnalyticsModule'
  scope: sharedSvcsResourceGroup
  params: {
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    location: location
  }
}

// Key Vault
module keyVault 'keyVault.bicep' = {
  name: 'keyVaultModule'
  scope: sharedSvcsResourceGroup
  params: {
    keyVaultName: keyVaultName
    location: location
  }
}

// IPAM Reservation via Deployment Script
module fetchAddressPrefix 'fetchAddressPrefix.bicep' = {
  name: 'fetchAddressPrefixModule'
  scope: networkSvcsResourceGroup
  params: {
    ipamApiScope: ipamApiScope
    ipamBlock: ipamBlock
    ipamEndpoint: ipamEndpoint
    ipamSpace: ipamSpace
    reservationSize: reservationSize
    location: location
    managedIdentityId: managedIdentity.outputs.id
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
  }
}

// Virtual Network (tagged with IPAM reservation ID for automatic settlement)
module vnet 'vnet.bicep' = {
  name: 'vnetModule'
  scope: networkSvcsResourceGroup
  params: {
    ipamReservationId: fetchAddressPrefix.outputs.reservationId
    location: location
    vnetAddressPrefix: fetchAddressPrefix.outputs.addressPrefix
    vnetName: vnetName
  }
}
