import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';

import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { SpinnerCircular } from 'spinners-react';

import { getRestart, endServiceRestart } from './restartSlice';
import { fetchStatus } from '../ipam/ipamAPI';

// --- Recovery detection ---------------------------------------------------
const POLL_INTERVAL_MS = 5000; // how often to poll /api/status
const SLOW_SEC = 180; // surface the escape hatch (a restart — image pull or zip deploy — realistically takes 1-3 min)
const TIMEOUT_SEC = 300; // declare the service unreachable after this

// Full-screen blocking overlay shown while the backend service restarts (e.g.
// after a registry migration or an in-app update). The live SPA stays in memory
// and drives the wait, then reloads to pick up the new build.
//
// Recovery detection polls /api/status and keys off a changed start time
// (restart confirmation) and, for updates, a changed version.
function ServiceRestartGate() {
  const dispatch = useDispatch();
  const { active, reason, verify } = useSelector(getRestart);
  const { inProgress } = useMsal();

  const [phase, setPhase] = React.useState('restarting');
  const [elapsed, setElapsed] = React.useState(0);
  const [failureReason, setFailureReason] = React.useState(null);
  const baselineRef = React.useRef(null);
  const inProgressRef = React.useRef(InteractionStatus.None);

  // Keep the latest MSAL interaction status readable inside the poll interval
  // without re-subscribing the poller when it changes.
  React.useEffect(() => {
    inProgressRef.current = inProgress;
  }, [inProgress]);

  // Reset + elapsed ticker whenever a restart begins.
  React.useEffect(() => {
    if (!active) {
      return undefined;
    }

    setPhase('restarting');
    setElapsed(0);
    setFailureReason(null);
    baselineRef.current = null;

    const ticker = setInterval(() => setElapsed((value) => value + 1), 1000);

    return () => clearInterval(ticker);
  }, [active]);

  // Recovery detection: poll /api/status and key off a changed start time
  // (restart confirmation) and, when requested, a changed version (update verify).
  React.useEffect(() => {
    if (!active) {
      return undefined;
    }

    let cancelled = false;
    let sawDown = false;

    const poll = async () => {
      try {
        const status = await fetchStatus();

        if (cancelled) {
          return;
        }

        // Capture the pre-restart baseline on the first successful read.
        if (!baselineRef.current) {
          baselineRef.current = {
            startTime: status.start_time ?? null,
            version: status.version ?? null,
          };
          return;
        }

        const baseline = baselineRef.current;
        const restarted = sawDown || (status.start_time ?? null) !== baseline.startTime;

        if (!restarted) {
          return;
        }

        // Recovered. For an update, require the version to have advanced too.
        if (verify === 'version' && (status.version ?? null) === baseline.version) {
          setFailureReason('stale-version');
          setPhase('failed');
          return;
        }

        // Don't reload mid-interaction: interrupting an MSAL redirect orphans the
        // interaction lock. Recovery stays true, so the next poll retries when idle.
        setPhase('reloading');

        if (inProgressRef.current === InteractionStatus.None) {
          window.location.reload();
        }
      } catch {
        // Unreachable window = the service is cycling; note it and keep waiting.
        sawDown = true;

        if (!cancelled) {
          setPhase('restarting');
        }
      }
    };

    poll();
    const poller = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(poller);
    };
  }, [active, verify]);

  // Real timeout: we never stop polling on the user's behalf, but past the
  // timeout the prolonged render state acknowledges something may be wrong and
  // offers a deliberate manual reload (see below). No phase change here.

  if (!active) {
    return null;
  }

  const handleManualReload = () => {
    window.location.reload();
  };

  const phaseCopy = {
    restarting: {
      title: 'Applying changes\u2026',
      subtitle: `Azure IPAM is restarting to apply ${reason}. This can take a few minutes \u2014 please keep this window open.`,
    },
    verifying: {
      title: 'Verifying the update\u2026',
      subtitle: 'The service is back online. Confirming the new version is running.',
    },
    reloading: {
      title: 'Reloading\u2026',
      subtitle: 'Loading the latest version of Azure IPAM.',
    },
  };

  const failureCopy = {
    'stale-version': {
      title: 'The update may not have applied',
      subtitle:
        'The service restarted but is still reporting the previous version. The update may have failed to install correctly.',
    },
  };

  const isFailed = phase === 'failed';
  const slowThreshold = SLOW_SEC;
  const timeoutThreshold = TIMEOUT_SEC;

  // Past the timeout we keep polling on the user's behalf, but acknowledge that
  // something may be wrong and offer a deliberate manual "try it anyway".
  const prolonged = phase === 'restarting' && elapsed >= timeoutThreshold;

  // Calm, time-keyed reassurance while restarting — phrases at intervals instead
  // of a raw seconds counter ticking up. The slow escape hatch takes over later.
  let waitPhrase = null;

  if (phase === 'restarting' && elapsed < slowThreshold) {
    if (elapsed >= 90) {
      waitPhrase = 'Still working — this can take a couple of minutes.';
    } else if (elapsed >= 30) {
      waitPhrase = 'Hang tight while the service comes back online…';
    }
  }

  return (
    <Backdrop
      open
      sx={{
        zIndex: (theme) => theme.zIndex.tooltip + 100,
        color: '#fff',
        flexDirection: 'column',
        textAlign: 'center',
        px: 3,
        backgroundColor: 'rgba(15, 23, 33, 0.92)',
      }}
    >
      {isFailed ? (
        <WarningAmberIcon sx={{ fontSize: 72, color: 'warning.main', mb: 2 }} />
      ) : (
        <SpinnerCircular
          size={110}
          thickness={120}
          speed={120}
          color="#33ccff"
          secondaryColor="rgba(255,255,255,0.2)"
        />
      )}

      <Typography variant="h6" sx={{ mt: 3, fontWeight: 600 }}>
        {isFailed ? failureCopy[failureReason]?.title : phaseCopy[phase]?.title}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, maxWidth: 440, color: 'rgba(255,255,255,0.8)' }}>
        {isFailed ? failureCopy[failureReason]?.subtitle : phaseCopy[phase]?.subtitle}
      </Typography>

      {phase === 'restarting' && waitPhrase && (
        <Typography variant="caption" sx={{ mt: 2, color: 'rgba(255,255,255,0.6)' }}>
          {waitPhrase}
        </Typography>
      )}

      {phase === 'restarting' && elapsed >= slowThreshold && !prolonged && (
        <Typography variant="body2" sx={{ mt: 3, maxWidth: 440, color: 'rgba(255,255,255,0.8)' }}>
          This is taking longer than usual. We&apos;ll bring you back automatically as soon as Azure IPAM is online.
        </Typography>
      )}

      {prolonged && (
        <Box sx={{ mt: 3, maxWidth: 460 }}>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'rgba(255,255,255,0.8)' }}>
            This is taking longer than expected — something may have gone wrong. We&apos;ll keep
            checking on your behalf. If you believe Azure IPAM is already back, you can try reloading.
          </Typography>
          <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button variant="contained" color="primary" disableElevation onClick={handleManualReload}>
              Try it anyway
            </Button>
            <Button variant="outlined" color="inherit" onClick={() => dispatch(endServiceRestart())}>
              Dismiss
            </Button>
          </Stack>
        </Box>
      )}

      {isFailed && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button variant="contained" color="primary" disableElevation onClick={handleManualReload}>
            Reload now
          </Button>
          <Button variant="outlined" color="inherit" onClick={() => dispatch(endServiceRestart())}>
            Dismiss
          </Button>
        </Stack>
      )}
    </Backdrop>
  );
}

export default ServiceRestartGate;
