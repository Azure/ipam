//eslint-disable-next-line
export const SPACE_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9\._-]){1,64}(?<![\._-])$";
//eslint-disable-next-line
export const SPACE_DESC_REGEX = "^(?![ /\._-])([a-zA-Z0-9 /\._-]){1,128}(?<![ /\._-])$";

//eslint-disable-next-line
export const BLOCK_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9\._-]){1,64}(?<![\._-])$";

//eslint-disable-next-line
export const EXTERNAL_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9\._-]){1,64}(?<![\._-])$";
//eslint-disable-next-line
export const EXTERNAL_DESC_REGEX = "^(?![ /\._-])([a-zA-Z0-9 /\._-]){1,128}(?<![ /\._-])$";

//eslint-disable-next-line
export const EXTSUBNET_NAME_REGEX = "^(?![\._-])([a-zA-Z0-9\._-]){1,64}(?<![\._-])$";
//eslint-disable-next-line
export const EXTSUBNET_DESC_REGEX = "^(?![ /\._-])([a-zA-Z0-9 /\._-]){1,128}(?<![ /\._-])$";

export const CIDR_REGEX = "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(/(3[0-2]|[1-2][0-9]|[0-9]))$";

export const UI_APP_ID = import.meta.env.VITE_UI_ID || window['env'].VITE_UI_ID;
export const ENGINE_APP_ID = import.meta.env.VITE_ENGINE_ID || window['env'].VITE_ENGINE_ID;
export const TENANT_ID = import.meta.env.VITE_TENANT_ID || window['env'].VITE_TENANT_ID;

export const cidrMasks = [
  { name: '/8', value: 8},
  { name: '/9', value: 9},
  { name: '/10', value: 10},
  { name: '/11', value: 11},
  { name: '/12', value: 12},
  { name: '/13', value: 13},
  { name: '/14', value: 14},
  { name: '/15', value: 15},
  { name: '/16', value: 16},
  { name: '/17', value: 17},
  { name: '/18', value: 18},
  { name: '/19', value: 19},
  { name: '/20', value: 20},
  { name: '/21', value: 21},
  { name: '/22', value: 22},
  { name: '/23', value: 23},
  { name: '/24', value: 24},
  { name: '/25', value: 25},
  { name: '/26', value: 26},
  { name: '/27', value: 27},
  { name: '/28', value: 28},
  { name: '/29', value: 29},
  { name: '/30', value: 30},
  { name: '/31', value: 31},
  { name: '/32', value: 32}
];

export const getEngineURL = () => {
  try {
    const engineURL = new URL(import.meta.env.VITE_IPAM_ENGINE_URL || window['env'].VITE_IPAM_ENGINE_URL);

    return engineURL.origin;
  } catch {
    return window.location.origin;
  }
}
