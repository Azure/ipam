//eslint-disable-next-line
export const SPACE_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9\._-]){1,64}(?<![\._-])$";
//eslint-disable-next-line
export const SPACE_DESC_REGEX = "^(?![ /\._-])([a-zA-Z0-9 /\._-]){1,128}(?<![ /\._-])$";

//eslint-disable-next-line
export const BLOCK_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9/\._-]){1,64}(?<![\._-])$";

//eslint-disable-next-line
export const EXTERNAL_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9\._-]){1,32}(?<![\._-])$";
//eslint-disable-next-line
export const EXTERNAL_DESC_REGEX = "^(?![ /\._-])([a-zA-Z0-9 /\._-]){1,64}(?<![ /\._-])$";

export const CIDR_REGEX = "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(/(3[0-2]|[1-2][0-9]|[0-9]))$";

export const UI_APP_ID = import.meta.env.VITE_UI_ID || window['env'].VITE_UI_ID;
export const ENGINE_APP_ID = import.meta.env.VITE_ENGINE_ID || window['env'].VITE_ENGINE_ID;
export const TENANT_ID = import.meta.env.VITE_TENANT_ID || window['env'].VITE_TENANT_ID;

export const getEngineURL = () => {
  try {
    const engineURL = new URL(import.meta.env.VITE_IPAM_ENGINE_URL || window['env'].VITE_IPAM_ENGINE_URL);

    return engineURL.origin;
  } catch {
    return window.location.origin;
  }
}
