@description('IPAM Reservation ID')
param ipamReservationId string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Address prefix')
param vnetAddressPrefix string

@description('VNet Name')
param vnetName string

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
  }
  tags: {
    'X-IPAM-RES-ID': ipamReservationId
  }
}
