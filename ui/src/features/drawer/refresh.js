import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import {
  useMsal
} from "@azure/msal-react";

import { InteractionRequiredAuthError } from "@azure/msal-browser";

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

  const refreshInterval = useSelector(getRefreshInterval);

  const dispatch = useDispatch();

  const refreshAllRef = React.useRef();
  const refreshMeRef = React.useRef(null);
  const refreshLoadedRef = React.useRef(false);

  refreshAllRef.current = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async() => {
      try {
        const response = await instance.acquireTokenSilent(request)
        dispatch(refreshAllAsync(response.accessToken))
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
        }
      }
    })();
  }, []);

  refreshMeRef.current = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async() => {
      try {
        console.log("REFRESH ME...");
        const response = await instance.acquireTokenSilent(request)
        dispatch(getMeAsync(response.accessToken))
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
      }
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
    if(!refreshLoadedRef.current) {
      refreshLoadedRef.current = true;
      refreshMeRef.current()
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
    const env = { ...process.env, ...window['env'] }
    console.log("+++WEBSITE_DETAILS+++");
    console.log(env);
    console.log("+++++++++++++++++++++");
  }, []);

  return (null);
}

export default Refresh;
