## IPAM REST API Overview
You can interface with the full set of capabilities of IPAM via a REST API. We use Swagger to define API documentation in OpenAPI v3 Specification format.

API docs can be found at the `/api/docs` path of your IPAM website. Here you will find information on methods, parameters, and request body details for all available APIs.

![IPAM openapi specification](./images/openapispec.png)

## How to Call the API
You can interface with the API like you would any other REST API. We'll be using [Postman](https://www.postman.com) and [Azure PowerShell](https://docs.microsoft.com/en-us/powershell/azure/what-is-azure-powershell) for our examples. 

## Obtaining an Azure AD Token
First things first, you'll need to obtain an Azure AD token for authentication purposes. You can retrieve one via the IPAM UI at anytime by selecting **Token** from the menu presented when clicking on your user avatar in the upper righthand corner.

![IPAM azure ad token](./images/token.png)

You'll then be presented with a message notifying you that your token has been saved to your clipboard.

![IPAM azure ad token clipboard](./images/token_clipboard.png)

You can also retrieve an Azure AD token from IPAM via Azure PowerShell by using the [Get-AzAccessToken](https://docs.microsoft.com/en-us/powershell/module/az.accounts/get-azaccesstoken) commandlet. The token is retrieved from the API exposed via the backend engine application registration. This is the **ResourceUrl** you will be making the access token call against via Azure PowerShell.

![IPAM api resource url](./images/ipam_api_resource_url.png)

```ps1
$accessToken = ConvertTo-SecureString (Get-AzAccessToken -ResourceUrl api://e3ff2k34-2271-58b5-9g2g-5004145608b3).Token -AsPlainText
````

## Sample API Calls
You'll need to provide the following for each API call:
* a bearer token
* the method
*  the request URL
* any headers you'd like to pass
* the body of the request

Here is an example of how to create an IP address CIDR reservation in order to create a new VNET. We'll be performing a POST to the following request URL:
````
https://ipmadev.azurewebsites.net/api/spaces/TestSpace/blocks/TestBlock/reservations
````
The body contains a bit mask size of **/24**. Based on this, IPAM will provide the next available **/24** CIDR block available in the **TestBlock** found within our **TestSpace** (as denoted in our request URL).

![Postman CIDR reservation](./images/postman_body.png)

Be sure to provide the appropriate headers under the **Headers** tab.

![Postman CIDR reservation headers](./images/postman_headers.png)

Lastly, don't forget to provide your token information under the **Authorization** tab.

![Postman CIDR reservation authorization](./images/postman_authorization.png)

Click **Send** and you will recieve a response of type **201 Created** with key information regarding your CIDR block reservation request. Make note of the tag that is returned in the response. Tagging your newly created VNET with this key:value will automatically associate it with the **Block** the reservation was created from. 

![Postman CIDR reservation response](./images/postman_response.png)

Here is the same example performed via Azure PowerShell.

````ps1
$engineClientId = '<Engine App Registration Client ID>'
$appName = 'ipamdev'
$space = 'TestSpace'
$block = 'TestBlock'

$accessToken = ConvertTo-SecureString (Get-AzAccessToken -ResourceUrl api://$engineClientId).Token -AsPlainText

$requestUrl = "https://$appName.azurewebsites.net/api/spaces/$space/blocks/$block/reservations"

$body = @{
    'size' = 24
} | ConvertTo-Json

$headers = @{
  'Accept' = 'application/json'
  'Content-Type' = 'application/json'
}

$response = Invoke-RestMethod `
 -Method 'Post' `
 -Uri $requestUrl `
 -Authentication 'Bearer' `
 -Token $accessToken `
 -Headers $headers `
 -Body $body
````

The call will return key information regarding your CIDR block reservation. Again, make note of the *tag* information in the response.

````ps1
$response

id        : ABNsJjXXyTRDTRCdJEJThu
cidr      : 10.1.5.0/24
userId    : harvey@mytenant.onmicrosoft.com
createdOn : 1662514052.26623
status    : wait
tag       : @{X-IPAM-RES-ID=ABNsJjXXyTRDTRCdJEJThu}
````

Here is an example using the Azure CLI and cURL:

````bash
engineClientId="<Engine App Registration Client ID>"
appName="ipamdev"
space="TestSpace"
block="TestBlock"

accessToken=$(az account get-access-token --resource api://$engineClientId --query "accessToken" --output tsv)

requestUrl="https://$appName.azurewebsites.net/api/spaces/$space/blocks/$block/reservations"

data='{"size": 24}'

curl --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --header "Authorization: Bearer $accessToken" \
  --data "${data}" \
  $requestUrl
````
T
he call will return key information regarding your CIDR block reservation. Again, make note of the *tag* information in the response.

````bash

{"id":"Pex8bNxihMs59Ts34xC52Q","space":"TestSpace","block":"TestBlock","cidr":"10.1.1.0/24","desc":null,"createdOn":1685043641.5849886,"createdBy":"harvey@mytenant.onmicrosoft.com","settledOn":null,"settledBy":null,"status":"wait","tag":{"X-IPAM-RES-ID":"Pex8bNxihMs59Ts34xC52Q"}}

````
Take a look at our **Azure Landing Zone integration** example found under the `deploy` directory in the repository for a real work example of how to automate vNET creation by means of Bicep and leveraging the IPAM API.
