import * as React from "react";
import { styled } from '@mui/material/styles';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { callMsGraphUsersFilter } from "../../msal/graph";

import { useSnackbar } from 'notistack';

import { isEqual, throttle } from 'lodash';

import {
  DataGrid,
  GridOverlay,
  GridToolbarContainer
} from "@mui/x-data-grid";

import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Autocomplete,
  TextField,
  LinearProgress,
  CircularProgress,
  Popper,
}  from "@mui/material";

import {
  SaveAlt,
  HighlightOff
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

import {
  getAdmins,
  replaceAdmins
} from "../ipam/ipamAPI";

import { apiRequest } from "../../msal/authConfig";

function CustomToolbar(props) {
  const { admins, loadedAdmins, setAdmins, selectionModel, refresh, refreshing } = props;

  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(null);
  const [input, setInput] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  const loading = open && !options
  const unchanged = isEqual(admins, loadedAdmins);

  function SearchUsers(nameFilter) {
    const request = {
      scopes: ["Directory.Read.All"],
      account: accounts[0],
    };

    (async () => {
      try {
        setOptions(null);
        const response = await instance.acquireTokenSilent(request);
        const userData = await callMsGraphUsersFilter(response.accessToken, nameFilter);
        setOptions(userData.value);
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
      }
    })();
  }

  const fetchUsers = React.useMemo(() => throttle((input) => SearchUsers(input), 500), []);

  React.useEffect(() => {
    let active = true;

    if (active) {
      fetchUsers(input);
    }

    return () => {
      active = false;
    };
  }, [input, fetchUsers]);

  React.useEffect(() => {
    if (!open) {
      setOptions(null);
    }
  }, [input, open]);

  function handleAdd(user) {
    let newAdmin = {
      name: user.displayName,
      id: user.id,
      email: user.userPrincipalName,
    };

    if(!admins.find(obj => { return obj.id === user.id })) {
      setAdmins((admins) => [...admins, newAdmin]);
    } else {
      console.log("Admin already added!");
      enqueueSnackbar('Admin already added!', { variant: 'error' });
    }
    
    setSelected(null);
  }

  function onSave() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await replaceAdmins(response.accessToken, admins);
        enqueueSnackbar("Successfully updated admins", { variant: "success" });
        refresh();
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

  const popperStyle = {
    popper: {
      width: "fit-content"
    }
  };

  const MyPopper = function (props) {
    return <Popper {...props} style={{ popperStyle }} placement="bottom-start" />;
  };

  return (
    <GridToolbarContainer>
      <Box
        height="65px"
        width="100%"
        display="flex"
        flexDirection="row"
        justifyContent="flex-start"
        style={{ borderBottom: "1px solid rgba(224, 224, 224, 1)" }}
      >
        <Box display="flex" justifyContent="flex-start"  sx={{ flexBasis: "300px", flexGrow: 0, flexShrink: 0, ml: 2, mr: 2 }}>
          <Autocomplete
            PopperComponent={MyPopper}
            key="12345"
            id="asynchronous-demo"
            autoHighlight
            blurOnSelect={true}
            forcePopupIcon={false}
            sx={{ width: 300 }}
            open={open}
            value={selected}
            onOpen={() => {
              setOpen(true);
            }}
            onClose={() => {
              setOpen(false);
            }}
            onInputChange={(event, newInput) => {
              setInput(newInput);
            }}
            onChange={(event, newValue) => {
              newValue ? handleAdd(newValue) : setSelected(null);
            }}
            isOptionEqualToValue={(option, value) => option.displayName === value.displayName}
            getOptionLabel={(option) => `${option.displayName} (${option.userPrincipalName})`}
            options={options || []}
            loading={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="User Search"
                variant="standard"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />
        </Box>
        <Box width="100%" display="flex" alignSelf="center" textAlign="center">
          <Typography sx={{ flex: "1 1 100%" }} variant="h6" component="div">
            IPAM Admins
          </Typography>
        </Box>
        <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ flexBasis: "300px", flexGrow: 0, flexShrink: 0, ml: 2, mr: 2 }}>
          <Tooltip title="Save" >
            <IconButton
              color="primary"
              aria-label="upload picture"
              component="span"
              style={{
                visibility: unchanged ? 'hidden' : 'visible'
              }}
              disabled={sending || refreshing}
              onClick={onSave}
            >
              <SaveAlt />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </GridToolbarContainer>
  );
}

export default function Administration() {
  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [admins, setAdmins] = React.useState([]);
  const [loadedAdmins, setLoadedAdmins] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const columns = [
    { field: "name", headerName: "Name", flex: 0.5 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "id", headerName: "Object ID", flex: 0.75 },
    { field: "", headerName: "", headerAlign: "center", align: "center", width: 25, sortable: false, renderCell: renderDelete }
  ];

  React.useEffect(() => {
    refreshData();
  }, []);

  function refreshData() {
    console.log("REFRESHING...");
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setLoading(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await getAdmins(response.accessToken);
        setAdmins(data);
        setLoadedAdmins(data);
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error fetching admins", { variant: "error" });
        }
      } finally {
        setLoading(false);
      }
    })();
  }

  function renderDelete(params) {  
    const flexCenter = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }

    return (
      <Tooltip title="Delete">
        <span style={{...flexCenter}}>
          <IconButton
            color="error"
            sx={{
              padding: 0,
              display: (JSON.stringify([params.row.id]) === JSON.stringify(selectionModel)) ? "flex" : "none"
            }}
            disableFocusRipple
            disableTouchRipple
            disableRipple
            onClick={() => setAdmins(admins.filter(x => x.id !== params.row.id))}
          >
            <HighlightOff />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  function onModelChange(newModel) {
    if(JSON.stringify(newModel) === JSON.stringify(selectionModel)) {
      setSelectionModel([]);
    } else {
      setSelectionModel(newModel);
    }
  }

  const StyledGridOverlay = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  });

  function CustomNoRowsOverlay() {
    return (
      <StyledGridOverlay>
        <Shrug />
        <Typography variant="overline" display="block"  sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </StyledGridOverlay>
    );
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
    <Box sx={{ flexGrow: 1, height: "100%" }}>
      <DataGrid
        disableColumnMenu
        hideFooter
        hideFooterPagination
        hideFooterSelectedRowCount
        rows={admins}
        columns={columns}
        loading={loading}
        onSelectionModelChange={(newSelectionModel) => onModelChange(newSelectionModel)}
        setSelectionModel={selectionModel}
        components={{
          Toolbar: CustomToolbar,
          NoRowsOverlay: CustomNoRowsOverlay,
          LoadingOverlay: CustomLoadingOverlay,
        }}
        componentsProps={{
          toolbar: {
            admins: admins,
            loadedAdmins: loadedAdmins,
            setAdmins, setAdmins,
            selectionModel: selectionModel,
            refresh: refreshData,
            refreshing: loading
          }
        }}
        sx={{
          "&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus-within":
            {
              outline: "none",
            },
        }}
      />
    </Box>
  );
}
