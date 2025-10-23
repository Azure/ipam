$accessToken = (Get-AzAccessToken -ResourceUrl $Env:IPAM_API_SCOPE).Token

if ($accessToken -isnot [System.Security.SecureString]) {
  $accessToken = ConvertTo-SecureString $accessToken -AsPlainText -Force
}

$body = @{
    'size' = 16
} | ConvertTo-Json

$headers = @{
  'Accept' = 'application/json'
  'Content-Type' = 'application/json'
}

$response = Invoke-RestMethod `
 -Method 'Post' `
 -Uri $Env:IPAM_URL `
 -Authentication 'Bearer' `
 -Token $accessToken `
 -Headers $headers `
 -Body $body

return $response.cidr
return $response.id
