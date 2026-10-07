import React from 'react';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';

import { SEVERITY_COLOR } from './notificationConstants';

// Maps an MUI palette color (error | warning | info) to its icon.
const SEVERITY_ICON = {
  info: InfoOutlinedIcon,
  warning: WarningAmberIcon,
  error: ErrorIcon,
};

// Resolve the MUI palette color for a notification severity. The returned value
// doubles as a theme palette color key (info | warning | error).
export function getSeverityColor(severity) {
  return SEVERITY_COLOR[severity] ?? 'info';
}

// Module-scope component so consumers don't create components during render.
// Renders the severity-appropriate icon and forwards any MUI SvgIcon props.
export function SeverityIcon({ severity, ...props }) {
  const icon = SEVERITY_ICON[getSeverityColor(severity)] ?? InfoOutlinedIcon;

  return React.createElement(icon, props);
}
