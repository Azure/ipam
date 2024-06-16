import * as React from "react";
import { useDispatch } from "react-redux";
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import Draggable from "react-draggable";

import {
  Box,
  Button,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  Paper
} from "@mui/material";

import LoadingButton from "@mui/lab/LoadingButton";

import { deleteBlockExtSubnetAsync } from "../../../../ipam/ipamSlice";

const Spotlight = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.mode === 'dark' ? 'cornflowerblue' : 'mediumblue'
}));

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

export default function DeleteExtSubnet(props) {
  const { open, handleClose, space, block, external, subnet } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [force, setForce] = React.useState(false);
  const [verify, setVerify] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const dispatch = useDispatch();

  const handleForce = (event) => {
    setForce(event.target.checked);
  };

  const checkForce = () => {
    if(force & !verify) {
      setVerify(true);
    } else {
      (async () => {
        try {
          setSending(true);
          await dispatch(deleteBlockExtSubnetAsync({ space: space, block: block, external: external, subnet: subnet, force: force }));
          enqueueSnackbar("Successfully removed External Subnet", { variant: "success" });
          handleCancel();
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
  };

  const handleCancel = () => {
    setForce(false);
    setVerify(false);
    handleClose();
  };

  return (
    <div>
      <Dialog
        open={open}
        onClose={handleCancel}
        PaperComponent={DraggablePaper}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
          Delete External Subnet
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please confirm you want to delete External Subnet <Spotlight>'{subnet}'</Spotlight>
          </DialogContentText>
          <Box sx={{ display: "flex", justifyContent: "center", width: "100%", pt: 3 }}>
            <FormGroup sx={{ pl: 2.5, pr: 1, border: "1px solid rgba(224, 224, 224, 1)", borderRadius: "4px" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={force}
                    disabled={verify || sending}
                    onChange={handleForce}
                  />
                }
                label="Force Delete"
                sx={{ color: "red" }}
              />
            </FormGroup>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancel</Button>
          <LoadingButton
            onClick={checkForce}
            color={verify ? "error" : "primary" }
            loading={sending}
          >
            Delete
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
