import * as React from "react";
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
  Link,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";

import { OpenInNew as OpenInNewIcon } from "@mui/icons-material";

import ipamLogo from '../../../img/logo/logo.png';

import { fetchStatus } from "../../ipam/ipamAPI";
import { getUpdateNotification } from "../../notifications/notificationsSlice";

dayjs.extend(localizedFormat);

const RELEASES_URL = "https://github.com/Azure/ipam/releases";
const DOCS_URL = "https://azure.github.io/ipam/";

// Friendly names for the engine's DEPLOYMENT_STACK values.
const STACK_LABELS = {
  AppContainer: "App Service (Container)",
  AppNative: "App Service (Native)",
  FunctionContainer: "Function App (Container)",
  FunctionNative: "Function App (Native)",
  LegacyCompose: "App Service (Docker Compose)",
  ContainerApp: "Container Apps",
  Kubernetes: "Kubernetes",
  Docker: "Docker",
};

const CLOUD_LABELS = {
  AZURE_PUBLIC: "Azure Public",
  AZURE_US_GOV: "Azure US Government",
  AZURE_US_GOV_SECRET: "Azure US Government Secret",
  AZURE_GERMANY: "Azure Germany",
  AZURE_CHINA: "Azure China",
};

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

  const [status, setStatus] = React.useState(null);
  const [loadError, setLoadError] = React.useState(false);

  const updateNotification = useSelector(getUpdateNotification);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;

    setStatus(null);
    setLoadError(false);

    fetchStatus()
      .then((data) => {
        if (!cancelled) {
          setStatus(data);
        }
      })
      .catch((e) => {
        console.log("ERROR FETCHING STATUS");
        console.log(e);

        if (!cancelled) {
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
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
      value: describe((s) => STACK_LABELS[s.stack] ?? s.stack ?? NOT_APPLICABLE),
    },
    {
      label: "Base image",
      value: describe((s) => s.container?.image_pretty_name ?? NOT_APPLICABLE),
    },
    {
      label: "Cloud",
      value: describe((s) => CLOUD_LABELS[s.environment] ?? s.environment ?? NOT_APPLICABLE),
    },
    {
      label: "Running since",
      value: describe((s) => (s.start_time ? dayjs(s.start_time).format("lll") : NOT_APPLICABLE)),
    },
  ];

  const version = status?.version;
  const latestVersion = updateNotification?.data?.latestVersion;

  const releaseNotesUrl = version ? `${RELEASES_URL}/tag/v${version}` : RELEASES_URL;

  const links = [
    { label: "Release notes", href: releaseNotesUrl },
    { label: "Documentation", href: DOCS_URL },
  ];

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
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 3,
              rowGap: 1,
              alignItems: 'center',
              mt: 3,
              mb: 0,
            }}
          >
            {details.map((detail) => (
              <React.Fragment key={detail.label}>
                <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
                  {detail.label}
                </Typography>
                <DetailValue loading={loading} value={detail.value} />
              </React.Fragment>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 3 }}>
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="body2"
                underline="hover"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
              >
                {link.label}
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </Link>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
