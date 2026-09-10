// Notification framework constants + mock catalog (UI prototype)
//
// NOTE: The mock catalog below is only used to drive the dev harness so we can
// rapidly prototype the look & feel before the backend providers exist. Each
// entry mirrors the server-side Notification shape we'll produce later.

export const NOTIFICATION_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFORMATION: 'information',
};

export const NOTIFICATION_AUDIENCE = {
  ALL: 'all',
  ADMIN: 'admin',
};

// Relative ranking used for center sorting (highest severity first)
export const SEVERITY_PRIORITY = {
  [NOTIFICATION_SEVERITY.CRITICAL]: 3,
  [NOTIFICATION_SEVERITY.WARNING]: 2,
  [NOTIFICATION_SEVERITY.INFORMATION]: 1,
};

// Map notification severity -> MUI palette color (drives color/icon)
export const SEVERITY_COLOR = {
  [NOTIFICATION_SEVERITY.CRITICAL]: 'error',
  [NOTIFICATION_SEVERITY.WARNING]: 'warning',
  [NOTIFICATION_SEVERITY.INFORMATION]: 'info',
};

// UI-owned copy: the noun phrase shown in the restart gate for a remediation
// that restarts the service, keyed by the notification's stable id. This is
// presentation, so it lives in the UI (the API stays UI-agnostic); unmapped
// notifications fall back to a generic phrase.
export const RESTART_REASON = {
  'registry-migration': 'the registry migration',
  'registry-dev': 'the registry migration',
};

export const DEFAULT_RESTART_REASON = 'the update';

