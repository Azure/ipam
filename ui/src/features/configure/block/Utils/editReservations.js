import * as React from "react";
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { DataGrid, GridOverlay } from "@mui/x-data-grid";

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  LinearProgress,
  Tooltip,
  IconButton,
} from "@mui/material";

import {
  Check,
  ContentCopy,
  Refresh,
  Autorenew,
  WarningAmber,
  ErrorOutline
} from "@mui/icons-material";

import {
  fetchBlockResv,
  deleteBlockResvs
} from "../../../ipam/ipamAPI";

import { apiRequest } from "../../../../msal/authConfig";

// Python
// import time
// time.time() -> 1647638968.5812438

// const unixtime = 1647638968.5812438;
// const jstime = new Date(unixtime * 1000);

const msgMap = {
  "wait": "Waiting for vNET association...",
  "warnCIDRMismatch": "Reservation ID assigned to vNET which does not have an address space that matches the reservation.",
  "errCIDRExists": "A vNET with the assigned CIDR has already been associated with the target IP Block."
};

const Spotlight = styled("span")({
  fontWeight: "bold",
  color: "mediumblue"
});

export default function EditReservations(props) {
  const { open, handleClose, space, block } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(false);
  const [reservations, setReservations] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [copied, setCopied] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const empty = selectionModel.length == 0;

  const timer = React.useRef();

  const columns = [
    { field: "cidr", headerName: "CIDR", headerAlign: "left", align: "left", flex: 0.5 },
    { field: "userId", headerName: "User ID", headerAlign: "left", align: "left", flex: 1 },
    { field: "createdOn", headerName: "Created Date", headerAlign: "left", align: "left", flex: 0.75, renderCell: (params) => new Date(params.value * 1000).toLocaleString() },
    { field: "status", headerName: "Status", headerAlign: "center", align: "center", width: 75, renderCell: renderStatus },
    { field: "id", headerName: "", headerAlign: "center", align: "center", width: 25, renderCell: renderId }
  ];

  function renderStatus(params) {
    const MsgIcon = params.value.includes("wait") ? Autorenew : params.value.includes("warn") ? WarningAmber : ErrorOutline
    const MsgColor = params.value.includes("wait") ? "primary" : params.value.includes("warn") ? "warning" : "error"

    const onClick = (e) => {
      e.stopPropagation();
      console.log("CLICK!");
      console.log(params);
      // console.log(params.row.id);
      // navigator.clipboard.writeText(params.row.id);
      // setCopied(params.row.id)
    };
  
    const flexCenter = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }

    return (
      <Tooltip
        arrow
        disableFocusListener
        placement="top"
        title={
          <div style={{ textAlign: "center" }}>
            {msgMap[params.value]}
          </div>
        }
      >
        <span style={{...flexCenter}}>
          <IconButton
            color={MsgColor}
            size="small"
            sx={{
              padding: 0
            }}
            onClick={onClick}
            disableFocusRipple
            disableTouchRipple
            disableRipple
          >
            <MsgIcon fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  function renderId(params) {
    const contentCopied = (copied === params.row.id);

    const onClick = (e) => {
      e.stopPropagation();
      console.log("CLICK!");
      console.log(params.row.id);
      navigator.clipboard.writeText(params.row.id);
      setCopied(params.row.id)
    };
  
    const flexCenter = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }

    return (
      <Tooltip
        arrow
        disableFocusListener
        placement="right"
        title={
          <div style={{ textAlign: "center" }}>
            Click to Copy
            <br />
            <br />{params.row.id}
          </div>
        }
      >
        <span style={{...flexCenter}}>
          { !contentCopied
            ?
              <IconButton
                color="primary"
                size="small"
                sx={{
                  padding: 0
                }}
                onClick={onClick}
                disableFocusRipple
                disableTouchRipple
                disableRipple
              >
                <ContentCopy fontSize="inherit" />
              </IconButton>
            :
              <Check fontSize="small" color="success" />
          }
        </span>
      </Tooltip>
    );
  }

  React.useEffect(() => {
    refreshData();
  }, [block]);

  React.useEffect(() => {
    if(copied != "") {
      clearTimeout(timer.current);

      timer.current = setTimeout(
        function() {
          setCopied("");
        }, 3000
      );
    }
  }, [timer, copied]);

  function refreshData() {
      const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    setReservations([]);
    setSelectionModel([]);
    setLoading(true);

    (async () => {
      if(space && block) {
        try {
          setRefreshing(true);
          const response = await instance.acquireTokenSilent(request);
          const data = await fetchBlockResv(response.accessToken, space, block);
          setReservations(data);
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) {
            instance.acquireTokenRedirect(request);
          } else {
            console.log("ERROR");
            console.log("------------------");
            console.log(e);
            console.log("------------------");
            enqueueSnackbar("Error fetching available IP Block reservations", { variant: "error" });
          }
        } finally {
          setRefreshing(false);
        }
      } else {
        setReservations([])
      }

      setLoading(false);
    })();
  }

  function onSubmit() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await deleteBlockResvs(response.accessToken, space, block, selectionModel);
        handleClose();
        enqueueSnackbar("Successfully deleted IP Block reservations", { variant: "success" });
        refreshData();
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.response.data.error, { variant: "error" });
        }
      } finally {
        setSending(false);
      }
    })();
  }

  function CustomLoadingOverlay() {
    return (
      <GridOverlay>
        <div style={{ position: "absolute", top: 0, width: "100%" }}>
          <LinearProgress />
        </div>
      </GridOverlay>
    );
  }

  return (
    <div sx={{ height: "300px", width: "100%" }}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", flexDirection: "row" }}>
            <Box>
              Block Reservations
            </Box>
            <Box sx={{ ml: "auto" }}>
              <IconButton
                color="primary"
                size="small"
                onClick={refreshData}
                disabled={refreshing}
              >
                <Refresh />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select the CIDR reservations for Block <Spotlight>'{block}'</Spotlight> to be deleted
          </DialogContentText>
          <Box sx={{ pt: 4, height: "300px" }}>
            <DataGrid
              checkboxSelection
              disableColumnMenu
              hideFooter
              hideFooterPagination
              hideFooterSelectedRowCount
              density="compact"
              rows={reservations}
              columns={columns}
              loading={loading}
              onSelectionModelChange={(newSelectionModel) => setSelectionModel(newSelectionModel)}
              selectionModel={selectionModel}
              components={{
                LoadingOverlay: CustomLoadingOverlay,
                // NoRowsOverlay: CustomNoRowsOverlay,
              }}
              sx={{
                "&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus-within":
                  {
                    outline: "none",
                  },
                // border: "none",
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={empty || sending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
