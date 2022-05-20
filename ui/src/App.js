import React from 'react';
// import { useSelector, useDispatch } from 'react-redux';
import { BrowserRouter as Router} from "react-router-dom";

import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  // useMsal,
  // useIsAuthenticated
} from "@azure/msal-react";

// import {
//   getRefreshInterval,
//   refreshAllAsync,
//   getMeAsync
// } from './features/ipam/ipamSlice';

import './App.css';

import { SnackbarProvider } from 'notistack';
import Slide from '@mui/material/Slide';

import Login from "./features/login/Login";

import NavDrawer from './features/drawer/drawer';

// import { env } from './env';

function App() {
  // const { instance, accounts } = useMsal();
  // const [intervalAllId, setIntervalAllId] = React.useState();
  // const [intervalMeId, setIntervalMeId] = React.useState();
  // const isAuthenticated = useIsAuthenticated();
  // const refreshInterval = useSelector(getRefreshInterval);
  // const dispatch = useDispatch();
  // const refreshAllRef = React.useRef();
  // const refreshMeRef = React.useRef();

  // refreshAllRef.current = React.useCallback(() => {
  //   if(isAuthenticated) {
  //     const request = {
  //       scopes: ["https://management.azure.com/user_impersonation"],
  //       account: accounts[0],
  //     };

  //     (async() => {
  //       const response = await instance.acquireTokenSilent(request);
  //       dispatch(refreshAllAsync(response.accessToken))
  //     })();
  //   }
  // }, [isAuthenticated]);

  // refreshMeRef.current = React.useCallback(() => {
  //   if(isAuthenticated) {
  //     const request = {
  //       scopes: ["https://management.azure.com/user_impersonation"],
  //       account: accounts[0],
  //     };

  //     (async() => {
  //       const response = await instance.acquireTokenSilent(request);
  //       dispatch(getMeAsync(response.accessToken))
  //     })();
  //   }
  // }, [isAuthenticated]);

  // React.useEffect(()=>{
  //   refreshAllRef.current()
  //   clearInterval(intervalAllId);
  //   setIntervalAllId(
  //     setInterval(() => refreshAllRef.current(), refreshInterval * 60 * 1000)
  //   );
  //   return () => {
  //     clearInterval(intervalAllId);
  //   }
  // }, [refreshInterval]);

  // React.useEffect(()=>{
  //   console.log("+++WEBSITE_DETAILS+++");
  //   console.log(env);
  //   console.log("+++++++++++++++++++++");
  //   refreshMeRef.current()
  //   clearInterval(intervalMeId);
  //   setIntervalMeId(
  //     setInterval(() => refreshMeRef.current(), 60 * 1000)
  //   );
  //   return () => {
  //     clearInterval(intervalMeId);
  //   }
  // }, []);

  return (
    <div className="App">
      <AuthenticatedTemplate>
        <SnackbarProvider
          anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
          }}
          TransitionComponent={Slide}
        >
          <Router>
            <NavDrawer />
          </Router>
        </SnackbarProvider>
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </div>
  );
}

export default App;
