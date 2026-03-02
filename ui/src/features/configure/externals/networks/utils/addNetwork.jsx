import * as React from "react";
import { useSelector, useDispatch } from "react-redux";

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
  selectNetworks,
  createBlockExternalAsync
} from "../../../../ipam/ipamSlice";

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../../tools/planner/utils/iputils";

import {
  EXTERNAL_NAME_REGEX,
  EXTERNAL_DESC_REGEX,
  CIDR_REGEX,
  cidrMasks
} from "../../../../../global/globals";

export default function AddExtNetwork(props) {
  const { open, handleClose, space, block, externals } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [mode, setMode] = React.useState("auto");
  const addBySize = mode === "auto";

  const [maskOptions, setMaskOptions] = React.useState(null);
  const [maskInput, setMaskInput] = React.useState('');
  const [selectedMask, setSelectedMask] = React.useState(null);

  const [extName, setExtName] = React.useState({ value: "", error: false });
  const [extDesc, setExtDesc] = React.useState({ value: "", error: false });
  const [extCidr, setExtCidr] = React.useState({ value: "", error: false });

  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const networks = useSelector(selectNetworks);

  function onModeChange(_, newMode) {
    if (newMode !== null) setMode(newMode);
  }

  function onCancel() {
    handleClose();

    setExtName({ value: "", error: false });
    setExtDesc({ value: "", error: false });
    setExtCidr({ value: "", error: false });

    setSelectedMask(maskOptions.length >= 1 ? maskOptions[1] : maskOptions[0]);

    setMode("auto");
  }

  function onSubmit() {
    var body = {
      name: extName.value,
      desc: extDesc.value,
      ...(!addBySize && {cidr : extCidr.value}),
      ...(addBySize && {size : selectedMask.value})
    };

    (async () => {
      try {
        setSending(true);
        await dispatch(createBlockExternalAsync({ space: space, block: block.name, body: body }));
        enqueueSnackbar("Successfully created new External Network", { variant: "success" });
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
      const nameExists = externals.map(e => e.name.toLowerCase()).includes(newName.toLowerCase());

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
          acc.push(curr['cidr']);

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

  const hasError = React.useMemo(() => {
    var emptyCheck = false;
    var errorCheck = false;

    if (addBySize) {
      errorCheck = (extName.error || extDesc.error);
      emptyCheck = (extName.value.length === 0 || extDesc.value.length === 0 || selectedMask === null);
    } else {
      errorCheck = (extName.error || extDesc.error || extCidr.error);
      emptyCheck = (extName.value.length === 0 || extDesc.value.length === 0 || extCidr.value.length === 0);
    }

    return (errorCheck || emptyCheck);
  }, [addBySize, selectedMask, extName, extDesc, extCidr]);

  React.useEffect(() => {
    if (block) {
      let prefixParts = block.cidr.split("/");
      let currentMask = parseInt(prefixParts[1], 10);
      let availableMasks = cidrMasks.filter((opt) => opt.value >= currentMask && opt.value <= 29);

      setMaskOptions(availableMasks);
      setSelectedMask(availableMasks.length >= 1 ? availableMasks[1] : availableMasks[0]);
    } else {
      setSelectedMask(null);
      setMaskInput("");
      setMaskOptions(null);
    }
  }, [block]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperComponent={DraggablePaper}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
        Add External Network
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
              id="description"
              label="Description"
              type="description"
              variant="standard"
              value={extDesc.value}
              onChange={(event) => onDescChange(event)}
              inputProps={{ spellCheck: false }}
              sx={{ width: "80%" }}
            />
          </Tooltip>
          <Box sx={{ width: "80%", mt: 2, mb: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.75, width: '100%', textAlign: 'center' }}
            >
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
                  ListboxProps={{
                    style: { maxHeight: "15rem" },
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
                    error={extCidr.value.length > 0 && extCidr.error}
                    margin="dense"
                    id="cidr"
                    label="CIDR"
                    placeholder="x.x.x.x/x"
                    variant="standard"
                    value={extCidr.value}
                    onChange={(event) => onCidrChange(event)}
                    inputProps={{ spellCheck: false }}
                    sx={{ width: "20ch" }}
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
