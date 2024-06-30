# Bicep only deployments

The Entra Id app registrations and Azure infrastructure is bundled into seperate `main.bicep` files.
- `deploy/identity/main.bicep`
- `deploy/main.bicep` (move infra bicep to its own subfolder?)


## Configuration
All configuration should be done in `.bicepparam`-files.

## Challenges
The Entra Id app registration deployment has circular dependencies (both depend on values from the other for a complete setup):
- Engine app should include uiAppId as knownClientApplications.
- UI app should include engineAppId in requiredResourceAccess.

The redirectUri for the UI app might not be known until after the infrastructure is deployed.

## Solution
The Entra Id app registration deployment is done twice.
- The initial deployment happens without any value for the params `uiAppId` & `engineAppId`, and a placeholder value for `uiAppRedirectUris`.
- Successive deployments include the params `uiAppId` & `engineAppId`, and `uiAppRedirectUris` can be change at any point.

## Deployment options
The `main.bicep` files can be deployed with:
1. One pipeline deploying both
2. One powershell script deploying both
3. Two different pipelines deploying one part each
4. Two different powershell scripts deploying one part each

## Example setup
1. Deploy Entra Id app registration without `uiAppId` & `engineAppId`, and a placeholder value for `uiAppRedirectUris`.
2. Deploy the Azure infrastructure.
3. Deploy Entra Id app registration with the now known values for `uiAppId`, `engineAppId`, `uiAppRedirectUris`.

The `deploy` directory includes the following example scripts: `deploy-identity.ps1`, `deploy-infrastructure.ps1` and  `deploy-all.ps1`.
