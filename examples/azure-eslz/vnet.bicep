@description('IPAM Reservation ID')
param ipamReservationId string

@description('Deployment Location')
param location string = resourceGroup().location

@description('Address prefix')
param vnetAddressPrefix string

@description('VNet Name')
param vnetName string

resource vnet 'Microsoft.Network/virtualNetworks@2021-08-01' = {
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
    'ipam-res-id': ipamReservationId
  }
}
