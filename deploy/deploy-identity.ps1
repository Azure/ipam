$splat = @{
  DeploymentName        = -join ('ipamIdentityDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
  Location              = 'westeurope'
  TemplateFile          = './identity/main.bicep'
  TemplateParameterFile = './identity/main.bicepparam'
  WhatIf                = $false
  Verbose               = $false
  ManagementGroupId     = '<change-me>'
}

New-AzManagementGroupDeployment @splat
