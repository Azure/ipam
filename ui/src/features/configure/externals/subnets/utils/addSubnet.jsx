import * as React from "react";
import { useDispatch } from "react-redux";

import { useSnackbar } from "notistack";

import Draggable from "react-draggable";

import {
  Box,
  Button,
  Radio,
  Tooltip,
  TextField,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Paper
} from "@mui/material";

import LoadingButton from "@mui/lab/LoadingButton";

import {
  createBlockExtSubnetAsync
} from "../../../../ipam/ipamSlice";

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../../tools/planner/utils/iputils";

import {
  EXTSUBNET_NAME_REGEX,
  EXTSUBNET_DESC_REGEX,
  CIDR_REGEX,
  cidrMasks
} from "../../../../../global/globals";
import { Spellcheck } from "@mui/icons-material";

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

  const [addBySize, setAddBySize] = React.useState(true);

  const [maskOptions, setMaskOptions] = React.useState(null);
  const [maskInput, setMaskInput] = React.useState('');
  const [selectedMask, setSelectedMask] = React.useState(null);

  const [subName, setSubName] = React.useState({ value: "", error: false });
  const [subDesc, setSubDesc] = React.useState({ value: "", error: false });
  const [subCidr, setSubCidr] = React.useState({ value: "", error: false });

  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  function onCancel() {
    handleClose();

    setSubName({ value: "", error: false });
    setSubDesc({ value: "", error: false });
    setSubCidr({ value: "", error: false });

    setSelectedMask(maskOptions.length >= 1 ? maskOptions[1] : maskOptions[0]);

    setAddBySize(true);
  }

  function onSubmit() {
    var body = {
      name: subName.value,
      desc: subDesc.value,
      ...(!addBySize && {cidr : subCidr.value}),
      ...(addBySize && {size : selectedMask.value})
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
        EXTSUBNET_NAME_REGEX
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
    var emptyCheck = false;
    var errorCheck = false;

    if (addBySize) {
      errorCheck = (subName.error || subDesc.error);
      emptyCheck = (subName.value.length === 0 || subDesc.value.length === 0 || selectedMask === null);
    } else {
      errorCheck = (subName.error || subDesc.error || subCidr.error);
      emptyCheck = (subName.value.length === 0 || subDesc.value.length === 0 || subCidr.value.length === 0);
    }

    return (errorCheck || emptyCheck);
  }, [addBySize, selectedMask, subName, subDesc, subCidr]);

  React.useEffect(() => {
    if (external) {
      let prefixParts = external.cidr.split("/");
      let currentMask = parseInt(prefixParts[1], 10);
      let availableMasks = cidrMasks.filter((opt) => opt.value >= currentMask && opt.value <= 29);

      setMaskOptions(availableMasks);
      setSelectedMask(availableMasks.length >= 1 ? availableMasks[1] : availableMasks[0]);
    } else {
      setSelectedMask(null);
      setMaskInput("");
      setMaskOptions(null);
    }
  }, [external]);

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
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: '4px', width: '80%' }}>
              <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'left' }}>
                <Radio
                  checked={addBySize}
                  onChange={() => setAddBySize(true)}
                  name="add-by-size"
                  sx={{ pl: 0 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'center', pb: 1, mr: 1 }}>
                <Autocomplete
                  forcePopupIcon={false}
                  disabled={!addBySize}
                  id="cidr-mask-max"
                  size="small"
                  options={maskOptions || []}
                  getOptionLabel={(option) => option.name}
                  inputValue={maskInput}
                  onInputChange={(event, newInputValue) => setMaskInput(newInputValue)}
                  value={selectedMask}
                  onChange={(event, newValue) => setSelectedMask(newValue)}
                  sx={{ width: '6ch' }}
                  ListboxProps={{
                    style: {
                      maxHeight: "15rem"
                    },
                    position: "bottom-start"
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Size"
                      placeholder="Size"
                      variant="standard"
                    />
                  )}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'left' }}>
                <Radio
                  checked={!addBySize}
                  onChange={() => setAddBySize(false)}
                  name="add-by-cidr"
                  sx={{ pl: 0 }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'center', width: '100%' }}>
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
                    disabled={addBySize}
                    error={ !addBySize && (subCidr.value.length > 0 && subCidr.error) }
                    margin="dense"
                    id="name"
                    label="CIDR"
                    type="cidr"
                    variant="standard"
                    value={subCidr.value}
                    onChange={(event) => onCidrChange(event)}
                    inputProps={{ spellCheck: false }}
                    sx={{
                      width: "100%",
                      pointerEvents: addBySize ? 'none' : 'auto'
                    }}
                  />
                </Tooltip>
              </Box>
            </Box>
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
