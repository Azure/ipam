import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import {
  getRefreshInterval,
  refreshAllAsync,
  getMeAsync
} from '../../ipam/ipamSlice';

function Refresh() {
  const intervalAll = React.useRef(null);
  const intervalMe = React.useRef(null);
  const refreshAllRef = React.useRef();
  const refreshMeRef = React.useRef(null);
  const refreshLoadedRef = React.useRef(false);

  const refreshInterval = useSelector(getRefreshInterval);

  const dispatch = useDispatch();

  refreshAllRef.current = React.useCallback(() => {
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
    (async() => {
      try {
        await dispatch(getMeAsync());
      } catch (e) {
        console.log("REFRESM ME ERROR");
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

  React.useEffect(()=>{
    if(!refreshLoadedRef.current) {
      refreshLoadedRef.current = true;
      refreshMeRef.current();
    }
  }, []);

  React.useEffect(()=>{
    const env = { ...import.meta.env, ...window['env'] }
    console.log("+++WEBSITE_DETAILS+++");
    console.log(env);
    console.log("+++++++++++++++++++++");
  }, []);

  return (null);
}

export default Refresh;
