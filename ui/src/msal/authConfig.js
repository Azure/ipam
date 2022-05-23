const UI_APP_ID = process.env.REACT_APP_UI_ID || window['env'].REACT_APP_UI_ID;
const ENGINE_APP_ID = process.env.REACT_APP_ENGINE_ID || window['env'].REACT_APP_ENGINE_ID;
const TENANT_ID = process.env.REACT_APP_TENANT_ID || window['env'].REACT_APP_TENANT_ID;

export const msalConfig = {
    auth: {
        clientId: UI_APP_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    },
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest = {
    scopes: [`api://${ENGINE_APP_ID}/.default`],
    // scopes: ["https://management.azure.com/user_impersonation"],
    // extraScopesToConsent: ["User.Read", "Directory.Read.All"]
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const apiRequest = {
    scopes: [`api://${ENGINE_APP_ID}/access_as_user`],
    // scopes: ["https://management.azure.com/user_impersonation"],
    // extraScopesToConsent: ["User.Read", "Directory.Read.All"]
};

// Add the endpoints here for Microsoft Graph API services you'd like to use.
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/beta/me",
    graphUsersEndpoint: "https://graph.microsoft.com/beta/users",
    graphMePhotoEndpoint: "https://graph.microsoft.com/beta/me/photo/$value",
    // graphMeEndpoint: "https://graph.microsoft.com/oidc/userinfo ",
};
