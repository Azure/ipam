// Public-safe environment details for the About dialog, Copy diagnostics, and
// the GitHub bug report form. Issues are public, so never add tenant/app IDs,
// user details, or hostnames here.

const ISSUE_URL = "https://github.com/Azure/ipam/issues/new";
const ISSUE_TEMPLATE = "bug_report.yml";

const NATIVE = "N/A (native)";

// Friendly names for the engine's DEPLOYMENT_STACK values.
const STACK_LABELS = {
  AppContainer: "App Service (Container)",
  AppNative: "App Service (Native)",
  FunctionContainer: "Function App (Container)",
  FunctionNative: "Function App (Native)",
  LegacyCompose: "App Service (Docker Compose)",
  ContainerApp: "Container Apps",
  Kubernetes: "Kubernetes",
  Docker: "Docker",
};

const CLOUD_LABELS = {
  AZURE_PUBLIC: "Azure Public",
  AZURE_US_GOV: "Azure US Government",
  AZURE_US_GOV_SECRET: "Azure US Government Secret",
  AZURE_GERMANY: "Azure Germany",
  AZURE_CHINA: "Azure China",
};

// Keyed by the os-release ID reported in /api/status.
const CONTAINER_VARIANTS = {
  debian: "Debian",
  rhel: "RHEL",
};

// Order matters: Edge's user agent also contains "Chrome" and "Safari", and
// Chrome's also contains "Safari".
const BROWSERS = [
  { name: "Microsoft Edge", pattern: /Edg(?:e|A|iOS)?\/(\d+)/ },
  { name: "Firefox", pattern: /(?:Firefox|FxiOS)\/(\d+)/ },
  { name: "Chrome", pattern: /(?:Chrome|CriOS)\/(\d+)/ },
  { name: "Safari", pattern: /Version\/(\d+).*Safari\// },
];

export const getStackLabel = (stack) => STACK_LABELS[stack] ?? stack ?? null;

export const getCloudLabel = (environment) => CLOUD_LABELS[environment] ?? environment ?? null;

function getContainerVariant(imageId) {
  return CONTAINER_VARIANTS[imageId?.toLowerCase()] ?? imageId ?? null;
}

function getBrowser() {
  const userAgent = window.navigator.userAgent;

  for (const browser of BROWSERS) {
    const match = userAgent.match(browser.pattern);

    if (match) {
      return `${browser.name} ${match[1]}`;
    }
  }

  return null;
}

// Ordered environment details. Ids match the bug report form's field ids, which
// released UIs depend on for prefilling, so don't rename them. A null value
// means it couldn't be determined.
export function getDiagnostics(status) {
  const container = status?.container;
  const isNative = Boolean(status) && !container;

  const containerValue = (resolve) => {
    if (container) {
      return resolve(container);
    }

    return isNative ? NATIVE : null;
  };

  return [
    { id: "version", label: "Azure IPAM Version", value: status?.version ?? null },
    { id: "deployment-type", label: "Deployment Type", value: status ? getStackLabel(status.stack) : null },
    { id: "container-variant", label: "Container Variant", value: containerValue((c) => getContainerVariant(c.image_id)) },
    { id: "base-image", label: "Base Image", value: containerValue((c) => c.image_pretty_name ?? null) },
    { id: "cloud", label: "Azure Cloud", value: status ? getCloudLabel(status.environment) : null },
    { id: "browser", label: "Browser", value: getBrowser() },
  ];
}

export function formatDiagnostics(diagnostics) {
  const lines = diagnostics.map((item) => `- ${item.label}: ${item.value ?? "Unavailable"}`);

  return ["**Environment:**", "", ...lines].join("\n");
}

export function buildIssueUrl(diagnostics) {
  // encodeURIComponent (%20) rather than URLSearchParams ("+"), matching the
  // spacing GitHub was verified to prefill correctly.
  const query = [["template", ISSUE_TEMPLATE], ...diagnostics.filter((item) => item.value).map((item) => [item.id, item.value])]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `${ISSUE_URL}?${query}`;
}
