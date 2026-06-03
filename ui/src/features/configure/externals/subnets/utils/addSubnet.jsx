import * as React from "react";
import { useDispatch } from "react-redux";

import { useSnackbar } from "notistack";

import DraggablePaper from "../../../../../global/DraggablePaper";

import {
  Box,
  Button,
  Divider,
  Tooltip,
  TextField,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";



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

export default function AddExtSubnet(props) {
  const { open, handleClose, space, block, external, subnets } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [mode, setMode] = React.useState("auto");
  const addBySize = mode === "auto";

  const [maskOptions, setMaskOptions] = React.useState(null);
  const [maskInput, setMaskInput] = React.useState('');
  const [selectedMask, setSelectedMask] = React.useState(null);

  const [subName, setSubName] = React.useState({ value: "", error: false });
  const [subDesc, setSubDesc] = React.useState({ value: "", error: false });
  const [subCidr, setSubCidr] = React.useState({ value: "", error: false });

  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  function onModeChange(_, newMode) {
    if (newMode !== null) setMode(newMode);
  }

  function onCancel() {
    handleClose();

    setSubName({ value: "", error: false });
    setSubDesc({ value: "", error: false });
    setSubCidr({ value: "", error: false });

    setSelectedMask(maskOptions.length >= 1 ? maskOptions[1] : maskOptions[0]);

    setMode("auto");
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
    let emptyCheck, errorCheck;

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
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
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
              sx={{ width: "80%" }}
              slotProps={{
                htmlInput: { spellCheck: false }
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
                <br />- Can contain underscore, hypen, slash and period
                <br />- Cannot start/end with underscore, hypen, slash or period
              </>
            }
          >
            <TextField
              error={subDesc.error}
              margin="dense"
              id="description"
              label="Description"
              type="description"
              variant="standard"
              value={subDesc.value}
              onChange={(event) => onDescChange(event)}
              sx={{ width: "80%" }}
              slotProps={{
                htmlInput: { spellCheck: false }
              }}
            />
          </Tooltip>
          <Box sx={{ width: "80%", mt: 2, mb: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: 'block',
                mb: 0.75,
                width: '100%',
                textAlign: 'center'
              }}>
              Allocation Mode
            </Typography>
            <ToggleButtonGroup
              color="primary"
              value={mode}
              exclusive
              onChange={onModeChange}
              size="small"
            >
              <ToggleButton value="auto" sx={{ px: 4 }}>Auto</ToggleButton>
              <ToggleButton value="manual" sx={{ px: 4 }}>Manual</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Divider sx={{ width: "80%", my: 1.5 }} />
          <Box sx={{ width: "80%", minHeight: 64 }}>
            {mode === "auto" ? (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Autocomplete
                  forcePopupIcon={false}
                  id="cidr-mask-max"
                  size="small"
                  options={maskOptions || []}
                  getOptionLabel={(option) => option.name}
                  inputValue={maskInput}
                  onInputChange={(_, newInputValue) => setMaskInput(newInputValue)}
                  value={selectedMask}
                  onChange={(_, newValue) => setSelectedMask(newValue)}
                  sx={{ width: '7ch' }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Size"
                      placeholder="Size"
                      variant="standard"
                    />
                  )}
                  slotProps={{
                    listbox: {
                      style: { maxHeight: "15rem" },
                      position: "bottom-start"
                    }
                  }}
                />
              </Box>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Tooltip
                  arrow
                  disableFocusListener
                  placement="right"
                  title={
                    <>
                      - Must be in valid CIDR notation format
                      <br />- Example: 1.2.3.4/5
                      <br />- Cannot overlap existing subnets
                    </>
                  }
                >
                  <TextField
                    autoFocus
                    error={subCidr.value.length > 0 && subCidr.error}
                    margin="dense"
                    id="cidr"
                    label="CIDR"
                    placeholder="x.x.x.x/x"
                    variant="standard"
                    value={subCidr.value}
                    onChange={(event) => onCidrChange(event)}
                    sx={{ width: "20ch" }}
                    slotProps={{
                      htmlInput: { spellCheck: false }
                    }}
                  />
                </Tooltip>
              </Box>
            )}
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
        <Button
          onClick={onSubmit}
          loading={sending}
          disabled={hasError}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
