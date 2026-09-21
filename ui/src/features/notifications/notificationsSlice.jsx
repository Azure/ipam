import { createSlice, createSelector, createAsyncThunk } from '@reduxjs/toolkit';

import { getAdminStatus } from '../ipam/ipamSlice';
import { fetchNotifications, resolveNotification } from '../ipam/ipamAPI';
import { SEVERITY_PRIORITY, NOTIFICATION_AUDIENCE } from './utils/notificationConstants';

const initialState = {
  items: [],     // Notification[] — replaced wholesale by the backend fetch later
  dismissed: [], // archived notification ids (non-destructive; retrievable later)
  readIds: [],   // notification ids the user has seen/acknowledged
  refreshing: false, // true while a user-initiated manual refresh is in flight
};

// Execute a notification action. A 'resolve' action invokes the notification's
// server-owned remediation; the result message is surfaced to the user by the
// caller via a toast.
export const executeNotificationActionAsync = createAsyncThunk(
  'notifications/executeAction',
  async ({ notification, action }) => {
    // Ask the backend to resolve the notification (it owns the remediation logic).
    if (action?.kind === 'resolve') {
      const result = await resolveNotification(notification.id);

      return { message: result?.detail ?? 'Remediation accepted.' };
    }

    return { message: 'Done.' };
  }
);

// Fetch the active notifications from the backend. On success the payload
// replaces the active set; on failure the existing items are left untouched so
// a transient error never blanks the notification center.
export const fetchNotificationsAsync = createAsyncThunk(
  'notifications/fetch',
  async () => {
    const data = await fetchNotifications();

    return data?.notifications ?? [];
  }
);

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Drop a notification from the active set (e.g. after a successful resolve).
    removeNotification: (state, action) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    // --- user interactions ---
    dismissNotification: (state, action) => {
      if (!state.dismissed.includes(action.payload)) {
        state.dismissed.push(action.payload);
      }
    },
    markRead: (state, action) => {
      if (!state.readIds.includes(action.payload)) {
        state.readIds.push(action.payload);
      }
    },
    markAllRead: (state) => {
      const ids = state.items.map((i) => i.id);
      state.readIds = Array.from(new Set([...state.readIds, ...ids]));
    },
  },
  extraReducers: (builder) => {
    builder
      // A manual refresh (dispatched with { manual: true }) shows a spinner while
      // in flight and, on success, resyncs to the server's truth by clearing the
      // local dismissed set. The silent background poll passes no arg, so it just
      // updates the item set without touching dismissals or the spinner.
      .addCase(fetchNotificationsAsync.pending, (state, action) => {
        if (action.meta.arg?.manual) {
          state.refreshing = true;
        }
      })
      .addCase(fetchNotificationsAsync.fulfilled, (state, action) => {
        state.items = action.payload ?? [];

        if (action.meta.arg?.manual) {
          state.dismissed = [];
        }

        state.refreshing = false;
      })
      .addCase(fetchNotificationsAsync.rejected, (state) => {
        state.refreshing = false;
      });
  },
});

export const {
  removeNotification,
  dismissNotification,
  markRead,
  markAllRead,
} = notificationsSlice.actions;

// --- selectors ------------------------------------------------------------
const selectItems = (state) => state.notifications.items;
const selectDismissed = (state) => state.notifications.dismissed;
const selectReadIds = (state) => state.notifications.readIds;

// True while a user-initiated manual refresh is in flight (drives the spinner).
export const getNotificationsRefreshing = (state) => state.notifications.refreshing;

export const getIsRead = (state, id) => state.notifications.readIds.includes(id);

// Active = not dismissed, audience-appropriate; sorted by severity (highest
// first), then most-recent first.
export const getActiveNotifications = createSelector(
  [selectItems, selectDismissed, getAdminStatus],
  (items, dismissed, isAdmin) =>
    items
      .filter((n) => !dismissed.includes(n.id))
      .filter((n) => n.audience !== NOTIFICATION_AUDIENCE.ADMIN || isAdmin)
      .slice()
      .sort((a, b) => {
        const bySeverity = (SEVERITY_PRIORITY[b.severity] ?? 0) - (SEVERITY_PRIORITY[a.severity] ?? 0);
        if (bySeverity !== 0) return bySeverity;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      })
);

// Unread badge count (active + not yet read).
export const getUnreadCount = createSelector(
  [getActiveNotifications, selectReadIds],
  (items, readIds) => items.filter((n) => !readIds.includes(n.id)).length
);

// The worst (highest-priority) severity among active notifications, used to
// color the bell's attention indicator. Returns a severity string or null.
export const getWorstNotificationSeverity = createSelector(
  [getActiveNotifications],
  (items) => (items.length ? items[0].severity : null)
);

export default notificationsSlice.reducer;
