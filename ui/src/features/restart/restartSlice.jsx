import { createSlice } from '@reduxjs/toolkit';

// Drives the full-screen service-restart gate. The gate component owns the
// timeline; this slice just records that a restart is in progress and how it
// should behave (operation type).
const initialState = {
  active: false,
  reason: 'the update', // human-readable noun phrase shown in the overlay (display only)
  // Optional post-recovery verification for this restart. null = the shared
  // "restart and come back online" flow is sufficient (e.g. migrate). A value
  // such as 'version' adds a verification step (e.g. update). New reasons just
  // supply (or omit) a verify check — no per-reason code paths.
  verify: null,
};

export const restartSlice = createSlice({
  name: 'restart',
  initialState,
  reducers: {
    beginServiceRestart: (state, action) => {
      state.active = true;
      state.reason = action.payload?.reason ?? 'the update';
      state.verify = action.payload?.verify ?? null;
    },
    endServiceRestart: (state) => {
      state.active = false;
    },
  },
});

export const { beginServiceRestart, endServiceRestart } = restartSlice.actions;

export const getRestart = (state) => state.restart;

export default restartSlice.reducer;
