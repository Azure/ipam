$splat = @{
  DeploymentName        = -join ('ipamInfrastructureDeploy-{0}' -f (Get-Date -Format 'yyyyMMddTHHMMss'))[0..63]
  Location              = 'westeurope'
  TemplateFile          = './main.bicep'
  TemplateParameterFile = './main.bicepparam'
  WhatIf                = $false
  Verbose               = $false
}

Select-AzSubscription -SubscriptionId '<change-me>'

New-AzSubscriptionDeployment @splat
