param managedIdentityName string

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentityName
  location: resourceGroup().location
}

output principalId string = managedIdentity.properties.principalId
output managedIdentityId string = managedIdentity.id
