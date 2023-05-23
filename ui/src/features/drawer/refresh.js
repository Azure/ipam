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
  const intervalAll = React.useRef(null);
  const intervalMe = React.useRef(null);
  const refreshAllRef = React.useRef();
  const refreshMeRef = React.useRef(null);
  const refreshLoadedRef = React.useRef(false);

  const refreshInterval = useSelector(getRefreshInterval);

  const dispatch = useDispatch();

  refreshAllRef.current = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0]
    };

    (async() => {
      await instance.handleRedirectPromise();

      try {
        const response = await instance.acquireTokenSilent(request)
        dispatch(refreshAllAsync(response.accessToken))
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          const response = await instance.acquireTokenRedirect(request);
          dispatch(refreshAllAsync(response.accessToken))
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
        }
      }
    })();
  }, [accounts, dispatch, instance]);

  refreshMeRef.current = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0]
    };

    (async() => {
      await instance.handleRedirectPromise();

      try {
        const response = await instance.acquireTokenSilent(request)
        dispatch(getMeAsync(response.accessToken))
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          const response = await instance.acquireTokenRedirect(request);
          dispatch(getMeAsync(response.accessToken))
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
        }
      }
    })();
  }, [accounts, dispatch, instance]);

  React.useEffect(() => {
    if(refreshInterval) {
      refreshAllRef.current()
      clearInterval(intervalAll.current);
      intervalAll.current = setInterval(() => refreshAllRef.current(), refreshInterval * 60 * 1000);
      return () => {
        clearInterval(intervalAll.current);
        intervalAll.current = null;
      }
    }
  }, [refreshInterval]);

  React.useEffect(() => {
    clearInterval(intervalMe.current);
    intervalMe.current = setInterval(() => refreshMeRef.current(), 60 * 1000);
    return () => {
      clearInterval(intervalMe.current);
      intervalMe.current = null;
    }
  }, []);

  React.useEffect(()=>{
    if(!refreshLoadedRef.current) {
      refreshLoadedRef.current = true;
      refreshMeRef.current();
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
