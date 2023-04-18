import axios from 'axios';

import { getEngineURL } from '../../global/globals';

// const ENGINE_URL = window.location.origin
const ENGINE_URL = getEngineURL();

export function fetchSpaces(token, utilization = false) {
  var url = new URL(`${ENGINE_URL}/api/spaces`);
  var urlParams = url.searchParams;

  utilization && urlParams.append('utilization', true);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING SPACES FROM API");
    console.log(error);
    throw error;
  });
}

export function fetchSpace(token, space) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING SPACE FROM API");
    console.log(error);
    throw error;
  });
}

export function createSpace(token, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces`);

  return axios
    .post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR CREATING SPACE VIA API");
    console.log(error);
    throw error;
  });
}

export function updateSpace(token, space, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}`);

  return axios
    .patch(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR UPDATING SPACE VIA API");
    console.log(error);
    throw error;
  });
}

export function deleteSpace(token, space, force) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return axios
    .delete(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR DELETING SPACE VIA API");
    console.log(error);
    throw error;
  });
}

export function createBlock(token, space, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks`);

  return axios
    .post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR CREATING BLOCK VIA API");
    console.log(error);
    throw error;
  });
}

export function deleteBlock(token, space, block, force) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}`);
  var urlParams = url.searchParams;

  force && urlParams.append('force', true);

  return axios
    .delete(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR DELETING BLOCK VIA API");
    console.log(error);
    throw error;
  });
}

export function fetchBlockAvailable(token, space, block) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/available`);
  var urlParams = url.searchParams;

  urlParams.append('expand', true);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING AVAILABLE BLOCK NETWORKS FROM API");
    console.log(error);
    throw error;
  });
}

export function replaceBlockNetworks(token, space, block, body) {
  const url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/networks`);

  return axios
    .put(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR UPDATING BLOCK NETWORKS VIA API");
    console.log(error);
    throw error;
  });
}

export function fetchBlockResv(token, space, block) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING AVAILABLE BLOCK RESERVATIONS VIA API");
    console.log(error);
    throw error;
  });
}

export function deleteBlockResvs(token, space, block, body) {
  var url = new URL(`${ENGINE_URL}/api/spaces/${space}/blocks/${block}/reservations`);

  return axios
    .delete(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: body
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR DELETING BLOCK RESERVATIONS VIA API");
    console.log(error);
    throw error;
  });
}

export function fetchSubscriptions(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/subscription`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING SUBSCRIPTIONS FROM API");
    console.log(error);
    throw error;
  });
}

export function fetchVNets(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/vnet`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING VNETS FROM API");
    console.log(error);
    throw error;
  });
}

export function fetchVHubs(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/vhub`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING VHUBS FROM API");
    console.log(error);
    throw error;
  });
}

export function fetchSubnets(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/subnet`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING SUBNETS FROM API");
    console.log(error);
    throw error;
  });
}

export function fetchEndpoints(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/multi`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING ENDPOINTS FROM API");
    console.log(error);
    throw error;
  });
}

export function fetchNetworks(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/network`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING NETWORKS FROM API");
    console.log(error);
    throw error;
  });
}

export function refreshAll(token) {
  const stack = [
    (async () => await fetchSpaces(token, true))(),
    (async () => await fetchSubscriptions(token, true))(),
    (async () => await fetchNetworks(token))(),
    (async () => await fetchEndpoints(token))()
  ];

  return Promise.allSettled(stack);
}

export function fetchTreeView(token) {
  var url = new URL(`${ENGINE_URL}/api/internal/tree`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING TREE VIEW VIA API");
    console.log(error);
    throw error;
  });
}

export function getAdmins(token) {
  var url = new URL(`${ENGINE_URL}/api/admin/admins`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING ADMINS VIA API");
    console.log(error);
    throw error;
  });
}

export function replaceAdmins(token, body) {
  var url = new URL(`${ENGINE_URL}/api/admin/admins`);

  return axios
    .put(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR UPDATING ADMINS VIA API");
    console.log(error);
    throw error;
  });
}

export function getExclusions(token) {
  var url = new URL(`${ENGINE_URL}/api/admin/exclusions`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING EXCLUSIONS VIA API");
    console.log(error);
    throw error;
  });
}

export function replaceExclusions(token, body) {
  var url = new URL(`${ENGINE_URL}/api/admin/exclusions`);

  return axios
    .put(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR UPDATING EXCLUSIONS VIA API");
    console.log(error);
    throw error;
  });
}

export function getMe(token) {
  var url = new URL(`${ENGINE_URL}/api/users/me`);
  var urlParams = url.searchParams;

  urlParams.append('expand', true);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR FETCHING ME VIA API");
    console.log(error);
    throw error;
  });
}

export function updateMe(token, body) {
  var url = new URL(`${ENGINE_URL}/api/users/me`);

  return axios
    .patch(url, body, {
      headers: {
        Authorization: `Bearer ${token}`
      },
    })
  .then(response => response.data)
  .catch(error => {
    console.log("ERROR UPDATING ME VIA API");
    console.log(error);
    throw error;
  });
}
