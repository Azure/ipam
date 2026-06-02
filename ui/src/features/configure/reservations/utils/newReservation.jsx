import * as React from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router";

import { useSnackbar } from "notistack";

import DraggablePaper from "../../../../global/DraggablePaper";

import {
  Box,
  Button,
  Divider,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  FormGroup,
  FormControlLabel,
  Autocomplete,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import {
  createBlockResvAsync
} from "../../../ipam/ipamSlice";

import {
  SPACE_DESC_REGEX,
  CIDR_REGEX,
  cidrMasks
} from "../../../../global/globals";

export default function NewReservation(props) {
  const { open, handleClose, selectedSpace, selectedBlock } = props;

  const { enqueueSnackbar } = useSnackbar();

  const location = useLocation();

  const [description, setDescription] = React.useState({ value: "", error: false });
  const [mask, setMask] = React.useState(null);
  const [cidr, setCidr] = React.useState(location.state?.cidr ? { value: location.state.cidr, error: false } : { value: "", error: true });
  const [sending, setSending] = React.useState(false);

  const [maskOptions, setMaskOptions] = React.useState(null);
  const [maskInput, setMaskInput] = React.useState('');

  const [reverseSearch, setReverseSearch] = React.useState(false);
  const [smallestCIDR, setSmallestCIDR] = React.useState(false);

  const [invalidForm, setInvalidForm] = React.useState(false);

  const [mode, setMode] = React.useState(location.state?.cidr ? "manual" : "auto");

  const checked = mode === "auto";

  const dispatch = useDispatch();

  function onModeChange(_, newMode) {
    if (newMode !== null) {
      setMode(newMode);
    }
  }

  function onCancel() {
    handleClose();

    setMode("auto");
    setDescription({ value: "", error: false });
    setMask(maskOptions?.[0] ?? null);
    setReverseSearch(false);
    setSmallestCIDR(false);
    setCidr({ value: "", error: true });
  }

  function onSubmit() {
    var body = {
      ...(description.value.length > 0 && { desc: description.value }),
      ...(checked && { size: mask.value }),
      ...(checked && { reverse_search: reverseSearch }),
      ...(checked && { smallest_cidr: smallestCIDR }),
      ...(!checked && { cidr: cidr.value })
    };

    (async () => {
      try {
        setSending(true);
        await dispatch(createBlockResvAsync({ space: selectedSpace.name, block: selectedBlock.name, body: body }));
        enqueueSnackbar("Successfully created new Reservation", { variant: "success" });
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

  function onDescriptionChange(event) {
    setDescription({
      value: event.target.value,
      error: validateDescription(event.target.value),
    });
  }

  function validateDescription(description) {
    const regex = new RegExp(
      SPACE_DESC_REGEX
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

    return cidr ? !regex.test(cidr) : true;
  }

  React.useEffect(() => {
    const descError = description.error;
    const maskError = checked ? !mask : false;
    const cidrError = !checked ? cidr.error : false;

    setInvalidForm(descError || maskError || cidrError);
  }, [checked, description, mask, cidr]);

  React.useEffect(() => {
    if (selectedBlock) {
      let prefixParts = selectedBlock.cidr.split("/");
      let currentMask = parseInt(prefixParts[1], 10);
      let availableMasks = cidrMasks.filter((opt) => opt.value >= currentMask && opt.value <= 29);

      setMaskOptions(availableMasks);
      setMask(availableMasks[0]);
    } else {
      setMask(null);
      setMaskOptions(null);
    }
  }, [selectedBlock]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperComponent={DraggablePaper}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
        Create Reservation
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" alignItems="center">
          <Tooltip
            arrow
            disableFocusListener
            placement="right"
            title={
              <>
                - Optional
                <br />- Max of 128 characters
                <br />- Can contain alphnumerics
                <br />- Can contain spaces
                <br />- Can contain underscore, hypen, slash and period
                <br />- Cannot start/end with underscore, hypen, slash or period
              </>
            }
          >
            <TextField
              error={description.error}
              margin="dense"
              id="description"
              label="Description"
              type="description"
              variant="standard"
              value={description.value}
              onChange={(event) => onDescriptionChange(event)}
              sx={{ width: "80%" }}
              slotProps={{
                htmlInput: { spellCheck: false }
              }}
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
          <Box sx={{ width: "80%", minHeight: 80 }}>
          {mode === "auto" ? (
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
              <Autocomplete
                forcePopupIcon={false}
                id="cidr-mask-max"
                size="small"
                options={maskOptions || []}
                getOptionLabel={(option) => option.name}
                inputValue={maskInput}
                onInputChange={(_, newInputValue) => setMaskInput(newInputValue)}
                value={mask}
                onChange={(_, newValue) => setMask(newValue)}
                sx={{ width: '7ch', flexShrink: 0 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Mask"
                    placeholder="Mask"
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
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={reverseSearch}
                      onChange={() => setReverseSearch(prev => !prev)}
                    />
                  }
                  label={<Typography variant="body2">Reverse Search</Typography>}
                  sx={{ mb: 0.5 }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={smallestCIDR}
                      onChange={() => setSmallestCIDR(prev => !prev)}
                    />
                  }
                  label={<Typography variant="body2">Smallest CIDR</Typography>}
                />
              </FormGroup>
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
                  </>
                }
              >
                <TextField
                  autoFocus
                  error={cidr.value ? cidr.error : false}
                  margin="dense"
                  id="cidr"
                  label="CIDR"
                  placeholder="x.x.x.x/x"
                  variant="standard"
                  value={cidr.value}
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
          disabled={sending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          loading={sending}
          disabled={invalidForm}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
