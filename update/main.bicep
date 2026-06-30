// Global parameters
targetScope = 'subscription'

// Existing Azure IPAM deployment details (discovered + verified by update.ps1 before deployment)
type resourceObject = {
  appServiceName: string
  appServiceRG: string
  appServicePlanId: string
  managedIdentityId: string
  managedIdentityClientId: string
  cosmosDbUri: string
  databaseName: string
  containerName: string
  keyVaultUri: string
  linuxFxVersion: string
  isFunction: bool
  deployAsContainer: bool
  privateAcr: bool
  privateAcrUri: string
  runFromPackage: bool
}

@description('Deployment Location')
param location string = deployment().location

@description('Azure Cloud Enviroment')
param azureCloud string = 'AZURE_PUBLIC'

@description('Replicate production vNet integration onto the slot (set false to create a bare slot)')
param replicateVnet bool = true

@description('Existing Azure IPAM Resource Details')
param resourceDetails resourceObject

// App Service staging slot (additive: creates the slot only, production site is untouched)
module appServiceSlot './modules/appServiceSlot.bicep' = if (!resourceDetails.isFunction) {
  name: 'appServiceSlotModule'
  scope: resourceGroup(resourceDetails.appServiceRG)
  params: {
    location: location
    azureCloud: azureCloud
    appServiceName: resourceDetails.appServiceName
    appServicePlanId: resourceDetails.appServicePlanId
    managedIdentityId: resourceDetails.managedIdentityId
    managedIdentityClientId: resourceDetails.managedIdentityClientId
    cosmosDbUri: resourceDetails.cosmosDbUri
    databaseName: resourceDetails.databaseName
    containerName: resourceDetails.containerName
    keyVaultUri: resourceDetails.keyVaultUri
    deployAsContainer: resourceDetails.deployAsContainer
    privateAcr: resourceDetails.privateAcr
    privateAcrUri: resourceDetails.privateAcrUri
    runFromPackage: resourceDetails.runFromPackage
    linuxFxVersion: resourceDetails.linuxFxVersion
    replicateVnet: replicateVnet
  }
}

// Function App staging slot (additive: creates the slot only, production site is untouched)
module functionAppSlot './modules/functionAppSlot.bicep' = if (resourceDetails.isFunction) {
  name: 'functionAppSlotModule'
  scope: resourceGroup(resourceDetails.appServiceRG)
  params: {
    location: location
    azureCloud: azureCloud
    functionAppName: resourceDetails.appServiceName
    functionPlanId: resourceDetails.appServicePlanId
    managedIdentityId: resourceDetails.managedIdentityId
    managedIdentityClientId: resourceDetails.managedIdentityClientId
    cosmosDbUri: resourceDetails.cosmosDbUri
    databaseName: resourceDetails.databaseName
    containerName: resourceDetails.containerName
    keyVaultUri: resourceDetails.keyVaultUri
    deployAsContainer: resourceDetails.deployAsContainer
    privateAcr: resourceDetails.privateAcr
    privateAcrUri: resourceDetails.privateAcrUri
    runFromPackage: resourceDetails.runFromPackage
    linuxFxVersion: resourceDetails.linuxFxVersion
    replicateVnet: replicateVnet
  }
}

// Outputs
output stagingSlotHostName string = resourceDetails.isFunction
  ? functionAppSlot!.outputs.stagingSlotHostName
  : appServiceSlot!.outputs.stagingSlotHostName
output vnetReplicated bool = resourceDetails.isFunction
  ? functionAppSlot!.outputs.vnetReplicated
  : appServiceSlot!.outputs.vnetReplicated
