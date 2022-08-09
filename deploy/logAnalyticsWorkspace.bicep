@description('Log Analytics Workspace Name')
param workspaceName string

@description('Deployment Location')
param location string = resourceGroup().location

resource workspace 'Microsoft.OperationalInsights/workspaces@2020-10-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

output workspaceId string = workspace.id
