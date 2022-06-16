// Global parameters
targetScope = 'subscription'

@description('Landing Zone Prefix')
param landingZonePrefix string

@description('GUID for Resource Naming')
param guid string = newGuid()

@description('Deployment Location')
param location string = deployment().location

@description('API Scope for Access Token')
param ipamApiScope string

@description('Azure IPAM Endpoint')
param ipamEndpoint string

@description('IPAM Space')
param ipamSpace string

@description('IPAM Space')
param ipamBlock string

// Resource naming variables
var logAnalyticsWorkspaceName = '${landingZonePrefix}-law-${uniqueString(guid)}'
var managedIdentityName = '${landingZonePrefix}-mi-${uniqueString(guid)}'
var networkSvcsResourceGroupName = '${landingZonePrefix}NetworkSvcs-rg-${uniqueString(guid)}'
var sharedSvcsResourceGroupName = '${landingZonePrefix}SharedSvcs-rg-${uniqueString(guid)}'
var vnetName = '${landingZonePrefix}-vnet-${uniqueString(guid)}'


//Resource Groups
resource sharedSvcsResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  name: sharedSvcsResourceGroupName
}

resource networkSvcsResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  location: location
  name: networkSvcsResourceGroupName
}

// Managed Identity for Secure Access to KeyVault
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

// Virtual Network Prefix Script
module fetchAddressPrefix 'fetchAddressPrefix.bicep' = {
  name: 'fetchAddressPrefixModule'
  scope: networkSvcsResourceGroup
  params: {
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
