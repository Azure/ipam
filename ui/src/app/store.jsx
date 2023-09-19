import { configureStore } from '@reduxjs/toolkit';
import ipamReducer from '../features/ipam/ipamSlice';

export const store = configureStore({
  reducer: {
    ipam: ipamReducer,
  },
});
