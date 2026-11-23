import { useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import { useSnackbar } from "notistack";

import {
  getRefreshInterval,
  refreshAllAsync,
  getMeAsync
} from '../../ipam/ipamSlice';
import { fetchNotificationsAsync } from '../../notifications/notificationsSlice';
import { getRestart } from '../../restart/restartSlice';

function Refresh() {
  const intervalAllRef = useRef(null);
  const intervalMeRef = useRef(null);
  const intervalNotificationsRef = useRef(null);
  const refreshAllRef = useRef(null);
  const refreshMeRef = useRef(null);
  const refreshNotificationsRef = useRef(null);
  const refreshLoadedRef = useRef(false);
  const inProgressRef = useRef(InteractionStatus.None);
  const restartActiveRef = useRef(false);
  const loadErrorRef = useRef(null);

  const refreshInterval = useSelector(getRefreshInterval);
  const restart = useSelector(getRestart);

  const dispatch = useDispatch();
  const { inProgress } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    inProgressRef.current = inProgress;
  }, [inProgress]);

  // Pause all polling while a service restart is in progress; the app is cycling,
  // so these calls would just error, and the restart gate drives recovery itself.
  useEffect(() => {
    restartActiveRef.current = restart.active;
  }, [restart.active]);

  const refreshAll = useCallback(() => {
    if (inProgressRef.current !== InteractionStatus.None) {
      return;
    }

    if (restartActiveRef.current) {
      return;
    }

    (async() => {
      try {
        const result = await dispatch(refreshAllAsync());
        const outcomes = Array.isArray(result.payload) ? result.payload : [];
        const failed = outcomes.find((outcome) => outcome.status === 'rejected');
        const message = failed ? (failed.reason?.message || 'Unable to load data from Azure IPAM.') : null;

        // The failed data is left empty, so say why. Each distinct error is shown once rather
        // than on every refresh while it lasts, and again only after a successful refresh.
        if (message && message !== loadErrorRef.current) {
          enqueueSnackbar(message, { variant: 'error' });
        }

        loadErrorRef.current = message;
      } catch (e) {
        console.log("REFRESH ALL ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
      }
    })();
  }, [dispatch, enqueueSnackbar]);

  const refreshMe = useCallback(() => {
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

  const refreshNotifications = useCallback(() => {
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

  useEffect(() => {
    refreshAllRef.current = refreshAll;
    refreshMeRef.current = refreshMe;
    refreshNotificationsRef.current = refreshNotifications;
  }, [refreshAll, refreshMe, refreshNotifications]);

  useEffect(() => {
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

  useEffect(() => {
    clearInterval(intervalMeRef.current);
    intervalMeRef.current = setInterval(() => refreshMeRef.current(), 60 * 1000);
    return () => {
      clearInterval(intervalMeRef.current);
      intervalMeRef.current = null;
    }
  }, []);

  // The engine reuses recent check results, so polling often only reads them back.
  useEffect(() => {
    clearInterval(intervalNotificationsRef.current);
    intervalNotificationsRef.current = setInterval(() => refreshNotificationsRef.current(), 5 * 60 * 1000);
    return () => {
      clearInterval(intervalNotificationsRef.current);
      intervalNotificationsRef.current = null;
    }
  }, []);

  useEffect(() => {
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

  useEffect(()=>{
    const env = { ...import.meta.env, ...window['env'] }
    console.log("+++WEBSITE_DETAILS+++");
    console.log(env);
    console.log("+++++++++++++++++++++");
  }, []);

  return (null);
}

export default Refresh;
