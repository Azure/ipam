const AZURE_ENV = import.meta.env.VITE_AZURE_ENV || window['env'].VITE_AZURE_ENV;

const AZURE_ENV_MAP = {
  AZURE_PUBLIC: {
    AZURE_AD: "login.microsoftonline.com",
    AZURE_ARM: "management.azure.com",
    AZURE_PORTAL: "portal.azure.com",
    MS_GRAPH: "graph.microsoft.com"
  },
  AZURE_US_GOV: {
    AZURE_AD: "login.microsoftonline.us",
    AZURE_ARM: "management.usgovcloudapi.net",
    AZURE_PORTAL: "portal.azure.us",
    MS_GRAPH: "graph.microsoft.us"
  },
  AZURE_US_GOV_SECRET: {
    AZURE_AD: "login.microsoftonline.microsoft.scloud",
    AZURE_ARM: "management.azure.microsoft.scloud",
    AZURE_PORTAL: "portal.azure.microsoft.scloud",
    MS_GRAPH: "graph.cloudapi.microsoft.scloud"
  },
  AZURE_GERMANY: {
    AZURE_AD: "login.microsoftonline.de",
    AZURE_ARM: "management.microsoftazure.de",
    AZURE_PORTAL: "portal.microsoftazure.de",
    MS_GRAPH: "graph.microsoft.de"
  },
  AZURE_CHINA: {
    AZURE_AD: "login.chinacloudapi.cn",
    AZURE_ARM: "management.chinacloudapi.cn",
    AZURE_PORTAL: "portal.azure.cn",
    MS_GRAPH: "microsoftgraph.chinacloudapi.cn"
  }
};

export const AZURE_AD = (AZURE_ENV_MAP[AZURE_ENV] ?? AZURE_ENV_MAP['AZURE_PUBLIC']).AZURE_AD
export const AZURE_ARM = (AZURE_ENV_MAP[AZURE_ENV] ?? AZURE_ENV_MAP['AZURE_PUBLIC']).AZURE_ARM
export const AZURE_PORTAL = (AZURE_ENV_MAP[AZURE_ENV] ?? AZURE_ENV_MAP['AZURE_PUBLIC']).AZURE_PORTAL
export const MS_GRAPH = (AZURE_ENV_MAP[AZURE_ENV] ?? AZURE_ENV_MAP['AZURE_PUBLIC']).MS_GRAPH
