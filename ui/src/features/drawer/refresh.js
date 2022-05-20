import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import {
  useMsal,
  useIsAuthenticated
} from "@azure/msal-react";

import {
  getRefreshInterval,
  refreshAllAsync,
  getMeAsync
} from '../ipam/ipamSlice';

function Refresh() {
  const { instance, accounts } = useMsal();
  const [intervalAllId, setIntervalAllId] = React.useState();
  const [intervalMeId, setIntervalMeId] = React.useState();
  const isAuthenticated = useIsAuthenticated();
  const refreshInterval = useSelector(getRefreshInterval);
  const dispatch = useDispatch();
  const refreshAllRef = React.useRef();
  const refreshMeRef = React.useRef();

  refreshAllRef.current = React.useCallback(() => {
    const request = {
      scopes: ["https://management.azure.com/user_impersonation"],
      account: accounts[0],
    };

    (async() => {
      const response = await instance.acquireTokenSilent(request);
      dispatch(refreshAllAsync(response.accessToken))
    })();
  }, []);

  refreshMeRef.current = React.useCallback(() => {
    const request = {
      scopes: ["https://management.azure.com/user_impersonation"],
      account: accounts[0],
    };

    (async() => {
      const response = await instance.acquireTokenSilent(request);
      dispatch(getMeAsync(response.accessToken))
    })();
  }, []);

  React.useEffect(()=>{
    if(refreshInterval) {
      // refreshAllRef.current()
      clearInterval(intervalAllId);
      setIntervalAllId(
        setInterval(() => refreshAllRef.current(), refreshInterval * 60 * 1000)
      );
      return () => {
        clearInterval(intervalAllId);
      }
    }
  }, [refreshInterval]);

  React.useEffect(()=>{
    if(refreshInterval) {
      // refreshMeRef.current()
      clearInterval(intervalMeId);
      setIntervalMeId(
        setInterval(() => refreshMeRef.current(), 60 * 1000)
      );
      return () => {
        clearInterval(intervalMeId);
      }
    }
  }, []);

  React.useEffect(()=>{
    const env = process.env || window['env'];
    console.log("+++WEBSITE_DETAILS+++");
    console.log(env);
    console.log("+++++++++++++++++++++");
  }, []);

  return (null);
}

export default Refresh;
