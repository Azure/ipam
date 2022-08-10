const UI_APP_ID = process.env.REACT_APP_UI_ID || window['env'].REACT_APP_UI_ID;
const ENGINE_APP_ID = process.env.REACT_APP_ENGINE_ID || window['env'].REACT_APP_ENGINE_ID;
const TENANT_ID = process.env.REACT_APP_TENANT_ID || window['env'].REACT_APP_TENANT_ID;
const AZURE_ENV = process.env.REACT_APP_AZURE_ENV || window['env'].REACT_APP_AZURE_ENV;

const AZURE_ENV_MAP = {
  AZURE_PUBLIC: {
    AZURE_AD: "login.microsoftonline.com",
    AZURE_ARM: "management.azure.com",
    MS_GRAPH: "graph.microsoft.com"
  },
  AZURE_US_GOV: {
    AZURE_AD: "login.microsoftonline.us",
    AZURE_ARM: "management.usgovcloudapi.net",
    MS_GRAPH: "graph.microsoft.us"
  },
  AZURE_GERMANY: {
    AZURE_AD: "login.microsoftonline.de",
    AZURE_ARM: "management.microsoftazure.de",
    MS_GRAPH: "graph.microsoft.de"
  },
  AZURE_CHINA: {
    AZURE_AD: "login.chinacloudapi.cn",
    AZURE_ARM: "management.chinacloudapi.cn",
    MS_GRAPH: "microsoftgraph.chinacloudapi.cn"
  }
};

const AUTH = AZURE_ENV_MAP[AZURE_ENV] ?? AZURE_ENV_MAP['AZURE_PUBLIC'];

export const msalConfig = {
    auth: {
        clientId: UI_APP_ID,
        authority: `https://${AUTH.AZURE_AD}/${TENANT_ID}`,
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
    graphMeEndpoint: `https://${AUTH.MS_GRAPH}/beta/me`,
    graphUsersEndpoint: `https://${AUTH.MS_GRAPH}/beta/users`,
    graphMePhotoEndpoint: `https://${AUTH.MS_GRAPH}/beta/me/photo/$value`,
    // graphMeEndpoint: `https://${AUTH.MS_GRAPH}/oidc/userinfo`,
};
