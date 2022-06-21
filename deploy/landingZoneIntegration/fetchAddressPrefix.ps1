$accessToken = ConvertTo-SecureString (Get-AzAccessToken -ResourceUrl $Env:IPAM_API_SCOPE).Token -AsPlainText

$body = @{
    'size' = $Env:CIDR_SIZE
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
