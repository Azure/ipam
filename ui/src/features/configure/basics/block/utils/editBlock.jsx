import * as React from "react";
import { useDispatch } from "react-redux";

import { useSnackbar } from "notistack";

import DraggablePaper from "../../../../../global/DraggablePaper";

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

import { updateBlockAsync } from "../../../../ipam/ipamSlice";

import {
  BLOCK_NAME_REGEX,
  CIDR_REGEX
} from "../../../../../global/globals";

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

  const unchanged = block
                    ? (blockName.value === block.name && cidr.value === block.cidr)
                    ? true : false
                    : true;

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
    handleClose();

    setBlockName({ value: block.name, error: false });
    setCidr({ value: block.cidr, error: false });
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
      BLOCK_NAME_REGEX
    );

    const invalidName = name ? !regex.test(name) : false;
    const otherBlocks = blocks.filter((e) => e.name.toLowerCase() !== block.name.toLowerCase());
    const blockExists = otherBlocks.some((e) => e.name.toLowerCase() === name.toLowerCase()) ? true : false;

    return invalidName || blockExists;
  }

  function onCidrChange(event) {
    setCidr({
      value: event.target.value,
      error: validateCidr(event.target.value),
    });
  }

  function validateCidr(cidr) {
    const regex = new RegExp(
      CIDR_REGEX
    );

    return cidr ? !regex.test(cidr) : false;
  }

  return (
    <div>
      <Dialog
        open={open}
        onClose={onCancel}
        PaperComponent={DraggablePaper}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
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
                  <br />- Max of 64 characters
                  <br />- Can contain alphnumerics
                  <br />- Can contain underscore, hypen and period
                  <br />- Cannot start/end with underscore, hypen or period
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
                value={blockName.value}
                onChange={(event) => {
                  onNameChange(event);
                }}
                inputProps={{ spellCheck: false }}
                sx={{ width: "80%" }}
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
                inputProps={{ spellCheck: false }}
                sx={{ width: "80%" }}
              />
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            onClick={onSubmit}
            loading={sending}
            disabled={invalidForm || unchanged}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
