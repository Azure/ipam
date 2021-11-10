// Global parameters
@description('New GUID used for naming all resources')
param guidValue string = newGuid()

@description('location for all resources')
param location string = resourceGroup().location

// Authorization related parameters
@description('Contributor Role definition ID')
param roleDefinitionId string = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

// Compute related parameters
@description('The Github Repository URL that contains the project to deploy to Web App')
param repositoryUrl string

@description('The Github Repository Branch to deploy to Web App from')
param repositoryBranch string

@description('Username for the Virtual Machine.')
param adminUsername string

@description('SSH Key for the Virtual Machine')
@secure()
param sshKey string

@description('The Ubuntu version for the VM. This will pick a fully patched image of this given Ubuntu version.')
param ubuntuOSVersion string = '20_04-lts'

@description('The size of the VM')
param vmSize string = 'Standard_B2s'

@description('Virtual Machine OS disk type')
param osDiskType string = 'Standard_LRS'

// Naming variables
var managedIdentityName = 'mi-${uniqueString(guidValue)}'
var vnetName = 'vnet-${uniqueString(guidValue)}'
var subnetName = 'subnet-${uniqueString(guidValue)}'
var cosmosAcctName = 'dbacct-${uniqueString(guidValue)}'
var cosmosDbName = 'db-${uniqueString(guidValue)}'
var cosmosDbCollectionName = 'collection-${uniqueString(guidValue)}'
var appServicePlanName = 'asp-${uniqueString(guidValue)}'
var websiteName = 'ipamservice-${uniqueString(guidValue)}'
var vmName = 'vm-${uniqueString(guidValue)}'
var networkSecurityGroupName = 'nsg-${uniqueString(guidValue)}'
var publicIPAddressName = 'vmpip-${uniqueString(guidValue)}'
var networkInterfaceName = 'vmnic-${uniqueString(guidValue)}'
var dnsLabelPrefix = 'ipamservice-${uniqueString(guidValue)}'

//Authentication related resources
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2018-11-30' = {
  name: managedIdentityName
  location: location
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guidValue
  properties: {
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: managedIdentity.properties.principalId
  }
} 

// Network related resources
resource virtualNetwork 'Microsoft.Network/virtualNetworks@2019-11-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16'
      ]
    }
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: '10.0.0.0/24'
          serviceEndpoints: [
            {
              locations: [
                location
              ]
              service: 'Microsoft.AzureCosmosDB'
            }
          ]
        }
      }
    ]
  }
}

resource networkInterface 'Microsoft.Network/networkInterfaces@2020-06-01' = {
  name: networkInterfaceName
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: {
            id: virtualNetwork.properties.subnets[0].id
          }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: publicIP.id
          }
        }
      }
    ]
    networkSecurityGroup: {
      id: networkSecurityGroup.id
    }
  }
}

resource publicIP 'Microsoft.Network/publicIPAddresses@2020-06-01' = {
  name: publicIPAddressName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    publicIPAllocationMethod: 'Dynamic'
    publicIPAddressVersion: 'IPv4'
    dnsSettings: {
      domainNameLabel: dnsLabelPrefix
    }
    idleTimeoutInMinutes: 4
  }
}

resource networkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2020-06-01' = {
  name: networkSecurityGroupName
  location: location
  properties: {
    securityRules: [
      {
        name: 'SSH'
        properties: {
          priority: 1000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'HTTP'
        properties: {
          priority: 2000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'HTTPS'
        properties: {
          priority: 3000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
    ]
  }
}

// Database related resources
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2021-04-15' = {
  name: cosmosAcctName
  location: location
  kind: 'MongoDB'
  properties: {
    apiProperties: {
      serverVersion: '4.0'
    }
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
      }
    }
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxStalenessPrefix: 100
      maxIntervalInSeconds: 5
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: true
    capabilities: [
      {
        name: 'EnableMongo'
      }
      {
        name: 'DisableRateLimitingResponses'
      }
    ]
  }
}

resource cosmosDB 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2021-06-15' = {
  name: '${cosmosAccount.name}/${cosmosDbName}'
  location: location
  properties: {
    resource: {
      id: cosmosDbName
    }
  }
}

resource cosmosDBCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2021-06-15' ={
  name: '${cosmosDB.name}/${cosmosDbCollectionName}'
  location: location
  properties: {
    options: {
      autoscaleSettings: {
        maxThroughput: 4000
      }
    }
    resource: {
      id: cosmosDbCollectionName
      shardKey: {
        tenant_id: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
      ]
    }
  }
}

// Compute related resources
resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource appService 'Microsoft.Web/sites@2021-02-01' = {
  name: websiteName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.9'
      appCommandLine: 'gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app'
      connectionStrings: [
        {
          connectionString: listConnectionStrings(cosmosAccount.id, cosmosAccount.apiVersion).connectionStrings[0].connectionString
          name: cosmosAcctName
          type: 'DocDb'
        }
      ]
    }
  }
}

resource sourceControls 'Microsoft.Web/sites/sourcecontrols@2021-02-01' = {
  name: 'web'
  parent: appService
  properties: {
    branch: repositoryBranch
    repoUrl: repositoryUrl
    isManualIntegration: true
  }
}

resource virtualMachine 'Microsoft.Compute/virtualMachines@2020-06-01' = {
  name: vmName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    storageProfile: {
      osDisk: {
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: osDiskType
        }
      }
      imageReference: {
        publisher: 'canonical'
        offer: '0001-com-ubuntu-server-focal'
        sku: ubuntuOSVersion
        version: 'latest'
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: networkInterface.id
        }
      ]
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              keyData: sshKey
              path: '/home/${adminUsername}/.ssh/authorized_keys'
            }
          ]
        }
      }
    }
  }
}

//Outputs
output virtualMachineHostname string = publicIP.properties.dnsSettings.fqdn
output virtualMachineSshCommand string = 'ssh ${adminUsername}@${publicIP.properties.dnsSettings.fqdn}'
output appServiceHostName string = appService.properties.defaultHostName
