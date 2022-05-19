const TENANT_ID = process.env.REACT_APP_TENANT_ID || window['env'].REACT_APP_TENANT_ID;

export const msalConfig = {
    auth: {
        // clientId: "ee622b4f-81b4-4b2e-8da2-3552b2e0a616",
        // clientId: "d468ab59-4216-4e83-84c7-76803cca55a2",
        // clientId: "91067a4d-14ca-48e5-99cc-001fe07f3a94",
        clientId: process.env.REACT_APP_CLIENT_ID || window['env'].REACT_APP_CLIENT_ID,
        // authority: "https://login.microsoftonline.com/organizations", // This is a URL (e.g. https://login.microsoftonline.com/{your tenant ID})
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
    // scopes: ["api://91067a4d-14ca-48e5-99cc-001fe07f3a94/.default"],
    scopes: ["https://management.azure.com/user_impersonation"],
    extraScopesToConsent: ["User.Read", "Directory.Read.All"],
    // scopes: ["User.Read"],
    // extraScopesToConsent: ["api://ad9e3e8b-fbfd-4916-b9a9-eee3b3e94930/access_as_user"],
};

// Add the endpoints here for Microsoft Graph API services you'd like to use.
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/beta/me",
    graphUsersEndpoint: "https://graph.microsoft.com/beta/users",
    graphMePhotoEndpoint: "https://graph.microsoft.com/beta/me/photo/$value",
    // graphMeEndpoint: "https://graph.microsoft.com/oidc/userinfo ",
};
