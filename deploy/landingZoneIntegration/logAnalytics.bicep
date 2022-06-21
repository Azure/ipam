@description('Deployment Location')
param location string = resourceGroup().location

@description('Log Analytics Workspace Name')
param logAnalyticsWorkspaceName string


resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-06-01' ={
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
