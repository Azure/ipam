// Global parameters
targetScope = 'subscription'

@description('CIDR Block Size')
param cidrSize int

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Landing Zone Prefix')
param landingZonePrefix string

@description('Deployment Location')
param location string = deployment().location

@description('API Scope for Access Token')
param ipamApiScope string

@description('IPAM Space')
param ipamBlock string

@description('Azure IPAM Endpoint')
param ipamEndpoint string

@description('IPAM Space')
param ipamSpace string

// Resource naming variables
var managedIdentityName = '${landingZonePrefix}-mi-${uniqueString(guid)}'
var networkSvcsResourceGroupName = '${landingZonePrefix}NetworkSvcs-rg-${uniqueString(guid)}'
var vnetName = '${landingZonePrefix}-vnet-${uniqueString(guid)}'


//Resource Group
resource networkSvcsResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  name: networkSvcsResourceGroupName
}

// Managed Identity
module managedIdentity 'managedIdentity.bicep' = {
  name: 'managedIdentityModule'
  scope: networkSvcsResourceGroup
  params: {
    managedIdentityName: managedIdentityName
    location: location
  }
}

// Virtual Network Prefix Script
module fetchAddressPrefix 'fetchAddressPrefix.bicep' = {
  name: 'fetchAddressPrefixModule'
  scope: networkSvcsResourceGroup
  params: {
    cidrSize: cidrSize
    ipamApiScope: ipamApiScope
    ipamBlock: ipamBlock
    ipamEndpoint: ipamEndpoint
    ipamSpace: ipamSpace
    location: location
    managedIdentityId: managedIdentity.outputs.id
  }
}

// Virtual Network
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
