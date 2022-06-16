import * as React from "react";
import { useSelector } from 'react-redux';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import {
  Box,
  Button,
  Slider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

import {
  getMeAsync,
  getRefreshInterval
} from "../ipam/ipamSlice";

import { updateMe } from "../ipam/ipamAPI";

import { apiRequest } from "../../msal/authConfig";

const marks = [
  {
    value: 5,
    label: "5",
  },
  {
    value: 10,
    label: "10",
  },
  {
    value: 15,
    label: "15",
  },
  {
    value: 30,
    label: "30",
  },
];

export default function UserSettings(props) {
  const { open, handleClose } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [refreshValue, setRefreshValue] = React.useState();
  const [sending, setSending] = React.useState(false);
  const refreshInterval = useSelector(getRefreshInterval);

  const changed = (refreshInterval == refreshValue) ? false : true;

  React.useEffect(()=>{
    setRefreshValue(refreshInterval);
  }, [open]);

  function onSubmit() {
    var body = [
      { "op": "replace", "path": "/apiRefresh", "value": refreshValue }
    ];

    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await updateMe(response.accessToken, body);
        enqueueSnackbar("User settings updated", { variant: "success" });
        await getMeAsync(response.accessToken);
        handleClose();
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error updating refresh timeout", { variant: "error" });
        }
      } finally {
        setSending(false);
      }
    })();
  }

  return (
    <div>
      <Dialog open={open} onClose={handleClose} fullWidth>
        <DialogTitle>
          Settings
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Data refresh interval (minutes):
          </DialogContentText>
          <Box sx={{ p: 1 }}>
            <Slider
              aria-label="Restricted values"
              min={5}
              max={30}
              value={refreshValue}
              step={null}
              valueLabelDisplay="auto"
              marks={marks}
              onChange={(event, newValue) => setRefreshValue(newValue)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!changed || sending}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
