import * as React from "react";
import { styled } from '@mui/material/styles';

import { useMsal } from "@azure/msal-react";
import { callMsGraphUsers } from "../../msal/graph";

import { useSnackbar } from 'notistack';

import { isEqual } from 'lodash';

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
  const { admins, loadedAdmins, setAdmins, selectionModel, refresh } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  const loading = open && options.length === 0;
  // const selectedAdmin = admins.find(obj => { return obj.id === selectionModel[0] });
  const changed = isEqual(admins, loadedAdmins);

  React.useEffect(() => {
    let active = true;

    function SearchUsers() {
      (async () => {
        const request = {
          scopes: ["Directory.Read.All"],
          account: accounts[0],
        };
  
        try {
          const response = await instance.acquireTokenSilent(request);
          const userData = await callMsGraphUsers(response.accessToken);
          setOptions(userData.value);
          refresh();
        } catch (e) {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.response.data.error, { variant: "error" });
        }
      })();
    }

    if (!loading) {
      return undefined;
    }

    (async () => {
      if (active) {
        SearchUsers();
      }
    })();

    return () => {
      active = false;
    };
  }, [loading, accounts, instance]);

  React.useEffect(() => {
    if (!open) {
      setOptions([]);
    }
  }, [open]);

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
    (async () => {
      const request = {
        scopes: apiRequest.scopes,
        account: accounts[0],
      };

      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await replaceAdmins(response.accessToken, admins);
        enqueueSnackbar("Successfully updated admins", { variant: "success" });
        refresh();
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar(e.response.data.error, { variant: "error" });
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
            onChange={(event, newValue) => {
              newValue ? handleAdd(newValue) : setSelected(null);
            }}
            isOptionEqualToValue={(option, value) => option.displayName === value.displayName}
            getOptionLabel={(option) => `${option.displayName} (${option.userPrincipalName})`}
            options={options}
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
                visibility: changed ? 'hidden' : 'visible',
                disabled: sending
              }}
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
    (async () => {
      const request = {
        scopes: apiRequest.scopes,
        account: accounts[0],
      };

      try {
        setLoading(true);
        const response = await instance.acquireTokenSilent(request);
        const data = await getAdmins(response.accessToken);
        setAdmins(data);
        setLoadedAdmins(data);
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar("Error fetching admins", { variant: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }

  function handleDelete(id) {
    // const index = admins.findIndex(x => {
    //   return x.id === id;
    // });

    setAdmins(admins.filter(x => x.id !== id));
  }

  function renderDelete(params) {
    const onClick = (e) => {
      e.stopPropagation();
      console.log("CLICK: " + params.row.id);
      // setSelectionModel([params.value]);
      // setRowData(params.row);
      // setMenuExpand(true);
    };
  
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
            onClick={() => handleDelete(params.row.id)}
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
    <Box sx={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <Box sx={{ p: 3, height: "calc(100vh - 112px)", display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <Box height="100%" width="100%">
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
                refresh: refreshData
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
      </Box>
    </Box>
  );
}
