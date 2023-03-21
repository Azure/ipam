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
  CheckOutlined,
  WarningAmber,
  ErrorOutline,
  BlockOutlined,
  TimerOffOutlined
} from "@mui/icons-material";

import LoadingButton from '@mui/lab/LoadingButton';

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

const MESSAGE_MAP = {
  "wait": {
    msg: "Waiting for vNET association...",
    icon: Autorenew,
    color: "primary"
  },
  "fulfilled": {
    msg: "Reservation fulfilled.",
    icon: CheckOutlined,
    color: "success"
  },
  "warnCIDRMismatch": {
    msg: "Reservation ID assigned to vNET which does not have an address space that matches the reservation.",
    icon: WarningAmber,
    color: "warning"
  },
  "errCIDRExists": {
    msg: "A vNET with the assigned CIDR has already been associated with the target IP Block.",
    icon: ErrorOutline,
    color: "error"
  },
  "cancelledByUser": {
    msg: "Reservation cancelled by user.",
    icon: BlockOutlined,
    color: "error"
  },
  "canelledTimeout": {
    msg: "Reservation cancelled due to expiration.",
    icon: TimerOffOutlined,
    color: "error"
  }
};

const Spotlight = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.mode === 'dark' ? 'cornflowerblue' : 'mediumblue'
}));

const Update = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.error.light,
  textShadow: '-1px 0 white, 0 1px white, 1px 0 white, 0 -1px white'
}));

const gridStyle = {
  height: '100%',
  border: '1px solid rgba(224, 224, 224, 1)',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

export default function EditReservations(props) {
  const { open, handleClose, block } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [reservations, setReservations] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [copied, setCopied] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const theme = useTheme();

  const empty = selectionModel.length === 0;

  const timer = React.useRef();

  const columns = [
    { name: "cidr", header: "CIDR", type: "string", defaultFlex: 0.5 },
    { name: "createdBy", header: "Created By", type: "string", defaultFlex: 1 },
    { name: "desc", header: "Description", type: "string", defaultFlex: 1.5 },
    { name: "createdOn", header: "Creation Date", type: "date", defaultFlex: 0.75, render: ({value}) => new Date(value * 1000).toLocaleString() },
    { name: "status", header: "Status", headerAlign: "center", width: 90, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: renderStatus },
    { name: "id", header: "", width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, renderHeader: () => "", render: renderId }
  ];

  function renderStatus({value}) {
    const MsgIcon = MESSAGE_MAP[value].icon;
    const MsgColor = MESSAGE_MAP[value].color;

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
            {MESSAGE_MAP[value].msg}
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

  function refreshData() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      setReservations([]);

      if(block) {
        try {
          setRefreshing(true);
          setSelectionModel([]);

          const response = await instance.acquireTokenSilent(request);
          const data = await fetchBlockResv(response.accessToken, block.parent_space, block.name);
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
      }
    })();
  }

  React.useEffect(() => {
    block && refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block]);

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
        await deleteBlockResvs(response.accessToken, block.parent_space, block.name, Object.keys(selectionModel));
        handleClose();
        enqueueSnackbar("Successfully removed IP Block reservation(s)", { variant: "success" });
        refreshData();
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.error, { variant: "error" });
        }
      } finally {
        setSending(false);
      }
    })();
  }

  return (
    <div sx={{ height: "400px", width: "100%" }}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          style: {
            overflowY: "unset"
          },
        }}
      >
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
                disabled={refreshing || sending}
              >
                <Refresh />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{ overflowY: "unset" }}
        >
          <DialogContentText>
            Select the CIDR reservations for Block <Spotlight>'{block?.name}'</Spotlight> to be deleted
          </DialogContentText>
          <Box sx={{ pt: 4, height: "400px" }}>
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
              showColumnMenuLockOptions={false}
              columns={columns}
              loading={refreshing || sending}
              loadingText={sending ? <Update>Updating</Update> : "Loading"}
              dataSource={reservations}
              selected={selectionModel}
              onSelectionChange={({selected}) => setSelectionModel(selected)}
              style={gridStyle}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <LoadingButton onClick={onSubmit} loading={sending} disabled={empty || sending}>
            Delete
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
