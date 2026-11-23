import { Fragment, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";

import DraggablePaper from '../../../global/DraggablePaper';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";

import { useSnackbar } from "notistack";

import ipamLogo from '../../../img/logo/logo.png';

import { fetchStatus } from "../../ipam/ipamAPI";
import { getUpdateNotification } from "../../notifications/notificationsSlice";

import {
  buildIssueUrl,
  formatDiagnostics,
  getCloudLabel,
  getDiagnostics,
  getStackLabel,
} from "./diagnostics";

dayjs.extend(localizedFormat);

const RELEASES_URL = "https://github.com/Azure/ipam/releases";
const DOCS_URL = "https://azure.github.io/ipam/";

const NOT_APPLICABLE = "—";
const UNAVAILABLE = "Unavailable";

// Every row is always rendered (placeholder while loading, "Unavailable" on
// error) so the dialog never changes size once it is open.
function DetailValue({ loading, value }) {
  return (
    <Typography component="dd" variant="body2" sx={{ m: 0 }}>
      {loading ? <Skeleton variant="text" width={180} /> : value}
    </Typography>
  );
}

export default function About(props) {
  const { open, handleClose } = props;

  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const updateNotification = useSelector(getUpdateNotification);

  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let canceled = false;

    setStatus(null);
    setLoadError(false);

    fetchStatus()
      .then((data) => {
        if (!canceled) {
          setStatus(data);
        }
      })
      .catch((e) => {
        console.log("ERROR FETCHING STATUS");
        console.log(e);

        if (!canceled) {
          setLoadError(true);
        }
      });

    return () => {
      canceled = true;
    };
  }, [open]);

  const loading = !status && !loadError;

  const describe = (resolve) => {
    if (loadError) {
      return UNAVAILABLE;
    }

    return status ? resolve(status) : null;
  };

  const details = [
    {
      label: "Platform",
      value: describe((s) => getStackLabel(s.stack) ?? NOT_APPLICABLE),
    },
    {
      label: "Base image",
      value: describe((s) => s.container?.image_pretty_name ?? NOT_APPLICABLE),
    },
    {
      label: "Cloud",
      value: describe((s) => getCloudLabel(s.environment) ?? NOT_APPLICABLE),
    },
    {
      label: "Running since",
      value: describe((s) => (s.start_time ? dayjs(s.start_time).format("lll") : NOT_APPLICABLE)),
    },
  ];

  const version = status?.version;
  const latestVersion = updateNotification?.data?.latestVersion;

  const releaseNotesUrl = version ? `${RELEASES_URL}/tag/v${version}` : RELEASES_URL;

  const diagnostics = getDiagnostics(status);

  const handleCopyDiagnostics = async () => {
    try {
      await window.navigator.clipboard.writeText(formatDiagnostics(diagnostics));
      enqueueSnackbar("Diagnostics copied to clipboard", { variant: "success" });
    } catch (e) {
      console.log("ERROR COPYING DIAGNOSTICS");
      console.log(e);
      enqueueSnackbar("Unable to copy diagnostics to the clipboard", { variant: "error" });
    }
  };

  const links = [
    { label: "Release notes", href: releaseNotesUrl },
    { label: "Documentation", href: DOCS_URL },
    // Disabled until /api/status loads so the report is prefilled.
    { label: "Report an issue", href: buildIssueUrl(diagnostics), disabled: loading },
  ];

  const renderLink = (link) => (
    <Link
      key={link.label}
      href={link.disabled ? undefined : link.href}
      target="_blank"
      rel="noopener noreferrer"
      variant="body2"
      underline="hover"
      aria-disabled={link.disabled || undefined}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        ...(link.disabled && { color: 'text.disabled', pointerEvents: 'none' }),
      }}
    >
      {link.label}
      <OpenInNewIcon sx={{ fontSize: 16 }} />
    </Link>
  );

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleClose}
        PaperComponent={DraggablePaper}
        aria-labelledby="draggable-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
          About Azure IPAM
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src={ipamLogo}
              alt=""
              sx={{ height: 72, width: 'auto', flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ lineHeight: 1.3 }}>
                Azure IPAM
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 0.75 }}>
                <Typography component="div" variant="body2" sx={{ color: 'text.secondary' }}>
                  {loading ? (
                    <Skeleton variant="text" width={48} />
                  ) : (
                    version ? `v${version}` : "Version unavailable"
                  )}
                </Typography>
                {updateNotification && (
                  <Tooltip title="See Notifications for update options">
                    <Typography component="span" variant="body2" sx={{ color: 'info.main' }}>
                      {"· "}{latestVersion ? `v${latestVersion} available` : "Update available"}
                    </Typography>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 3 }}>
            <Box
              component="dl"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 3,
                rowGap: 1,
                alignItems: 'center',
                flexGrow: 1,
                my: 0,
              }}
            >
              {details.map((detail) => (
                <Fragment key={detail.label}>
                  <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
                    {detail.label}
                  </Typography>
                  <DetailValue loading={loading} value={detail.value} />
                </Fragment>
              ))}
            </Box>
            <Tooltip title="Copy diagnostics">
              <Box component="span" sx={{ mt: -0.75, mr: -1 }}>
                <IconButton
                  size="small"
                  aria-label="copy diagnostics"
                  disabled={loading}
                  onClick={handleCopyDiagnostics}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2.5, rowGap: 1, mt: 3 }}>
            {links.map(renderLink)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
