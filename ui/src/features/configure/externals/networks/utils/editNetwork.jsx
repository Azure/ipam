import * as React from "react";
import { useSelector, useDispatch } from "react-redux";

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
  selectNetworks,
  updateBlockExternalAsync
} from "../../../../ipam/ipamSlice";

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../../tools/planner/utils/iputils";

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

export default function EditExtNetwork(props) {
  const { open, handleClose, space, block, externals, selectedExternal } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [extName, setExtName] = React.useState({ value: "", error: false });
  const [extDesc, setExtDesc] = React.useState({ value: "", error: false });
  const [extCidr, setExtCidr] = React.useState({ value: "", error: false });

  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const networks = useSelector(selectNetworks);

  function onCancel() {
    handleClose();

    if(selectedExternal) {
      setExtName({ value: selectedExternal.name, error: false });
      setExtDesc({ value: selectedExternal.desc, error: false });
      setExtCidr({ value: selectedExternal.cidr, error: false });
    } else {
      setExtName({ value: "", error: false });
      setExtDesc({ value: "", error: false });
      setExtCidr({ value: "", error: false });
    }
  }

  function onSubmit() {
    var body = [
      {
        op: "replace",
        path: "/name",
        value: extName.value
      },
      {
        op: "replace",
        path: "/desc",
        value: extDesc.value,
      },
      {
        op: "replace",
        path: "/cidr",
        value: extCidr.value
      }
    ];

    (async () => {
      try {
        setSending(true);
        await dispatch(updateBlockExternalAsync({ space: space, block: block.name, external: selectedExternal.name, body: body }));
        enqueueSnackbar("Successfully updated External Network", { variant: "success" });
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

    if(externals) {
      const regex = new RegExp(
        EXTERNAL_NAME_REGEX
      );

      const nameError = newName ? !regex.test(newName) : false;
      const nameExists = externals?.reduce((acc, curr) => {
        curr['name'] !== selectedExternal['name'] && acc.push(curr['name'].toLowerCase());

        return acc;
      }, []).includes(newName.toLowerCase());

      setExtName({
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

    setExtDesc({
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

    var blockNetworks= [];
    var extNetworks = [];

    var cidrInBlock = false;
    var resvOverlap = true;
    var vnetOverlap = true;
    var extOverlap = true;

    if(!cidrError && newCidr.length > 0) {
      cidrInBlock = isSubnetOf(newCidr, block.cidr);

      const openResv = block?.resv.reduce((acc, curr) => {
        if(!curr['settledOn']) {
          acc.push(curr['cidr']);
        }

        return acc;
      }, []);

      if(space && block && networks) {
        blockNetworks = networks?.reduce((acc, curr) => {
          if(curr['parent_space'] && curr['parent_block']) {
            if(curr['parent_space'] === space && curr['parent_block'].includes(block.name)) {
              acc = acc.concat(curr['prefixes']);
            }
          }

          return acc;
        }, []);
      }

      if(externals) {
        extNetworks = externals?.reduce((acc, curr) => {
          curr['name'] !== selectedExternal['name'] && acc.push(curr['cidr']);

          return acc;
        }, []);
      }

      resvOverlap = isSubnetOverlap(newCidr, openResv);
      vnetOverlap = isSubnetOverlap(newCidr, blockNetworks);
      extOverlap = isSubnetOverlap(newCidr, extNetworks);
    }

    setExtCidr({
      value: newCidr,
      error: (cidrError || !cidrInBlock || resvOverlap || vnetOverlap || extOverlap)
    });
  }

  const unchanged = React.useMemo(() => {
    if(selectedExternal) {
      return (
        extName.value === selectedExternal.name &&
        extDesc.value === selectedExternal.desc &&
        extCidr.value === selectedExternal.cidr
      );
    } else {
      return true;
    }
  }, [selectedExternal, extName, extDesc, extCidr]);

  const hasError = React.useMemo(() => {
    var emptyCheck = false;
    var errorCheck = false;

    errorCheck = (extName.error || extDesc.error || extCidr.error);
    emptyCheck = (extName.value.length === 0 || extDesc.value.length === 0 || extCidr.value.length === 0);

    return (errorCheck || emptyCheck);
  }, [extName, extDesc, extCidr]);

  React.useEffect(() => {
    if (selectedExternal) {
      setExtName({ value: selectedExternal.name, error: false });
      setExtDesc({ value: selectedExternal.desc, error: false });
      setExtCidr({ value: selectedExternal.cidr, error: false });
    } else {
      handleClose();

      setExtName({ value: "", error: false });
      setExtDesc({ value: "", error: false });
      setExtCidr({ value: "", error: false });
    }
  }, [selectedExternal, handleClose]);

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
          Edit External Network
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
                  <br />- Can contain underscore, hypen and period
                  <br />- Cannot start/end with underscore, hypen or period
                </>
              }
            >
              <TextField
                autoFocus
                error={extName.error}
                margin="dense"
                id="name"
                label="Name"
                type="name"
                variant="standard"
                value={extName.value}
                onChange={(event) => onNameChange(event)}
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
                  - Max of 128 characters
                  <br />- Can contain alphnumerics
                  <br />- Can contain spaces
                  <br />- Can contain underscore, hypen, slash and period
                  <br />- Cannot start/end with underscore, hypen, slash or period
                </>
              }
            >
              <TextField
                error={extDesc.error}
                margin="dense"
                id="name"
                label="Description"
                type="description"
                variant="standard"
                value={extDesc.value}
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
                error={(extCidr.value.length > 0 && extCidr.error)}
                margin="dense"
                id="name"
                label="CIDR"
                type="cidr"
                variant="standard"
                value={extCidr.value}
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
