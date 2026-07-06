import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme, keyframes } from '@mui/material/styles';

import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';

import {
  getActiveNotifications,
  getUnreadCount,
  getWorstNotificationSeverity,
  getNotificationsRefreshing,
  dismissNotification,
  markAllRead,
  markRead,
  fetchNotificationsAsync,
} from './notificationsSlice';
import { getSeverityColor } from './utils/severityMeta';
import NotificationListItem from './NotificationListItem';
import NotificationDetailDialog from './NotificationDetailDialog';
import { NOTIFICATION_SEVERITY } from './utils/notificationConstants';

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.18); }
  100% { transform: scale(1); }
`;

// Always-available home for every advisory: a bell + unread badge in the AppBar
// that opens a flat, severity-ordered list (popover on desktop, full-screen
// sheet on mobile). Selecting a row opens its detail dialog.
function NotificationCenter() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const notifications = useSelector(getActiveNotifications);
  const unread = useSelector(getUnreadCount);
  const worstSeverity = useSelector(getWorstNotificationSeverity);
  const refreshing = useSelector(getNotificationsRefreshing);

  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const [selectedId, setSelectedId] = React.useState(null);
  const selected = notifications.find((n) => n.id === selectedId) ?? null;

  // Subtle, brief attention pulse when an urgent item is present (respects
  // reduced-motion). Deliberately not a forced panel open.
  const urgent = worstSeverity === NOTIFICATION_SEVERITY.CRITICAL;
  const [animate, setAnimate] = React.useState(false);

  React.useEffect(() => {
    if (urgent && !reduceMotion) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 3600);
      return () => clearTimeout(timer);
    }

    setAnimate(false);
    return undefined;
  }, [urgent, reduceMotion]);

  const badgeColor = worstSeverity ? getSeverityColor(worstSeverity) : 'error';

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleDismiss = (notification) => dispatch(dismissNotification(notification.id));

  const handleOpenItem = (notification) => {
    setSelectedId(notification.id);
    dispatch(markRead(notification.id));
    setAnchorEl(null); // close the list popover/sheet; the detail dialog takes over
  };

  const header = (
    <Box
      sx={{
        px: 2,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
        Notifications
      </Typography>
      <Tooltip title="Refresh">
        <span>
          <IconButton
            size="small"
            aria-label="refresh notifications"
            disabled={refreshing}
            onClick={() => dispatch(fetchNotificationsAsync({ manual: true }))}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {unread > 0 && (
        <Tooltip title="Mark all as read">
          <IconButton
            size="small"
            aria-label="mark all as read"
            onClick={() => dispatch(markAllRead())}
          >
            <DoneAllIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {fullScreen && (
        <IconButton size="small" aria-label="close notifications" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );

  const list =
    refreshing ? (
      <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    ) : notifications.length === 0 ? (
      <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
        <NotificationsNoneIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          You&apos;re all caught up.
        </Typography>
      </Box>
    ) : (
      <List disablePadding>
        {notifications.map((notification, index) => (
          <React.Fragment key={notification.id}>
            <NotificationListItem
              notification={notification}
              onOpen={handleOpenItem}
              onDismiss={handleDismiss}
            />
            {index < notifications.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    );

  const panel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: fullScreen ? '100%' : 'auto' }}>
      {header}
      <Divider />
      <Box
        sx={{
          p: 0,
          overflowY: 'auto',
          ...(fullScreen ? { flexGrow: 1 } : { maxHeight: 'min(520px, 70vh)' }),
        }}
      >
        {list}
      </Box>
    </Box>
  );

  return (
    <React.Fragment>
      <Tooltip title="Notifications">
        <IconButton
          size="large"
          color="inherit"
          aria-label={`${unread} unread notifications`}
          onClick={handleOpen}
        >
          <Badge badgeContent={unread} color={badgeColor} overlap="circular">
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                transformOrigin: 'center',
                animation: animate ? `${pulse} 1.2s ease-in-out 3` : 'none',
              }}
            >
              {notifications.length > 0 ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
            </Box>
          </Badge>
        </IconButton>
      </Tooltip>

      {fullScreen ? (
        <Dialog fullScreen open={open} onClose={handleClose}>
          {panel}
        </Dialog>
      ) : (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                width: 420,
                maxWidth: '92vw',
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 2.5,
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 18,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  backgroundImage: (theme) =>
                    `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            },
          }}
        >
          {panel}
        </Popover>
      )}

      <NotificationDetailDialog
        notification={selected}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        onDismiss={handleDismiss}
      />
    </React.Fragment>
  );
}

export default NotificationCenter;
