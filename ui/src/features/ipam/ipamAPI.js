import axios from 'axios';

import { InteractionRequiredAuthError } from "@azure/msal-browser";

import {
  apiRequest
} from '../../msal/authConfig';

import { msalInstance } from '../../index';
import { getEngineURL } from '../../global/globals';

// const ENGINE_URL = window.location.origin
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
    if (e instanceof InteractionRequiredAuthError) {
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

export function fetchSpaces(utilization = false) {
  var url = new URL(`${ENGINE_URL}/api/spaces`);
  var urlParams = url.searchParams;

  utilization && urlParams.append('utilization', true);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING SPACES FROM API");
      console.log(error);
      throw error;
    });
}

export function fetchSpace(space) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING SPACE FROM API");
      console.log(error);
      throw error;
    });
}

export function createSpace(body) {
  const url = new URL(`${ENGINE_URL}/api/spaces`);

  return api
    .post(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR CREATING SPACE VIA API");
      console.log(error);
      throw error;
    });
}

export function updateSpace(space, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}`);

  return api
    .patch(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR UPDATING SPACE VIA API");
      console.log(error);
      throw error;
    });
}

export function deleteSpace(space, force) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return api
    .delete(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR DELETING SPACE VIA API");
      console.log(error);
      throw error;
    });
}

export function createBlock(space, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks`);

  return api
    .post(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR CREATING BLOCK VIA API");
      console.log(error);
      throw error;
    });
}

export function deleteBlock(space, block, force) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return api
    .delete(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR DELETING BLOCK VIA API");
      console.log(error);
      throw error;
    });
}

export function fetchBlockAvailable(space, block) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/available`);
  var urlParams = url.searchParams;

  urlParams.append('expand', true);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING AVAILABLE BLOCK NETWORKS FROM API");
      console.log(error);
      throw error;
    });
}

export function replaceBlockNetworks(space, block, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/networks`);

  return api
    .put(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR UPDATING BLOCK NETWORKS VIA API");
      console.log(error);
      throw error;
    });
}

export function fetchBlockResv(space, block) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING AVAILABLE BLOCK RESERVATIONS VIA API");
      console.log(error);
      throw error;
    });
}

export function deleteBlockResvs(space, block, body) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return api
    .delete(url, {
      data: body
    })
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR DELETING BLOCK RESERVATIONS VIA API");
      console.log(error);
      throw error;
    });
}

export function fetchSubscriptions() {
  var url = new URL(`${ENGINE_URL}/api/azure/subscription`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING SUBSCRIPTIONS FROM API");
      console.log(error);
      throw error;
    });
}

export function fetchVNets() {
  var url = new URL(`${ENGINE_URL}/api/azure/vnet`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING VNETS FROM API");
      console.log(error);
      throw error;
    });
}

export function fetchVHubs() {
  var url = new URL(`${ENGINE_URL}/api/azure/vhub`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING VHUBS FROM API");
      console.log(error);
      throw error;
    });
}

export function fetchSubnets() {
  var url = new URL(`${ENGINE_URL}/api/azure/subnet`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING SUBNETS FROM API");
      console.log(error);
      throw error;
    });
}

export function fetchEndpoints() {
  var url = new URL(`${ENGINE_URL}/api/azure/multi`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING ENDPOINTS FROM API");
      console.log(error);
      throw error;
    });
}

export function fetchNetworks() {
  var url = new URL(`${ENGINE_URL}/api/azure/network`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING NETWORKS FROM API");
      console.log(error);
      throw error;
    });
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

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING TREE VIEW VIA API");
      console.log(error);
      throw error;
    });
}

export function getAdmins() {
  var url = new URL(`${ENGINE_URL}/api/admin/admins`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING ADMINS VIA API");
      console.log(error);
      throw error;
    });
}

export function replaceAdmins(body) {
  var url = new URL(`${ENGINE_URL}/api/admin/admins`);

  return api
    .put(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR UPDATING ADMINS VIA API");
      console.log(error);
      throw error;
    });
}

export function getExclusions() {
  var url = new URL(`${ENGINE_URL}/api/admin/exclusions`);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING EXCLUSIONS VIA API");
      console.log(error);
      throw error;
    });
}

export function replaceExclusions(body) {
  var url = new URL(`${ENGINE_URL}/api/admin/exclusions`);

  return api
    .put(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR UPDATING EXCLUSIONS VIA API");
      console.log(error);
      throw error;
    });
}

export function getMe() {
  var url = new URL(`${ENGINE_URL}/api/users/me`);
  var urlParams = url.searchParams;

  urlParams.append('expand', true);

  return api
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR FETCHING ME VIA API");
      console.log(error);
      throw error;
    });
}

export function updateMe(body) {
  var url = new URL(`${ENGINE_URL}/api/users/me`);

  return api
    .patch(url, body)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR UPDATING ME VIA API");
      console.log(error);
      throw error;
    });
}
