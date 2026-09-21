import React from "react";

import { useMsal } from "@azure/msal-react";
import { EventType, InteractionStatus, InteractionRequiredAuthError } from "@azure/msal-browser";

import { loginRequest } from "./authConfig";

const INTERACTION_REQUIRED_ERROR_CODES = new Set([
  "interaction_required",
  "login_required",
  "consent_required",
  "no_tokens_found",
  "refresh_token_expired",
  "monitor_window_timeout",
  "timed_out",
]);

function isInteractionRequiredError(error) {
  if (!error) {
    return false;
  }

  if (error instanceof InteractionRequiredAuthError) {
    return true;
  }

  const errorCode = error.errorCode || error.subError;

  return typeof errorCode === "string" && INTERACTION_REQUIRED_ERROR_CODES.has(errorCode);
}

function AuthHandler() {
  const { instance, inProgress } = useMsal();
  const [pendingReauth, setPendingReauth] = React.useState(null);
  const redirectPendingRef = React.useRef(false);

  React.useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (
        event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
        event.eventType === EventType.LOGIN_SUCCESS
      ) {
        // Ensure the active account is set after a successful login so
        // acquireTokenSilent can resolve it automatically.
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
          instance.setActiveAccount(event.payload.account);
        }

        redirectPendingRef.current = false;
        setPendingReauth(null);
        return;
      }

      if (event.eventType === EventType.ACQUIRE_TOKEN_FAILURE) {
        const error = event.error;
        const errorCode = event.errorCode;

        const shouldHandle =
          isInteractionRequiredError(error) ||
          (typeof errorCode === "string" && INTERACTION_REQUIRED_ERROR_CODES.has(errorCode));

        if (!shouldHandle) {
          return;
        }

        // A silent token acquisition failed and needs interaction. Trigger a
        // single re-auth redirect via the effect below. loginRedirect(loginRequest)
        // re-consents every scope (API + Graph), so it covers any failed request.
        redirectPendingRef.current = false;
        setPendingReauth({ error });
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance]);

  React.useEffect(() => {
    if (!pendingReauth) {
      return;
    }

    if (inProgress !== InteractionStatus.None || redirectPendingRef.current) {
      return;
    }

    redirectPendingRef.current = true;

    instance.loginRedirect(loginRequest).catch((error) => {
      console.error("Re-authentication redirect failed", error);

      // Allow a retry once the in-progress interaction clears. A fresh object
      // changes identity so this effect re-runs.
      redirectPendingRef.current = false;
      setPendingReauth((current) => (current ? { ...current } : current));
    });
  }, [pendingReauth, inProgress, instance]);

  return null;
}

export default AuthHandler;
