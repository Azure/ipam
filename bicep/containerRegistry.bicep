param containerRegistryName string
param location string = resourceGroup().location

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2021-12-01-preview' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Standard'
  }
}

output loginServer string = containerRegistry.properties.loginServer
