import * as React from "react";
import { useDispatch } from 'react-redux';

import { useSnackbar } from "notistack";

import {
  Box,
  Button,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent
} from "@mui/material";

import LoadingButton from '@mui/lab/LoadingButton';

import { updateBlockAsync } from "../../../ipam/ipamSlice";

export default function EditBlock(props) {
  const { open, handleClose, space, blocks, block } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [blockName, setBlockName] = React.useState({ value: "", error: false });
  const [cidr, setCidr] = React.useState({ value: "", error: false });
  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const invalidForm = blockName.value
                      && !blockName.error
                      && cidr.value
                      && !cidr.error ? false : true;

  React.useEffect(() => {
    if(block) {
      setBlockName({
        value: block.name,
        error: false
      });

      setCidr({
        value: block.cidr,
        error: false
      });
    } else {
      setBlockName({
        value: "",
        error: false
      });

      setCidr({
        value: "",
        error: false
      });
    }
  }, [block]);

  function onCancel() {
    setBlockName({ value: block.name, error: false });
    setCidr({ value: block.cidr, error: false });
    handleClose();
  }

  function onSubmit() {
    var body = [
      { "op": "replace", "path": "/name", "value": blockName.value },
      { "op": "replace", "path": "/cidr", "value": cidr.value }
    ];

    (async () => {
      try {
        setSending(true);
        await dispatch(updateBlockAsync({ space: space, block: block.name, body: body }));
        enqueueSnackbar("Successfully updated Block", { variant: "success" });
        onCancel();
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar(e.message, { variant: "error" });
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
    const regex = new RegExp(
      //eslint-disable-next-line
      "^([a-zA-Z0-9/\._-]){1,32}$"
    );

    const nameValid = name ? !regex.test(name) : false;
    const blockExists = blocks.some((e) => e.name.toLowerCase() === name.toLowerCase()) ? true : false;

    return nameValid || blockExists;
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
        <DialogTitle>
          Edit Block
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Tooltip
              arrow
              disableFocusListener
              placement="right"
              title={
                <>
                  - Block name must be unique
                  <br />- Max of 32 characters
                  <br />- Can contain alphnumerics
                  <br />- Can underscore, hypen, lash, and period
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
          <LoadingButton
            onClick={onSubmit}
            loading={sending}
            disabled={invalidForm}
          >
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
