import * as React from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import { loginRequest } from "../../msal/authConfig";

const Login = () => {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // React.useEffect(() => {
  //   if (!isAuthenticated && inProgress === InteractionStatus.None) {
  //     instance.loginRedirect(loginRequest).catch((e) => {
  //       if (e.errorCode === "consent_required" || e.errorCode === "interaction_required" || e.errorCode === "login_required") {
  //         instance.acquireTokenPopup(loginRequest).catch((e) => {
  //           console.log("LOGIN ERROR:");
  //           console.log("--------------");
  //           console.error(e);
  //           console.log("--------------");
  //         });
  //       }
  //     });
  //   }
  // }, [isAuthenticated, inProgress, instance]);

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

  // React.useEffect(() => {
  //   instance.loginRedirect(loginRequest).catch((e) => {
  //     console.log("LOGIN ERROR:");
  //     console.log("--------------");
  //     console.error(e);
  //     console.log("--------------");
  //   });
  // }, []);

  return(null)
};

export default Login;
