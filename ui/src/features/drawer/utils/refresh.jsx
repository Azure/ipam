import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import {
  getRefreshInterval,
  refreshAllAsync,
  getMeAsync
} from '../../ipam/ipamSlice';
import { fetchNotificationsAsync } from '../../notifications/notificationsSlice';
import { getRestart } from '../../restart/restartSlice';

function Refresh() {
  const intervalAllRef = React.useRef(null);
  const intervalMeRef = React.useRef(null);
  const intervalNotificationsRef = React.useRef(null);
  const refreshAllRef = React.useRef(null);
  const refreshMeRef = React.useRef(null);
  const refreshNotificationsRef = React.useRef(null);
  const refreshLoadedRef = React.useRef(false);
  const inProgressRef = React.useRef(InteractionStatus.None);
  const restartActiveRef = React.useRef(false);

  const refreshInterval = useSelector(getRefreshInterval);
  const restart = useSelector(getRestart);

  const dispatch = useDispatch();
  const { inProgress } = useMsal();

  React.useEffect(() => {
    inProgressRef.current = inProgress;
  }, [inProgress]);

  // Pause all polling while a service restart is in progress; the app is cycling,
  // so these calls would just error, and the restart gate drives recovery itself.
  React.useEffect(() => {
    restartActiveRef.current = restart.active;
  }, [restart.active]);

  const refreshAll = React.useCallback(() => {
    if (inProgressRef.current !== InteractionStatus.None) {
      return;
    }

    if (restartActiveRef.current) {
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

  const refreshMe = React.useCallback(() => {
    if (inProgressRef.current !== InteractionStatus.None) {
      return;
    }

    if (restartActiveRef.current) {
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

  const refreshNotifications = React.useCallback(() => {
    if (inProgressRef.current !== InteractionStatus.None) {
      return;
    }

    if (restartActiveRef.current) {
      return;
    }

    (async() => {
      try {
        await dispatch(fetchNotificationsAsync());
      } catch (e) {
        console.log("REFRESH NOTIFICATIONS ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
      }
    })();
  }, [dispatch]);

  React.useEffect(() => {
    refreshAllRef.current = refreshAll;
    refreshMeRef.current = refreshMe;
    refreshNotificationsRef.current = refreshNotifications;
  }, [refreshAll, refreshMe, refreshNotifications]);

  React.useEffect(() => {
    if(refreshInterval) {
      refreshAllRef.current()
      clearInterval(intervalAllRef.current);
      intervalAllRef.current = setInterval(() => refreshAllRef.current(), refreshInterval * 60 * 1000);
      return () => {
        clearInterval(intervalAllRef.current);
        intervalAllRef.current = null;
      }
    }
  }, [refreshInterval]);

  React.useEffect(() => {
    clearInterval(intervalMeRef.current);
    intervalMeRef.current = setInterval(() => refreshMeRef.current(), 60 * 1000);
    return () => {
      clearInterval(intervalMeRef.current);
      intervalMeRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    clearInterval(intervalNotificationsRef.current);
    intervalNotificationsRef.current = setInterval(() => refreshNotificationsRef.current(), 15 * 60 * 1000);
    return () => {
      clearInterval(intervalNotificationsRef.current);
      intervalNotificationsRef.current = null;
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
      refreshNotificationsRef.current();
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
