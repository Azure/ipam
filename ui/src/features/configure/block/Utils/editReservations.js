import * as React from "react";
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import { useTheme } from '@mui/material/styles';

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
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

const Spotlight = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.mode === 'dark' ? 'cornflowerblue' : 'mediumblue'
}));

const gridStyle = {
  height: '100%',
  border: '1px solid rgba(224, 224, 224, 1)',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

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

  const theme = useTheme();

  const empty = selectionModel.length === 0;

  const timer = React.useRef();

  const columns = [
    { name: "cidr", header: "CIDR", defaultFlex: 0.5 },
    { name: "userId", header: "User ID", defaultFlex: 1 },
    { name: "createdOn", header: "Created Date", defaultFlex: 0.75, render: ({value}) => new Date(value * 1000).toLocaleString() },
    { name: "status", header: "Status", headerAlign: "center", width: 90, resizable: false, hideable: false, sortable: false, showColumnMenuTool: false, render: renderStatus },
    { name: "tag", header: "Tags", headerAlign: "left", defaultFlex: 1.3, render: renderTags },
    { name: "id", header: "", width: 25, resizable: false, hideable: false, showColumnMenuTool: false, sortable: false, renderHeader: () => "", render: renderId }
  ];

  function renderStatus({value}) {
    const MsgIcon = value.includes("wait") ? Autorenew : value.includes("warn") ? WarningAmber : ErrorOutline
    const MsgColor = value.includes("wait") ? "primary" : value.includes("warn") ? "warning" : "error"

    const onClick = (e) => {
      e.stopPropagation();
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
            {msgMap[value]}
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

  function renderId({value}) {
    const contentCopied = (copied === value);

    const onClick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value);
      setCopied(value)
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
            <br />{value}
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

  function renderTags(params) {
    const multilineTags = Object.entries(params.value).map(([key, value]) => {
      return key + ": " + value + "\n";
    })
    const multilineTagsLite = Object.keys(params.value).map((item, index) => {
      if (index == 1 && Object.keys(params.value).length > 2)  {
        return item + ": " + params.value[item] + "(...)\n";
      } else if (index < 2  ) {
        return item + ": " + params.value[item] + "\n";
      }
    })

    const flexLeftMultiline = {
      display: "flex",
      textAlign: "left",
      alignItems: "left",
      justifyContent: "left",
      whiteSpace: "pre"
    }

    return (
      <Tooltip
        arrow
        disableFocusListener
        placement="top"
        title={
          <div style={{ textAlign: "center" }}>
            Tags
            <br />
            <span style={{ ...flexLeftMultiline }}>{multilineTags}</span>
          </div>
        }
      >
        <div style={{ whiteSpace: "pre", fontSize: ".85em" }}>{multilineTagsLite}</div>
      </Tooltip>
    );
  }

  const refreshData = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    }

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
  }, [accounts, block, enqueueSnackbar, instance, space]);

  React.useEffect(() => {
    refreshData();
  }, [block, refreshData]);

  React.useEffect(() => {
    if(copied !== "") {
      clearTimeout(timer.current);

      timer.current = setTimeout(
        function() {
          setCopied("");
        }, 3000
      );
    }
  }, [timer, copied]);

  function onSubmit() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        await deleteBlockResvs(response.accessToken, space, block, Object.keys(selectionModel));
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

  return (
    <div sx={{ height: "300px", width: "100%" }}>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
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
            <ReactDataGrid
              theme={theme.palette.mode === 'dark' ? "default-dark" : "default-light"}
              idProperty="id"
              showCellBorders="horizontal"
              checkboxColumn
              checkboxOnlyRowSelect
              showZebraRows={false}
              multiSelect={true}
              showActiveRowIndicator={false}
              enableColumnAutosize={false}
              showColumnMenuGroupOptions={false}
              columns={columns}
              loading={loading}
              dataSource={reservations}
              selected={selectionModel}
              onSelectionChange={({selected}) => setSelectionModel(selected)}
              style={gridStyle}
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
