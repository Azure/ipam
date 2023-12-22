import * as React from "react";
// import { useSelector, useDispatch } from 'react-redux';

// import { isEqual } from 'lodash';

// import { useSnackbar } from "notistack";

import Draggable from 'react-draggable';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  // ToggleButton,
  // ToggleButtonGroup,
  Paper
} from "@mui/material";

// import {
//   WbSunnyOutlined,
//   DarkModeOutlined,
// } from "@mui/icons-material";

// import LoadingButton from '@mui/lab/LoadingButton';

// import {
//   getMeAsync,
//   getRefreshInterval,
//   getDarkMode,
//   setDarkMode
// } from "../ipam/ipamSlice";

// import { updateMe } from "../ipam/ipamAPI";

function DraggablePaper(props) {
  const nodeRef = React.useRef(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle="#draggable-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
      bounds="parent"
    >
      <Paper {...props} ref={nodeRef}/>
    </Draggable>
  );
}

export default function About(props) {
  const { open, handleClose } = props;

  // const { enqueueSnackbar } = useSnackbar();

  // const [prevOpen, setPrevOpen] = React.useState(false);
  // const [openState, setOpenState] = React.useState({});
  // const [refreshValue, setRefreshValue] = React.useState();
  // const [darkModeValue, setDarkModeValue] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // const darkModeSetting = useSelector(getDarkMode);
  // const refreshInterval = useSelector(getRefreshInterval);

  // const dispatch = useDispatch();

  // const changed = React.useMemo(() => {
  //   const currentState = {
  //     darkMode: darkModeValue,
  //     apiRefresh: refreshValue
  //   };

  //   return(!isEqual(openState, currentState));
  // },[darkModeValue, refreshValue, openState]);

  // React.useEffect(()=>{
  //   if(!open && (open !== prevOpen)) {
  //     dispatch(setDarkMode(openState.darkMode));
  //     setRefreshValue(openState.apiRefresh);
  //     setPrevOpen(open);
  //   }
  // }, [open, prevOpen, openState, dispatch]);

  // React.useEffect(()=>{
  //   if(open && (open !== prevOpen)) {
  //     setDarkModeValue(darkModeSetting);
  //     setRefreshValue(refreshInterval);

  //     setOpenState(
  //       {
  //         darkMode: darkModeSetting,
  //         apiRefresh: refreshInterval
  //       }
  //     );

  //     setPrevOpen(open);
  //   }
  // }, [open, prevOpen, darkModeSetting, refreshInterval]);

  function onSubmit() {
    console.log("Submit");
    // var body = [
    //   { "op": "replace", "path": "/apiRefresh", "value": refreshValue },
    //   { "op": "replace", "path": "/darkMode", "value": darkModeValue }
    // ];

    // (async () => {
    //   try {
    //     setSending(true);
    //     await updateMe(body);
    //     enqueueSnackbar("User settings updated", { variant: "success" });
    //     setOpenState(
    //       {
    //         darkMode: darkModeValue,
    //         apiRefresh: refreshValue
    //       }
    //     );
    //     dispatch(getMeAsync());
    //     handleClose();
    //   } catch (e) {
    //     console.log("ERROR");
    //     console.log("------------------");
    //     console.log(e);
    //     console.log("------------------");
    //     enqueueSnackbar("Error updating user settings", { variant: "error" });
    //   } finally {
    //     setSending(false);
    //   }
    // })();
  }

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleClose}
        PaperComponent={DraggablePaper}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
          About
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="button"
            sx={{
              pt: 2,
              pb: 1,
              pl: 0.5,
              fontWeight: 'bold',
              textDecoration: 'underline'
            }}
          >
            IPAM DETAILS
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              mt: 1,
              pl: 0.5
            }}
          >
            Current Version: v2.0.0
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              pl: 0.5
            }}
          >
            Runtime: Native Code
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              pl: 0.5
            }}
          >
            Framework: Azure App Service
          </Typography>
          <Box
            sx={{
              mt: 4,
              display: 'flex',
              width: '100%',
              justifyContent: 'center'
            }}
          >
            <Button
              // variant="outlined"
              variant="contained"
              sx={{
                width: '250px',
                textTransform: 'none'
              }}
            >
              UPDATE TO v2.0.1 {/* Check for Updates */}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>OK</Button>
          {/* <LoadingButton onClick={onSubmit} loading={sending} disabled={!changed}> */}
          {/* <LoadingButton onClick={onSubmit} loading={sending} >
            Apply
          </LoadingButton> */}
        </DialogActions>
      </Dialog>
    </div>
  );
}
