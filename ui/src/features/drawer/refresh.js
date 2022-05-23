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

import {
  apiRequest
} from '../../msal/authConfig';

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
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async() => {
      const response = await instance.acquireTokenSilent(request).catch((e) => {
        if (e.errorCode === "consent_required" || e.errorCode === "interaction_required" || e.errorCode === "login_required") {
          instance.acquireTokenPopup(request).catch((e) => {
            console.log("TOKEN ERROR:");
            console.log("--------------");
            console.error(e);
            console.log("--------------");
          });
        }
      });
      dispatch(refreshAllAsync(response.accessToken))
    })();
  }, []);

  refreshMeRef.current = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async() => {
      const response = await instance.acquireTokenSilent(request).catch((e) => {
        if (e.errorCode === "consent_required" || e.errorCode === "interaction_required" || e.errorCode === "login_required") {
          instance.acquireTokenPopup(request).catch((e) => {
            console.log("LOGIN ERROR:");
            console.log("--------------");
            console.error(e);
            console.log("--------------");
          });
        }
      });
      dispatch(getMeAsync(response.accessToken))
    })();
  }, []);

  React.useEffect(()=>{
    if(refreshInterval) {
      refreshAllRef.current()
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
    refreshMeRef.current()
    clearInterval(intervalMeId);
    setIntervalMeId(
      setInterval(() => refreshMeRef.current(), 60 * 1000)
    );
    return () => {
      clearInterval(intervalMeId);
    }
  }, []);

  React.useEffect(()=>{
    const env = { ...process.env, ...window['env'] }
    console.log("+++WEBSITE_DETAILS+++");
    console.log(env);
    console.log("+++++++++++++++++++++");
  }, []);

  return (null);
}

export default Refresh;
