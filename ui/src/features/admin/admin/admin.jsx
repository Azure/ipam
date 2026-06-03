import * as React from "react";
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { isEqual, throttle } from 'lodash';

import { DataGrid } from "../../../global/grids";

import {
  Box,
  Tooltip,
  IconButton,
  Autocomplete,
  TextField,
  CircularProgress,
  Popper,
  Typography,
  Button
}  from "@mui/material";

import {
  Person,
  Apps,
  QuestionMark,
  PersonSearch,
  SaveAlt,
  HighlightOff
} from "@mui/icons-material";

import Shrug from "../../../img/pam/Shrug";

import {
  getAdmins,
  replaceAdmins
} from "../../ipam/ipamAPI";

import {
  callMsGraphUsersFilter,
  callMsGraphPrincipalsFilter
} from "../../../msal/graph";

const AdminContext = React.createContext({});

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
  width: "30%",
  textAlign: "center",
  alignSelf: "center",
}));

const DataSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  width: "100%",
  borderRadius: "4px",
  // marginBottom: theme.spacing(1.5)
}));

// Grid Styles

const GridBody = styled("div")({
  height: "100%",
  width: "100%"
});

function RenderDelete(props) {
  const { data } = props;
  const { admins, setAdmins, selectedId } = React.use(AdminContext);

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
            display: (data.id === selectedId) ? "flex" : "none"
          }}
          disableFocusRipple
          disableTouchRipple
          disableRipple
          onClick={() => setAdmins(admins.filter(x => x.id !== data.id))}
        >
          <HighlightOff />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function RenderType(props) {
  const { value } = props;

  const flexCenter = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }

  const typeMap = {
    "User": {
      title: "User",
      icon: <Person />
    },
    "Principal" : {
      title: "Principal",
      icon: <Apps />
    }
  };

  return (
    <Tooltip title={ typeMap[value]?.title || "Unknown" }>
      <span style={{...flexCenter}}>
        { typeMap[value]?.icon || <QuestionMark />}
      </span>
    </Tooltip>
  );
}

const popperStyle = {
  popper: {
    width: "fit-content"
  }
};

function MyPopper(props) {
  return <Popper {...props} style={{ popperStyle }} placement="bottom-start" />;
}

export default function Administration() {
  const { enqueueSnackbar } = useSnackbar();

  const [admins, setAdmins] = React.useState(null);
  const [loadedAdmins, setLoadedAdmins] = React.useState(null);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(null);
  const [input, setInput] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  const [appSearch, setAppSearch] = React.useState(false);

  const adminLoadedRef = React.useRef(false);

  const TypeHeaderComponent = React.useCallback(() => (
    <span style={{ display: "flex", height: "100%", width: "100%", alignItems: "center", justifyContent: "center" }}>
      <PersonSearch />
    </span>
  ), []);

  const columns = React.useMemo(() => [
    {
      field: "type",
      headerName: "",
      headerComponent: TypeHeaderComponent,
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      resizable: false,
      sortable: false,
      filter: false,
      suppressMovable: true,
      suppressSizeToFit: true,
      suppressAutoSize: true,
      cellRenderer: RenderType,
      cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" }
    },
    { field: "name", headerName: "Name", flex: 0.5, filter: true },
    { field: "email", headerName: "Email", flex: 1, filter: true, valueFormatter: (params) => params.value || "N/A" },
    { field: "id", headerName: "Object ID", flex: 0.75, filter: true }
  ], [TypeHeaderComponent]);

  const actionsCellRenderer = React.useCallback((params) => {
    return <RenderDelete data={params.data} />;
  }, []);

  const usersLoading = open && !options;
  const unchanged = isEqual(admins, loadedAdmins);

  const SearchUsers = React.useCallback((nameFilter) => {
    (async () => {
      try {
        setOptions(null);
        const userData = appSearch ? await callMsGraphPrincipalsFilter(nameFilter) : await callMsGraphUsersFilter(nameFilter);
        setOptions(userData.value);
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar(e.message, { variant: "error" });
      }
    })();
  }, [appSearch, enqueueSnackbar]);

  const fetchUsers = React.useMemo(() => throttle((input) => SearchUsers(input), 500), [SearchUsers]);

  const refreshData = React.useCallback(() => {
    (async () => {
      try {
        const data = await getAdmins();
        setAdmins(data);
        setLoadedAdmins(data);
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar("Error fetching admins", { variant: "error" });
      }
    })();
  }, [enqueueSnackbar]);

  React.useEffect(() => {
    if(!adminLoadedRef.current) {
      adminLoadedRef.current = true;

      refreshData();
    }
  }, [refreshData]);

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

  React.useEffect(() => {
    admins && setLoading(false);
  }, [admins]);

  function onSave() {
    (async () => {
      try {
        setSending(true);
        await replaceAdmins(admins);
        enqueueSnackbar("Successfully updated admins", { variant: "success" });
        refreshData();
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

  function handleAdd(user) {
    let newAdmin = {
      type: appSearch ? "Principal" : "User",
      name: user.displayName,
      id: user.id,
      email: appSearch ? null : user.userPrincipalName,
    };

    if(!admins.find(obj => { return obj.id === user.id })) {
      setAdmins((admins) => [...admins, newAdmin]);
    } else {
      console.log("Admin already added!");
      enqueueSnackbar('Admin already added!', { variant: 'error' });
    }

    setSelected(null);
  }

  const toggleAppSearch = () => {
    setAppSearch((current) => !current);
  };

  const handleRowClicked = React.useCallback((event) => {
    const data = event.data;
    setSelectedId(prevId => prevId === data.id ? null : data.id);
  }, []);

  const NoRowsOverlay = React.useCallback(() => {
    return (
      <React.Fragment>
        <Shrug />
        <Typography
          variant="overline"
          sx={{
            display: "block",
            mt: 1
          }}>
          Nothing yet...
        </Typography>
      </React.Fragment>
    );
  }, []);

  return (
    <AdminContext value={{ admins, setAdmins, selectedId }}>
      <Wrapper>
        <MainBody>
          <FloatingHeader>
            <Box sx={{ display: "flex", alignItems: "center", width: "35%", p: 0.5 }}>
              <Tooltip
                title={ appSearch ? "Service Principals" : "Users" }
                arrow
                slotProps={{
                  popper: {
                    sx: {
                        "& .MuiTooltip-tooltip": {
                          left: appSearch ? "32px" : "8px"
                        },
                        "& .MuiTooltip-arrow": {
                          left: appSearch ? "-32px !important" : "-8px !important"
                        }
                    }
                  }
                }}
              >
                {/* <IconButton onClick={toggleAppSearch} color="primary">
                  { appSearch ? <Apps /> : <Person /> }
                </IconButton> */}
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={ appSearch ? <Apps /> : <Person /> }
                  onClick={toggleAppSearch}
                  sx={{
                    borderRight: "unset",
                    borderRadius: "4px 0px 0px 4px",
                    borderColor: "rgba(0, 0, 0, 0.23)",
                    padding: "8px",
                    left: "1px",
                    minWidth: "unset",
                    "& .MuiButton-startIcon": { margin: "unset" }
                  }}
                />
              </Tooltip>
              <Autocomplete
                key="12345"
                id="asynchronous-demo"
                size="small"
                autoHighlight
                blurOnSelect={true}
                forcePopupIcon={false}
                sx={{
                  // ml: 2,
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
                getOptionLabel={(option) => appSearch ? `${option.displayName} (${option.appId})` : `${option.displayName} (${option.userPrincipalName})`}
                options={options || []}
                loading={usersLoading}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={ appSearch ? "Principal Search" : "User Search" }
                    slotProps={{
                      ...params.slotProps,

                      input: {
                        ...params.slotProps.input,
                        endAdornment: (
                          <React.Fragment>
                            {usersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.slotProps.input.endAdornment}
                          </React.Fragment>
                        ),
                        style: {
                          borderRadius: "0px 4px 4px 0px"
                        }
                      }
                    }}
                  />
                )}
                slots={{
                  popper: MyPopper
                }}
              />
            </Box>
            <HeaderTitle>Admin Users</HeaderTitle>
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                width: "35%",
                ml: 2,
                mr: 2
              }}>
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
                viewSettingKey="admins"
                rowData={admins}
                columnDefs={columns}
                isLoading={loading || sending}
                noRowsOverlay={NoRowsOverlay}
                onRowClicked={handleRowClicked}
                actionsCellRenderer={actionsCellRenderer}
              />
            </GridBody>
          </DataSection>
        </MainBody>
      </Wrapper>
    </AdminContext>
  );
}
