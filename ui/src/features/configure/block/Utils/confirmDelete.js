import * as React from 'react';
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";

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
} from "@mui/material";

import { deleteBlock } from "../../../ipam/ipamAPI";

const Spotlight = styled("span")({
	fontWeight: "bold",
  color: "mediumblue"
});

export default function ConfirmDelete(props) {
  const { open, handleClose, space, block, refresh } = props;

  const { instance, accounts } = useMsal();
	const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const [force, setForce] = React.useState(false);
  const [verify, setVerify] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const handleForce = (event) => {
    setForce(event.target.checked);
  };

  const checkForce = () => {
    if(force & !verify) {
      setVerify(true);
    } else {
      (async () => {
        const request = {
          scopes: ["https://management.azure.com/user_impersonation"],
          account: accounts[0],
        };
  
        try {
          setSending(true);
          const response = await instance.acquireTokenSilent(request);
          const data = await deleteBlock(response.accessToken, space, block, force);
          refresh();
          handleCancel();
        } catch (e) {
          console.log("ERROR");
          console.log("------------------");
          console.log(e.response.data.error);
          console.log("------------------");
          enqueueSnackbar(e.response.data.error, { variant: "error" });
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
          Delete Block
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please confirm you want to delete Block <Spotlight>'{block}'</Spotlight>
          </DialogContentText>
          <Box sx={{ display: "flex", justifyContent: "center", width: "100%", pt: 3 }}>
            <FormGroup sx={{ pl: 1, pr: 1, border: "1px solid rgba(224, 224, 224, 1)", borderRadius: "4px" }}>
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
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
