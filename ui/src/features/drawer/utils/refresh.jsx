import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import {
  getRefreshInterval,
  refreshAllAsync,
  getMeAsync
} from '../../ipam/ipamSlice';

function Refresh() {
  const intervalAll = React.useRef(null);
  const intervalMe = React.useRef(null);
  const refreshAllRef = React.useRef(null);
  const refreshMeRef = React.useRef(null);
  const refreshLoadedRef = React.useRef(false);
  const inProgressRef = React.useRef(InteractionStatus.None);

  const refreshInterval = useSelector(getRefreshInterval);

  const dispatch = useDispatch();
  const { inProgress } = useMsal();

  React.useEffect(() => {
    inProgressRef.current = inProgress;
  }, [inProgress]);

  refreshAllRef.current = React.useCallback(() => {
    if (inProgressRef.current !== InteractionStatus.None) {
      return;
    }

    (async() => {
      try {
        await dispatch(refreshAllAsync());
      } catch (e) {
        console.log("REFRESH ALL ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
      }
    })();
  }, [dispatch]);

  refreshMeRef.current = React.useCallback(() => {
    if (inProgressRef.current !== InteractionStatus.None) {
      return;
    }

    (async() => {
      try {
        await dispatch(getMeAsync());
      } catch (e) {
        console.log("REFRESH ME ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
      }
    })();
  }, [dispatch]);

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

  React.useEffect(() => {
    // Wait until MSAL is idle (inProgress === None) before triggering the
    // initial data fetch.  After a redirect-based re-auth, inProgress starts
    // as "handleRedirect" and only transitions to "none" once the auth code
    // exchange is complete.  Without this guard the initial call would bail
    // out (because refreshMeRef checks inProgressRef) and never retry.
    if (!refreshLoadedRef.current && inProgress === InteractionStatus.None) {
      refreshLoadedRef.current = true;
      refreshMeRef.current();
    }
  }, [inProgress]);

  React.useEffect(()=>{
    const env = { ...import.meta.env, ...window['env'] }
    console.log("+++WEBSITE_DETAILS+++");
    console.log(env);
    console.log("+++++++++++++++++++++");
  }, []);

  return (null);
}

export default Refresh;
