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
      [string]$resource,

      [Parameter(Mandatory=$False, Position=1)]
	    [hashtable]$query
    )

    $response = Invoke-RestMethod `
      -Method Get `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $query `
      -StatusCodeVariable status

    Write-Output $response, $status
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
      -Body $jsonBody `
      -StatusCodeVariable status

    Write-Output $response, $status
  }

  # PUT API Request
  Function Set-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource,

    	[Parameter(Mandatory=$True, Position=1)]
	    [object[]]$body
    )

    $jsonBody = $body | ConvertTo-Json
    $response = Invoke-RestMethod `
      -Method Put `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $jsonBody `
      -StatusCodeVariable status

    Write-Output $response, $status
  }

  # PATCH API Request
  Function Update-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource,

    	[Parameter(Mandatory=$True, Position=1)]
	    [hashtable[]]$body
    )

    $jsonBody = $body | ConvertTo-Json
    $response = Invoke-RestMethod `
      -Method Patch `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $jsonBody `
      -StatusCodeVariable status

    Write-Output $response, $status
  }

  # DELETE API Request
  Function Remove-ApiResource {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True, Position=0)]
      [string]$resource,

      [Parameter(Mandatory=$False, Position=1)]
	    [string[]]$body
    )

    $jsonBody = $body | ConvertTo-Json -AsArray
    $response = Invoke-RestMethod `
      -Method Delete `
      -Authentication Bearer `
      -Token $accessToken `
      -Uri "${baseUrl}${resource}" `
      -Headers $headers `
      -Body $jsonBody `
      -StatusCodeVariable status

    Write-Output $response, $status
  }

  # Parse JWT Access Token
  Function Parse-JWTtoken {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$true)]
      [string]$token
    )

    # Validate as per https://tools.ietf.org/html/rfc7519
    # Access and ID tokens are fine, Refresh tokens will not work
    if (!$token.Contains(".") -or !$token.StartsWith("eyJ")) {
      Write-Error "Invalid Token!" -ErrorAction Stop
    }

    # Extract Header
    $tokenHeader = $token.Split(".")[0].Replace('-', '+').Replace('_', '/')

    # Fix padding as needed, keep adding "=" until string length modulus 4 reaches 0
    while ($tokenHeader.Length % 4) {
      $tokenHeader += "="
    }

    # Convert from Base64 Encoded String to PSObject
    $headerObj = [System.Text.Encoding]::ASCII.GetString([system.convert]::FromBase64String($tokenHeader)) | ConvertFrom-Json

    # Extract Payload
    $tokenPayload = $token.Split(".")[1].Replace('-', '+').Replace('_', '/')

    # Fix padding as needed, keep adding "=" until string length modulus 4 reaches 0
    while ($tokenPayload.Length % 4) {
      $tokenPayload += "="
    }

    # Convert to Byte Array
    $tokenByteArray = [System.Convert]::FromBase64String($tokenPayload)

    # Convert to JSON String
    $tokenJson = [System.Text.Encoding]::ASCII.GetString($tokenByteArray)

    # Convert from JSON to PSObject
    $tokenObj = $tokenJson | ConvertFrom-Json
    
    Write-Output $headerObj, $tokenObj
  }
}

Context 'Spaces' {
  # GET /api/spaces
  It 'Verify No Spaces Exist' {

    $spaces, $spacesStatus = Get-ApiResource '/spaces'

    $spaces | Should -Be $null
  }

  # POST /api/spaces
  It 'Create Two Spaces' {
    $spaceA = @{
      name = 'TestSpace01'
      desc = 'Test Space 1'
    }

    $spaceB = @{
      name = 'TestSpace02'
      desc = 'Test Space 2'
    }

    New-ApiResource '/spaces' $spaceA
    New-ApiResource '/spaces' $spaceB

    $spaces, $spacesStatus = Get-ApiResource '/spaces'
    
    $spaces.Count | Should -Be 2
    $spaces.Name -contains 'TestSpace01' | Should -Be $true
    $spaces.Name -contains 'TestSpace02' | Should -Be $true
  }

  # DELETE /api/spaces/{space}
  It 'Delete a Space' {
    Remove-ApiResource '/spaces/TestSpace02'

    $spaces, $spacesStatus = Get-ApiResource '/spaces'
    
    $spaces.Count | Should -Be 1
    $spaces.Name -contains 'TestSpace01' | Should -Be $true
    $spaces.Name -contains 'TestSpace02' | Should -Be $false
  }

  # PATCH /api/spaces/{space}
  It 'Update a Space' {
    $update = @(
      @{
        op = 'replace'
        path = '/name'
        value = 'TestSpaceA'
      }
      @{
        op = 'replace'
        path = '/desc'
        value = 'Test Space A'
      }
    )

    Update-ApiResource '/spaces/TestSpace01' $update

    $spaces, $spacesStatus = Get-ApiResource '/spaces'
    
    $spaces.Count | Should -Be 1
    $spaces[0].Name -eq 'TestSpaceA' | Should -Be $true
    $spaces[0].Desc -eq 'Test Space A' | Should -Be $true
  }

  # GET /api/spaces/{space}
  It 'Get A Specific Space' {

    $space, $spaceStatus = Get-ApiResource '/spaces/TestSpaceA'

    $space.Name -eq 'TestSpaceA' | Should -Be $true
    $space.Desc -eq 'Test Space A' | Should -Be $true
  }
}

Context 'Blocks' {
  # GET /api/spaces/{space}/blocks
  It 'Verify No Blocks Exist' {

    $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks'

    $blocks | Should -Be $null
  }

  # POST /api/spaces/{space}/blocks
  It 'Create Two Blocks' {
    $blockA = @{
      name = 'TestBlock01'
      cidr = '10.0.0.0/16'
    }

    $blockB = @{
      name = 'TestBlock02'
      cidr = '192.168.0.0/24'
    }

    New-ApiResource '/spaces/TestSpaceA/blocks' $blockA
    New-ApiResource '/spaces/TestSpaceA/blocks' $blockB

    $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks'
    
    $blocks.Count | Should -Be 2
    $blocks.Name -contains 'TestBlock01' | Should -Be $true
    $blocks.Name -contains 'TestBlock02' | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}
  It 'Delete a Block' {
    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlock02'

    $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks'
    
    $blocks.Count | Should -Be 1
    $blocks.Name -contains 'TestBlock01' | Should -Be $true
    $blocks.Name -contains 'TestBlock02' | Should -Be $false
  }

  # PATCH /api/spaces/{space}/blocks/{block}
  It 'Update a Block' {
    $update = @(
      @{
        op = 'replace'
        path = '/name'
        value = 'TestBlockA'
      }
      @{
        op = 'replace'
        path = '/cidr'
        value = '10.1.0.0/16'
      }
    )

    Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlock01' $update

    $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks'
    
    $blocks.Count | Should -Be 1
    $blocks[0].Name -eq 'TestBlockA' | Should -Be $true
    $blocks[0].Cidr -eq '10.1.0.0/16' | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}
  It 'Get a Specific Block' {

    $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA'

    $block.Name -eq 'TestBlockA' | Should -Be $true
    $block.Cidr -eq '10.1.0.0/16' | Should -Be $true
  }
}

Context 'Networks' {
  # GET /api/spaces/{space}/blocks/{block}/networks
  It 'Verify No Networks Exist in Block' {

    $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'
    
    $networks | Should -Be $null
  }

  # POST /api/spaces/{space}/blocks/{block}/networks
  It 'Add a Virtual Network to Block' {
    $script:newNetA = New-AzVirtualNetwork `
      -Name 'TestVNet01' `
      -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
      -Location 'westus3' `
      -AddressPrefix '10.1.0.0/24'

    Start-Sleep -Seconds 60

    $body = @{
      id = $script:newNetA.Id
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body

    $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA'

    $($block.vnets | Select-Object -ExpandProperty id) -contains $script:newNetA.Id | Should -Be $true
  }

  # PUT /api/spaces/{space}/blocks/{block}/networks
  It 'Replace Block Virtual Networks' {
    $script:newNetB = New-AzVirtualNetwork `
      -Name 'TestVNet02' `
      -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
      -Location 'westus3' `
      -AddressPrefix '10.1.1.0/24'

    Start-Sleep -Seconds 60

    $body = @(
      $script:newNetA.Id
      $script:newNetB.Id
    )

    Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body

    $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

    $($networks | Select-Object -ExpandProperty id) -contains $script:newNetA.Id | Should -Be $true
    $($networks | Select-Object -ExpandProperty id) -contains $script:newNetB.Id | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/networks
  It 'Delete Block Virtual Network' {
    $body = @(
      $script:newNetB.Id
    )

    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body

    $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

    $($networks | Select-Object -ExpandProperty id) -contains $script:newNetA.Id | Should -Be $true
    $($networks | Select-Object -ExpandProperty id) -contains $script:newNetB.Id | Should -Be $false
  }
}

Context 'External Networks' {
  # GET /api/spaces/{space}/blocks/{block}/externals
  It 'Verify No External Networks Exist in Block' {

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Count | Should -Be 0
  }

  # POST /api/spaces/{space}/blocks/{block}/externals
  It 'Add an External Network to Block' {
    $script:externalA = @{
      name = "ExternalNetA"
      desc = "External Network A"
      cidr = "10.1.1.0/24"
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $script:externalA

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Count | Should -Be 1

    $externals[0].Name -eq "ExternalNetA" | Should -Be $true
    $externals[0].Desc -eq "External Network A" | Should -Be $true
    $externals[0].Cidr -eq "10.1.1.0/24" | Should -Be $true
  }

  # POST /api/spaces/{space}/blocks/{block}/externals
  It 'Add a Second External Network to Block' {
    $script:externalB = @{
      name = "ExternalNetB"
      desc = "External Network B"
      size = 24
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $script:externalB

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Count | Should -Be 2

    $externals[0].Name -eq "ExternalNetA" | Should -Be $true
    $externals[0].Desc -eq "External Network A" | Should -Be $true
    $externals[0].Cidr -eq "10.1.1.0/24" | Should -Be $true

    $externals[1].Name -eq "ExternalNetB" | Should -Be $true
    $externals[1].Desc -eq "External Network B" | Should -Be $true
    $externals[1].Cidr -eq "10.1.2.0/24" | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}/externals/{external}
  It 'Get a Specific External Network' {

    $external, $externalStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetB'
    
    $external.Name -eq "ExternalNetB" | Should -Be $true
    $external.Desc -eq "External Network B" | Should -Be $true
    $external.Cidr -eq "10.1.2.0/24" | Should -Be $true
  }

  # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}
  It 'Update an External Network' {
    $update = @(
      @{
        op = 'replace'
        path = '/name'
        value = 'ExternalNetC'
      }
      @{
        op = 'replace'
        path = '/desc'
        value = 'External Network C'
      }
      @{
        op = 'replace'
        path = '/cidr'
        value = '10.1.3.0/24'
      }
    )

    Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetB' $update

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Count | Should -Be 2

    $externals[0].Name -eq "ExternalNetA" | Should -Be $true
    $externals[0].Desc -eq "External Network A" | Should -Be $true
    $externals[0].Cidr -eq "10.1.1.0/24" | Should -Be $true

    $externals[1].Name -eq "ExternalNetC" | Should -Be $true
    $externals[1].Desc -eq "External Network C" | Should -Be $true
    $externals[1].Cidr -eq "10.1.3.0/24" | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}
  It 'Delete an External Network' {
    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetC'

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Count | Should -Be 1

    $externals[0].Name -eq "ExternalNetA" | Should -Be $true
    $externals[0].Desc -eq "External Network A" | Should -Be $true
    $externals[0].Cidr -eq "10.1.1.0/24" | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets
  It 'Verify No External Subnets Exist in External Network' {

    $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'
    
    $subnets.Count | Should -Be 0
  }

  # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets
  It 'Add an External Subnet to an External Network' {
    $script:subnetA = @{
      name = "SubnetA"
      desc = "Subnet A"
      cidr = "10.1.1.0/26"
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets' $script:subnetA

    $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'
    
    $subnets.Count | Should -Be 1

    $subnets[0].Name -eq "SubnetA" | Should -Be $true
    $subnets[0].Desc -eq "Subnet A" | Should -Be $true
    $subnets[0].Cidr -eq "10.1.1.0/26" | Should -Be $true
  }

  # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets
  It 'Add a Second External Subnet to an External Network' {
    $script:subnetB = @{
      name = "SubnetB"
      desc = "Subnet B"
      size = 26
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets' $script:subnetB

    $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'
    
    $subnets.Count | Should -Be 2

    $subnets[0].Name -eq "SubnetA" | Should -Be $true
    $subnets[0].Desc -eq "Subnet A" | Should -Be $true
    $subnets[0].Cidr -eq "10.1.1.0/26" | Should -Be $true

    $subnets[1].Name -eq "SubnetB" | Should -Be $true
    $subnets[1].Desc -eq "Subnet B" | Should -Be $true
    $subnets[1].Cidr -eq "10.1.1.64/26" | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
  It 'Get Specific External Subnet' {

    $subnet, $subnetStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetB'
    
    $subnet.Name -eq "SubnetB" | Should -Be $true
    $subnet.Desc -eq "Subnet B" | Should -Be $true
    $subnet.Cidr -eq "10.1.1.64/26" | Should -Be $true
  }

  # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
  It 'Update an External Subnet' {
    $update = @(
      @{
        op = 'replace'
        path = '/name'
        value = 'SubnetC'
      }
      @{
        op = 'replace'
        path = '/desc'
        value = 'Subnet C'
      }
      @{
        op = 'replace'
        path = '/cidr'
        value = '10.1.1.128/27'
      }
    )

    Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetB' $update

    $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'
    
    $subnets.Count | Should -Be 2

    $subnets[0].Name -eq "SubnetA" | Should -Be $true
    $subnets[0].Desc -eq "Subnet A" | Should -Be $true
    $subnets[0].Cidr -eq "10.1.1.0/26" | Should -Be $true

    $subnets[1].Name -eq "SubnetC" | Should -Be $true
    $subnets[1].Desc -eq "Subnet C" | Should -Be $true
    $subnets[1].Cidr -eq "10.1.1.128/27" | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
  It 'Delete an External Subnet' {
    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetC'

    $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'
    
    $subnets.Count | Should -Be 1

    $subnets[0].Name -eq "SubnetA" | Should -Be $true
    $subnets[0].Desc -eq "Subnet A" | Should -Be $true
    $subnets[0].Cidr -eq "10.1.1.0/26" | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
  It 'Verify No External Endpoints Exist in External Subnet' {

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 0
  }

  # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
  It 'Add an External Endpoint to an External Subnet' {
    $script:endpointA = @{
      name = "EndpointA"
      desc = "Endpoint A"
      ip = "10.1.1.4"
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $script:endpointA

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 1

    $endpoints[0].Name -eq "EndpointA" | Should -Be $true
    $endpoints[0].Desc -eq "Endpoint A" | Should -Be $true
    $endpoints[0].IP -eq "10.1.1.4" | Should -Be $true
  }

  # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
  It 'Add a Second External Endpoint to an External Subnet' {
    $script:endpointB = @{
      name = "EndpointB"
      desc = "Endpoint B"
      ip = $null
    }

    New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $script:endpointB

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 2

    $endpoints[0].Name -eq "EndpointA" | Should -Be $true
    $endpoints[0].Desc -eq "Endpoint A" | Should -Be $true
    $endpoints[0].IP -eq "10.1.1.4" | Should -Be $true

    $endpoints[1].Name -eq "EndpointB" | Should -Be $true
    $endpoints[1].Desc -eq "Endpoint B" | Should -Be $true
    $endpoints[1].IP -eq "10.1.1.1" | Should -Be $true
  }

  # PUT /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
  It 'Replace External Endpoints in an External Subnet' {
    $script:endpointC = @{
      name = "EndpointC"
      desc = "Endpoint C"
      ip = "10.1.1.5"
    }

    $script:endpointD = @{
      name = "EndpointD"
      desc = "Endpoint D"
      ip = $null
    }

    $body = @(
      $script:endpointA
      $script:endpointB
      $script:endpointC
      $script:endpointD
    )

    Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $body

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 4

    $endpoints[0].Name -eq "EndpointA" | Should -Be $true
    $endpoints[0].Desc -eq "Endpoint A" | Should -Be $true
    $endpoints[0].IP -eq "10.1.1.4" | Should -Be $true

    $endpoints[1].Name -eq "EndpointB" | Should -Be $true
    $endpoints[1].Desc -eq "Endpoint B" | Should -Be $true
    $endpoints[1].IP -eq "10.1.1.1" | Should -Be $true

    $endpoints[2].Name -eq "EndpointC" | Should -Be $true
    $endpoints[2].Desc -eq "Endpoint C" | Should -Be $true
    $endpoints[2].IP -eq "10.1.1.5" | Should -Be $true

    $endpoints[3].Name -eq "EndpointD" | Should -Be $true
    $endpoints[3].Desc -eq "Endpoint D" | Should -Be $true
    $endpoints[3].IP -eq "10.1.1.2" | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/externals/ExternalNetA/subnets/SubnetA/endpoints
  It 'Delete External Endpoints' {
    $body = @(
      $script:endpointC.name
      $script:endpointD.name
    )

    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $body

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 2

    $endpoints[0].Name -eq "EndpointA" | Should -Be $true
    $endpoints[0].Desc -eq "Endpoint A" | Should -Be $true
    $endpoints[0].IP -eq "10.1.1.4" | Should -Be $true

    $endpoints[1].Name -eq "EndpointB" | Should -Be $true
    $endpoints[1].Desc -eq "Endpoint B" | Should -Be $true
    $endpoints[1].IP -eq "10.1.1.1" | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints/{endpoint}
  It 'Get a Specific External Endpoint' {

    $endpoint, $endpointStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints/EndpointA'
    
    $endpoint.Name | Should -Be "EndpointA"
    $endpoint.Desc | Should -Be "Endpoint A"
    $endpoint.IP | Should -Be "10.1.1.4"
  }

  # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints/{endpoint}
  It 'Update an External Endpoint' {
    $update = @(
      @{
        op = 'replace'
        path = '/name'
        value = 'EndpointC'
      }
      @{
        op = 'replace'
        path = '/desc'
        value = 'Endpoint C'
      }
      @{
        op = 'replace'
        path = '/ip'
        value = '10.1.1.10'
      }
    )

    Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints/EndpointB' $update

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 2

    $endpoints[0].Name -eq "EndpointA" | Should -Be $true
    $endpoints[0].Desc -eq "Endpoint A" | Should -Be $true
    $endpoints[0].IP -eq "10.1.1.4" | Should -Be $true

    $endpoints[1].Name -eq "EndpointC" | Should -Be $true
    $endpoints[1].Desc -eq "Endpoint C" | Should -Be $true
    $endpoints[1].IP -eq "10.1.1.10" | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints/{endpoint}
  It 'Delete an External Endpoint' {
    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints/EndpointC'

    $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'
    
    $endpoints.Count | Should -Be 1

    $endpoints[0].Name -eq "EndpointA" | Should -Be $true
    $endpoints[0].Desc -eq "Endpoint A" | Should -Be $true
    $endpoints[0].IP -eq "10.1.1.4" | Should -Be $true
  }
}

Context 'Reservations' {
  # GET /api/spaces/{space}/blocks/{block}/reservations
  It 'Verify No Reservations Exist in Block' {

    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'
    
    $reservations | Should -Be $null
  }

  # POST /api/spaces/{space}/blocks/{block}/reservations
  It 'Create Two Block Reservations' {
    $bodyA = @{
      size = 24
      desc = "Test Reservation A"
    }

    $bodyB = @{
      size = 24
      desc = "Test Reservation B"
    }

    $bodyC = @{
      size = 24
      desc = "Test Reservation C"
    }

    $script:reservationA, $reservationAStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $bodyA
    $script:reservationB, $reservationBStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $bodyB
    $script:reservationC, $reservationCStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $bodyC

    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'
    
    $reservations.Count | Should -Be 3

    $reservations[0].Space -eq "TestSpaceA" | Should -Be $true
    $reservations[0].Block -eq "TestBlockA" | Should -Be $true
    $reservations[0].Desc -eq "Test Reservation A" | Should -Be $true
    $reservations[0].Cidr -eq "10.1.2.0/24" | Should -Be $true
    $reservations[0].SettledOn -eq $null | Should -Be $true

    $reservations[1].Space -eq "TestSpaceA" | Should -Be $true
    $reservations[1].Block -eq "TestBlockA" | Should -Be $true
    $reservations[1].Desc -eq "Test Reservation B" | Should -Be $true
    $reservations[1].Cidr -eq "10.1.3.0/24" | Should -Be $true
    $reservations[1].SettledOn -eq $null | Should -Be $true

    $reservations[2].Space -eq "TestSpaceA" | Should -Be $true
    $reservations[2].Block -eq "TestBlockA" | Should -Be $true
    $reservations[2].Desc -eq "Test Reservation C" | Should -Be $true
    $reservations[2].Cidr -eq "10.1.4.0/24" | Should -Be $true
    $reservations[2].SettledOn -eq $null | Should -Be $true
  }

  # Create an Azure Virtual Network w/ Reservation ID Tag and Verify it's Automatically Imported into IPAM
  It 'Import Virtual Network via Reservation ID' {
    $script:newNetC = New-AzVirtualNetwork `
      -Name 'TestVNet03' `
      -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
      -Location 'westus3' `
      -AddressPrefix $script:reservationA.Cidr `
      -Tag @{ "X-IPAM-RES-ID" = $script:reservationA.Id }

    Start-Sleep -Seconds 180

    $query = @{
      settled = $true
    }

    $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'
    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $query

    $($networks | Select-Object -ExpandProperty id) -contains $script:newNetA.Id | Should -Be $true
    $($networks | Select-Object -ExpandProperty id) -contains $script:newNetC.Id | Should -Be $true

    $reservations.Count | Should -Be 3

    $reservations[0].SettledOn -eq $null | Should -Be $false
    $reservations[0].Status -eq "fulfilled" | Should -Be $true
    $reservations[1].SettledOn -eq $null | Should -Be $true
    $reservations[1].Status -eq "wait" | Should -Be $true
    $reservations[2].SettledOn -eq $null | Should -Be $true
    $reservations[2].Status -eq "wait" | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/reservations
  It 'Delete Reservations' {
    $body = @(
      $script:reservationB.Id
    )

    $query = @{
      settled = $true
    }

    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $body

    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $query

    $reservations.Count | Should -Be 3

    $reservations[0].SettledOn -eq $null | Should -Be $false
    $reservations[0].Status -eq "fulfilled" | Should -Be $true
    $reservations[1].SettledOn -eq $null | Should -Be $false
    $reservations[1].Status -eq "cancelledByUser" | Should -Be $true
    $reservations[2].SettledOn -eq $null | Should -Be $true
    $reservations[2].Status -eq "wait" | Should -Be $true
  }

  # GET /api/spaces/{space}/blocks/{block}/reservations/{reservationId}
  It 'Get a Specific Reservation' {

    $reservation, $reservationStatus = Get-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/reservations/$($script:reservationC.Id)"
    
    $reservation.Space -eq "TestSpaceA" | Should -Be $true
    $reservation.Block -eq "TestBlockA" | Should -Be $true
    $reservation.Desc -eq "Test Reservation C" | Should -Be $true
    $reservation.Cidr -eq "10.1.4.0/24" | Should -Be $true
    $reservation.SettledOn -eq $null | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/reservations/{reservationId}
  It 'Delete a Specific Reservation' {
    $query = @{
      settled = $true
    }

    Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/reservations/$($script:reservationC.Id)"

    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $query

    $reservations.Count | Should -Be 3

    $reservations[0].SettledOn -eq $null | Should -Be $false
    $reservations[0].Status -eq "fulfilled" | Should -Be $true
    $reservations[1].SettledOn -eq $null | Should -Be $false
    $reservations[1].Status -eq "cancelledByUser" | Should -Be $true
    $reservations[2].SettledOn -eq $null | Should -Be $false
    $reservations[2].Status -eq "cancelledByUser" | Should -Be $true
  }
}

Context 'Tools' {
  # POST /api/spaces
  It 'Create Tools Space' {
    $toolsSpace = @{
      name = 'ToolsSpace'
      desc = 'Tools Space'
    }

    New-ApiResource '/spaces' $toolsSpace

    $spaces, $spacesStatus = Get-ApiResource '/spaces'
    
    $spaces.Count | Should -Be 2
    $spaces.Name -eq 'TestSpaceA' | Should -Be $true
    $spaces.Name -eq 'ToolsSpace' | Should -Be $true
  }

  # POST /api/spaces/{space}/blocks
  It 'Create Tools Block' {
    $toolsBlock = @{
      name = 'ToolsBlock'
      cidr = '198.51.100.0/24'
    }

    New-ApiResource '/spaces/ToolsSpace/blocks' $toolsBlock

    $blocks, $blocksStatus = Get-ApiResource '/spaces/ToolsSpace/blocks'
    
    $blocks.Count | Should -Be 1

    $blocks.Name -eq 'ToolsBlock' | Should -Be $true
    $blocks.Cidr -eq '198.51.100.0/24' | Should -Be $true
  }

  # POST /api/tools/nextAvailableVnet
  It 'Check Next Available vNET in Tools Block' {
    $body = @{
      space = 'ToolsSpace'
      blocks = @('ToolsBlock')
      size = 24
    }

    $newNet, $newNetStatus = New-ApiResource '/tools/nextAvailableVNet' $body

    $newNet.Space -eq 'ToolsSpace' | Should -Be $true
    $newNet.Block -eq 'ToolsBlock' | Should -Be $true
    $newNet.Cidr -eq '198.51.100.0/24' | Should -Be $true
  }

  # POST /api/spaces/{space}/blocks/{block}/networks
  It 'Add a Virtual Network to Tools Block' {
    $script:toolsNet = New-AzVirtualNetwork `
      -Name 'ToolsNet' `
      -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
      -Location 'westus3' `
      -AddressPrefix '198.51.100.0/24'

    Start-Sleep -Seconds 60

    $body = @{
      id = $script:toolsNet.Id
    }

    New-ApiResource '/spaces/ToolsSpace/blocks/ToolsBlock/networks' $body

    $block, $blockStatus = Get-ApiResource '/spaces/ToolsSpace/blocks/ToolsBlock'

    $($block.vnets | Select-Object -ExpandProperty id) -contains $script:toolsNet.Id | Should -Be $true
  }

  # POST /api/tools/nextAvailableSubnet
  It 'Check Next Available Subnet in Tools vNET' {
    $body = @{
      vnet_id = $script:toolsNet.Id
      size = 26
    }

    $newSubnet, $newSubnetStatus = New-ApiResource '/tools/nextAvailableSubnet' $body

    $subscriptionId = ($script:toolsNet.Id | Select-String -Pattern '(?<=subscriptions/).*(?=/resourceGroups)').Matches.Value

    $newSubnet.vnet_name -eq $script:toolsNet.Name | Should -Be $true
    $newSubnet.resource_group -eq $script:toolsNet.ResourceGroupName | Should -Be $true
    $newSubnet.subscription_id -eq $subscriptionId | Should -Be $true
    $newSubnet.Cidr -eq '198.51.100.0/26' | Should -Be $true
  }

  # POST /api/tools/cidrCheck
  It 'Check Where CIDR is Used' {
    $body = @{
      cidr = '198.51.100.0/24'
    }

    $cidrCheck, $cidrCheckStatus = New-ApiResource '/tools/cidrCheck' $body

    $containers = @(
      @{
        space = "ToolsSpace"
        block = "ToolsBlock"
      }
    )

    $subscriptionId = ($script:toolsNet.Id | Select-String -Pattern '(?<=subscriptions/).*(?=/resourceGroups)').Matches.Value

    $cidrCheck.name -eq $script:toolsNet.Name | Should -Be $true
    $cidrCheck.id -eq $script:toolsNet.Id | Should -Be $true
    $cidrCheck.resource_group -eq $script:toolsNet.ResourceGroupName | Should -Be $true
    $cidrCheck.subscription_id -eq $subscriptionId | Should -Be $true
    $cidrCheck.prefixes -contains '198.51.100.0/24' | Should -Be $true
    $null -eq (Compare-Object $cidrCheck.containers $containers -Property {$_.space}) | Should -Be $true
    $null -eq (Compare-Object $cidrCheck.containers $containers -Property {$_.block}) | Should -Be $true
  }
}

Context 'Status' {
  # GET /api/status
  It 'Verify Status' {

    $status, $statusCode = Get-ApiResource '/status'

    $statusCode | Should -Be 200

    $status.status -eq 'OK' | Should -Be $true
    $status.stack -eq 'AppContainer' | Should -Be $true
    $status.environment -eq 'AZURE_PUBLIC' | Should -Be $true
  }
}
