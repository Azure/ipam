import * as React from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import { loginRequest } from "../../msal/authConfig";

const Login = () => {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const loginAttemptedRef = React.useRef(false);

  React.useEffect(() => {
    const handleAuthentication = async () => {
      // Only attempt login if:
      // 1. User is not authenticated
      // 2. No interaction is currently in progress (this is the key check per MSAL docs)
      // 3. We haven't already attempted login
      if (
        !isAuthenticated &&
        inProgress === InteractionStatus.None &&
        !loginAttemptedRef.current
      ) {
        loginAttemptedRef.current = true;

        try {
          await instance.loginRedirect(loginRequest);
        } catch (error) {
          console.log("LOGIN ERROR:");
          console.log("--------------");
          console.error(error);
          console.log("--------------");

          // Reset the attempt flag on any error to allow retry
          loginAttemptedRef.current = false;
        }
      }
    };

    handleAuthentication();
  }, [isAuthenticated, inProgress, instance]);

  // Reset login attempt flag when authentication state changes
  React.useEffect(() => {
    if (isAuthenticated) {
      loginAttemptedRef.current = false;
    }
  }, [isAuthenticated]);

  return(null)
};

export default Login;
