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

  # The suite deliberately waits on ARG propagation, so a run can outlive a single access token.
  # Tokens are cached and re-acquired on expiry rather than fetched once up front.
  $script:apiToken = $null
  $script:apiTokenExpiresOn = [DateTimeOffset]::MinValue

  Function Get-ApiToken {
    [CmdletBinding()]
    Param()

    if ($null -eq $script:apiToken -or [DateTimeOffset]::UtcNow -ge $script:apiTokenExpiresOn.AddMinutes(-5)) {
      $result = Get-AzAccessToken -ResourceUrl api://$env:IPAM_ENGINE_APP_ID
      $token = $result.Token

      $script:apiToken = if ($token -is [System.Security.SecureString]) { $token } else { ConvertTo-SecureString $token -AsPlainText }

      # ExpiresOn moved between Az.Accounts versions, so fall back to a conservative window.
      $expiresOn = $result.PSObject.Properties['ExpiresOn']

      $script:apiTokenExpiresOn = if ($expiresOn -and $expiresOn.Value) {
        [DateTimeOffset]$expiresOn.Value
      } else {
        [DateTimeOffset]::UtcNow.AddMinutes(30)
      }
    }

    return $script:apiToken
  }

  # Acquire once here so a broken sign-in fails the suite up front rather than mid-run.
  $null = Get-ApiToken

  [hashtable]$headers = @{
    "Content-Type" = "application/json"
  }

  # Transient failures worth a retry: Resource Graph throttling surfaced by the engine, plus upstream
  # faults. Client errors (400/403/404/409/422) are deliberately excluded because this suite asserts
  # them, and retrying would both mask regressions and slow every negative test.
  [int[]]$transientStatusCodes = @(429, 500, 502, 503, 504)
  [int]$maxApiAttempts = 3
  [int]$maxRetryDelaySeconds = 10

  # Shared request pipeline for the API helpers below.
  Function Invoke-ApiRequest {
    [CmdletBinding()]
    Param(
      [Parameter(Mandatory=$True)]
      [string]$method,

      [Parameter(Mandatory=$True)]
      [string]$resource,

      [Parameter(Mandatory=$False)]
      $body
    )

    $attempt = 0

    while ($true) {
      $attempt++

      $request = @{
        Method = $method
        Authentication = 'Bearer'
        Token = Get-ApiToken
        Uri = "${baseUrl}${resource}"
        Headers = $headers
        Body = $body
        StatusCodeVariable = 'status'
      }

      try {
        $response = Invoke-RestMethod @request

        Write-Output $response, $status

        return
      }
      catch {
        # Only a definitive HTTP response proves the request had no effect. A transport failure could
        # mean a POST already applied server-side, so those are surfaced rather than replayed.
        $failedResponse = $_.Exception.PSObject.Properties['Response']
        $statusCode = if ($failedResponse -and $failedResponse.Value) { [int]$failedResponse.Value.StatusCode } else { 0 }

        if ($attempt -ge $maxApiAttempts -or $statusCode -notin $transientStatusCodes) {
          throw
        }

        $delay = [Math]::Pow(2, $attempt - 1)

        # The engine sends Retry-After on a 429, so wait exactly as long as it asked.
        $retryAfterHeader = $failedResponse.Value.Headers | Where-Object { $_.Key -eq 'Retry-After' } | Select-Object -First 1

        if ($retryAfterHeader) {
          $retryAfter = ($retryAfterHeader.Value | Select-Object -First 1) -as [int]

          if ($retryAfter -gt 0) {
            $delay = $retryAfter
          }
        }

        $delay = [Math]::Min($delay, $maxRetryDelaySeconds)

        Write-Warning "Transient HTTP $statusCode from $method $resource; retrying in ${delay}s (attempt $attempt of $maxApiAttempts)."

        Start-Sleep -Seconds $delay
      }
    }
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

    Invoke-ApiRequest -method Get -resource $resource -body $query
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

    Invoke-ApiRequest -method Post -resource $resource -body $jsonBody
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

    $jsonBody = $body | ConvertTo-Json -AsArray

    Invoke-ApiRequest -method Put -resource $resource -body $jsonBody
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

    $jsonBody = $body | ConvertTo-Json -AsArray

    Invoke-ApiRequest -method Patch -resource $resource -body $jsonBody
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

    Invoke-ApiRequest -method Delete -resource $resource -body $jsonBody
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
        -AddressPrefix @('10.1.4.0/24', '10.1.0.0/24')

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

  Context 'Utilization & Expansion' -Tag @('AzureLive') {
    BeforeAll {
      # Address count for a CIDR, used to check the engine's utilization math independently.
      Function Get-CidrSize {
        Param(
          [Parameter(Mandatory=$True)]
          [string]$cidr
        )

        $mask = [int]($cidr -split '/')[1]

        return [int64][Math]::Pow(2, 32 - $mask)
      }
    }

    # GET /api/spaces/{space}?utilization=true
    It 'Get Space Utilization When a Block Contains External Networks' {
      # Regression: this accumulated external address space onto the space *path parameter* rather
      # than the space document, so it returned 500 for any space holding an external network.
      $space, $spaceStatus = Get-ApiResource '/spaces/TestSpaceA?utilization=true'

      $spaceStatus | Should -Be 200

      $space.size | Should -BeGreaterThan 0
      $space.used | Should -BeGreaterThan 0
    }

    # GET /api/spaces?utilization=true
    It 'Get All Spaces with Utilization' {
      $spaces, $spacesStatus = Get-ApiResource '/spaces?utilization=true'

      $spacesStatus | Should -Be 200

      $targetSpace = $spaces | Where-Object { $_.name -eq 'TestSpaceA' } | Select-Object -First 1

      $targetSpace | Should -Not -BeNullOrEmpty
      $targetSpace.size | Should -BeGreaterThan 0
    }

    # GET /api/spaces/{space}/blocks?utilization=true
    It 'Get All Blocks with Utilization' {
      $blocks, $blocksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks?utilization=true'

      $blocksStatus | Should -Be 200

      $targetBlock = $blocks | Where-Object { $_.name -eq 'TestBlockA' } | Select-Object -First 1

      $targetBlock | Should -Not -BeNullOrEmpty
      $targetBlock.size | Should -Be (Get-CidrSize $targetBlock.cidr)
    }

    # GET /api/spaces/{space}/blocks/{block}?utilization=true
    It 'Get Block with Utilization' {
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?utilization=true'

      $blockStatus | Should -Be 200

      $block.size | Should -Be (Get-CidrSize $block.cidr)
      $block.used | Should -BeGreaterThan 0
      $block.used | Should -BeLessOrEqual $block.size
    }

    # GET /api/spaces/{space}/blocks/{block}?utilization=true
    It 'Block Utilization Matches Between Reference and Expanded Responses' {
      # Utilization is answered from a lighter Resource Graph query when networks are not expanded,
      # so both paths must report identical address counts.
      $light, $lightStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?utilization=true'
      $expanded, $expandedStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?expand=true&utilization=true'

      $lightStatus | Should -Be 200
      $expandedStatus | Should -Be 200

      $light.size | Should -Be $expanded.size
      $light.used | Should -Be $expanded.used
    }

    # GET /api/spaces/{space}?utilization=true
    It 'Space Utilization Matches Between Reference and Expanded Responses' {
      $light, $lightStatus = Get-ApiResource '/spaces/TestSpaceA?utilization=true'
      $expanded, $expandedStatus = Get-ApiResource '/spaces/TestSpaceA?expand=true&utilization=true'

      $lightStatus | Should -Be 200
      $expandedStatus | Should -Be 200

      $light.size | Should -Be $expanded.size
      $light.used | Should -Be $expanded.used
    }

    # GET /api/spaces/{space}/blocks/{block}?expand=true&utilization=true
    It 'Block Utilization Equals Network Plus External Address Space' {
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?expand=true&utilization=true'

      $blockStatus | Should -Be 200

      $networkUsed = [int64](@($block.vnets) | Measure-Object -Property size -Sum).Sum
      $externalUsed = [int64]0

      foreach($external in @($block.externals)) {
        $externalUsed += Get-CidrSize $external.cidr
      }

      $block.used | Should -Be ($networkUsed + $externalUsed)
    }

    # GET /api/spaces/{space}?utilization=true
    It 'Space Utilization Equals Sum of Block Utilization' {
      $space, $spaceStatus = Get-ApiResource '/spaces/TestSpaceA?utilization=true'

      $spaceStatus | Should -Be 200

      $blockSize = [int64](@($space.blocks) | Measure-Object -Property size -Sum).Sum
      $blockUsed = [int64](@($space.blocks) | Measure-Object -Property used -Sum).Sum

      $space.size | Should -Be $blockSize
      $space.used | Should -Be $blockUsed
    }

    # GET /api/spaces/{space}/blocks/{block}?expand=true
    It 'Expanded Block Returns Full Network Objects' {
      # The Union response model silently falls back to the reference shape when expansion fails
      # validation, so assert the expanded fields are actually present rather than trusting the 200.
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?expand=true'

      $blockStatus | Should -Be 200

      @($block.vnets).Count | Should -BeGreaterThan 0

      foreach($vnet in @($block.vnets)) {
        $vnet.PSObject.Properties.Name | Should -Contain 'name'
        $vnet.PSObject.Properties.Name | Should -Contain 'prefixes'
        $vnet.PSObject.Properties.Name | Should -Contain 'subnets'
      }
    }

    # GET /api/spaces/{space}/blocks/{block}/networks?expand=true
    It 'Expanded Block Networks Return Full Network Objects' {
      $networks, $networksStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks?expand=true'

      $networksStatus | Should -Be 200

      @($networks).Count | Should -BeGreaterThan 0

      foreach($network in @($networks)) {
        $network.PSObject.Properties.Name | Should -Contain 'name'
        $network.PSObject.Properties.Name | Should -Contain 'prefixes'
      }
    }

    # GET /api/spaces/{space}/blocks/{block}?expand=true&utilization=true
    It 'Expanded Network Utilization Never Exceeds Its Size' {
      # Regression: size counted only the prefixes inside the Block while used counted the subnets of
      # every prefix the network owns, so a network straddling the Block boundary reported used > size.
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?expand=true&utilization=true'

      $blockStatus | Should -Be 200

      @($block.vnets).Count | Should -BeGreaterThan 0

      foreach($vnet in @($block.vnets)) {
        $vnet.PSObject.Properties.Name | Should -Contain 'size'
        $vnet.PSObject.Properties.Name | Should -Contain 'used'

        $vnet.used | Should -BeLessOrEqual $vnet.size
      }
    }

    # GET /api/spaces/{space}/blocks/{block}?utilization=true
    It 'External Networks Report Address Utilization' {
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?utilization=true'

      $blockStatus | Should -Be 200

      @($block.externals).Count | Should -BeGreaterThan 0

      foreach($external in @($block.externals)) {
        $external.PSObject.Properties.Name | Should -Contain 'size'
        $external.PSObject.Properties.Name | Should -Contain 'used'

        $external.size | Should -Be (Get-CidrSize $external.cidr)

        # An external network's used is the address space assigned to its subnets.
        $subnetSize = [int64]0

        foreach($subnet in @($external.subnets)) {
          $subnetSize += Get-CidrSize $subnet.cidr
        }

        $external.used | Should -Be $subnetSize
        $external.used | Should -BeLessOrEqual $external.size
      }
    }

    # GET /api/spaces/{space}/blocks/{block}?utilization=true
    It 'External Subnets Report Endpoints as Used Addresses' {
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?utilization=true'

      $blockStatus | Should -Be 200

      $subnets = @(@($block.externals) | ForEach-Object { $_.subnets })

      @($subnets).Count | Should -BeGreaterThan 0

      foreach($subnet in $subnets) {
        $subnet.PSObject.Properties.Name | Should -Contain 'size'
        $subnet.PSObject.Properties.Name | Should -Contain 'used'

        $subnet.size | Should -Be (Get-CidrSize $subnet.cidr)

        # External networks are not Azure, so no addresses are reserved by the platform.
        $subnet.used | Should -Be @($subnet.endpoints).Count
        $subnet.used | Should -BeLessOrEqual $subnet.size
      }
    }

    # GET /api/spaces/{space}/blocks/{block}?utilization=true
    It 'Block Utilization Counts an External Network Once, Not Its Subnets Again' {
      # An external network's subnets sit inside its own range, so counting both would double count.
      $block, $blockStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?utilization=true'

      $blockStatus | Should -Be 200

      $externalSubnetSize = [int64](@(@($block.externals) | ForEach-Object { $_.subnets } | Where-Object { $_ }) | Measure-Object -Property size -Sum).Sum

      # Guards against this passing vacuously if the external subnet fixture ever disappears.
      $externalSubnetSize | Should -BeGreaterThan 0

      $externalSize = [int64]0

      foreach($external in @($block.externals)) {
        $externalSize += Get-CidrSize $external.cidr
      }

      $networkSize, $networkStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA?expand=true&utilization=true'

      $networkStatus | Should -Be 200

      $networkUsed = [int64](@($networkSize.vnets) | Measure-Object -Property size -Sum).Sum

      $block.used | Should -Be ($networkUsed + $externalSize)
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

    # POST /api/spaces/{space}/blocks/{block}/reservations
    It 'Reject Block Reservation When Smallest CIDR Search Finds No Candidate' {
      # Requesting a network larger than the Block itself leaves the smallest CIDR
      # search with no candidates, which must surface as a descriptive error.
      $body = @{
        size = 8
        smallest_cidr = $true
        desc = 'Oversized Reservation'
      }

      $caught = $null

      try {
        New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/reservations' $body
      }
      catch {
        $caught = $_
      }

      $caught | Should -Not -BeNullOrEmpty
      $caught.ErrorDetails.Message | Should -BeLike '*unavailable in target block*'

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

    # GET /api/spaces/{space}/blocks/{block}/available
    It 'Exclude vNET Whose Prefix Overlaps Unfulfilled Reservation' -Tag @('LongRunning') {
      $script:newNetAvailResv = New-AzVirtualNetwork `
        -Name 'TestVNetAvailResv' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix $script:reservationC.Cidr

      Start-Sleep -Seconds 60

      $available, $availableStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/available'

      $availableStatus | Should -Be 200

      $available | Should -Not -Contain $script:newNetAvailResv.Id
    }

    # GET /api/spaces/{space}/blocks/{block}/available
    It 'Exclude vNET Already Associated Within Same Space via CIDR Containment' -Tag @('LongRunning') {
      # newNetA (10.1.0.0/24) is already associated with TestBlockA and its prefix
      # falls under TestBlockA (10.1.0.0/16). It should not appear as available for
      # TestBlockOverlap (100.65.0.0/24) either, since the prefix doesn't fit that block.
      $available, $availableStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockOverlap/available'

      $availableStatus | Should -Be 200

      $available | Should -Not -Contain $script:newNetA.Id
    }

    # GET /api/spaces/{space}/blocks/{block}/available
    It 'Allow Multi-Prefix vNET Across Blocks in Same Space' -Tag @('LongRunning') {
      # Create a second block with a non-overlapping CIDR in the same space
      $blockMultiPrefix = @{
        name = 'TestBlockMultiPfx'
        cidr = '172.16.0.0/16'
      }

      New-ApiResource '/spaces/TestSpaceA/blocks' $blockMultiPrefix

      # Create a vNET with two prefixes: one in TestBlockA, one in TestBlockMultiPfx
      $script:newNetMultiPfx = New-AzVirtualNetwork `
        -Name 'TestVNetMultiPfx' `
        -ResourceGroupName $env:IPAM_RESOURCE_GROUP `
        -Location 'westus3' `
        -AddressPrefix @('10.1.201.0/24', '172.16.1.0/24')

      Start-Sleep -Seconds 60

      # Associate the vNET with TestBlockA
      $body = @{
        id = $script:newNetMultiPfx.Id
      }

      New-ApiResource '/spaces/TestSpaceA/blocks/TestBlockA/networks' $body

      # It should still appear as available for TestBlockMultiPfx (different prefix fits there)
      $available, $availableStatus = Get-ApiResource '/spaces/TestSpaceA/blocks/TestBlockMultiPfx/available'

      $availableStatus | Should -Be 200

      $available | Should -Contain $script:newNetMultiPfx.Id
    }

    # GET /api/spaces/{space}/blocks/{block}/available
    It 'Allow Cross-Space vNET Association' -Tag @('LongRunning') {
      # Create a second space with a block whose CIDR overlaps TestBlockA
      $spaceB = @{
        name = 'TestSpaceB'
        desc = 'Test Space B'
      }

      New-ApiResource '/spaces' $spaceB

      $blockB = @{
        name = 'TestBlockB'
        cidr = '10.1.0.0/16'
      }

      New-ApiResource '/spaces/TestSpaceB/blocks' $blockB

      # newNetA (10.1.0.0/24) is already associated with TestSpaceA/TestBlockA.
      # It should still appear as available for TestSpaceB/TestBlockB since
      # Spaces are independent logical boundaries.
      $available, $availableStatus = Get-ApiResource '/spaces/TestSpaceB/blocks/TestBlockB/available'

      $availableStatus | Should -Be 200

      $available | Should -Contain $script:newNetA.Id
    }

    # Create an Azure Virtual Network w/ Reservation ID Tag and Verify it's Automatically Imported into IPAM
    It 'Import Virtual Network via Reservation ID' -Tag @('LongRunning') {
      $script:newNetResvC = New-AzVirtualNetwork `
        -Name 'TestVNetResv' `
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
      $spaces.Count | Should -Be 3

      $spaces.Name | Should -Contain 'TestSpaceA'
      $spaces.Name | Should -Contain 'TestSpaceB'
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

      $newNetStatus | Should -Be 200

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

      $newSubnetStatus | Should -Be 200

      $newSubnet.vnet_name | Should -Be $script:toolsNet.Name
      $newSubnet.resource_group | Should -Be $script:toolsNet.ResourceGroupName
      $newSubnet.subscription_id | Should -Be $subscriptionId
      $newSubnet.Cidr | Should -Be '198.51.100.0/26'
    }

    # POST /api/tools/nextAvailableSubnet
    It 'Reject Next Available Subnet When Smallest CIDR Search Finds No Candidate' {
      # Requesting a subnet larger than the vNET itself leaves the smallest CIDR
      # search with no candidates, which must surface as a descriptive error.
      $body = @{
        vnet_id = $script:toolsNet.Id
        size = 23
        smallest_cidr = $true
      }

      $caught = $null

      try {
        New-ApiResource '/tools/nextAvailableSubnet' $body
      }
      catch {
        $caught = $_
      }

      $caught | Should -Not -BeNullOrEmpty
      $caught.ErrorDetails.Message | Should -BeLike '*unavailable in target virtual network*'
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

      $cidrCheckStatus | Should -Be 200

      $cidrCheck.name | Should -Be $script:toolsNet.Name
      $cidrCheck.id | Should -Be $script:toolsNet.Id
      $cidrCheck.resource_group | Should -Be $script:toolsNet.ResourceGroupName
      $cidrCheck.subscription_id | Should -Be $subscriptionId
      $cidrCheck.prefixes | Should -Contain '198.51.100.0/24'

      (Compare-Object $cidrCheck.containers $containers -Property {$_.space}) | Should -BeNullOrEmpty
      (Compare-Object $cidrCheck.containers $containers -Property {$_.block}) | Should -BeNullOrEmpty
    }

    # POST /api/spaces/{space}/blocks
    It 'Create Tools Fallback Blocks' {
      # 'ToolsBlockSmall' is intentionally too small to satisfy a /25 request so
      # that block list evaluation must fall through to 'ToolsBlockLarge'.
      $smallBlock = @{
        name = 'ToolsBlockSmall'
        cidr = '203.0.113.0/26'
      }

      $largeBlock = @{
        name = 'ToolsBlockLarge'
        cidr = '203.0.113.128/25'
      }

      New-ApiResource '/spaces/ToolsSpace/blocks' $smallBlock
      New-ApiResource '/spaces/ToolsSpace/blocks' $largeBlock

      $blocks, $blocksStatus = Get-ApiResource '/spaces/ToolsSpace/blocks'

      $blocksStatus | Should -Be 200
      $blocks.Count | Should -Be 3

      $blocks.Name | Should -Contain 'ToolsBlockSmall'
      $blocks.Name | Should -Contain 'ToolsBlockLarge'
    }

    # POST /api/tools/nextAvailableVNet
    It 'Skip Blocks That Cannot Satisfy Requested Size with Smallest CIDR Search' {
      $body = @{
        space = 'ToolsSpace'
        blocks = @('ToolsBlockSmall', 'ToolsBlockLarge')
        size = 25
        reverse_search = $false
        smallest_cidr = $true
      }

      $newNet, $newNetStatus = New-ApiResource '/tools/nextAvailableVNet' $body

      $newNetStatus | Should -Be 200

      $newNet.Space | Should -Be 'ToolsSpace'
      $newNet.Block | Should -Be 'ToolsBlockLarge'
      $newNet.Cidr | Should -Be '203.0.113.128/25'
    }

    # POST /api/tools/nextAvailableVNet
    It 'Skip Blocks That Cannot Satisfy Requested Size without Smallest CIDR Search' {
      $body = @{
        space = 'ToolsSpace'
        blocks = @('ToolsBlockSmall', 'ToolsBlockLarge')
        size = 25
        reverse_search = $false
        smallest_cidr = $false
      }

      $newNet, $newNetStatus = New-ApiResource '/tools/nextAvailableVNet' $body

      $newNetStatus | Should -Be 200

      $newNet.Space | Should -Be 'ToolsSpace'
      $newNet.Block | Should -Be 'ToolsBlockLarge'
      $newNet.Cidr | Should -Be '203.0.113.128/25'
    }

    # POST /api/tools/nextAvailableVNet
    It 'Reject Next Available vNET When No Block Can Satisfy Requested Size' {
      $body = @{
        space = 'ToolsSpace'
        blocks = @('ToolsBlockSmall', 'ToolsBlockLarge')
        size = 16
        reverse_search = $false
        smallest_cidr = $true
      }

      $caught = $null

      try {
        New-ApiResource '/tools/nextAvailableVNet' $body
      }
      catch {
        $caught = $_
      }

      $caught | Should -Not -BeNullOrEmpty
      $caught.ErrorDetails.Message | Should -BeLike '*unavailable in target block*'
    }
  }

  Context 'Notifications' {
    # GET /api/notifications
    It 'Verify Notifications list' {

      $notifications, $status = Get-ApiResource '/notifications'

      $status | Should -Be 200

      # The envelope always carries a 'notifications' collection (possibly empty).
      $notifications.PSObject.Properties.Name | Should -Contain 'notifications'

      # When notifications are present, each must be well-formed and self-describing.
      foreach ($notification in $notifications.notifications) {
        $notification.id | Should -Not -BeNullOrEmpty
        $notification.title | Should -Not -BeNullOrEmpty
        $notification.message | Should -Not -BeNullOrEmpty
        $notification.category | Should -Not -BeNullOrEmpty
        $notification.severity | Should -BeIn @('critical', 'warning', 'information')
        $notification.audience | Should -BeIn @('all', 'admin')
      }
    }

    # POST /api/notifications/{id}/resolve
    It 'Returns an error resolving an unknown notification' {

      { New-ApiResource '/notifications/does-not-exist/resolve' @{} } | Should -Throw -ExpectedMessage '*404*'
    }

    # POST /api/notifications/{id}/resolve
    It 'Returns an error resolving a notification with no remediation' {

      # 'update-available' is a real, link-only notification: it never carries a
      # server-owned resolve action, so resolving it is always a 404.
      { New-ApiResource '/notifications/update-available/resolve' @{} } | Should -Throw -ExpectedMessage '*404*'
    }

    # POST /api/notifications/{id}/resolve
    It 'Returns an error resolving a remediable notification that is not active' {

      # Never active against the test deployment's private ACR, so this hits the
      # active-gate (409) instead of triggering a real remediation/restart.
      { New-ApiResource '/notifications/registry-migration/resolve' @{} } | Should -Throw -ExpectedMessage '*409*'
    }
  }

  Context 'Health' {
    # GET /api/health
    It 'Verify Health' {

      $health, $healthStatus = Get-ApiResource '/health'

      $healthStatus | Should -Be 200

      $health.ok | Should -Be $true

      $checkNames = $health.checks.PSObject.Properties.Name

      foreach ($check in @('config', 'cosmos', 'arm', 'schema')) {
        $checkNames | Should -Contain $check
        $health.checks.$check.ok | Should -Be $true
      }
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
