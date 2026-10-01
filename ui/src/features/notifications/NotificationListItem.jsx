import React from 'react';
import { useSelector } from 'react-redux';

import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import CloseIcon from '@mui/icons-material/Close';

import { getSeverityColor, SeverityIcon } from './utils/severityMeta';
import { getIsRead } from './notificationsSlice';

// A flat Material row: a leading unread dot, a severity-colored icon, and the
// title (clamped to two lines, uniform row height). Severity is conveyed by the
// icon color; unread by the leading dot + a bolder title. Read rows are plain.
function NotificationListItem({ notification, onOpen, onDismiss }) {
  const color = getSeverityColor(notification.severity);
  const isRead = useSelector((state) => getIsRead(state, notification.id));

  return (
    <ListItem
      disablePadding
      secondaryAction={
        notification.dismissible ? (
          <Tooltip title="Dismiss">
            <IconButton
              edge="end"
              size="small"
              aria-label="dismiss notification"
              onClick={(event) => {
                event.stopPropagation();
                onDismiss(notification);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null
      }
    >
      <ListItemButton
        onClick={() => onOpen(notification)}
        alignItems="center"
        sx={{ px: 2, py: 1, pr: notification.dismissible ? 6 : 2, minHeight: 56 }}
      >
        <Box sx={{ width: 10, mr: 1, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {!isRead && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${color}.main` }} />
          )}
        </Box>
        <ListItemIcon sx={{ minWidth: 36, color: `${color}.main` }}>
          <SeverityIcon severity={notification.severity} fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={notification.title}
          secondary={notification.message}
          slotProps={{
            primary: {
              variant: 'body2',
              sx: {
                fontWeight: isRead ? 400 : 600,
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              },
            },
            secondary: {
              variant: 'caption',
              sx: {
                color: 'text.secondary',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              },
            },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

export default NotificationListItem;
