import * as React from "react";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import {
  Box,
  Button,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
} from "@mui/material";

import { createBlock } from "../../../ipam/ipamAPI";

import { apiRequest } from "../../../../msal/authConfig";

export default function AddBlock(props) {
  const { open, handleClose, space, blocks, refresh } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [blockName, setBlockName] = React.useState({ value: "", error: false });
  const [cidr, setCidr] = React.useState({ value: "", error: false });
  const [sending, setSending] = React.useState(false);

  const invalidForm = blockName.value
                      && !blockName.error
                      && cidr.value
                      && !cidr.error ? false : true;

  function onCancel() {
    setBlockName({ value: "", error: false });
    setCidr({ value: "", error: false });
    handleClose();
  }

  function onSubmit() {
    var body = {
      name: blockName.value,
      cidr: cidr.value
    };
  
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await createBlock(response.accessToken, space, body);
        refresh();
        onCancel();
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.response.data.error, { variant: "error" });
        }
      } finally {
        setSending(false);
      }
    })();
  }

  function onNameChange(event) {
    setBlockName({
      value: event.target.value,
      error: validateName(event.target.value),
    });
  }

  function validateName(name) {
    return blocks.some((e) => e.name.toLowerCase() === name.toLowerCase()) ? true : false;
  }

  function onCidrChange(event) {
    setCidr({
      value: event.target.value,
      error: validateCidr(event.target.value),
    });
  }

  function validateCidr(cidr) {
    const regex = new RegExp(
      "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(/(3[0-2]|[1-2][0-9]|[0-9]))$"
    );

    return cidr ? !regex.test(cidr) : false;
  }

  return (
    <div sx={{ height: "300px", width: "100%" }}>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Add Block</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Tooltip
              arrow
              disableFocusListener
              placement="right"
              title={
                <>
                  - Block name must be unique
                  <br />- Can contain alphnumerics
                </>
              }
            >
              <TextField
                autoFocus
                error={blockName.error}
                margin="dense"
                id="name"
                label="Block Name"
                type="name"
                variant="standard"
                sx={{ width: "80%" }}
                value={blockName.value}
                onChange={(event) => {
                  onNameChange(event);
                }}
              />
            </Tooltip>
            <Tooltip
              arrow
              disableFocusListener
              placement="right"
              title={
                <>
                  - Must be in valid CIDR notation format
                  <br />- Example: 1.2.3.4/5
                </>
              }
            >
              <TextField
                error={cidr.error}
                margin="dense"
                id="name"
                label="Block CIDR"
                type="cidr"
                variant="standard"
                value={cidr.value}
                onChange={(event) => onCidrChange(event)}
                sx={{ width: "80%" }}
              />
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={onSubmit} disabled={invalidForm || sending}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
