import * as React from "react";
import { useDispatch } from 'react-redux';

import { useSnackbar } from "notistack";

import Draggable from 'react-draggable';

import {
  Box,
  Button,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Paper
} from "@mui/material";

import LoadingButton from '@mui/lab/LoadingButton';

import { updateBlockAsync } from "../../../ipam/ipamSlice";

import {
  BLOCK_NAME_REGEX,
  BLOCK_DESC_REGEX,
  CIDR_REGEX
} from "../../../../global/globals";
import { set } from "lodash";

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

export default function EditBlock(props) {
  const { open, handleClose, space, blocks, block } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [blockName, setBlockName] = React.useState({ value: "", error: false });
  const [description, setDescription] = React.useState({ value: "", error: false });
  const [cidr, setCidr] = React.useState({ value: "", error: false });
  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const invalidForm = blockName.value
                      && !blockName.error
                      && description.value
                      && !description.error
                      && cidr.value
                      && !cidr.error ? false : true;

  const unchanged = block
                    ? (blockName.value === block.name && description.value == block.desc && cidr.value === block.cidr)
                    ? true : false
                    : true;

  React.useEffect(() => {
    if(block) {
      setBlockName({
        value: block.name,
        error: false
      });

      setDescription({
        value: block.desc,
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

      setDescription({
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
    setDescription({ value: block.desc, error: false });
    setCidr({ value: block.cidr, error: false });
    handleClose();
  }

  function onSubmit() {
    var body = [
      { "op": "replace", "path": "/name", "value": blockName.value },
      { "op": "replace", "path": "/desc", "value": description.value },
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

  function onDescriptionChange(event) {
    setDescription({
      value: event.target.value,
      error: validateDescription(event.target.value),
    });
  }

  function validateDescription(description) {
    const regex = new RegExp(
      BLOCK_DESC_REGEX
    );

    return description ? !regex.test(description) : false;
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
        onClose={handleClose}
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
                  <br />- Can contain underscore, hypen, slash, and period
                  <br />- Cannot start/end with underscore, hypen, slash, or period
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
                  - Max of 128 characters
                  <br />- Can contain alphnumerics
                  <br />- Can contain spaces
                  <br />- Can contain underscore, hypen, slash, and period
                  <br />- Cannot start/end with underscore, hypen, slash, or period
                </>
              }
            >
              <TextField
                error={description.error}
                margin="dense"
                id="name"
                label="Block Description"
                type="description"
                variant="standard"
                value={description.value}
                onChange={(event) => onDescriptionChange(event)}
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
            disabled={invalidForm || unchanged}
          >
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
