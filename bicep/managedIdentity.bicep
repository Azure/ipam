param location string = resourceGroup().location
param managedIdentityName string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentityName
  location: location
}

output principalId string = managedIdentity.properties.principalId
output clientId string = managedIdentity.properties.clientId
output managedIdentityId string = managedIdentity.id
