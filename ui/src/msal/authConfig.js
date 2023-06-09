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

const reqScope = process.env.REACT_APP_USER_READBASIC_PERMISSION === "true" ? "User.ReadBasic.All" : "Directory.Read.All"

export const loginRequest = {
  scopes: [`api://${ENGINE_APP_ID}/access_as_user`],
  extraScopesToConsent: ["openid", "profile", "offline_access", "User.Read", reqScope]
};

export const apiRequest = {
  scopes: [`api://${ENGINE_APP_ID}/access_as_user`],
};

export const graphConfig = {
  graphMeEndpoint: `https://${MS_GRAPH}/beta/me`,
  graphUsersEndpoint: `https://${MS_GRAPH}/beta/users`,
  graphMePhotoEndpoint: `https://${MS_GRAPH}/beta/me/photo/$value`
};
