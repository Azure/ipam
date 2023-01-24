import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';

import { isEqual } from 'lodash';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { styled } from '@mui/material/styles';

import {
  Box,
  Button,
  Slider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormGroup,
  FormControlLabel,
  Switch,
  Typography,
  ToggleButton,
  ToggleButtonGroup
} from "@mui/material";

import {
  WbSunnyOutlined,
  DarkModeOutlined,
} from "@mui/icons-material";

import {
  getMeAsync,
  getRefreshInterval,
  getDarkMode,
  setDarkMode
} from "../ipam/ipamSlice";

import { updateMe } from "../ipam/ipamAPI";

import { apiRequest } from "../../msal/authConfig";

const DarkModeSwitch = styled(Switch)(({ theme }) => ({
  width: 62,
  height: 34,
  padding: 7,
  '& .MuiSwitch-switchBase': {
    margin: 1,
    padding: 0,
    transform: 'translateX(6px)',
    '&.Mui-checked': {
      color: '#fff',
      transform: 'translateX(22px)',
      '& .MuiSwitch-thumb:before': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          '#fff',
        )}" d="M8.04,4.86C7.88,5.39,7.8,5.94,7.8,6.5c0,3.14,2.56,5.7,5.7,5.7c0.56,0,1.11-0.08,1.64-0.24c-0.79,2.07-2.8,3.54-5.14,3.54 c-3.03,0-5.5-2.47-5.5-5.5C4.5,7.66,5.97,5.65,8.04,4.86z M10,3c-3.87,0-7,3.13-7,7s3.13,7,7,7s7-3.13,7-7 c0-0.36-0.03-0.72-0.08-1.06C16.16,10,14.91,10.7,13.5,10.7c-2.32,0-4.2-1.88-4.2-4.2c0-1.41,0.7-2.66,1.76-3.42 C10.72,3.03,10.36,3,10,3L10,3z"/></svg>')`,
      },
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
      },
    },
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: theme.palette.mode === 'dark' ? '#003892' : '#001e3c',
    width: 32,
    height: 32,
    '&:before': {
      content: "''",
      position: 'absolute',
      width: '100%',
      height: '100%',
      left: 0,
      top: 0,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
        '#fff',
      )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`,
    },
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
    borderRadius: 20 / 2,
  },
}));

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

  const [prevOpen, setPrevOpen] = React.useState(false);
  const [openState, setOpenState] = React.useState({});
  const [refreshValue, setRefreshValue] = React.useState();
  const [darkModeValue, setDarkModeValue] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const darkModeSetting = useSelector(getDarkMode);
  const refreshInterval = useSelector(getRefreshInterval);

  const dispatch = useDispatch();

  
  // const changed = (refreshInterval === refreshValue) ? false : true;

  const changed = React.useMemo(() => {
    const currentState = {
      darkMode: darkModeValue,
      apiRefresh: refreshValue
    };

    return(!isEqual(openState, currentState));
  },[darkModeValue, refreshValue]);

  React.useEffect(()=>{
    if(!open && (open !== prevOpen)) {
      dispatch(setDarkMode(openState.darkMode));
      setRefreshValue(openState.apiRefresh);
      setPrevOpen(open);
    }
  }, [open, openState]);

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

    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        await updateMe(response.accessToken, body);
        enqueueSnackbar("User settings updated", { variant: "success" });
        setOpenState(
          {
            darkMode: darkModeValue,
            apiRefresh: refreshValue
          }
        );
        dispatch(getMeAsync(response.accessToken));
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
          {/* <Box sx={{ m: 1}}>
            <FormGroup>
              <FormControlLabel
                label={darkModeValue ? "Dark Mode" : "Light Mode"}
                control={
                  <DarkModeSwitch
                    checked={darkModeValue}
                    onChange={(event) => {dispatch(setDarkMode(event.target.checked)); setDarkModeValue(event.target.checked)}}
                    sx={{ m: 1 }}
                  />
                }
              />
            </FormGroup>
          </Box> */}
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
          {/* <Box sx={{ m: 1 }}>
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
          </Box> */}
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
