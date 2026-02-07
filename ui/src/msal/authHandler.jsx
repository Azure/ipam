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

function extractTokenRequest(event) {
  const payload = event?.payload;

  if (payload && typeof payload === "object" && "request" in payload) {
    return payload.request;
  }

  return null;
}

function AuthHandler() {
  const { instance, inProgress } = useMsal();
  const [pendingInteraction, setPendingInteraction] = React.useState(null);
  const activeRequestRef = React.useRef(null);
  const redirectPendingRef = React.useRef(false);

  const resetInteraction = React.useCallback(() => {
    activeRequestRef.current = null;
    setPendingInteraction(null);
    redirectPendingRef.current = false;
  }, []);

  React.useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (
        event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
        event.eventType === EventType.LOGIN_SUCCESS
      ) {
        resetInteraction();
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

        const tokenRequest = extractTokenRequest(event);

        const interaction = tokenRequest
          ? { type: "token", tokenRequest, error }
          : { type: "login", error };

        activeRequestRef.current = interaction;
        redirectPendingRef.current = false;
        setPendingInteraction(interaction);
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance, resetInteraction]);

  React.useEffect(() => {
    if (!pendingInteraction) {
      return;
    }

    if (inProgress !== InteractionStatus.None || redirectPendingRef.current) {
      return;
    }

    const request = activeRequestRef.current;

    if (!request) {
      return;
    }

    redirectPendingRef.current = true;

    const invokeRedirect = async () => {
      try {
        if (request.type === "token" && request.tokenRequest) {
          await instance.acquireTokenRedirect(request.tokenRequest);
        } else {
          await instance.loginRedirect(loginRequest);
        }
      } catch (error) {
        console.error("Redirect request failed", error);
        redirectPendingRef.current = false;
        setPendingInteraction((current) => (current ? { ...current } : current));
      }
    };

    invokeRedirect();
  }, [pendingInteraction, inProgress, instance]);

  return null;
}

export default AuthHandler;
