export const UI_APP_ID = process.env.REACT_APP_UI_ID || window['env'].REACT_APP_UI_ID;
export const ENGINE_APP_ID = process.env.REACT_APP_ENGINE_ID || window['env'].REACT_APP_ENGINE_ID;
export const TENANT_ID = process.env.REACT_APP_TENANT_ID || window['env'].REACT_APP_TENANT_ID;

export const getEngineURL = () => {
  try {
    const engineURL = new URL(process.env.REACT_APP_IPAM_ENGINE_URL || window['env'].REACT_APP_IPAM_ENGINE_URL);

    return engineURL.origin;
  } catch {
    return window.location.origin;
  }
}
