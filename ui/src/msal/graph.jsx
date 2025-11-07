import axios from 'axios';

import { msalInstance } from '../index';
import { graphConfig } from "./authConfig";

async function generateToken() {
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length === 0) {
    throw new Error("No user accounts found. Please login or re-authenticate first.");
  }

  const request = {
    scopes: ["User.Read", "Directory.Read.All"],
    forceRefresh: true,
  };

  const tokenRequest = {
    ...request,
    account: accounts[0]
  };

  try {
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    return response.accessToken;
  } catch (error) {
    throw error;
  }
}

const graph = axios.create();

graph.interceptors.request.use(
  async config => {
    const token = await generateToken();

    config.headers['Authorization'] = `Bearer ${token}`;

    return config;
  },
  error => {
    return Promise.reject(error);
});

export function callMsGraph() {
  var url = new URL(graphConfig.graphMeEndpoint);

  return graph
    .get(url)
    .then(response => response.data)
    .catch(async error => {
      console.log("ERROR CALLING MSGRAPH");
      console.log(error);

      // If we get a 401, the token might be invalid - try to get a fresh token
      if (error.response?.status === 401) {
        console.log("401 error - attempting to refresh Graph token");
        try {
          // Force a fresh token acquisition for Graph API
          await generateToken();
          // The generateToken function will trigger a redirect if needed
        } catch (tokenError) {
          console.log("Token refresh failed:", tokenError);
          throw tokenError;
        }
      }

      throw error;
    });
}

export function callMsGraphUsers() {
  var url = new URL(graphConfig.graphUsersEndpoint);

  return graph
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR CALLING MSGRAPH USERS");
      console.log(error);
      throw error;
    });
}

export function callMsGraphUsersFilter(nameFilter = "") {
  var url = new URL(graphConfig.graphUsersEndpoint);
  var urlParams = url.searchParams;

  if(nameFilter !== "") {
    urlParams.append('$filter', `startsWith(userPrincipalName,'${nameFilter}') OR startsWith(displayName, '${nameFilter}')`);
  }

  urlParams.append('$orderby', 'displayName');
  urlParams.append('$count', true);

  return graph
    .get(url, {
      headers: {
        ConsistencyLevel: 'eventual'
      }
    })
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR CALLING MSGRAPH USERS FILTER");
      console.log(error);
      throw error;
    });
}

export function callMsGraphPrincipalsFilter(nameFilter = "") {
  var url = new URL(graphConfig.graphPrincipalsEndpoint);
  var urlParams = url.searchParams;

  if(nameFilter !== "") {
    urlParams.append('$filter', `startsWith(displayName,'${nameFilter}')`);
  }

  urlParams.append('$orderby', 'displayName');
  urlParams.append('$count', true);

  return graph
    .get(url, {
      headers: {
        ConsistencyLevel: 'eventual'
      }
    })
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR CALLING MSGRAPH PRINCIPALS FILTER");
      console.log(error);
      throw error;
    });
}

export function callMsGraphPhoto() {
  var url = new URL(graphConfig.graphMePhotoEndpoint);

  return graph
    .get(url, {
      headers: {
        "Content-Type": "image/jpeg"
      },
      responseType: 'blob'
    })
    .then(response => {
      if(response.status === 200) {
        return response.data;
      } else {
        throw new Error("Profile image not found");
      }
    })
    .then((imageBlob) => {
      const imageObjectURL = URL.createObjectURL(imageBlob);

      return imageObjectURL;
    })
    .catch(error => {
      console.log("ERROR CALLING MSGRAPH PHOTO");
      console.log(error);
      // throw error;
    });
}
