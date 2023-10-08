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
  It 'Get A Specific Block' {

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
  It 'Add a Virtual Network to a Block' {
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
    
    $externals | Should -Be $null
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
    
    $externals.Name -contains "ExternalNetA" | Should -Be $true
  }

  # PUT /api/spaces/{space}/blocks/{block}/externals
  It 'Replace Block External Networks' {
    $script:externalB = @{
      name = "ExternalNetB"
      desc = "External Network B"
      cidr = "10.1.2.0/24"
    }

    $script:externalC = @{
      name = "ExternalNetC"
      desc = "External Network C"
      cidr = "10.1.3.0/24"
    }

    $body = @(
      $script:externalA
      $script:externalB
      $script:externalC
    )

    Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $body

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Name -contains "ExternalNetA" | Should -Be $true
    $externals.Name -contains "ExternalNetB" | Should -Be $true
  }

  # DELETE /api/spaces/{space}/blocks/{block}/externals
  It 'Delete Block External Network' {
    $body = @(
      $script:externalC.name
    )

    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $body

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'
    
    $externals.Name -contains "ExternalNetA" | Should -Be $true
    $externals.Name -contains "ExternalNetB" | Should -Be $true
    $externals.Name -contains "ExternalNetC" | Should -Be $false
  }

  # GET /api/spaces/{space}/blocks/{block}/externals/{external}
  It 'Get Specific Block External Network' {

    $external, $externalStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetB'
    
    $external.Name | Should -Be "ExternalNetB"
    $external.Desc | Should -Be "External Network B"
    $external.Cidr | Should -Be "10.1.2.0/24"
  }

  # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}
  It 'Delete Specific Block External Network' {

    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetB'

    $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

    $externals.Name -contains "ExternalNetA" | Should -Be $true
    $externals.Name -contains "ExternalNetB" | Should -Be $false
    $externals.Name -contains "ExternalNetC" | Should -Be $false
  }
}

Context 'Reservations' {
  # GET /api/spaces/{space}/blocks/{block}/reservations
  It 'Verify No Reservations Exist in Block' {

    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'
    
    $reservations | Should -Be $null
  }

  It 'Create Two Block Reservations' {
    $bodyA = @{
      size = 24
      desc = "Test Reservation A"
    }

    $bodyB = @{
      size = 24
      desc = "Test Reservation B"
    }

    $script:reservationA, $reservationAStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $bodyA
    $script:reservationB, $reservationBStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $bodyB
    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'
    
    $reservations.Count | Should -Be 2

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
  }

  # PUT /api/spaces/{space}/blocks/{block}/reservations
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

    $reservations | Should -Not -Be $null

    $reservations[0].SettledOn -eq $null | Should -Be $false
    $reservations[0].Status -eq "fulfilled" | Should -Be $true
    $reservations[1].SettledOn -eq $null | Should -Be $true
    $reservations[1].Status -eq "wait" | Should -Be $true
  }

  # PATCH /api/spaces/{space}/blocks/{block}/reservations
  It 'Delete A Reservation' {
    $body = @(
      $script:reservationB.Id
    )

    $query = @{
      settled = $true
    }

    Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $body

    $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $query

    $reservations[0].SettledOn -eq $null | Should -Be $false
    $reservations[0].Status -eq "fulfilled" | Should -Be $true
    $reservations[1].SettledOn -eq $null | Should -Be $false
    $reservations[1].Status -eq "cancelledByUser" | Should -Be $true
  }
}
