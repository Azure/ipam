import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useSnackbar } from 'notistack';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import DraggablePaper from '../../global/DraggablePaper';
import { getSeverityColor, SeverityIcon } from './utils/severityMeta';
import { executeNotificationActionAsync, removeNotification } from './notificationsSlice';
import { RESTART_REASON, DEFAULT_RESTART_REASON } from './utils/notificationConstants';
import { getAdminStatus } from '../ipam/ipamSlice';
import { beginServiceRestart } from '../restart/restartSlice';

// Draggable detail view for a single notification. Mirrors the app's existing
// dialog styling (plain title, no divider rules). Server actions report their
// outcome via toast notifications: success resolves + closes; failure keeps the
// notification so it can be addressed again later.
function NotificationDetailDialog({ notification, open, onClose, onDismiss }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const isAdmin = useSelector(getAdminStatus);

  const [submitting, setSubmitting] = React.useState(false);

  const id = notification?.id;

  React.useEffect(() => {
    setSubmitting(false);
  }, [id, open]);

  if (!notification) {
    return null;
  }

  const severity = getSeverityColor(notification.severity);

  const allActions = notification.actions ?? [];
  const docLinks = allActions.filter((a) => a.kind === 'link');
  const resolveActions = allActions.filter((a) => a.kind === 'resolve');
  const navigateActions = allActions.filter((a) => a.kind === 'navigate');

  // Primary CTA(s): resolve actions if present, otherwise navigate actions.
  const primaryActions = resolveActions.length ? resolveActions : navigateActions;
  const secondaryActions = resolveActions.length ? navigateActions : [];

  const submit = async (action) => {
    setSubmitting(true);

    try {
      const result = await dispatch(executeNotificationActionAsync({ notification, action })).unwrap();
      enqueueSnackbar(result?.message ?? action.successText ?? 'Action completed.', { variant: 'success' });
      dispatch(removeNotification(notification.id));
      onClose();

      // A remediation that restarts the service raises the full-screen gate so the
      // user gets clear feedback while the app cycles back up.
      if (action.causesRestart) {
        const reason = RESTART_REASON[notification.id] ?? DEFAULT_RESTART_REASON;
        dispatch(beginServiceRestart({ reason, verify: null }));
      }
    } catch (err) {
      enqueueSnackbar(action.errorText ?? err?.message ?? 'Action failed.', { variant: 'error' });
      setSubmitting(false);
    }
  };

  const handleNavigate = (action) => {
    if (action.to) {
      navigate(action.to);
      onClose();
    }
  };

  const handleFooterAction = (action) =>
    action.kind === 'resolve' ? submit(action) : handleNavigate(action);

  const handleDocLink = (action) => {
    if (action.href) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDismiss = () => {
    onDismiss(notification);
    onClose();
  };

  let footer;

  if (notification.dismissible || primaryActions.length > 0) {
    footer = (
      <React.Fragment>
        {notification.dismissible && (
          <Button color="inherit" disabled={submitting} onClick={handleDismiss}>
            Dismiss
          </Button>
        )}
        {secondaryActions.map((action) => (
          <Button
            key={action.id}
            variant="outlined"
            color="warning"
            disabled={submitting}
            onClick={() => handleFooterAction(action)}
          >
            {action.label}
          </Button>
        ))}
        {primaryActions.map((action) => {
          const blocked = action.requiresAdmin && !isAdmin;

          const button = (
            <Button
              key={action.id}
              variant="contained"
              color="warning"
              disableElevation
              disabled={submitting || blocked}
              startIcon={
                action.kind === 'resolve' && submitting ? (
                  <CircularProgress size={14} color="inherit" />
                ) : null
              }
              onClick={() => handleFooterAction(action)}
            >
              {action.label}
            </Button>
          );

          return blocked ? (
            <Tooltip key={action.id} title="Requires an administrator">
              <span>{button}</span>
            </Tooltip>
          ) : (
            button
          );
        })}
      </React.Fragment>
    );
  } else {
    footer = null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperComponent={DraggablePaper}
      aria-labelledby="draggable-dialog-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="draggable-dialog-title" sx={{ cursor: 'move', pr: 6 }}>
        <Box component="span" sx={{ display: 'block', lineHeight: 1.3 }}>
          {notification.title}
        </Box>
        {notification.category && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <SeverityIcon
              severity={notification.severity}
              sx={{ color: `${severity}.main`, fontSize: 16 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              {notification.category}
            </Typography>
          </Box>
        )}
        <IconButton
          aria-label="close"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1" sx={{ lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {notification.message}
        </Typography>

        {docLinks.length > 0 && (
          <Stack spacing={0.5} sx={{ mt: 2 }}>
            {docLinks.map((action) => (
              <Link
                key={action.id}
                component="button"
                type="button"
                variant="body2"
                underline="hover"
                onClick={() => handleDocLink(action)}
                sx={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {action.label}
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </Link>
            ))}
          </Stack>
        )}
      </DialogContent>

      {footer && <DialogActions sx={{ px: 3, pb: 2 }}>{footer}</DialogActions>}
    </Dialog>
  );
}

export default NotificationDetailDialog;
