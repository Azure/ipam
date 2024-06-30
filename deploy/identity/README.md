# Identity (App Registrations)

## Challenges
The redirectUri for the UI app might not be known until after the infrastructure is deployed.

The deployment has circular dependency:
- Engine app should include uiAppId as knownClientApplications.
- UI app should include engineAppId in requiredResourceAccess.



## Solution
The deployment is done in two stages.
- The initial deployment happens without any value for the params `uiAppId` & `engineAppId`, and a placeholder value for `uiAppRedirectUris`.
- Successive deployments include the params `uiAppId` & `engineAppId`, and `uiAppRedirectUris` can be change at any point.