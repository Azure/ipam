import {
  ENGINE_APP_ID,
  UI_APP_ID,
  TENANT_ID
} from "../global/globals";

import {
  AZURE_AD,
  MS_GRAPH
} from "../global/azureClouds";

export const msalConfig = {
  auth: {
    clientId: UI_APP_ID,
    authority: `https://${AZURE_AD}/${TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

export const loginRequest = {
  scopes: [`api://${ENGINE_APP_ID}/access_as_user`],
  extraScopesToConsent: ["openid", "profile", "offline_access", "User.Read", "Directory.Read.All"]
};

export const apiRequest = {
  scopes: [`api://${ENGINE_APP_ID}/access_as_user`],
};

export const graphConfig = {
  graphMeEndpoint: `https://${MS_GRAPH}/v1.0/me`,
  graphUsersEndpoint: `https://${MS_GRAPH}/v1.0/users`,
  graphPrincipalsEndpoint: `https://${MS_GRAPH}/v1.0/servicePrincipals`,
  graphMePhotoEndpoint: `https://${MS_GRAPH}/v1.0/me/photo/$value`
};
