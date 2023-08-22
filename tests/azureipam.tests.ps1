BeforeAll {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  Set-StrictMode -Version Latest

  [string]$baseUrl = "$env:IPAM_URL/api"
  [System.Security.SecureString]$accessToken = ConvertTo-SecureString (Get-AzAccessToken -ResourceUrl api://$env:IPAM_ENGINE_APP_ID).Token -AsPlainText
  [hashtable]$headers = @{
    "Content-Type" = "application/json"
  }

  # GET API Request
  Function Get-ApiResource {
    [CmdletBinding()]
    Param (
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource
    )

    $response = Invoke-RestMethod `
      -Method Get `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers

    Write-Output $response
  }

  # POST API Request
  Function New-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource,

    	[Parameter(Mandatory=$True, Position=1)]
	    [hashtable]$body
    )

    $jsonBody = $body | ConvertTo-Json
    $response = Invoke-RestMethod `
      -Method Post `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $jsonBody

    Write-Output $response
  }

  # PUT API Request
  Function Set-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource,

    	[Parameter(Mandatory=$True, Position=1)]
	    [hashtable]$body
    )

    $jsonBody = $body | ConvertTo-Json
    $response = Invoke-RestMethod `
      -Method Put `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $jsonBody

    Write-Output $response
  }

  # PATCH API Request
  Function Update-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource,

    	[Parameter(Mandatory=$True, Position=1)]
	    [hashtable]$body
    )

    $jsonBody = $body | ConvertTo-Json
    $response = Invoke-RestMethod `
      -Method Patch `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $jsonBody

    Write-Output $response
  }

  # DELETE API Request
  Function Remove-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource
    )

    $response = Invoke-RestMethod `
      -Method Delete `
      -Autjentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers

    Write-Output $response
  }
}

Describe 'Get-Posts' {

  It 'Spaces is empty' {

    $spaces = Get-ApiResource '/spaces'
    
    $spaces | Should -Be $null
  }

}
