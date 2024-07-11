import * as React from "react";
import { useDispatch } from "react-redux";

import { useSnackbar } from "notistack";

import Draggable from "react-draggable";

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

import LoadingButton from "@mui/lab/LoadingButton";

import {
  updateBlockExtSubnetAsync
} from "../../../../ipam/ipamSlice";

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../../tools/planner/utils/iputils";

import {
  EXTSUBNET_NAME_REGEX,
  EXTSUBNET_DESC_REGEX,
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

export default function EditExtSubnet(props) {
  const { open, handleClose, space, block, external, subnets, selectedSubnet } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [subName, setSubName] = React.useState({ value: "", error: false });
  const [subDesc, setSubDesc] = React.useState({ value: "", error: false });
  const [subCidr, setSubCidr] = React.useState({ value: "", error: false });

  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  function onCancel() {
    handleClose();

    if(selectedSubnet) {
      setSubName({ value: selectedSubnet.name, error: false });
      setSubDesc({ value: selectedSubnet.desc, error: false });
      setSubCidr({ value: selectedSubnet.cidr, error: false });
    } else {
      setSubName({ value: "", error: false });
      setSubDesc({ value: "", error: false });
      setSubCidr({ value: "", error: false });
    }
  }

  function onSubmit() {
    var body = [
      {
        op: "replace",
        path: "/name",
        value: subName.value
      },
      {
        op: "replace",
        path: "/desc",
        value: subDesc.value
      },
      {
        op: "replace",
        path: "/cidr",
        value: subCidr.value
      }
    ];

    (async () => {
      try {
        setSending(true);
        await dispatch(updateBlockExtSubnetAsync({ space: space, block: block, external: external.name, subnet: selectedSubnet.name, body: body }));
        enqueueSnackbar("Successfully updated External Subnet", { variant: "success" });
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
        EXTSUBNET_NAME_REGEX
      );

      const nameError = newName ? !regex.test(newName) : false;
      const nameExists = subnets?.reduce((acc, curr) => {
        curr['name'] !== selectedSubnet['name'] && acc.push(curr['name'].toLowerCase());

        return acc;
      }, []).includes(newName.toLowerCase());

      setSubName({
          value: newName,
          error: (nameError || nameExists)
      });
    }
  }

  function onDescChange(event) {
    const newDesc = event.target.value;

    const regex = new RegExp(
      EXTSUBNET_DESC_REGEX
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
          curr['name'] !== selectedSubnet['name'] && acc.push(curr['cidr']);

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

  const unchanged = React.useMemo(() => {
    if(selectedSubnet) {
      return (
        subName.value === selectedSubnet.name &&
        subDesc.value === selectedSubnet.desc &&
        subCidr.value === selectedSubnet.cidr
      );
    } else {
      return true;
    }
  }, [selectedSubnet, subName, subDesc, subCidr]);

  const hasError = React.useMemo(() => {
    var emptyCheck = false;
    var errorCheck = false;

    errorCheck = (subName.error || subDesc.error || subCidr.error);
    emptyCheck = (subName.value.length === 0 || subDesc.value.length === 0 || subCidr.value.length === 0);

    return (errorCheck || emptyCheck);
  }, [subName, subDesc, subCidr]);

  React.useEffect(() => {
    if (selectedSubnet) {
      setSubName({ value: selectedSubnet.name, error: false });
      setSubDesc({ value: selectedSubnet.desc, error: false });
      setSubCidr({ value: selectedSubnet.cidr, error: false });
    } else {
      handleClose();

      setSubName({ value: "", error: false });
      setSubDesc({ value: "", error: false });
      setSubCidr({ value: "", error: false });
    }
  }, [selectedSubnet, handleClose]);

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
          Edit External Subnet
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Tooltip
              arrow
              disableFocusListener
              placement="right"
              title={
                <>
                  - Subnet name must be unique
                  <br />- Max of 64 characters
                  <br />- Can contain alphnumerics
                  <br />- Can contain underscore, hypen and period
                  <br />- Cannot start/end with underscore, hypen or period
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
                value={subName.value}
                onChange={(event) => onNameChange(event)}
                inputProps={{ spellCheck: false }}
                sx={{width: "80%" }}
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
                  <br />- Can contain underscore, hypen, slash and period
                  <br />- Cannot start/end with underscore, hypen, slash or period
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
                  <br />&nbsp;&nbsp;&nbsp;&nbsp;- Example: 1.2.3.4/5
                  <br />- Cannot overlap existing subnets
                </>
              }
            >
              <TextField
                error={(subCidr.value.length > 0 && subCidr.error)}
                margin="dense"
                id="name"
                label="CIDR"
                type="cidr"
                variant="standard"
                value={subCidr.value}
                onChange={(event) => onCidrChange(event)}
                inputProps={{ spellCheck: false }}
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
            disabled={hasError || unchanged}
          >
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
