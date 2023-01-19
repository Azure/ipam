import * as React from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import { loginRequest } from "../../msal/authConfig";

const Login = () => {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  React.useEffect(() => {
    if (!isAuthenticated && inProgress === InteractionStatus.None) {
      instance.loginRedirect(loginRequest).catch((e) => {
        console.log("LOGIN ERROR:");
        console.log("--------------");
        console.error(e);
        console.log("--------------");
      });
    }
  }, [isAuthenticated, inProgress, instance]);

  return(null)
};

export default Login;
