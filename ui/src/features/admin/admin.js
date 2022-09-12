import * as React from "react";
import { styled } from '@mui/material/styles';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { callMsGraphUsersFilter } from "../../msal/graph";

import { useSnackbar } from 'notistack';

import { isEqual, throttle } from 'lodash';

import {
  DataGrid,
  GridOverlay
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

// Page Styles

const Wrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexGrow: 1,
  height: "calc(100vh - 160px)"
}));

const MainBody = styled("div")({
  display: "flex",
  height: "100%",
  width: "100%",
  flexDirection: "column",
});

const FloatingHeader = styled("div")(({ theme }) => ({
  ...theme.typography.h6,
  display: "flex",
  flexDirection: "row",
  height: "7%",
  width: "100%",
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginBottom: theme.spacing(3)
}));

const HeaderTitle = styled("div")(({ theme }) => ({
  ...theme.typography.h6,
  width: "80%",
  textAlign: "center",
  alignSelf: "center",
}));

const DataSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginBottom: theme.spacing(1.5)
}));

// Grid Styles

const GridBody = styled("div")({
  height: "100%",
  width: "100%",
  '& .ipam-sub-excluded': {
    backgroundColor: "rgb(255, 230, 230) !important",
    '&:hover': {
      backgroundColor: "rgb(255, 220, 220) !important",
    }
  },
  '& .ipam-sub-included': {
    backgroundColor: "rgb(255, 255, 255, 0.1) !important",
    '&:hover': {
      backgroundColor: "none",
    }
  }
});

const StyledGridOverlay = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
});

export default function Administration() {
  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [admins, setAdmins] = React.useState([]);
  const [loadedAdmins, setLoadedAdmins] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(null);
  const [input, setInput] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  const columns = [
    { field: "name", headerName: "Name", flex: 0.5 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "id", headerName: "Object ID", flex: 0.75 },
    { field: "", headerName: "", headerAlign: "center", align: "center", width: 25, sortable: false, renderCell: renderDelete }
  ];

  const fetchUsers = React.useMemo(() => throttle((input) => SearchUsers(input), 500), []);

  const usersLoading = open && !options;
  const unchanged = isEqual(admins, loadedAdmins);

  React.useEffect(() => {
    refreshData();
  }, []);

  React.useEffect(() => {
    if(open) {
      let active = true;

      if (active) {
        fetchUsers(input);
      }

      return () => {
        active = false;
      };
    }
  }, [open, input, fetchUsers]);

  React.useEffect(() => {
    if (!open) {
      setOptions(null);
    }
  }, [input, open]);

  function refreshData() {
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
              display: (isEqual([params.row.id], selectionModel)) ? "flex" : "none"
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

  const popperStyle = {
    popper: {
      width: "fit-content"
    }
  };

  const MyPopper = function (props) {
    return <Popper {...props} style={{ popperStyle }} placement="bottom-start" />;
  };

  function onModelChange(newModel) {
    if(isEqual(newModel, selectionModel)) {
      setSelectionModel([]);
    } else {
      setSelectionModel(newModel);
    }
  }

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
    <Wrapper>
      <MainBody>
        <FloatingHeader>
          <Box sx={{ width: "35%" }}>
            <Autocomplete
              PopperComponent={MyPopper}
              key="12345"
              id="asynchronous-demo"
              size="small"
              autoHighlight
              blurOnSelect={true}
              forcePopupIcon={false}
              sx={{
                ml: 2,
                width: 300
              }}
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
              loading={usersLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="User Search"
                  variant="standard"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {usersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
            />
          </Box>
          <HeaderTitle>IPAM Admins</HeaderTitle>
          <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ width: "35%", ml: 2, mr: 2 }}>
            <Tooltip title="Save" >
              <IconButton
                color="primary"
                aria-label="upload picture"
                component="span"
                style={{
                  visibility: unchanged ? 'hidden' : 'visible'
                }}
                disabled={sending}
                onClick={onSave}
              >
                <SaveAlt />
              </IconButton>
            </Tooltip>
          </Box>
        </FloatingHeader>
        <DataSection>
          <GridBody>
            <DataGrid
              disableColumnMenu
              hideFooter
              hideFooterPagination
              hideFooterSelectedRowCount
              density="compact"
              rows={admins}
              columns={columns}
              loading={loading}
              onSelectionModelChange={(newSelectionModel) => onModelChange(newSelectionModel)}
              selectionModel={selectionModel}
              components={{
                NoRowsOverlay: CustomNoRowsOverlay,
                LoadingOverlay: CustomLoadingOverlay,
              }}
              sx={{
                "&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus-within":
                  {
                    outline: "none",
                  },
                "&.MuiDataGrid-root .MuiDataGrid-columnHeader--moving":
                  {
                    backgroundColor: "rgba(255, 255, 255, 0.1)"
                  },
                border: "none"
              }}
            />
          </GridBody>
        </DataSection>
      </MainBody>
    </Wrapper>
  );
}
