import axios from 'axios';

import { InteractionRequiredAuthError, BrowserAuthError } from "@azure/msal-browser";

import { msalInstance } from '../index';
import { graphConfig } from "./authConfig";

async function generateToken() {
  // const activeAccount = msalInstance.getActiveAccount();
  const accounts = msalInstance.getAllAccounts();

  // if (!activeAccount && accounts.length === 0) {
  // }

  const request = {
    scopes: ["User.Read", "Directory.Read.All"],
    account: accounts[0],
    forceRefresh: true,
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
      console.log("ERROR FETCHING GRAPH TOKEN");
      console.log("------------------");
      console.log(e);
      console.log("------------------");
      throw(e);
    }
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
    Promise.reject(error)
});

export function callMsGraph() {
  var url = new URL(graphConfig.graphMeEndpoint);

  return graph
    .get(url)
    .then(response => response.data)
    .catch(error => {
      console.log("ERROR CALLING MSGRAPH");
      console.log(error);
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
    urlParams.append('filter', `startsWith(userPrincipalName,'${nameFilter}') OR startsWith(displayName, '${nameFilter}')`);
  }

  urlParams.append('orderby', 'displayName');
  urlParams.append('count', true);

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
    urlParams.append('filter', `startsWith(displayName,'${nameFilter}')`);
  }

  urlParams.append('orderby', 'displayName');
  urlParams.append('count', true);

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
