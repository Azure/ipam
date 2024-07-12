# Bicep bootstrapping

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
The Entra Id app registration deployment is executed twice.
1. The 1st identity deployment happens without any value for the params `uiAppId` and `engineAppId`, and a placeholder value for `uiAppRedirectUris`.
2. The 1st infrastructure deployment happens with the params `uiAppId` and `engineAppId` filled with values from the 1st identity deployment.
3. The 2nd identity deployment include the params `uiAppId`, `engineAppId` and `uiAppRedirectUris`.
4. Build to any private ACR.
5. Archive and publish .zip.


The `deploy` directory includes the following example script `deploy-all.ps1`.
