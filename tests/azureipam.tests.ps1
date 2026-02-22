BeforeAll {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  Set-StrictMode -Version Latest

  # Full integration suite prerequisites: fail fast with a clear message when required env vars are missing.
  $requiredEnvVars = @(
    'IPAM_URL'
    'IPAM_ENGINE_APP_ID'
    'IPAM_RESOURCE_GROUP'
  )

  $missingEnvVars = @($requiredEnvVars | Where-Object {
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
  })

  if ($missingEnvVars.Count -gt 0) {
    throw "Missing required environment variable(s): $($missingEnvVars -join ', ')."
  }

  [string]$baseUrl = "$env:IPAM_URL/api"

  $token = (Get-AzAccessToken -ResourceUrl api://$env:IPAM_ENGINE_APP_ID).Token
  [System.Security.SecureString]$accessToken = if ($token -is [System.Security.SecureString]) { $token } else { ConvertTo-SecureString $token -AsPlainText }

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
  Function Get-JWTPayload {
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

# NOTE: This suite intentionally uses ordered, shared-state integration flows.
# - Do not reorder Context/It blocks without updating dependent test data.
# - Later tests depend on resources created earlier (for example: TestSpaceA, TestBlockA,
#   associated vNETs, External Networks/Subnets/Endpoints, and Reservations).
# - This tradeoff keeps end-to-end scenarios realistic for API integration validation.
Describe 'Azure IPAM API Integration Tests' -Tag @('Integration') {
  Context 'Spaces' {
    # GET /api/spaces
    It 'Verify No Spaces Exist' {

      $spaces, $spacesStatus = Get-ApiResource '/spaces'

      $spacesStatus | Should -Be 200
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

      $spacesStatus | Should -Be 200
      $spaces.Count | Should -Be 2

      $spaces.Name | Should -Contain 'TestSpace01'
      $spaces.Name | Should -Contain 'TestSpace02'
    }

    # DELETE /api/spaces/{space}
    It 'Delete a Space' {
      Remove-ApiResource '/spaces/TestSpace02'

      $spaces, $spacesStatus = Get-ApiResource '/spaces'

      $spacesStatus | Should -Be 200
      $spaces.Count | Should -Be 1

      $spaces.Name | Should -Contain 'TestSpace01'
      $spaces.Name | Should -Not -Contain 'TestSpace02'
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

      $spacesStatus | Should -Be 200
      $spaces.Count | Should -Be 1

      $updatedSpace = $spaces | Where-Object { $_.Name -eq 'TestSpaceA' } | Select-Object -First 1

      $updatedSpace | Should -Not -BeNullOrEmpty

      $updatedSpace.Name | Should -Be 'TestSpaceA'
      $updatedSpace.Desc | Should -Be 'Test Space A'
    }

    # GET /api/spaces/{space}
    It 'Get A Specific Space' {

      $space, $spaceStatus = Get-ApiResource '/spaces/TestSpaceA'

      $spaceStatus | Should -Be 200

      $space.Name | Should -Be 'TestSpaceA'
      $space.Desc | Should -Be 'Test Space A'
    }

    # PATCH /api/spaces/{space}
    It 'Reject Updating Space with Invalid Name Format' {
      $update = @(
        @{
          op = 'replace'
          path = '/name'
          value = '-InvalidSpaceName'
        }
      )

      { Update-ApiResource '/spaces/TestSpaceA' $update } | Should -Throw

      $space, $spaceStatus = Get-ApiResource '/spaces/TestSpaceA'

      $spaceStatus | Should -Be 200

      $space.Name | Should -Be 'TestSpaceA'
    }

    # PATCH /api/spaces/{space}
    It 'Ignore Unsupported Space Patch Operation Without Mutation' {
      $update = @(
        @{
          op = 'add'
          path = '/name'
          value = 'ShouldNotApply'
        }
      )

      $space, $spaceStatus = Update-ApiResource '/spaces/TestSpaceA' $update

      $spaceStatus | Should -Be 200

      $space.Name | Should -Be 'TestSpaceA'
      $space.Desc | Should -Be 'Test Space A'

      $currentSpace, $currentSpaceStatus = Get-ApiResource '/spaces/TestSpaceA'

      $currentSpaceStatus | Should -Be 200

      $currentSpace.Name | Should -Be 'TestSpaceA'
      $currentSpace.Desc | Should -Be 'Test Space A'
    }
  }

  Context 'Blocks' {
    # GET /api/spaces/{space}/blocks
    It 'Verify No Blocks Exist' {

      $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks'

      $blocksStatus | Should -Be 200
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

      $blocksStatus | Should -Be 200
      $blocks.Count | Should -Be 2

      $blocks.Name | Should -Contain 'TestBlock01'
      $blocks.Name | Should -Contain 'TestBlock02'
    }

    # DELETE /api/spaces/{space}
    It 'Reject Deleting a Space with Existing Blocks Without Force' {
      { Remove-ApiResource '/spaces/TestSpaceA' } | Should -Throw

      $space, $spaceStatus = Get-ApiResource '/spaces/TestSpaceA'

      $spaceStatus | Should -Be 200

      $space.Name | Should -Be 'TestSpaceA'
    }

    # DELETE /api/spaces/{space}/blocks/{block}
    It 'Delete a Block' {
      Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlock02'

      $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks'

      $blocksStatus | Should -Be 200
      $blocks.Count | Should -Be 1

      $blocks.Name | Should -Contain 'TestBlock01'
      $blocks.Name | Should -Not -Contain 'TestBlock02'
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

      $blocksStatus | Should -Be 200
      $blocks.Count | Should -Be 1

      $updatedBlock = $blocks | Where-Object { $_.Name -eq 'TestBlockA' } | Select-Object -First 1

      $updatedBlock | Should -Not -BeNullOrEmpty

      $updatedBlock.Name | Should -Be 'TestBlockA'
      $updatedBlock.Cidr | Should -Be '10.1.0.0/16'
    }

    # GET /api/spaces/{space}/blocks/{block}
    It 'Get a Specific Block' {

      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA'

      $blockStatus | Should -Be 200

      $block.Name | Should -Be 'TestBlockA'
      $block.Cidr | Should -Be '10.1.0.0/16'
    }

    # PATCH /api/spaces/{space}/blocks/{block}
    It 'Reject Updating Block CIDR to Overlap Existing Block CIDR' {
      $overlapBlock = @{
        name = 'TestBlockOverlap'
        cidr = '100.65.0.0/24'
      }

      $newBlock, $newBlockStatus = New-ApiResource '/spaces/TestSpaceA/blocks' $overlapBlock

      $newBlockStatus | Should -Be 201

      $newBlock.Name | Should -Be 'TestBlockOverlap'

      $update = @(
        @{
          op = 'replace'
          path = '/cidr'
          value = '10.1.0.0/24'
        }
      )

      { Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockOverlap' $update } | Should -Throw

      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockOverlap'

      $blockStatus | Should -Be 200

      $block.Cidr | Should -Be '100.65.0.0/24'
    }

    # PATCH /api/spaces/{space}/blocks/{block}
    It 'Ignore Unsupported Block Patch Path Without Mutation' {
      $update = @(
        @{
          op = 'replace'
          path = '/nonexistent'
          value = 'NoEffect'
        }
      )

      $block, $blockStatus = Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA' $update

      $blockStatus | Should -Be 200

      $block.Name | Should -Be 'TestBlockA'
      $block.Cidr | Should -Be '10.1.0.0/16'

      $currentBlock, $currentBlockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA'

      $currentBlockStatus | Should -Be 200

      $currentBlock.Name | Should -Be 'TestBlockA'
      $currentBlock.Cidr | Should -Be '10.1.0.0/16'
    }
  }

  Context 'Networks' -Tag @('AzureLive') {
    # GET /api/spaces/{space}/blocks/{block}/networks
    It 'Verify No Networks Exist in Block' {

      $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

      $networksStatus | Should -Be 200
      $networks | Should -Be $null
    }

    # POST /api/spaces/{space}/blocks/{block}/networks
    It 'Add a Virtual Network to Block' -Tag @('LongRunning') {
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

      $blockStatus | Should -Be 200

      ($block.vnets | Select-Object -ExpandProperty id) | Should -Contain $script:newNetA.Id
    }

    # DELETE /api/spaces/{space}/blocks/{block}
    It 'Reject Deleting Block with Existing Networks Without Force' {
      { Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA' } | Should -Throw

      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA'

      $blockStatus | Should -Be 200

      $block.Name | Should -Be 'TestBlockA'
    }

    # POST /api/spaces/{space}/blocks/{block}/networks
    It 'Reject vNET Association if Any In-Block Prefix Overlaps Existing Network' -Tag @('LongRunning') {
      $script:newNetC = New-AzVirtualNetwork `
        -Name 'TestVNet03' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix @('10.1.3.0/24', '10.1.0.0/24')

      Start-Sleep -Seconds 60

      $body = @{
        id = $script:newNetC.Id
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body } | Should -Throw

      $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

      $networksStatus | Should -Be 200

      ($networks | Select-Object -ExpandProperty id) | Should -Not -Contain $script:newNetC.Id
    }

    # PUT /api/spaces/{space}/blocks/{block}/networks
    It 'Replace Block Virtual Networks' -Tag @('LongRunning') {
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

      $networksStatus | Should -Be 200

      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetA.Id
      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetB.Id
    }

    # PUT /api/spaces/{space}/blocks/{block}/networks
    It 'Reject Block Network Replacement if Any In-Block Prefix Overlaps Existing Network' -Tag @('LongRunning') {
      $script:newNetD = New-AzVirtualNetwork `
        -Name 'TestVNet04' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix @('10.1.4.0/24', '10.1.1.0/24')

      Start-Sleep -Seconds 60

      $body = @(
        $script:newNetA.Id
        $script:newNetD.Id
      )

      { Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body } | Should -Throw

      $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

      $networksStatus | Should -Be 200

      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetA.Id
      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetB.Id
      ($networks | Select-Object -ExpandProperty id) | Should -Not -Contain $script:newNetD.Id
    }

    # POST /api/spaces/{space}/blocks/{block}/networks
    It 'Add vNET Association if All In-Block Prefixes Are Available' -Tag @('LongRunning') {
      $script:newNetE = New-AzVirtualNetwork `
        -Name 'TestVNet05' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix @('10.1.5.0/24', '10.1.6.0/24')

      Start-Sleep -Seconds 60

      $body = @{
        id = $script:newNetE.Id
      }

      New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body

      $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

      $networksStatus | Should -Be 200

      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetE.Id
    }

    # DELETE /api/spaces/{space}/blocks/{block}/networks
    It 'Delete Block Virtual Network' {
      $body = @(
        $script:newNetB.Id
      )

      Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body

      $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks'

      $networksStatus | Should -Be 200

      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetA.Id
      ($networks | Select-Object -ExpandProperty id) | Should -Not -Contain $script:newNetB.Id
    }
  }

  Context 'External Networks' {
    # GET /api/spaces/{space}/blocks/{block}/externals
    It 'Verify No External Networks Exist in Block' {

      $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

      $externalsStatus | Should -Be 200
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

      $externalsStatus | Should -Be 200
      $externals.Count | Should -Be 1

      $externalA = $externals | Where-Object { $_.Name -eq 'ExternalNetA' } | Select-Object -First 1

      $externalA | Should -Not -BeNullOrEmpty

      $externalA.Name | Should -Be "ExternalNetA"
      $externalA.Desc | Should -Be "External Network A"
      $externalA.Cidr | Should -Be "10.1.1.0/24"
    }

    # POST /api/spaces/{space}/blocks/{block}/externals
    It 'Reject External Network CIDR Outside Block Range' {
      $outsideExternal = @{
        name = 'ExternalNetOutside'
        desc = 'External Outside Block'
        cidr = '172.16.1.0/24'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $outsideExternal } | Should -Throw

      $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

      $externalsStatus | Should -Be 200

      ($externals | Select-Object -ExpandProperty name) | Should -Not -Contain 'ExternalNetOutside'
    }

    # POST /api/spaces/{space}/blocks/{block}/externals
    It 'Reject External Network CIDR Overlap with Existing External Network' {
      $overlapExternal = @{
        name = 'ExternalNetOverlap'
        desc = 'External Overlap Test'
        cidr = '10.1.1.128/25'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $overlapExternal } | Should -Throw

      $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

      $externalsStatus | Should -Be 200

      ($externals | Select-Object -ExpandProperty name) | Should -Not -Contain 'ExternalNetOverlap'
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

      $externalsStatus | Should -Be 200
      $externals.Count | Should -Be 2

      $externalA = $externals | Where-Object { $_.Name -eq 'ExternalNetA' } | Select-Object -First 1
      $externalB = $externals | Where-Object { $_.Name -eq 'ExternalNetB' } | Select-Object -First 1

      $externalA | Should -Not -BeNullOrEmpty
      $externalB | Should -Not -BeNullOrEmpty

      $externalA.Name | Should -Be "ExternalNetA"
      $externalA.Desc | Should -Be "External Network A"
      $externalA.Cidr | Should -Be "10.1.1.0/24"

      $externalB.Name | Should -Be "ExternalNetB"
      $externalB.Desc | Should -Be "External Network B"
      $externalB.Cidr | Should -Be "10.1.2.0/24"
    }

    # GET /api/spaces/{space}/blocks/{block}/externals/{external}
    It 'Get a Specific External Network' {

      $external, $externalStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetB'

      $externalStatus | Should -Be 200

      $external.Name | Should -Be "ExternalNetB"
      $external.Desc | Should -Be "External Network B"
      $external.Cidr | Should -Be "10.1.2.0/24"
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

      $externalsStatus | Should -Be 200
      $externals.Count | Should -Be 2

      $externalA = $externals | Where-Object { $_.Name -eq 'ExternalNetA' } | Select-Object -First 1
      $externalC = $externals | Where-Object { $_.Name -eq 'ExternalNetC' } | Select-Object -First 1

      $externalA | Should -Not -BeNullOrEmpty
      $externalC | Should -Not -BeNullOrEmpty

      $externalA.Name | Should -Be "ExternalNetA"
      $externalA.Desc | Should -Be "External Network A"
      $externalA.Cidr | Should -Be "10.1.1.0/24"

      $externalC.Name | Should -Be "ExternalNetC"
      $externalC.Desc | Should -Be "External Network C"
      $externalC.Cidr | Should -Be "10.1.3.0/24"
    }

    # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}
    It 'Ignore Unsupported External Patch Operation Without Mutation' {
      $update = @(
        @{
          op = 'add'
          path = '/name'
          value = 'NoEffectExternal'
        }
      )

      $external, $externalStatus = Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetC' $update

      $externalStatus | Should -Be 200

      $external.Name | Should -Be 'ExternalNetC'
      $external.Cidr | Should -Be '10.1.3.0/24'

      $currentExternal, $currentExternalStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetC'

      $currentExternalStatus | Should -Be 200

      $currentExternal.Name | Should -Be 'ExternalNetC'
      $currentExternal.Cidr | Should -Be '10.1.3.0/24'
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}
    It 'Delete an External Network' {
      Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetC'

      $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

      $externalsStatus | Should -Be 200
      $externals.Count | Should -Be 1

      $externalA = $externals | Where-Object { $_.Name -eq 'ExternalNetA' } | Select-Object -First 1

      $externalA | Should -Not -BeNullOrEmpty

      $externalA.Name | Should -Be "ExternalNetA"
      $externalA.Desc | Should -Be "External Network A"
      $externalA.Cidr | Should -Be "10.1.1.0/24"
    }

    # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets
    It 'Verify No External Subnets Exist in External Network' {

      $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'

      $subnetsStatus | Should -Be 200
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

      $subnetsStatus | Should -Be 200
      $subnets.Count | Should -Be 1

      $subnetA = $subnets | Where-Object { $_.Name -eq 'SubnetA' } | Select-Object -First 1

      $subnetA | Should -Not -BeNullOrEmpty

      $subnetA.Name | Should -Be "SubnetA"
      $subnetA.Desc | Should -Be "Subnet A"
      $subnetA.Cidr | Should -Be "10.1.1.0/26"
    }

    # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}
    It 'Reject Updating External Network CIDR That Excludes Existing Subnets' {
      $update = @(
        @{
          op = 'replace'
          path = '/cidr'
          value = '10.1.2.0/24'
        }
      )

      { Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA' $update } | Should -Throw

      $external, $externalStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA'

      $externalStatus | Should -Be 200

      $external.Cidr | Should -Be '10.1.1.0/24'
    }

    # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets
    It 'Reject External Subnet CIDR Outside Parent External Network' {
      $outsideSubnet = @{
        name = 'SubnetOutside'
        desc = 'Outside Parent External'
        cidr = '10.1.2.0/26'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets' $outsideSubnet } | Should -Throw

      $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'

      $subnetsStatus | Should -Be 200

      ($subnets | Select-Object -ExpandProperty name) | Should -Not -Contain 'SubnetOutside'
    }

    # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets
    It 'Reject External Subnet CIDR Overlap with Existing Subnet' {
      $overlapSubnet = @{
        name = 'SubnetOverlap'
        desc = 'Overlapping Subnet'
        cidr = '10.1.1.32/27'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets' $overlapSubnet } | Should -Throw

      $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'

      $subnetsStatus | Should -Be 200

      ($subnets | Select-Object -ExpandProperty name) | Should -Not -Contain 'SubnetOverlap'
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

      $subnetsStatus | Should -Be 200
      $subnets.Count | Should -Be 2

      $subnetA = $subnets | Where-Object { $_.Name -eq 'SubnetA' } | Select-Object -First 1
      $subnetB = $subnets | Where-Object { $_.Name -eq 'SubnetB' } | Select-Object -First 1

      $subnetA | Should -Not -BeNullOrEmpty
      $subnetB | Should -Not -BeNullOrEmpty

      $subnetA.Name | Should -Be "SubnetA"
      $subnetA.Desc | Should -Be "Subnet A"
      $subnetA.Cidr | Should -Be "10.1.1.0/26"

      $subnetB.Name | Should -Be "SubnetB"
      $subnetB.Desc | Should -Be "Subnet B"
      $subnetB.Cidr | Should -Be "10.1.1.64/26"
    }

    # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
    It 'Get Specific External Subnet' {

      $subnet, $subnetStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetB'

      $subnetStatus | Should -Be 200

      $subnet.Name | Should -Be "SubnetB"
      $subnet.Desc | Should -Be "Subnet B"
      $subnet.Cidr | Should -Be "10.1.1.64/26"
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

      $subnetsStatus | Should -Be 200
      $subnets.Count | Should -Be 2

      $subnetA = $subnets | Where-Object { $_.Name -eq 'SubnetA' } | Select-Object -First 1
      $subnetC = $subnets | Where-Object { $_.Name -eq 'SubnetC' } | Select-Object -First 1

      $subnetA | Should -Not -BeNullOrEmpty
      $subnetC | Should -Not -BeNullOrEmpty

      $subnetA.Name | Should -Be "SubnetA"
      $subnetA.Desc | Should -Be "Subnet A"
      $subnetA.Cidr | Should -Be "10.1.1.0/26"

      $subnetC.Name | Should -Be "SubnetC"
      $subnetC.Desc | Should -Be "Subnet C"
      $subnetC.Cidr | Should -Be "10.1.1.128/27"
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
    It 'Delete an External Subnet' {
      Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetC'

      $subnets, $subnetsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets'

      $subnetsStatus | Should -Be 200
      $subnets.Count | Should -Be 1

      $subnetA = $subnets | Where-Object { $_.Name -eq 'SubnetA' } | Select-Object -First 1

      $subnetA | Should -Not -BeNullOrEmpty

      $subnetA.Name | Should -Be "SubnetA"
      $subnetA.Desc | Should -Be "Subnet A"
      $subnetA.Cidr | Should -Be "10.1.1.0/26"
    }

    # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Verify No External Endpoints Exist in External Subnet' {

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
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

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 1

      $endpointA = $endpoints | Where-Object { $_.Name -eq 'EndpointA' } | Select-Object -First 1

      $endpointA | Should -Not -BeNullOrEmpty

      $endpointA.Name | Should -Be "EndpointA"
      $endpointA.Desc | Should -Be "Endpoint A"
      $endpointA.IP | Should -Be "10.1.1.4"
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

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      $endpointA = $endpoints | Where-Object { $_.Name -eq 'EndpointA' } | Select-Object -First 1
      $endpointB = $endpoints | Where-Object { $_.Name -eq 'EndpointB' } | Select-Object -First 1

      $endpointA | Should -Not -BeNullOrEmpty
      $endpointB | Should -Not -BeNullOrEmpty

      $endpointA.Name | Should -Be "EndpointA"
      $endpointA.Desc | Should -Be "Endpoint A"
      $endpointA.IP | Should -Be "10.1.1.4"

      $endpointB.Name | Should -Be "EndpointB"
      $endpointB.Desc | Should -Be "Endpoint B"
      $endpointB.IP | Should -Be "10.1.1.1"
    }

    # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Reject Creating External Endpoint with IP Outside Subnet CIDR' {
      $outsideEndpoint = @{
        name = 'EndpointOutsideSubnet'
        desc = 'Endpoint Outside Subnet'
        ip = '10.1.2.10'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $outsideEndpoint } | Should -Throw

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      ($endpoints | Select-Object -ExpandProperty name) | Should -Not -Contain 'EndpointOutsideSubnet'
    }

    # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Reject Creating External Endpoint with Duplicate IP Address' {
      $duplicateIpEndpoint = @{
        name = 'EndpointDuplicateIP'
        desc = 'Endpoint Duplicate IP'
        ip = '10.1.1.4'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $duplicateIpEndpoint } | Should -Throw

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      ($endpoints | Select-Object -ExpandProperty name) | Should -Not -Contain 'EndpointDuplicateIP'
    }

    # POST /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Reject Creating External Endpoint with Duplicate Name' {
      $duplicateNameEndpoint = @{
        name = 'EndpointA'
        desc = 'Endpoint Duplicate Name'
        ip = '10.1.1.6'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $duplicateNameEndpoint } | Should -Throw

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2
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

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 4

      $endpointA = $endpoints | Where-Object { $_.Name -eq 'EndpointA' } | Select-Object -First 1
      $endpointB = $endpoints | Where-Object { $_.Name -eq 'EndpointB' } | Select-Object -First 1
      $endpointC = $endpoints | Where-Object { $_.Name -eq 'EndpointC' } | Select-Object -First 1
      $endpointD = $endpoints | Where-Object { $_.Name -eq 'EndpointD' } | Select-Object -First 1

      $endpointA | Should -Not -BeNullOrEmpty
      $endpointB | Should -Not -BeNullOrEmpty
      $endpointC | Should -Not -BeNullOrEmpty
      $endpointD | Should -Not -BeNullOrEmpty

      $endpointA.Name | Should -Be "EndpointA"
      $endpointA.Desc | Should -Be "Endpoint A"
      $endpointA.IP | Should -Be "10.1.1.4"

      $endpointB.Name | Should -Be "EndpointB"
      $endpointB.Desc | Should -Be "Endpoint B"
      $endpointB.IP | Should -Be "10.1.1.1"

      $endpointC.Name | Should -Be "EndpointC"
      $endpointC.Desc | Should -Be "Endpoint C"
      $endpointC.IP | Should -Be "10.1.1.5"

      $endpointD.Name | Should -Be "EndpointD"
      $endpointD.Desc | Should -Be "Endpoint D"
      $endpointD.IP | Should -Be "10.1.1.2"
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/ExternalNetA/subnets/SubnetA/endpoints
    It 'Delete External Endpoints' {
      $body = @(
        $script:endpointC.name
        $script:endpointD.name
      )

      Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $body

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      $endpointA = $endpoints | Where-Object { $_.Name -eq 'EndpointA' } | Select-Object -First 1
      $endpointB = $endpoints | Where-Object { $_.Name -eq 'EndpointB' } | Select-Object -First 1

      $endpointA | Should -Not -BeNullOrEmpty
      $endpointB | Should -Not -BeNullOrEmpty

      $endpointA.Name | Should -Be "EndpointA"
      $endpointA.Desc | Should -Be "Endpoint A"
      $endpointA.IP | Should -Be "10.1.1.4"

      $endpointB.Name | Should -Be "EndpointB"
      $endpointB.Desc | Should -Be "Endpoint B"
      $endpointB.IP | Should -Be "10.1.1.1"
    }

    # PATCH /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
    It 'Reject Updating External Subnet CIDR That Excludes Existing Endpoints' {
      $update = @(
        @{
          op = 'replace'
          path = '/cidr'
          value = '10.1.1.64/26'
        }
      )

      { Update-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA' $update } | Should -Throw

      $subnet, $subnetStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA'

      $subnetStatus | Should -Be 200

      $subnet.Cidr | Should -Be '10.1.1.0/26'
    }

    # PUT /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Reject Replacing Endpoints with Duplicate Names' {
      $body = @(
        @{
          name = 'EndpointA'
          desc = 'Endpoint A Duplicate Test 1'
          ip = '10.1.1.4'
        }
        @{
          name = 'EndpointA'
          desc = 'Endpoint A Duplicate Test 2'
          ip = '10.1.1.6'
        }
      )

      { Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $body } | Should -Throw

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      ($endpoints | Select-Object -ExpandProperty Name) | Should -Contain 'EndpointA'
      ($endpoints | Select-Object -ExpandProperty Name) | Should -Contain 'EndpointB'
    }

    # PUT /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Reject Replacing Endpoints with Overlapping IP Addresses' {
      $body = @(
        @{
          name = 'EndpointOverlapA'
          desc = 'Endpoint Overlap A'
          ip = '10.1.1.7'
        }
        @{
          name = 'EndpointOverlapB'
          desc = 'Endpoint Overlap B'
          ip = '10.1.1.7'
        }
      )

      { Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $body } | Should -Throw

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      ($endpoints | Select-Object -ExpandProperty Name) | Should -Contain 'EndpointA'
      ($endpoints | Select-Object -ExpandProperty Name) | Should -Contain 'EndpointB'
    }

    # PUT /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints
    It 'Reject Replacing Endpoints with IP Outside Subnet CIDR' {
      $body = @(
        @{
          name = 'EndpointOutsideA'
          desc = 'Endpoint Outside A'
          ip = '10.1.1.8'
        }
        @{
          name = 'EndpointOutsideB'
          desc = 'Endpoint Outside B'
          ip = '10.1.2.8'
        }
      )

      { Set-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints' $body } | Should -Throw

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      ($endpoints | Select-Object -ExpandProperty Name) | Should -Contain 'EndpointA'
      ($endpoints | Select-Object -ExpandProperty Name) | Should -Contain 'EndpointB'
    }

    # GET /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints/{endpoint}
    It 'Get a Specific External Endpoint' {

      $endpoint, $endpointStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints/EndpointA'

      $endpointStatus | Should -Be 200

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

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 2

      $endpointA = $endpoints | Where-Object { $_.Name -eq 'EndpointA' } | Select-Object -First 1
      $endpointC = $endpoints | Where-Object { $_.Name -eq 'EndpointC' } | Select-Object -First 1

      $endpointA | Should -Not -BeNullOrEmpty
      $endpointC | Should -Not -BeNullOrEmpty

      $endpointA.Name | Should -Be "EndpointA"
      $endpointA.Desc | Should -Be "Endpoint A"
      $endpointA.IP | Should -Be "10.1.1.4"

      $endpointC.Name | Should -Be "EndpointC"
      $endpointC.Desc | Should -Be "Endpoint C"
      $endpointC.IP | Should -Be "10.1.1.10"
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}/endpoints/{endpoint}
    It 'Delete an External Endpoint' {
      Remove-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints/EndpointC'

      $endpoints, $endpointsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals/ExternalNetA/subnets/SubnetA/endpoints'

      $endpointsStatus | Should -Be 200
      $endpoints.Count | Should -Be 1

      $endpointA = $endpoints | Where-Object { $_.Name -eq 'EndpointA' } | Select-Object -First 1

      $endpointA | Should -Not -BeNullOrEmpty

      $endpointA.Name | Should -Be "EndpointA"
      $endpointA.Desc | Should -Be "Endpoint A"
      $endpointA.IP | Should -Be "10.1.1.4"
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}
    It 'Reject Deleting External Network with Subnets Without Force' {
      $script:forceDeleteExternal = @{
        name = 'ExternalForceDeleteA'
        desc = 'External Force Delete A'
        cidr = '10.1.240.0/24'
      }

      $script:forceDeleteSubnet = @{
        name = 'SubnetForceDeleteA'
        desc = 'Subnet Force Delete A'
        cidr = '10.1.240.0/26'
      }

      $newExternal, $newExternalStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $script:forceDeleteExternal
      $newSubnet, $newSubnetStatus = New-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteExternal.name)/subnets" $script:forceDeleteSubnet

      $newExternalStatus | Should -Be 201
      $newSubnetStatus | Should -Be 201

      { Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteExternal.name)" } | Should -Throw

      $external, $externalStatus = Get-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteExternal.name)"

      $externalStatus | Should -Be 200

      $external.Name | Should -Be $script:forceDeleteExternal.name
      $external.Subnets.Count | Should -Be 1
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}
    It 'Delete External Network with Subnets When Force Is True' {
      Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteExternal.name)?force=true"

      $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

      $externalsStatus | Should -Be 200

      ($externals | Select-Object -ExpandProperty name) | Should -Not -Contain $script:forceDeleteExternal.name
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
    It 'Reject Deleting External Subnet with Endpoints Without Force' {
      $script:forceDeleteEndpointExternal = @{
        name = 'ExternalForceDeleteB'
        desc = 'External Force Delete B'
        cidr = '10.1.241.0/24'
      }

      $script:forceDeleteEndpointSubnet = @{
        name = 'SubnetForceDeleteB'
        desc = 'Subnet Force Delete B'
        cidr = '10.1.241.0/26'
      }

      $script:forceDeleteEndpoint = @{
        name = 'EndpointForceDeleteB'
        desc = 'Endpoint Force Delete B'
        ip = $null
      }

      $newExternal, $newExternalStatus = New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals' $script:forceDeleteEndpointExternal
      $newSubnet, $newSubnetStatus = New-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)/subnets" $script:forceDeleteEndpointSubnet
      $newEndpoint, $newEndpointStatus = New-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)/subnets/$($script:forceDeleteEndpointSubnet.name)/endpoints" $script:forceDeleteEndpoint

      $newExternalStatus | Should -Be 201
      $newSubnetStatus | Should -Be 201
      $newEndpointStatus | Should -Be 200

      { Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)/subnets/$($script:forceDeleteEndpointSubnet.name)" } | Should -Throw

      $subnet, $subnetStatus = Get-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)/subnets/$($script:forceDeleteEndpointSubnet.name)"

      $subnetStatus | Should -Be 200

      $subnet.Name | Should -Be $script:forceDeleteEndpointSubnet.name
      ($subnet.Endpoints | Select-Object -ExpandProperty name) | Should -Contain $script:forceDeleteEndpoint.name
    }

    # DELETE /api/spaces/{space}/blocks/{block}/externals/{external}/subnets/{subnet}
    It 'Delete External Subnet with Endpoints When Force Is True' {
      Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)/subnets/$($script:forceDeleteEndpointSubnet.name)?force=true"

      $subnets, $subnetsStatus = Get-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)/subnets"

      $subnetsStatus | Should -Be 200

      if($subnets) {
        ($subnets | Select-Object -ExpandProperty name) | Should -Not -Contain $script:forceDeleteEndpointSubnet.name
      }
      else {
        $subnets.Count | Should -Be 0
      }

      Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/externals/$($script:forceDeleteEndpointExternal.name)"

      $externals, $externalsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/externals'

      $externalsStatus | Should -Be 200

      ($externals | Select-Object -ExpandProperty name) | Should -Not -Contain $script:forceDeleteEndpointExternal.name
    }
  }

  Context 'Reservations' -Tag @('AzureLive') {
    # GET /api/spaces/{space}/blocks/{block}/reservations
    It 'Verify No Reservations Exist in Block' {

      $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'

      $reservationsStatus | Should -Be 200

      $reservations | Should -Be $null
    }

    # POST /api/spaces/{space}/reservations
    It 'Reject Space Reservation with Invalid Block List' {
      $body = @{
        blocks = @('InvalidBlockName')
        size = 26
        desc = 'Invalid Space Reservation Test'
      }

      { New-ApiResource '/spaces/TestSpaceA/reservations' $body } | Should -Throw
    }

    # POST /api/spaces/{space}/reservations
    It 'Create Space Reservation from Block List' {
      $spaceReservationBlock = @{
        name = 'TestBlockSpaceResv'
        cidr = '100.64.0.0/24'
      }

      $newBlock, $newBlockStatus = New-ApiResource '/spaces/TestSpaceA/blocks' $spaceReservationBlock

      $body = @{
        blocks = @('TestBlockSpaceResv')
        size = 26
        desc = 'Test Space Reservation A'
      }

      $script:spaceReservationA, $spaceReservationAStatus = New-ApiResource '/spaces/TestSpaceA/reservations' $body

      $newBlockStatus | Should -Be 201
      $spaceReservationAStatus | Should -Be 201

      $newBlock.Name | Should -Be 'TestBlockSpaceResv'
      $newBlock.Cidr | Should -Be '100.64.0.0/24'

      $script:spaceReservationA.Space | Should -Be 'TestSpaceA'
      $script:spaceReservationA.Block | Should -Be 'TestBlockSpaceResv'
      $script:spaceReservationA.Desc | Should -Be 'Test Space Reservation A'
      $script:spaceReservationA.Cidr | Should -Be '100.64.0.0/26'
      $script:spaceReservationA.SettledOn | Should -Be $null
      $script:spaceReservationA.Status | Should -Be 'wait'
    }

    # GET /api/spaces/{space}/reservations
    It 'List Unsettled Space Reservations' {

      $spaceReservations, $spaceReservationsStatus = Get-ApiResource '/spaces/TestSpaceA/reservations'

      $spaceReservationsStatus | Should -Be 200

      ($spaceReservations | Select-Object -ExpandProperty id) | Should -Contain $script:spaceReservationA.Id
    }

    # DELETE /api/spaces/{space}/blocks/{block}/reservations/{reservationId}
    It 'Cancel Space Reservation' {

      Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockSpaceResv/reservations/$($script:spaceReservationA.Id)"

      $spaceReservations, $spaceReservationsStatus = Get-ApiResource '/spaces/TestSpaceA/reservations'

      $spaceReservationsStatus | Should -Be 200

      if($spaceReservations) {
        ($spaceReservations | Select-Object -ExpandProperty id) | Should -Not -Contain $script:spaceReservationA.Id
      }
      else {
        $spaceReservations | Should -Be $null
      }
    }

    # GET /api/spaces/{space}/reservations
    It 'List Settled Space Reservations' {
      $query = @{
        settled = $true
      }

      $spaceReservations, $spaceReservationsStatus = Get-ApiResource '/spaces/TestSpaceA/reservations' $query

      $spaceReservationsStatus | Should -Be 200

      $targetReservation = $spaceReservations | Where-Object { $_.Id -eq $script:spaceReservationA.Id } | Select-Object -First 1

      $targetReservation | Should -Not -BeNullOrEmpty

      $targetReservation.Status | Should -Be 'cancelledByUser'
      $targetReservation.SettledOn | Should -Not -Be $null
    }

    # POST /api/spaces/{space}/blocks/{block}/reservations
    It 'Reject Specific Block Reservation CIDR Outside Block Availability' {
      $body = @{
        cidr = '10.2.0.0/24'
        desc = 'Outside Block CIDR'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $body } | Should -Throw

      $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'

      $reservationsStatus | Should -Be 200

      if($reservations) {
        ($reservations | Select-Object -ExpandProperty cidr) | Should -Not -Contain '10.2.0.0/24'
      }
      else {
        $reservations | Should -Be $null
      }
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

      $reservationAStatus | Should -Be 201
      $reservationBStatus | Should -Be 201
      $reservationCStatus | Should -Be 201
      $reservationsStatus | Should -Be 200
      $reservations.Count | Should -Be 3

      $reservationA = $reservations | Where-Object { $_.Id -eq $script:reservationA.Id } | Select-Object -First 1
      $reservationB = $reservations | Where-Object { $_.Id -eq $script:reservationB.Id } | Select-Object -First 1
      $reservationC = $reservations | Where-Object { $_.Id -eq $script:reservationC.Id } | Select-Object -First 1

      $reservationA | Should -Not -BeNullOrEmpty
      $reservationB | Should -Not -BeNullOrEmpty
      $reservationC | Should -Not -BeNullOrEmpty

      $reservationA.Space | Should -Be "TestSpaceA"
      $reservationA.Block | Should -Be "TestBlockA"
      $reservationA.Desc | Should -Be "Test Reservation A"
      $reservationA.Cidr | Should -Be "10.1.2.0/24"
      $reservationA.SettledOn | Should -Be $null

      $reservationB.Space | Should -Be "TestSpaceA"
      $reservationB.Block | Should -Be "TestBlockA"
      $reservationB.Desc | Should -Be "Test Reservation B"
      $reservationB.Cidr | Should -Be "10.1.3.0/24"
      $reservationB.SettledOn | Should -Be $null

      $reservationC.Space | Should -Be "TestSpaceA"
      $reservationC.Block | Should -Be "TestBlockA"
      $reservationC.Desc | Should -Be "Test Reservation C"
      $reservationC.Cidr | Should -Be "10.1.4.0/24"
      $reservationC.SettledOn | Should -Be $null
    }

    # POST /api/spaces/{space}/blocks/{block}/reservations
    It 'Reject Block Reservation with Conflicting CIDR and Search Flags' {
      $body = @{
        cidr = '10.1.5.0/24'
        reverse_search = $true
        desc = 'Invalid Reservation Options'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $body } | Should -Throw
    }

    # POST /api/spaces/{space}/blocks/{block}/reservations
    It 'Reject Specific Block Reservation CIDR Overlap' {
      $body = @{
        cidr = $script:reservationA.Cidr
        desc = 'Overlapping Reservation CIDR'
      }

      { New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $body } | Should -Throw

      $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations'

      $reservationsStatus | Should -Be 200
      $reservations.Count | Should -Be 3
    }

    # GET /api/spaces/{space}/blocks/{block}/available
    It 'List Available Block Networks by CIDR Eligibility' -Tag @('LongRunning') {
      $script:newNetAvailA = New-AzVirtualNetwork `
        -Name 'TestVNetAvail01' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix '10.1.200.0/24'

      $script:newNetAvailB = New-AzVirtualNetwork `
        -Name 'TestVNetAvail02' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix '10.1.1.0/24'

      Start-Sleep -Seconds 60

      $available, $availableStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/available'

      $availableStatus | Should -Be 200

      $available | Should -Contain $script:newNetAvailA.Id
      $available | Should -Not -Contain $script:newNetAvailB.Id
    }

    # Create an Azure Virtual Network w/ Reservation ID Tag and Verify it's Automatically Imported into IPAM
    It 'Import Virtual Network via Reservation ID' -Tag @('LongRunning') {
      $script:newNetResvC = New-AzVirtualNetwork `
        -Name 'TestVNetResv03' `
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

      $networksStatus | Should -Be 200
      $reservationsStatus | Should -Be 200

      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetA.Id
      ($networks | Select-Object -ExpandProperty id) | Should -Contain $script:newNetResvC.Id

      $reservations.Count | Should -Be 3

      $reservationASettled = $reservations | Where-Object { $_.Id -eq $script:reservationA.Id } | Select-Object -First 1
      $reservationBPending = $reservations | Where-Object { $_.Id -eq $script:reservationB.Id } | Select-Object -First 1
      $reservationCPending = $reservations | Where-Object { $_.Id -eq $script:reservationC.Id } | Select-Object -First 1

      $reservationASettled | Should -Not -BeNullOrEmpty
      $reservationBPending | Should -Not -BeNullOrEmpty
      $reservationCPending | Should -Not -BeNullOrEmpty

      $reservationASettled.SettledOn | Should -Not -Be $null
      $reservationASettled.Status | Should -Be "fulfilled"
      $reservationBPending.SettledOn | Should -Be $null
      $reservationBPending.Status | Should -Be "wait"
      $reservationCPending.SettledOn | Should -Be $null
      $reservationCPending.Status | Should -Be "wait"
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

      $reservationsStatus | Should -Be 200
      $reservations.Count | Should -Be 3

      $reservationAFulfilled = $reservations | Where-Object { $_.Id -eq $script:reservationA.Id } | Select-Object -First 1
      $reservationBCancelled = $reservations | Where-Object { $_.Id -eq $script:reservationB.Id } | Select-Object -First 1
      $reservationCWaiting = $reservations | Where-Object { $_.Id -eq $script:reservationC.Id } | Select-Object -First 1

      $reservationAFulfilled | Should -Not -BeNullOrEmpty
      $reservationBCancelled | Should -Not -BeNullOrEmpty
      $reservationCWaiting | Should -Not -BeNullOrEmpty

      $reservationAFulfilled.SettledOn | Should -Not -Be $null
      $reservationAFulfilled.Status | Should -Be "fulfilled"
      $reservationBCancelled.SettledOn | Should -Not -Be $null
      $reservationBCancelled.Status | Should -Be "cancelledByUser"
      $reservationCWaiting.SettledOn | Should -Be $null
      $reservationCWaiting.Status | Should -Be "wait"
    }

    # GET /api/spaces/{space}/blocks/{block}/reservations/{reservationId}
    It 'Get a Specific Reservation' {

      $reservation, $reservationStatus = Get-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/reservations/$($script:reservationC.Id)"

      $reservationStatus | Should -Be 200

      $reservation.Space | Should -Be "TestSpaceA"
      $reservation.Block | Should -Be "TestBlockA"
      $reservation.Desc | Should -Be "Test Reservation C"
      $reservation.Cidr | Should -Be "10.1.4.0/24"
      $reservation.SettledOn | Should -Be $null
    }

    # DELETE /api/spaces/{space}/blocks/{block}/reservations/{reservationId}
    It 'Delete a Specific Reservation' {
      $query = @{
        settled = $true
      }

      Remove-ApiResource "/spaces/TestSpaceA/blocks/TestBlockA/reservations/$($script:reservationC.Id)"

      $reservations, $reservationsStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $query

      $reservationsStatus | Should -Be 200
      $reservations.Count | Should -Be 3

      $reservationAFulfilled = $reservations | Where-Object { $_.Id -eq $script:reservationA.Id } | Select-Object -First 1
      $reservationBCancelled = $reservations | Where-Object { $_.Id -eq $script:reservationB.Id } | Select-Object -First 1
      $reservationCCancelled = $reservations | Where-Object { $_.Id -eq $script:reservationC.Id } | Select-Object -First 1

      $reservationAFulfilled | Should -Not -BeNullOrEmpty
      $reservationBCancelled | Should -Not -BeNullOrEmpty
      $reservationCCancelled | Should -Not -BeNullOrEmpty

      $reservationAFulfilled.SettledOn | Should -Not -Be $null
      $reservationAFulfilled.Status | Should -Be "fulfilled"
      $reservationBCancelled.SettledOn | Should -Not -Be $null
      $reservationBCancelled.Status | Should -Be "cancelledByUser"
      $reservationCCancelled.SettledOn | Should -Not -Be $null
      $reservationCCancelled.Status | Should -Be "cancelledByUser"
    }
  }

  Context 'Tools' -Tag @('AzureLive') {
    # POST /api/spaces
    It 'Create Tools Space' {
      $toolsSpace = @{
        name = 'ToolsSpace'
        desc = 'Tools Space'
      }

      New-ApiResource '/spaces' $toolsSpace

      $spaces, $spacesStatus = Get-ApiResource '/spaces'

      $spacesStatus | Should -Be 200
      $spaces.Count | Should -Be 2

      $spaces.Name | Should -Contain 'TestSpaceA'
      $spaces.Name | Should -Contain 'ToolsSpace'
    }

    # PATCH /api/spaces/{space}
    It 'Reject Updating Space Name to Duplicate Existing Space Name' {
      $update = @(
        @{
          op = 'replace'
          path = '/name'
          value = 'ToolsSpace'
        }
      )

      { Update-ApiResource '/spaces/TestSpaceA' $update } | Should -Throw

      $spaces, $spacesStatus = Get-ApiResource '/spaces'

      $spacesStatus | Should -Be 200

      $spaces.Name | Should -Contain 'TestSpaceA'
      $spaces.Name | Should -Contain 'ToolsSpace'
    }

    # POST /api/spaces/{space}/blocks
    It 'Create Tools Block' {
      $toolsBlock = @{
        name = 'ToolsBlock'
        cidr = '198.51.100.0/24'
      }

      New-ApiResource '/spaces/ToolsSpace/blocks' $toolsBlock

      $blocks, $blocksStatus = Get-ApiResource '/spaces/ToolsSpace/blocks'

      $blocksStatus | Should -Be 200
      $blocks.Count | Should -Be 1

      $blocks.Name | Should -Be 'ToolsBlock'
      $blocks.Cidr | Should -Be '198.51.100.0/24'
    }

    # POST /api/tools/nextAvailableVnet
    It 'Check Next Available vNET in Tools Block' {
      $body = @{
        space = 'ToolsSpace'
        blocks = @('ToolsBlock')
        size = 24
      }

      $newNet, $newNetStatus = New-ApiResource '/tools/nextAvailableVNet' $body

      $newNetStatus | Should -Be 201

      $newNet.Space | Should -Be 'ToolsSpace'
      $newNet.Block | Should -Be 'ToolsBlock'
      $newNet.Cidr | Should -Be '198.51.100.0/24'
    }

    # POST /api/spaces/{space}/blocks/{block}/networks
    It 'Add a Virtual Network to Tools Block' -Tag @('LongRunning') {
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

      $blockStatus | Should -Be 200

      ($block.vnets | Select-Object -ExpandProperty id) | Should -Contain $script:toolsNet.Id
    }

    # POST /api/tools/nextAvailableSubnet
    It 'Check Next Available Subnet in Tools vNET' {
      $body = @{
        vnet_id = $script:toolsNet.Id
        size = 26
      }

      $newSubnet, $newSubnetStatus = New-ApiResource '/tools/nextAvailableSubnet' $body

      $subscriptionId = ($script:toolsNet.Id | Select-String -Pattern '(?<=subscriptions/).*(?=/resourceGroups)').Matches.Value

      $newSubnetStatus | Should -Be 201

      $newSubnet.vnet_name | Should -Be $script:toolsNet.Name
      $newSubnet.resource_group | Should -Be $script:toolsNet.ResourceGroupName
      $newSubnet.subscription_id | Should -Be $subscriptionId
      $newSubnet.Cidr | Should -Be '198.51.100.0/26'
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

      $cidrCheckStatus | Should -Be 201

      $cidrCheck.name | Should -Be $script:toolsNet.Name
      $cidrCheck.id | Should -Be $script:toolsNet.Id
      $cidrCheck.resource_group | Should -Be $script:toolsNet.ResourceGroupName
      $cidrCheck.subscription_id | Should -Be $subscriptionId
      $cidrCheck.prefixes | Should -Contain '198.51.100.0/24'

      (Compare-Object $cidrCheck.containers $containers -Property {$_.space}) | Should -BeNullOrEmpty
      (Compare-Object $cidrCheck.containers $containers -Property {$_.block}) | Should -BeNullOrEmpty
    }
  }

  Context 'Status' {
    # GET /api/status
    It 'Verify Status' {

      $status, $statusCode = Get-ApiResource '/status'

      $statusCode | Should -Be 200

      $status.status | Should -Be 'OK'
      $status.stack | Should -Be 'AppContainer'
      $status.environment | Should -Be 'AZURE_PUBLIC'
    }
  }
}
