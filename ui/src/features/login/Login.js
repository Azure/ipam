import * as React from 'react';
import { useMsal } from "@azure/msal-react";

import { loginRequest } from "../../msal/authConfig";

const Login = () => {
  const { instance } = useMsal();

  React.useEffect(() => {
    instance.loginRedirect(loginRequest).catch((e) => {
      console.log("LOGIN ERROR:");
      console.log("--------------");
      console.error(e);
      console.log("--------------");
    });
  }, []);

  return(null)
};

export default Login;
