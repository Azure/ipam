using './main.bicep'

param uiAppName = 'ipam-ui-app'
param uiAppId = ''
param engineAppName = 'ipam-engine-app'
param engineAppId = ''
param disableUi = false
param uiAppRedirectUris = ['https://replace-this-value.azurewebsites.net']
param engineAppApiPermissionGuid = guid('myOrgNameHereForUniqueness')
param engineReaderRoleManagementGroupIds = ['<replace-with-tenant-id>']
param azureCloud = 'AZURE_PUBLIC'
