@description('Deployment Location')
param location string = resourceGroup().location

@description('Managed Identity Name')
param managedIdentityName string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentityName
  location: location
}

output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId
output id string = managedIdentity.id
