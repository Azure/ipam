import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';

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

import {
  selectNetworks,
  createBlockExtSubnetAsync
} from "../../../../ipam/ipamSlice"

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../../tools/utils/iputils"

import {
  EXTERNAL_NAME_REGEX,
  EXTERNAL_DESC_REGEX,
  CIDR_REGEX
} from "../../../../../global/globals";

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

export default function AddExtSubnet(props) {
  const { open, handleClose, space, block, external, subnets } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [subName, setSubName] = React.useState({ value: "", error: false });
  const [subDesc, setSubDesc] = React.useState({ value: "", error: false });
  const [subCidr, setSubCidr] = React.useState({ value: "", error: false });

  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const networks = useSelector(selectNetworks);

  function onCancel() {
    setSubName({ value: "", error: false });
    setSubDesc({ value: "", error: false });
    setSubCidr({ value: "", error: false });

    handleClose();
  }

  function onSubmit() {
    var body = {
      name: subName.value,
      desc: subDesc.value,
      cidr: subCidr.value
    };

    (async () => {
      try {
        setSending(true);
        await dispatch(createBlockExtSubnetAsync({ space: space, block: block, external: external.name, body: body }));
        enqueueSnackbar("Successfully created new External Subnet", { variant: "success" });
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
    const newName = event.target.value;

    if(subnets) {
      const regex = new RegExp(
        EXTERNAL_NAME_REGEX
      );

      const nameError = newName ? !regex.test(newName) : false;
      const nameExists = subnets.map(s => s.name.toLowerCase()).includes(newName.toLowerCase());

      setSubName({
          value: newName,
          error: (nameError || nameExists)
      });
    }
  }

  function onDescChange(event) {
    const newDesc = event.target.value;

    const regex = new RegExp(
      EXTERNAL_DESC_REGEX
    );

    setSubDesc({
      value: newDesc,
      error: (newDesc ? !regex.test(newDesc) : false)
    });
  }

  function onCidrChange(event) {
    const newCidr = event.target.value;

    const regex = new RegExp(
      CIDR_REGEX
    );

    const cidrError = newCidr ? !regex.test(newCidr) : false;

    var extSubnets = [];

    var cidrInBlock = false;
    var subOverlap = true;

    if(!cidrError && newCidr.length > 0) {
      cidrInBlock = isSubnetOf(newCidr, external.cidr);

      if(subnets) {
        extSubnets = subnets?.reduce((acc, curr) => {
          acc.push(curr['cidr']);

          return acc;
        }, []);
      }

      subOverlap = isSubnetOverlap(newCidr, extSubnets);
    }

    setSubCidr({
      value: newCidr,
      error: (cidrError || !cidrInBlock || subOverlap)
    });
  }

  const hasError = React.useMemo(() => {
    const errorCheck = (subName.error || subDesc.error || subCidr.error);
    const emptyCheck = (subName.value.length === 0 || subDesc.value.length === 0 || subCidr.value.length === 0);

    return (errorCheck || emptyCheck);
  }, [subName, subDesc, subCidr]);

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
          Add External Subnet
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Tooltip
              arrow
              disableFocusListener
              placement="right"
              title={
                <>
                  - Network name must be unique
                  <br />- Max of 64 characters
                  <br />- Can contain alphnumerics
                  <br />- Can contain underscore, hypen, slash, and period
                  <br />- Cannot start/end with underscore, hypen, slash, or period
                </>
              }
            >
              <TextField
                autoFocus
                error={subName.error}
                margin="dense"
                id="name"
                label="Name"
                type="name"
                variant="standard"
                sx={{ width: "80%" }}
                value={subName.value}
                onChange={(event) => onNameChange(event)}
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
                error={subDesc.error}
                margin="dense"
                id="name"
                label="Description"
                type="description"
                variant="standard"
                value={subDesc.value}
                onChange={(event) => onDescChange(event)}
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
                error={subCidr.error}
                margin="dense"
                id="name"
                label="CIDR"
                type="cidr"
                variant="standard"
                value={subCidr.value}
                onChange={(event) => onCidrChange(event)}
                sx={{ width: "80%" }}
              />
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onCancel}
            disabled={sending}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={onSubmit}
            loading={sending}
            disabled={hasError}
          >
            Add
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
