import { configureStore } from '@reduxjs/toolkit';
import ipamReducer from '../features/ipam/ipamSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';
import restartReducer from '../features/restart/restartSlice';

export const store = configureStore({
  reducer: {
    ipam: ipamReducer,
    notifications: notificationsReducer,
    restart: restartReducer,
  },
});
