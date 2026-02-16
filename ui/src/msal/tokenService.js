import { CacheLookupPolicy } from "@azure/msal-browser";

import { msalInstance } from "../index";
import { apiRequest } from "./authConfig";

const GRAPH_SCOPES = ["User.Read", "Directory.Read.All"];

/**
 * Resolve the current user account for token requests.
 *
 * Prefers the active account set via setActiveAccount(), but falls
 * back to the first account in the cache.  This handles the race
 * condition where AuthenticatedTemplate renders (because an account
 * exists in the cache after handleRedirectPromise resolves) before
 * the LOGIN_SUCCESS event handler has called setActiveAccount().
 *
 * If there are truly no accounts (first visit, not yet logged in),
 * returns null — acquireTokenSilent will throw no_account_error and
 * the Login component will redirect to AAD.
 */
function getAccount() {
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null;
}

/**
 * Acquire an access token for the IPAM Engine API.
 *
 * Uses CacheLookupPolicy.AccessTokenAndRefreshToken so that
 * acquireTokenSilent will try the cache and refresh token only —
 * it will never fall back to a hidden iframe, avoiding the
 * AADSTS160021 / timed_out errors that occur when the AAD
 * browser session has expired.
 *
 * If the refresh token itself has expired, acquireTokenSilent
 * will fail immediately and AuthHandler will trigger a single
 * interactive redirect to re-authenticate the user.
 */
export async function getApiToken() {
  const response = await msalInstance.acquireTokenSilent({
    ...apiRequest,
    account: getAccount(),
    cacheLookupPolicy: CacheLookupPolicy.AccessTokenAndRefreshToken,
  });

  return response.accessToken;
}

/**
 * Acquire an access token for the Microsoft Graph API.
 *
 * Same CacheLookupPolicy rationale as getApiToken above.
 */
export async function getGraphToken() {
  const response = await msalInstance.acquireTokenSilent({
    scopes: GRAPH_SCOPES,
    account: getAccount(),
    cacheLookupPolicy: CacheLookupPolicy.AccessTokenAndRefreshToken,
  });

  return response.accessToken;
}
