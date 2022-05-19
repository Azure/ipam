import { graphConfig } from "./authConfig";

/**
 * Attaches a given access token to a Microsoft Graph API call. Returns information about the user
 */
export async function callMsGraph(accessToken) {
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers,
    };

    return fetch(graphConfig.graphMeEndpoint, options)
        .then((response) => response.json())
        .catch((error) => console.log(error));
}

export async function callMsGraphUsers(accessToken) {
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers,
    };

    return fetch(graphConfig.graphUsersEndpoint, options)
        .then((response) => response.json())
        .catch((error) => console.log(error));
}

export async function callMsGraphUsersFilter(accessToken, search) {
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers,
    };

    let filter = `?$filter=startsWith(userPrincipalName,'${search}') OR startsWith(displayName, '${search}')`

    return fetch((graphConfig.graphUsersEndpoint + filter), options)
        .then((response) => response.json())
        .catch((error) => console.log(error));
}

export async function callMsGraphPhoto(accessToken) {
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);
    headers.append("Content-Type", "image/jpeg");

    const options = {
        method: "GET",
        headers: headers,
    };

    return fetch(graphConfig.graphMePhotoEndpoint, options)
        .then((response) => {
            console.log("-----------------")
            console.log(response);
            console.log("-----------------")
            response.json();
        })
        .catch((error) => console.log(error));
}

/*
   .catch((error) => {
      throw new Error("Profile image not found");
    });
 */
