import * as React from "react";
import { useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";

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
  FormGroup,
  FormControlLabel,
  Autocomplete,
  Radio,
  Switch,
  Paper
} from "@mui/material";

import LoadingButton from "@mui/lab/LoadingButton";

import {
  createBlockResvAsync
} from "../../../ipam/ipamSlice";

import {
  SPACE_DESC_REGEX,
  CIDR_REGEX
} from "../../../../global/globals";

const cidrMasks = [
  { name: '/8', value: 8},
  { name: '/9', value: 9},
  { name: '/10', value: 10},
  { name: '/11', value: 11},
  { name: '/12', value: 12},
  { name: '/13', value: 13},
  { name: '/14', value: 14},
  { name: '/15', value: 15},
  { name: '/16', value: 16},
  { name: '/17', value: 17},
  { name: '/18', value: 18},
  { name: '/19', value: 19},
  { name: '/20', value: 20},
  { name: '/21', value: 21},
  { name: '/22', value: 22},
  { name: '/23', value: 23},
  { name: '/24', value: 24},
  { name: '/25', value: 25},
  { name: '/26', value: 26},
  { name: '/27', value: 27},
  { name: '/28', value: 28},
  { name: '/29', value: 29},
  { name: '/30', value: 30},
  { name: '/31', value: 31},
  { name: '/32', value: 32}
];

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

export default function NewReservation(props) {
  const { open, handleClose, selectedSpace, selectedBlock } = props;
  const spaces = [];

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

  const [checked, setChecked] = React.useState(location.state?.cidr ? false : true);

  const dispatch = useDispatch();

  function onCancel() {
    handleClose();

    setChecked(true);
    setDescription({ value: "", error: false });
    setMask(maskOptions[0]);
    setReverseSearch(false);
    setSmallestCIDR(false);
    setCidr({ value: "", error: false });
  }

  function onSubmit() {
    var body = {
      ...description.value.length > 0 && { desc: description.value },
      ...checked && { size: mask.value },
      ...checked && { reverse_search: reverseSearch },
      ...checked && { smallest_cidr: smallestCIDR },
      ...!checked && { cidr: cidr.value }
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

    return cidr ? !regex.test(cidr) : false;
  }

  React.useEffect(() => {
    const descError = description.error
    const maskError = checked ? !mask : false
    const cidrError = !checked ? cidr.error : false

    setInvalidForm( descError || maskError || cidrError);
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
    <div>
      <Dialog
        open={open}
        onClose={onCancel}
        PaperComponent={DraggablePaper}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
          Create Reservation
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '90%' }}>
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
                id="name"
                label="Description"
                type="description"
                variant="standard"
                value={description.value}
                onChange={(event) => onDescriptionChange(event)}
                inputProps={{ spellCheck: false }}
                sx={{ width: "100%" }}
              />
            </Tooltip>
            <Box
              sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'row',
                gap: '24px',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px'
                }}
              >
                <Radio
                  checked={checked}
                  onChange={() => setChecked(true)}
                  value={true}
                />
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    height: '160px',
                    width: '250px',
                    gap: '16px',
                    border: 'solid 1px rgba(0, 0, 0, 0.12)'
                  }}
                >
                  <Autocomplete
                    forcePopupIcon={false}
                    disabled={!checked}
                    id="cidr-mask-max"
                    size="small"
                    options={maskOptions || []}
                    getOptionLabel={(option) => option.name}
                    inputValue={maskInput}
                    onInputChange={(event, newInputValue) => setMaskInput(newInputValue)}
                    value={mask}
                    onChange={(event, newValue) => setMask(newValue)}
                    sx={{ width: '8ch' }}
                    ListboxProps={{
                      style: {
                        maxHeight: "15rem"
                      },
                      position: "bottom-start"
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Mask"
                        placeholder="Mask"
                      />
                    )}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <FormGroup
                      sx={{
                        pl: 1
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            disabled={!checked}
                            size='small'
                            checked={reverseSearch}
                            onChange={() => setReverseSearch(prev => !prev)}
                          />
                        }
                        label="Reverse Search"
                        sx={{ pb: 1 }}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            disabled={!checked}
                            size='small'
                            checked={smallestCIDR}
                            onChange={() => setSmallestCIDR(prev => !prev)}
                          />
                        }
                        label="Smallest CIDR"
                      />
                    </FormGroup>
                  </Box>
                </Box>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px'
                }}
              >
                <Radio
                  checked={!checked}
                  onChange={() => setChecked(false)}
                  value={false}
                />
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '160px',
                    width: '250px',
                    gap: '16px',
                    border: 'solid 1px rgba(0, 0, 0, 0.12)'
                  }}
                >
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
                    <div
                      style={checked ? { pointerEvents: 'none' } : {}}
                    >
                      <TextField
                        error={!checked ? (cidr.value ? cidr.error : false) : false}
                        disabled={checked}
                        size="small"
                        label="CIDR"
                        placeholder="x.x.x.x/x"
                        value={cidr.value}
                        onChange={(event) => onCidrChange(event)}
                        sx={{
                          width: '21ch',
                        }}
                      />
                    </div>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
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
          <LoadingButton
            onClick={onSubmit}
            loading={sending}
            disabled={invalidForm}
          >
            Create
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
