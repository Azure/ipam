import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';

import { Link as RouterLink } from "react-router";

import { isEmpty } from 'lodash-es';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";

import DraggablePaper from '../../../global/DraggablePaper';
import { getEngineURL } from '../../../global/globals';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  Check as CheckIcon,
  ContentCopy as ContentCopyIcon,
  DarkModeOutlined,
  OpenInNew as OpenInNewIcon,
  WbSunnyOutlined,
} from "@mui/icons-material";

import {
  getMeAsync,
  getAdminStatus,
  getDarkMode,
  getRoles,
  getViewSettings,
  setDarkMode,
  updateMeAsync,
} from "../../ipam/ipamSlice";

import { getSetupModeNotification } from "../../notifications/notificationsSlice";
import { SEVERITY_COLOR } from "../../notifications/utils/notificationConstants";

import { fetchRoles, updateMe } from "../../ipam/ipamAPI";
import { copyApiToken, getApiTokenDetails } from "../../../msal/tokenService";
import { getInitials } from "../../../utils/initials";

const ROLES_DOCS_URL = "https://azure.github.io/ipam/#/roles-permissions/README";

// Below this, the token is shown as expiring soon. It matches tokenRenewalOffsetSeconds in authConfig,
// so copying a token in this window gets a new one.
const RENEWAL_WINDOW_MS = 10 * 60 * 1000;
const COPIED_INDICATOR_MS = 2000;

// The tables whose layouts can be saved, by the key they're saved under.
const SAVED_VIEW_LABELS = {
  spaces: "Spaces",
  blocks: "Blocks",
  vnets: "Virtual Networks",
  vhubs: "Virtual Hubs",
  subnets: "Subnets",
  endpoints: "Endpoints",
  networks: "Associations",
  reservations: "Reservations",
  admins: "Admins",
  exclusions: "Exclusions",
  extnetworks: "External Networks",
  extsubnets: "External Subnets",
  extendpoints: "External Endpoints",
};

const TOGGLE_BUTTON_SX = {
  gap: 0.75,
  px: 1.25,
  py: 0.25,
  textTransform: 'none',
  fontSize: '0.875rem',
  lineHeight: 1.75,
};

function formatRemaining(ms) {
  const minutes = Math.floor(ms / 60000);

  if (minutes < 1) {
    return "less than a minute";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function SectionHeading({ children }) {
  return (
    <Typography
      component="h3"
      variant="overline"
      sx={{
        gridColumn: '1 / -1',
        color: 'text.secondary',
        fontWeight: 'bold',
        lineHeight: 1.5,
        mt: 1,
        '&:first-of-type': { mt: 0 },
      }}
    >
      {children}
    </Typography>
  );
}

function Label({ children }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

export default function Profile(props) {
  const { open, handleClose, user, photo } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [committedDarkMode, setCommittedDarkMode] = React.useState(false);
  const [darkModeValue, setDarkModeValue] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const [roleDefinitions, setRoleDefinitions] = React.useState(null);
  const [rolesError, setRolesError] = React.useState(false);

  const [tokenExpiresOn, setTokenExpiresOn] = React.useState(null);
  const [tokenError, setTokenError] = React.useState(false);
  const [tokenCopied, setTokenCopied] = React.useState(false);
  const [copyingToken, setCopyingToken] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  const [confirmingClear, setConfirmingClear] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  const darkModeSetting = useSelector(getDarkMode);
  const roles = useSelector(getRoles);
  const isAdmin = useSelector(getAdminStatus);
  const setupNotification = useSelector(getSetupModeNotification);
  const viewSettings = useSelector(getViewSettings);

  const dispatch = useDispatch();
  const { inProgress } = useMsal();
  const pendingRefreshRef = React.useRef(false);

  // Snapshot the committed setting on open, so Cancel can undo the live preview.
  const [prevOpen, setPrevOpen] = React.useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);

    if (open) {
      setCommittedDarkMode(darkModeSetting);
      setDarkModeValue(darkModeSetting);
      setConfirmingClear(false);
    }
  }

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    let canceled = false;

    setRoleDefinitions(null);
    setRolesError(false);

    fetchRoles()
      .then((data) => {
        if (!canceled) {
          setRoleDefinitions(data);
        }
      })
      .catch((e) => {
        console.log("ERROR FETCHING ROLES");
        console.log(e);

        if (!canceled) {
          setRolesError(true);
        }
      });

    return () => {
      canceled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    let canceled = false;

    setTokenExpiresOn(null);
    setTokenError(false);
    setNow(Date.now());

    getApiTokenDetails()
      .then(({ expiresOn }) => {
        if (!canceled) {
          setTokenExpiresOn(expiresOn);
        }
      })
      .catch((e) => {
        console.log("ERROR READING TOKEN EXPIRY");
        console.log(e);

        if (!canceled) {
          setTokenError(true);
        }
      });

    const timer = setInterval(() => setNow(Date.now()), 15000);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [open]);

  React.useEffect(() => {
    if (!tokenCopied) {
      return undefined;
    }

    const timer = setTimeout(() => setTokenCopied(false), COPIED_INDICATOR_MS);

    return () => clearTimeout(timer);
  }, [tokenCopied]);

  React.useEffect(() => {
    if (pendingRefreshRef.current && inProgress === InteractionStatus.None) {
      pendingRefreshRef.current = false;
      dispatch(getMeAsync());
    }
  }, [inProgress, dispatch]);

  const changed = darkModeValue !== committedDarkMode;

  const savedViews = Object.keys(SAVED_VIEW_LABELS).filter((key) => viewSettings && key in viewSettings);
  const customizedViews = savedViews.filter((key) => !isEmpty(viewSettings[key]));
  const viewCount = customizedViews.length;

  const heldRoles = roles.map((id) => roleDefinitions?.find((role) => role.id === id) ?? { id, name: id, description: "" });
  const descriptions = heldRoles.map((role) => role.description).filter(Boolean);
  const rolesLoading = !roleDefinitions && !rolesError;

  const remainingMs = tokenExpiresOn ? tokenExpiresOn.getTime() - now : 0;
  const expiringSoon = remainingMs < RENEWAL_WINDOW_MS;

  // The setup notification is the source of truth, so Profile matches the bell in color and destination.
  const setupColor = SEVERITY_COLOR[setupNotification?.severity] ?? "warning";
  const setupAction = setupNotification?.actions?.find((action) => action.kind === "navigate");

  // Role IDs are opaque, so emphasis follows the caller's access rather than any particular role.
  const chipColor = () => {
    if (!isAdmin) {
      return "default";
    }

    return setupNotification ? setupColor : "primary";
  };

  const handleCancel = () => {
    dispatch(setDarkMode(committedDarkMode));
    handleClose();
  };

  const handleDarkModeChange = (event, value) => {
    // An exclusive group reports null when the selected option is clicked again.
    if (value === null) {
      return;
    }

    dispatch(setDarkMode(value));
    setDarkModeValue(value);
  };

  const handleApply = async () => {
    try {
      setSending(true);
      await updateMe([
        { "op": "replace", "path": "/darkMode", "value": darkModeValue }
      ]);
      enqueueSnackbar("Preferences updated", { variant: "success" });
      setCommittedDarkMode(darkModeValue);

      if (inProgress === InteractionStatus.None) {
        dispatch(getMeAsync());
      } else {
        pendingRefreshRef.current = true;
      }

      handleClose();
    } catch (e) {
      console.log("ERROR UPDATING PREFERENCES");
      console.log(e);
      enqueueSnackbar("Error updating preferences", { variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const handleCopyToken = async () => {
    if (inProgress !== InteractionStatus.None) {
      enqueueSnackbar("Authentication in progress, please wait and try again", { variant: "info" });
      return;
    }

    try {
      setCopyingToken(true);
      const expiresOn = await copyApiToken();
      setTokenExpiresOn(expiresOn);
      setTokenError(false);
      setNow(Date.now());
      setTokenCopied(true);
      enqueueSnackbar("Token copied to clipboard!", { variant: "success" });
    } catch (e) {
      console.log("ERROR REQUESTING TOKEN");
      console.log(e);
      enqueueSnackbar("Error fetching access token", { variant: "error" });
    } finally {
      setCopyingToken(false);
    }
  };

  const handleClearViews = async () => {
    const body = savedViews.map((key) => ({ "op": "remove", "path": `/views/${key}` }));

    try {
      setClearing(true);
      await dispatch(updateMeAsync({ body })).unwrap();
      setConfirmingClear(false);
      enqueueSnackbar("Saved views cleared", { variant: "success" });
    } catch (e) {
      console.log("ERROR CLEARING SAVED VIEWS");
      console.log(e);
      enqueueSnackbar("Error clearing saved views", { variant: "error" });
    } finally {
      setClearing(false);
    }
  };

  const renderRoles = () => {
    if (rolesLoading) {
      return (
        <>
          <Skeleton variant="rounded" width={88} height={24} />
          <Box sx={{ gridColumn: 2 }}>
            <Skeleton variant="text" />
            <Skeleton variant="text" width="60%" />
          </Box>
        </>
      );
    }

    if (rolesError) {
      return <Typography variant="body2">Unavailable</Typography>;
    }

    return (
      <>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {heldRoles.map((role) => (
            <Chip key={role.id} size="small" variant="outlined" color={chipColor()} label={role.name} />
          ))}
        </Box>
        <Typography variant="body2" sx={{ gridColumn: 2, color: 'text.secondary', mt: -0.25 }}>
          {descriptions.join(" ")}{descriptions.length > 0 && " "}
          <Link
            href={ROLES_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, whiteSpace: 'nowrap' }}
          >
            Learn more
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </Link>
        </Typography>
      </>
    );
  };

  const renderTokenExpiry = () => {
    if (tokenError) {
      return <Typography variant="body2">Unavailable</Typography>;
    }

    if (!tokenExpiresOn) {
      return <Skeleton variant="text" width={120} />;
    }

    const tooltip = `Expires at ${tokenExpiresOn.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      + (expiringSoon ? ". Copying gets a new token." : "");

    return (
      <Tooltip title={tooltip}>
        <Typography
          variant="body2"
          sx={{ cursor: 'default', color: expiringSoon ? 'warning.main' : 'text.primary' }}
        >
          {remainingMs > 0 ? `Expires in ${formatRemaining(remainingMs)}` : "Expired"}
        </Typography>
      </Tooltip>
    );
  };

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleCancel}
        PaperComponent={DraggablePaper}
        aria-labelledby="draggable-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
          Azure IPAM Profile
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={photo ?? undefined}
              alt={user?.displayName ?? ""}
              sx={{ width: 72, height: 72, fontSize: 28, flexShrink: 0 }}
            >
              {getInitials(user?.displayName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" noWrap title={user?.displayName} sx={{ lineHeight: 1.3 }}>
                {user?.displayName}
              </Typography>
              <Typography variant="body2" noWrap title={user?.userPrincipalName} sx={{ color: 'text.secondary' }}>
                {user?.userPrincipalName}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 3,
              rowGap: 1,
              alignItems: 'center',
              mt: 3,
            }}
          >
            <SectionHeading>Access</SectionHeading>

            <Label>{roles.length > 1 ? "Roles" : "Role"}</Label>
            {renderRoles()}
            {setupNotification && isAdmin && (
              <Alert severity={setupColor} variant="outlined" sx={{ gridColumn: '1 / -1', py: 0, mt: 0.5 }}>
                <Typography variant="body2">
                  <strong>Setup isn&apos;t complete.</strong> You&apos;re an administrator because no administrators have been designated yet, so everyone is treated as one.
                  {setupAction && (
                    <>
                      {" "}
                      <Link component={RouterLink} to={setupAction.to} onClick={handleCancel} underline="hover">
                        {setupAction.label}
                      </Link>
                    </>
                  )}
                </Typography>
              </Alert>
            )}

            <Label>API token</Label>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 32 }}>
              {renderTokenExpiry()}
              <Box sx={{ display: 'flex', alignItems: 'center', mr: -0.5 }}>
                <Tooltip title={tokenCopied ? "Copied" : "Copy token"}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label="copy API token"
                      disabled={copyingToken}
                      onClick={handleCopyToken}
                    >
                      {tokenCopied
                        ? <CheckIcon fontSize="small" color="success" />
                        : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Open API docs">
                  <IconButton
                    size="small"
                    aria-label="open API docs"
                    href={`${getEngineURL()}/api/docs`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <SectionHeading>Preferences</SectionHeading>

            <Label>Appearance</Label>
            <Box>
              <ToggleButtonGroup
                size="small"
                color="primary"
                value={darkModeValue}
                exclusive
                onChange={handleDarkModeChange}
                aria-label="Appearance"
              >
                <ToggleButton value={false} sx={TOGGLE_BUTTON_SX}>
                  <WbSunnyOutlined fontSize="small" />Light
                </ToggleButton>
                <ToggleButton value={true} sx={TOGGLE_BUTTON_SX}>
                  <DarkModeOutlined fontSize="small" />Dark
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Label>Saved views</Label>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 32 }}>
              {confirmingClear ? (
                <>
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    Clear {viewCount} saved {viewCount === 1 ? "view" : "views"}?
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Button size="small" autoFocus disabled={clearing} onClick={() => setConfirmingClear(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      disableElevation
                      loading={clearing}
                      onClick={handleClearViews}
                    >
                      Clear
                    </Button>
                  </Box>
                </>
              ) : (
                <>
                  {viewCount > 0 ? (
                    <Tooltip title={customizedViews.map((key) => SAVED_VIEW_LABELS[key]).join(", ")}>
                      <Typography variant="body2" sx={{ cursor: 'default' }}>
                        {viewCount} {viewCount === 1 ? "table" : "tables"} customized
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      None
                    </Typography>
                  )}
                  <Button
                    size="small"
                    disabled={viewCount === 0}
                    onClick={() => setConfirmingClear(true)}
                    sx={{ flexShrink: 0 }}
                  >
                    Clear all
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleApply} loading={sending} disabled={!changed}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
