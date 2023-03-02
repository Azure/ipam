import * as React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import {
  Box,
  Button,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  CircularProgress
} from "@mui/material";

// import { deleteSpace } from "../../../ipam/ipamAPI";

import { deleteSpaceAsync } from "../../../ipam/ipamSlice";

import { apiRequest } from '../../../../msal/authConfig';

const Spotlight = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.mode === 'dark' ? 'cornflowerblue' : 'mediumblue'
}));

export default function ConfirmDelete(props) {
  const { open, handleClose, space } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [force, setForce] = React.useState(false);
  const [verify, setVerify] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const handleForce = (event) => {
    setForce(event.target.checked);
  };

  const checkForce = () => {
    if(force & !verify) {
      setVerify(true);
    } else {
      const request = {
        scopes: apiRequest.scopes,
        account: accounts[0],
      };
  
      (async () => {
        try {
          setSending(true);
          const response = await instance.acquireTokenSilent(request);
          // await deleteSpace(response.accessToken, space, force);
          await dispatch(deleteSpaceAsync({ token: response.accessToken, space: space, force: force}));
          enqueueSnackbar("Successfully removed Space", { variant: "success" });
          // refresh();
          handleCancel();
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) {
            instance.acquireTokenRedirect(request);
          } else {
            console.log("ERROR");
            console.log("------------------");
            console.log(e);
            console.log("------------------");
            enqueueSnackbar(e.error, { variant: "error" });
          }
        } finally {
          setSending(false);
        }
      })();
    }
  };

  const handleCancel = () => {
    setForce(false);
    setVerify(false);
    handleClose();
  };

  return (
    <div>
      <Dialog open={open} onClose={handleCancel}>
        <DialogTitle>
          <Box sx={{ display: 'flex', flexDirection: 'row', height: '32px', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', marginRight: 'auto' }}>
              Delete Space
            </Box>
            <Box sx={{ display: 'flex', visibility: sending ? 'visible' : 'hidden' }}>
              <CircularProgress size={32} />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please confirm you want to delete Space <Spotlight>'{space}'</Spotlight>
          </DialogContentText>
          <Box sx={{ display: "flex", justifyContent: "center", width: "100%", pt: 3 }}>
            <FormGroup sx={{ pl: 2.5, pr: 1, border: "1px solid rgba(224, 224, 224, 1)", borderRadius: "4px" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={force}
                    disabled={verify || sending}
                    onChange={handleForce}
                  />
                }
                label="Force Delete"
                sx={{ color: "red" }}
              />
            </FormGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            onClick={checkForce}
            color={verify ? "error" : "primary" }
            disabled={sending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
