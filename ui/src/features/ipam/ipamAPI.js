import axios from 'axios';

// const ENGINE_URL = 'localhost:8000'
// const ENGINE_URL = 'localhost:3000'
const ENGINE_URL = window.location.origin

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
  .then((data) => {
    data.forEach(space => {
      if(utilization) {
        space['available'] = (space.size - space.used);
        space['utilization'] = Math.round((space.used / space.size) * 100) || 0;
      }
    });

    return data;
  })
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

// export function fetchBlocks(token) {
//   const headers = [
//     ['Authorization', `Bearer ${token}`]
//   ];

//   return fetch('${ENGINE_URL}/api/block?detail=true', { headers })
//   .then((response) => response.json()
//   .then((data) => {
//     data.forEach(block => {
//       block['available'] = (block.size - block.used);
//       block['utilization'] = Math.round((block.used / block.size) * 100);
//       block['id'] = `${block.name}@${block.parentSpace}`;
//     });

//     return data;
//   }))
//   .catch((error) => {
//     console.log("ERROR FETCHING IP BLOCKS FROM API");
//   });
// }

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
  .then((data) => {
    data.forEach(vnet => {
      vnet['available'] = (vnet.size - vnet.used);
      vnet['utilization'] = Math.round((vnet.used / vnet.size) * 100);
      vnet['prefixes'] = vnet.prefixes.join(", ");
    });

    return data;
  })
  .catch(error => {
    console.log("ERROR FETCHING VNETS FROM API");
    console.log(error);
    throw error;
  });
}

const subnetMap = {
  AFW: "Azure Firewall",
  VGW: "Virtual Network Gateway",
  BAS: "Azure Bastion",
  AGW: "Application Gateway"
};

export function fetchSubnets(token) {
  var url = new URL(`${ENGINE_URL}/api/azure/subnet`);

  return axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  .then(response => response.data)
  .then((data) => {
    data.forEach(subnet => {
      subnet['available'] = (subnet.size - subnet.used);
      subnet['utilization'] = Math.round((subnet.used / subnet.size) * 100);
      subnet['type'] = subnetMap[subnet['type']];
    });

    return data;
  })
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

export function refreshAll(token) {
  const stack = [
    (async () => await fetchSpaces(token, true))(),
    // (async () => await fetchBlocks(token))(),
    (async () => await fetchVNets(token))(),
    (async () => await fetchSubnets(token))(),
    (async () => await fetchEndpoints(token))()
  ];

  return Promise.all(stack);
}

export function fetchTreeView(token) {
  const url = new URL(`${ENGINE_URL}/api/azure/tree`);

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
  const url = new URL(`${ENGINE_URL}/api/admins`);

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
  const url = new URL(`${ENGINE_URL}/api/admins`);

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

export function getMe(token) {
  const url = new URL(`${ENGINE_URL}/api/users/me`);

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
  const url = new URL(`${ENGINE_URL}/api/users/me`);

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
