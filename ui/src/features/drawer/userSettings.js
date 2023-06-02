import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';

import { isEqual } from 'lodash';

import { useSnackbar } from "notistack";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  // CircularProgress
} from "@mui/material";

import {
  WbSunnyOutlined,
  DarkModeOutlined,
} from "@mui/icons-material";

import LoadingButton from '@mui/lab/LoadingButton';

import {
  getMeAsync,
  getRefreshInterval,
  getDarkMode,
  setDarkMode
} from "../ipam/ipamSlice";

import { updateMe } from "../ipam/ipamAPI";

export default function UserSettings(props) {
  const { open, handleClose } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [prevOpen, setPrevOpen] = React.useState(false);
  const [openState, setOpenState] = React.useState({});
  const [refreshValue, setRefreshValue] = React.useState();
  const [darkModeValue, setDarkModeValue] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const darkModeSetting = useSelector(getDarkMode);
  const refreshInterval = useSelector(getRefreshInterval);

  const dispatch = useDispatch();

  const changed = React.useMemo(() => {
    const currentState = {
      darkMode: darkModeValue,
      apiRefresh: refreshValue
    };

    return(!isEqual(openState, currentState));
  },[darkModeValue, refreshValue, openState]);

  React.useEffect(()=>{
    if(!open && (open !== prevOpen)) {
      dispatch(setDarkMode(openState.darkMode));
      setRefreshValue(openState.apiRefresh);
      setPrevOpen(open);
    }
  }, [open, prevOpen, openState, dispatch]);

  React.useEffect(()=>{
    if(open && (open !== prevOpen)) {
      setDarkModeValue(darkModeSetting);
      setRefreshValue(refreshInterval);

      setOpenState(
        {
          darkMode: darkModeSetting,
          apiRefresh: refreshInterval
        }
      );

      setPrevOpen(open);
    }
  }, [open, prevOpen, darkModeSetting, refreshInterval]);

  function onSubmit() {
    var body = [
      { "op": "replace", "path": "/apiRefresh", "value": refreshValue },
      { "op": "replace", "path": "/darkMode", "value": darkModeValue }
    ];

    (async () => {
      try {
        setSending(true);
        await updateMe(body);
        enqueueSnackbar("User settings updated", { variant: "success" });
        setOpenState(
          {
            darkMode: darkModeValue,
            apiRefresh: refreshValue
          }
        );
        dispatch(getMeAsync());
        handleClose();
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar("Error updating user settings", { variant: "error" });
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
          {/* <Box sx={{ display: 'flex', flexDirection: 'row', height: '32px', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', marginRight: 'auto' }}>
              Settings
            </Box>
            <Box sx={{ display: 'flex', visibility: sending ? 'visible' : 'hidden' }}>
              <CircularProgress size={32} />
            </Box>
          </Box> */}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ 
              pt: 1,
              pb: 2,
              pl: 2,
              pr: 2,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid lightgrey',
              borderRadius: '4px'
            }}
          >
            <Typography
              variant="button"
              sx={{
                pb: 1,
                pl: 0.5,
                fontWeight: 'bold'
              }}
            >
              UI MODE
            </Typography>
            <ToggleButtonGroup
              size="small"
              color="primary"
              value={darkModeValue}
              exclusive
              onChange={(event, newValue) => {dispatch(setDarkMode(newValue)); setDarkModeValue(newValue)}}
              aria-label="Platform"
            >
              <ToggleButton value={false}>
                <WbSunnyOutlined />&nbsp;Light
              </ToggleButton>
              <ToggleButton value={true}>
                <DarkModeOutlined />&nbsp;Dark
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <LoadingButton onClick={onSubmit} loading={sending} disabled={!changed}>
            Apply
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
