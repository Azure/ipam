import * as React from "react";
import { useDispatch } from 'react-redux';

import { useSnackbar } from "notistack";

import {
  Box,
  Button,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent
} from "@mui/material";

import LoadingButton from '@mui/lab/LoadingButton';

import { updateSpaceAsync } from "../../../ipam/ipamSlice";

import {
  SPACE_NAME_REGEX,
  SPACE_DESC_REGEX
} from "../../../../global/globals";

export default function EditSpace(props) {
  const { open, handleClose, space, spaces } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [spaceName, setSpaceName] = React.useState({ value: "", error: false });
  const [description, setDescription] = React.useState({ value: "", error: false });
  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const invalidForm = spaceName.value
                      && !spaceName.error
                      && description.value
                      && !description.error ? false : true;

  React.useEffect(() => {
    if(space) {
      setSpaceName({
        value: space.name,
        error: false
      });

      setDescription({
        value: space.desc,
        error: false
      });
    } else {
      setSpaceName({
        value: "",
        error: false
      });

      setDescription({
        value: "",
        error: false
      });
    }
  }, [space]);

  function onCancel() {
    setSpaceName({ value: space.name, error: false });
    setDescription({ value: space.desc, error: false });
    handleClose();
  }

  function onSubmit() {
    var body = [
      { "op": "replace", "path": "/name", "value": spaceName.value },
      { "op": "replace", "path": "/desc", "value": description.value }
    ];

    (async () => {
      try {
        setSending(true);
        await dispatch(updateSpaceAsync({ space: space.name, body: body }));
        enqueueSnackbar("Successfully updated Space", { variant: "success" });
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
    setSpaceName({
      value: event.target.value,
      error: validateName(event.target.value),
    });
  }

  function validateName(name) {
    const regex = new RegExp(
      SPACE_NAME_REGEX
    );

    const nameValid = name ? !regex.test(name) : false;
    const spaceExists = spaces.some((e) => e.name.toLowerCase() === name.toLowerCase())
                        && name.toLowerCase() !== space.name.toLowerCase()
                        ? true
                        : false;

    return nameValid || spaceExists;
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

  return (
    <div sx={{ height: "300px", width: "100%" }}>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          Edit Space
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center">
            <Tooltip
              arrow
              disableFocusListener
              placement="right"
              title={
                <>
                  - Space name must be unique
                  <br />- Max of 64 characters
                  <br />- Can contain alphnumerics
                  <br />- Can contain underscore, hypen, and period
                  <br />- Cannot start/end with underscore, hypen, or period
                </>
              }
            >
              <TextField
                autoFocus
                error={spaceName.error}
                margin="dense"
                id="name"
                label="Space Name"
                type="name"
                variant="standard"
                sx={{ width: "80%" }}
                value={spaceName.value}
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
                label="Space Description"
                type="description"
                variant="standard"
                value={description.value}
                onChange={(event) => onDescriptionChange(event)}
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
            disabled={invalidForm}
          >
            Update
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
