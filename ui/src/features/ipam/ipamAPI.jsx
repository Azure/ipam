import axios from 'axios';

import { InteractionRequiredAuthError, BrowserAuthError } from "@azure/msal-browser";

import {
  apiRequest
} from '../../msal/authConfig';

import { msalInstance } from '../../index';
import { getEngineURL } from '../../global/globals';

const ENGINE_URL = getEngineURL();

async function generateToken() {
  // const activeAccount = msalInstance.getActiveAccount();
  const accounts = msalInstance.getAllAccounts();

  // if (!activeAccount && accounts.length === 0) {
  // }

  const request = {
    scopes: apiRequest.scopes,
    account: accounts[0]
  };

  await msalInstance.handleRedirectPromise();

  try {
    const response = await msalInstance.acquireTokenSilent(request);

    return response.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError || e instanceof BrowserAuthError) {
      const response = await msalInstance.acquireTokenRedirect(request);
      
      return response.accessToken;
    } else {
      console.log("ERROR FETCHING API TOKEN");
      console.log("------------------");
      console.log(e);
      console.log("------------------");
      throw(e);
    }
  }
}

const api = axios.create();

api.interceptors.request.use(
  async config => {
    const token = await generateToken();

    config.headers['Authorization'] = `Bearer ${token}`;
  
    return config;
  },
  error => {
    Promise.reject(error)
});

api.interceptors.response.use(
  response => response.data,
  error => {
    console.log("ERROR CALLING IPAM API");
    console.log(error);

    if(error.response) {
      return Promise.reject(new Error(error.response.data.error));
    } else {
      return Promise.reject(error);
    }
});

export function fetchSpaces(utilization = false) {
  var url = new URL(`${ENGINE_URL}/api/spaces`);
  var urlParams = url.searchParams;

  utilization && urlParams.append('utilization', true);

  return api.get(url);
}

export function fetchSpace(space) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}`);

  return api.get(url);
}

export function createSpace(body) {
  const url = new URL(`${ENGINE_URL}/api/spaces`);

  return api.post(url, body);
}

export function updateSpace(space, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}`);

  return api.patch(url, body);
}

export function deleteSpace(space, force) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return api.delete(url);
}

export function createBlock(space, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks`);

  return api.post(url, body);
}

export function updateBlock(space, block, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}`);

  return api.patch(url, body);
}

export function deleteBlock(space, block, force) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return api.delete(url);
}

export function fetchBlockAvailable(space, block) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/available`);
  var urlParams = url.searchParams;

  urlParams.append('expand', true);

  return api.get(url);
}

export function replaceBlockNetworks(space, block, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/networks`);

  return api.put(url, body);
}

export function createBlockExternal(space, block, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals`);

  return api.post(url, body);
}

export function updateBlockExternal(space, block, external, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals/${external}`);

  return api.patch(url, body);
}

export function deleteBlockExternal(space, block, external, force) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals/${external}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return api.delete(url);
}

export function createBlockExtSubnet(space, block, external, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals/${external}/subnets`);

  return api.post(url, body);
}

export function updateBlockExtSubnet(space, block, external, subnet, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals/${external}/subnets/${subnet}`);

  return api.patch(url, body);
}

export function deleteBlockExtSubnet(space, block, external, subnet, force) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals/${external}/subnets/${subnet}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return api.delete(url);
}

export function replaceBlockExtSubnetEndpoints(space, block, external, subnet, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals/${external}/subnets/${subnet}/endpoints`);

  return api.put(url, body);
}

export function replaceBlockExternals(space, block, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/externals`);

  return api.put(url, body);
}

export function createBlockResv(space, block, body) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return api.post(url, body);
}

export function fetchBlockResv(space, block) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return api.get(url);
}

export function deleteBlockResvs(space, block, body) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return api.delete(url, { data: body });
}

export function fetchSubscriptions() {
  var url = new URL(`${ENGINE_URL}/api/azure/subscription`);

  return api.get(url);
}

export function fetchVNets() {
  var url = new URL(`${ENGINE_URL}/api/azure/vnet`);

  return api.get(url);
}

export function fetchVHubs() {
  var url = new URL(`${ENGINE_URL}/api/azure/vhub`);

  return api.get(url);
}

export function fetchSubnets() {
  var url = new URL(`${ENGINE_URL}/api/azure/subnet`);

  return api.get(url);
}

export function fetchEndpoints() {
  var url = new URL(`${ENGINE_URL}/api/azure/multi`);

  return api.get(url);
}

export function fetchNetworks() {
  var url = new URL(`${ENGINE_URL}/api/azure/network`);

  return api.get(url);
}

export function refreshAll() {
  const stack = [
    (async () => await fetchSpaces(true))(),
    (async () => await fetchSubscriptions(true))(),
    (async () => await fetchNetworks())(),
    (async () => await fetchEndpoints())()
  ];

  return Promise.allSettled(stack);
}

export function fetchTreeView() {
  var url = new URL(`${ENGINE_URL}/api/internal/tree`);

  return api.get(url);
}

export function getAdmins() {
  var url = new URL(`${ENGINE_URL}/api/admin/admins`);

  return api.get(url);
}

export function replaceAdmins(body) {
  var url = new URL(`${ENGINE_URL}/api/admin/admins`);

  return api.put(url, body);
}

export function getExclusions() {
  var url = new URL(`${ENGINE_URL}/api/admin/exclusions`);

  return api.get(url);
}

export function replaceExclusions(body) {
  var url = new URL(`${ENGINE_URL}/api/admin/exclusions`);

  return api.put(url, body);
}

export function getMe() {
  var url = new URL(`${ENGINE_URL}/api/users/me`);
  var urlParams = url.searchParams;

  urlParams.append('expand', true);

  return api.get(url);
}

export function updateMe(body) {
  var url = new URL(`${ENGINE_URL}/api/users/me`);

  return api.patch(url, body);
}

export function fetchNextAvailableVNet(body) {
  const url = new URL(`${ENGINE_URL}/api/tools/nextAvailableVNet`);

  return api.post(url, body);
}

export function fetchNextAvailableSubnet(body) {
  const url = new URL(`${ENGINE_URL}/api/tools/nextAvailableSubnet`);

  return api.post(url, body);
}
