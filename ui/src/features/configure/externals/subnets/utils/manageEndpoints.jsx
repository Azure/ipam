import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { styled } from "@mui/material/styles";

import { omit, isEqual, cloneDeep } from "lodash";

import { useSnackbar } from "notistack";

import { AgGridReact } from "ag-grid-react";
import { themeQuartz } from "ag-grid-community";

import Draggable from "react-draggable";

import { useTheme } from "@mui/material/styles";

import md5 from "md5";

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  OutlinedInput,
  Tooltip,
  Paper,
  Autocomplete,
  TextField
} from "@mui/material";

import {
  Refresh,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined,
  PlaylistAddOutlined,
  PlaylistAddCheckOutlined,
  PlaylistRemoveOutlined,
  InfoOutlined
} from "@mui/icons-material";



import {
  replaceBlockExtSubnetEndpointsAsync,
  selectViewSetting,
  updateMeAsync,
  getAdminStatus
} from "../../../../ipam/ipamSlice";

import {
  expandCIDR,
  getSubnetSize
} from "../../../../tools/planner/utils/iputils";

import {
  EXTERNAL_NAME_REGEX,
  EXTERNAL_DESC_REGEX
} from "../../../../../global/globals";

import { ExternalContext } from "../../externalContext";

const EndpointContext = React.createContext({});

const Spotlight = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.mode === 'dark' ? 'cornflowerblue' : 'mediumblue'
}));

const Update = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.error.light,
  textShadow: '-1px 0 white, 0 1px white, 1px 0 white, 0 -1px white'
}));

function DeleteCellRenderer(props) {
  const { data } = props;
  const { setChanges, selectedRow } = React.useContext(EndpointContext);

  const flexCenter = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%"
  };

  const isSelected = selectedRow && selectedRow.id === data.id;

  return (
    <Tooltip title="Delete">
      <span style={{...flexCenter}}>
        <IconButton
          color="error"
          sx={{
            padding: 0,
            display: isSelected ? "flex" : "none"
          }}
          disableFocusRipple
          disableTouchRipple
          disableRipple
          onClick={() => {
            var endpointDetails = cloneDeep(data);
            endpointDetails['op'] = "delete";
            setChanges(prev => [...prev, endpointDetails]);
          }}
        >
          <PlaylistRemoveOutlined />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function HeaderMenu(props) {
  const { setting } = props;
  const { saving, sendResults, saveConfig, loadConfig, resetConfig } = React.useContext(EndpointContext);

  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuRef = React.useRef(null);

  const viewSetting = useSelector(state => selectViewSetting(state, setting));

  const onClick = () => {
    setMenuOpen(prev => !prev);
  };

  const onSave = () => {
    saveConfig();
    setMenuOpen(false);
  };

  const onLoad = () => {
    loadConfig();
    setMenuOpen(false);
  };

  const onReset = () => {
    resetConfig();
    setMenuOpen(false);
  };

  return (
    <Box
      ref={menuRef}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%"
      }}
    >
      {
        saving ?
        <React.Fragment>
          <CircularProgress size={24} />
        </React.Fragment> :
        (sendResults !== null) ?
        <React.Fragment>
          {
            sendResults ?
            <TaskAltOutlined color="success"/> :
            <CancelOutlined color="error"/>
          }
        </React.Fragment> :
        <React.Fragment>
          <IconButton
            id="table-state-menu"
            onClick={onClick}
          >
            <ExpandCircleDownOutlined />
          </IconButton>
          <Menu
            id="table-state-menu"
            anchorEl={menuRef.current}
            open={menuOpen}
            onClose={onClick}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              elevation: 0,
              style: {
                width: 215,
                transform: 'translateX(35px)',
              },
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                '& .MuiAvatar-root': {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 29,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
          >
            <MenuItem
              onClick={onLoad}
              disabled={ !viewSetting }
            >
              <ListItemIcon>
                <FileDownloadOutlined fontSize="small" />
              </ListItemIcon>
              Load Saved View
            </MenuItem>
            <MenuItem onClick={onSave}>
              <ListItemIcon>
                <FileUploadOutlined fontSize="small" />
              </ListItemIcon>
              Save Current View
            </MenuItem>
            <MenuItem onClick={onReset}>
              <ListItemIcon>
                <ReplayOutlined fontSize="small" />
              </ListItemIcon>
              Reset Default View
            </MenuItem>
          </Menu>
        </React.Fragment>
      }
    </Box>
  );
}

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

export default function ManageExtEndpoints(props) {
  const {
    open,
    handleClose,
    space,
    block,
    external,
    subnet
  } = props;
  const { refreshing, refresh } = React.useContext(ExternalContext);

  const { enqueueSnackbar } = useSnackbar();

  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [endpoints, setEndpoints] = React.useState(null);
  const [addressOptions, setAddressOptions] = React.useState([]);
  const [changes, setChanges] = React.useState([]);
  const [gridData, setGridData] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState(null);

  const [endName, setEndName] = React.useState({ value: "", error: true });
  const [endDesc, setEndDesc] = React.useState({ value: "", error: true });

  const [endAddrInput, setEndAddrInput] = React.useState("");
  const [endAddr, setEndAddr] = React.useState(null);

  const isAdmin = useSelector(getAdminStatus);
  const viewSetting = useSelector(state => selectViewSetting(state, 'extendpoints'));

  const dispatch = useDispatch();
  const gridRef = React.useRef(null);

  const saveTimer = React.useRef();

  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const unchanged = (subnet && endpoints) ? isEqual(subnet['endpoints'], endpoints.map(({id, ...rest}) => rest)) : false;

  // AG Grid column definitions
  const columns = React.useMemo(() => [
    { field: "name", headerName: "Name", flex: 0.5 },
    { field: "desc", headerName: "Description", flex: 1 },
    { field: "ip", headerName: "IP Address", flex: 0.30 },
    {
      field: "actions",
      headerName: "",
      headerComponent: () => <HeaderMenu setting="extendpoints" />,
      width: 50,
      resizable: false,
      sortable: false,
      suppressColumnsToolPanel: true,
      cellRenderer: DeleteCellRenderer
    }
  ], []);

  // Grid theme with compactness
  const gridTheme = React.useMemo(() => {
    const baseParams = {
      spacing: 7,  // default is 8, reduced for tighter layout
    };

    return themeQuartz
      .withParams(baseParams, 'light')
      .withParams(baseParams, 'dark');
  }, []);

  // Default column definitions
  const defaultColDef = React.useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    suppressHeaderMenuButton: true,
  }), []);

  // Handle row selection
  const onRowClicked = React.useCallback((event) => {
    if (!isAdmin) return;

    const data = event.data;
    const node = event.node;

    if (selectedRow && selectedRow.id === data.id) {
      // Deselect
      node.setSelected(false);
      setSelectedRow(null);
      setEndName({ value: "", error: true });
      setEndDesc({ value: "", error: true });
      setEndAddrInput("");
      setEndAddr(null);

      const endpointAddresses = endpoints.map(e => e.ip);
      const newAddressOptions = expandCIDR(subnet.cidr).slice(1,-1).filter(addr => !endpointAddresses.includes(addr));
      setAddressOptions(["<auto>", ...newAddressOptions]);
    } else {
      // Select
      node.setSelected(true);
      setSelectedRow(data);
      setEndName({ value: data.name, error: false });
      setEndDesc({ value: data.desc, error: false });
      setEndAddrInput(data.ip);
      setEndAddr(data.ip);

      const endpointAddresses = endpoints.map(e => {
        if (data.ip !== e.ip) {
          return e.ip;
        }
      });
      const newAddressOptions = expandCIDR(subnet.cidr).slice(1,-1).filter(addr => !endpointAddresses.includes(addr));
      setAddressOptions(newAddressOptions);
    }
  }, [isAdmin, selectedRow, endpoints, subnet]);

  // Handle cell double click for copy
  const onCellDoubleClicked = React.useCallback((event) => {
    const value = event.value;
    if (value !== undefined && value !== null) {
      navigator.clipboard.writeText(value);
      enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
    }
  }, [enqueueSnackbar]);

  const saveConfig = React.useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const columnState = api.getColumnState();
    // Filter out system columns and non-essential properties
    const cleanedState = columnState
      .filter(col => !col.colId.startsWith('ag-') && col.colId !== 'actions')
      .map(({ colId, width, flex, sort, sortIndex, hide }) => ({
        colId,
        width,
        flex,
        sort,
        sortIndex,
        hide
      }));

    const saveData = {
      columnState: cleanedState
    };

    var body = [
      { "op": "add", "path": `/views/extendpoints`, "value": saveData }
    ];

    (async () => {
      try {
        setSaving(true);
        await dispatch(updateMeAsync({ body: body }));
        setSendResults(true);
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        setSendResults(false);
        enqueueSnackbar("Error saving view settings", { variant: "error" });
      } finally {
        setSaving(false);
      }
    })();
  }, [dispatch, enqueueSnackbar]);

  const loadConfig = React.useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || !viewSetting) return;

    // Handle both old format (values, order, sort) and new format (columnState)
    if (viewSetting.columnState) {
      api.applyColumnState({ state: viewSetting.columnState, applyOrder: true });
    }
  }, [viewSetting]);

  const resetConfig = React.useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.resetColumnState();
  }, []);

  // Handle grid ready
  const onGridReady = React.useCallback(() => {
    // Auto-load saved view if available
    if (viewSetting?.columnState) {
      loadConfig();
    }
  }, [viewSetting, loadConfig]);

  React.useEffect(() => {
    if(sendResults !== null) {
      clearTimeout(saveTimer.current);

      saveTimer.current = setTimeout(
        function() {
          setSendResults(null);
        }, 2000
      );
    }
  }, [saveTimer, sendResults]);

  // Update grid data when endpoints change
  React.useEffect(() => {
    setGridData(endpoints);
  }, [endpoints]);

  function onAddExternal() {
    if(!hasError) {
      var endpointDetails =         {
        name: endName.value,
        desc: endDesc.value,
        ip: endAddr
      };

      endpointDetails['id'] = md5(JSON.stringify(endpointDetails));

      if (selectedRow) {
        const updates = {
          op: "update",
          old: selectedRow,
          new: endpointDetails
        };

        setChanges(prev => [
          ...prev,
          updates
        ]);
      } else {
        const numEndpoints = endpoints.length;
        const numAdditions = changes.filter(change => change.op === "add").length;
        const numDeletions = changes.filter(change => change.op === "delete").length;
        const subnetSize = getSubnetSize(subnet.cidr) - 2;

        if (((numEndpoints + numAdditions) - numDeletions) >= subnetSize) {
          enqueueSnackbar(`Number of endpoints cannot exceed subnet size of ${subnetSize}`, { variant: "error" });
          return;
        }

        endpointDetails['op'] = "add";

        setChanges(prev => [
          ...prev,
          endpointDetails
        ]);
      }

      setEndName({ value: "", error: true });
      setEndDesc({ value: "", error: true });
      setEndAddrInput("");
      setEndAddr(null);
    }
  }

  function onSubmit() {
    (async () => {
      try {
        setSending(true);

        const bodyData = endpoints.reduce((acc, curr) => {
          const newEndpoint = {
            name: curr.name,
            desc: curr.desc,
            ip: curr.ip === "<auto>" ? null : curr.ip
          };

          acc.push(newEndpoint);

          return acc;
        }, []);

        await dispatch(replaceBlockExtSubnetEndpointsAsync({ space: space, block: block, external: external, subnet: subnet.name, body: bodyData }));
        onCancel();
        enqueueSnackbar("Successfully updated External Subnet Endpoints", { variant: "success" });
        // refresh();
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

  const onCancel = React.useCallback(() => {
    if (open) {
      handleClose();

      setSelectedRow(null);
      setChanges([]);

      setEndName({ value: "", error: true });
      setEndDesc({ value: "", error: true });
      setEndAddrInput("");
      setEndAddr(null);
    }
  }, [open, handleClose]);

  function onNameChange(event) {
    const newName = event.target.value;

    if(endpoints) {
      const regex = new RegExp(
        EXTERNAL_NAME_REGEX
      );

      const nameError = newName ? !regex.test(newName) : false;
      const nameExists = endpoints?.reduce((acc, curr) => {
        if(selectedRow) {
          if (curr['name'].toLowerCase() !== selectedRow.name.toLowerCase()) {
            acc.push(curr['name'].toLowerCase());
          }
        } else {
          acc.push(curr['name'].toLowerCase());
        }

        return acc;
      }, []).includes(newName.toLowerCase());

      setEndName({
          value: newName,
          error: (nameError || nameExists)
      });
    }
  }

  function onDescChange(event) {
    const newDesc = event.target.value;

    const regex = new RegExp(
      EXTERNAL_DESC_REGEX
    );

    setEndDesc({
      value: newDesc,
      error: (newDesc ? !regex.test(newDesc) : false)
    });
  }

  const hasError = React.useMemo(() => {
    const errorCheck = (endName.error || endDesc.error);
    const emptyCheck = (endName.value.length === 0 || endDesc.value.length === 0 || endAddr === null);

    return (errorCheck || emptyCheck);
  }, [endName, endDesc, endAddr]);

  React.useEffect(() => {
    if(subnet) {
      var newEndpoints = cloneDeep(subnet['endpoints']);

      var newData = newEndpoints.reduce((acc, curr) => {
        // curr['id'] = `${subnet}@${curr.name}}`;
        curr['id'] = md5(JSON.stringify(curr));

        acc.push(curr);

        return acc;
      }, []);

      changes.forEach(change => {
        switch(change.op) {
          case "add": {
            newData.push(omit(change, 'op'));

            break;
          }
          case "update": {
            const index = newData.findIndex(e => e.name === change.old.name);

            if (index !== -1) {
              newData[index] = change.new;
            }

            break;
          }
          case "delete": {
            newData = newData.filter(e => e.name !== change.name);

            break;
          }
          default:
            break;
        }
      });

      const endpointAddresses = newData.map(e => e.ip);
      const newAddressOptions = expandCIDR(subnet.cidr).slice(1,-1).filter(addr => !endpointAddresses.includes(addr));

      setEndpoints(newData);
      setAddressOptions(["<auto>", ...newAddressOptions]);
    } else {
      onCancel();
    }
  }, [subnet, changes, onCancel]);

  return (
    <EndpointContext.Provider value={{ endpoints, setChanges, selectedRow, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <Dialog
        open={open}
        onClose={onCancel}
        PaperComponent={DraggablePaper}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          style: {
            overflowY: "unset"
          },
        }}
      >
        <DialogTitle style={{ cursor: 'move' }} id="draggable-dialog-title">
          <Box sx={{ display: "flex", flexDirection: "row" }}>
            <Box>
              Manage External Subnet Endpoints
            </Box>
            <Box sx={{ ml: "auto" }}>
              <IconButton
                color="primary"
                size="small"
                onClick={refresh}
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
            Define the Endpoints below which should be associated with the Subnet <Spotlight>'{subnet && subnet.name}'</Spotlight>
          </DialogContentText>
          { isAdmin &&
          <React.Fragment>
          <Box
            sx={{
              mt: 4,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: '25px',
              borderWidth: '1px 1px 1px 1px',
              borderStyle: 'solid',
              borderColor: 'rgb(224, 224, 224)',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgb(80, 80, 80)' : 'rgb(240, 240, 240)'

            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: theme.palette.mode === 'dark' ? '#9ba7b4' : '#555e68'
              }}
            >
              {
                selectedRow ?
                "Edit Existing Endpoint" :
                "Add New Endpoint"
              }
            </span>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              height: '40px',
              borderWidth: '0px 1px 1px 1px',
              borderStyle: 'solid',
              borderColor: 'rgb(224, 224, 224)'
            }}
          >
            <Box
              sx={{
                pl: 1,
                height: '100%',
                display: 'flex',
                flex: '1 1 auto',
                alignItems: 'center',
                width: 'calc(((100% - 50px) / 1.80) * 0.5)',
                borderRight: '1px solid rgb(224, 224, 224)'
              }}
              style={
                theme.palette.mode === 'dark'
                ? (endName.error && endName.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : (endName.error && endName.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <OutlinedInput
                fullWidth
                placeholder="Name"
                value={endName.value}
                onChange={onNameChange}
                inputProps={{
                  spellCheck: false,
                  style: {
                    fontSize: '14px',
                    fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                    padding: '4px 0px 5px'
                  }
                }}
                endAdornment={
                  <Tooltip
                    arrow
                    placement="top"
                    title={
                      <>
                        - External network name must be unique
                        <br />- Max of 32 characters
                        <br />- Can contain alphnumerics
                        <br />- Can contain underscore, hypen, and period
                        <br />- Cannot start/end with underscore, hypen, or period
                      </>
                    }
                  >
                    <InfoOutlined
                      fontSize="small"
                      sx={{
                        pl: 0.5,
                        color: 'lightgrey',
                        cursor: 'default'
                      }}
                    />
                  </Tooltip>
                }
                sx={{
                  "& fieldset": { border: 'none' },
                }}
              />
            </Box>
            <Box
              sx={{
                pl: 1,
                height: '100%',
                display: 'flex',
                flex: '1 1 auto',
                alignItems: 'center',
                width: 'calc(((100% - 50px) / 1.80) * 1)',
                borderRight: '1px solid rgb(224, 224, 224)'
              }}
              style={
                theme.palette.mode === 'dark'
                ? (endDesc.error && endDesc.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : (endDesc.error && endDesc.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <OutlinedInput
                fullWidth
                placeholder="Description"
                value={endDesc.value}
                onChange={onDescChange}
                inputProps={{
                  spellCheck: false,
                  style: {
                    fontSize: '14px',
                    fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                    padding: '4px 0px 5px'
                  }
                }}
                endAdornment={
                  <Tooltip
                    arrow
                    placement="top"
                    title={
                      <>
                        - Max of 64 characters
                        <br />- Can contain alphnumerics
                        <br />- Can contain spaces
                        <br />- Can contain underscore, hypen, slash, and period
                        <br />- Cannot start/end with underscore, hypen, slash, or period
                      </>
                    }
                  >
                    <InfoOutlined
                      fontSize="small"
                      sx={{
                        pl: 0.5,
                        color: 'lightgrey',
                        cursor: 'default'
                      }}
                    />
                  </Tooltip>
                }
                sx={{
                  "& fieldset": { border: 'none' },
                }}
              />
            </Box>
            <Box
              sx={{
                pl: 1,
                height: '100%',
                display: 'flex',
                flex: '1 1 auto',
                alignItems: 'center',
                width: 'calc(((100% - 50px) / 1.80) * 0.3)',
              }}
              style={
                theme.palette.mode === 'dark'
                ? { backgroundColor: 'rgb(49, 57, 67)' }
                : { backgroundColor: 'unset' }
              }
            >
              <Autocomplete
                disabled={false}
                openOnFocus={true}
                forcePopupIcon={false}
                id="grouped-demo"
                size="small"
                options={addressOptions}
                // getOptionLabel={(option) => option.name}
                inputValue={endAddrInput}
                onInputChange={(event, newInputValue) => setEndAddrInput(newInputValue)}
                value={endAddr}
                onChange={(event, newValue) => setEndAddr(newValue)}
                isOptionEqualToValue={(option, value) => isEqual(option, value)}
                sx={{ width: 300 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="standard"
                    // label="IP Address"
                    placeholder="IP Address"
                    InputProps={{
                      ...params.InputProps,
                      disableUnderline: true,
                      spellCheck: false,
                      style: {
                        fontSize: '14px',
                        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                        padding: '4px 0px 5px'
                      }
                    }}
                  />
                )}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                minWidth: '40px',
                height: '100%',
                borderLeft: '1px solid rgb(224, 224, 224)',
                backgroundColor: theme.palette.mode === 'dark' ? 'rgb(49, 57, 67)' : 'unset'
              }}
            >
              <Tooltip
                arrow
                placement="top"
                title={ selectedRow ? "Update Network" : "Add Network" }
              >
                <span>
                  <IconButton
                    disableRipple
                    disabled={(hasError || sending || refreshing)}
                    onClick={onAddExternal}
                  >
                    {
                      selectedRow ?
                      <PlaylistAddCheckOutlined
                        style={
                          theme.palette.mode === 'dark'
                          ? (hasError || sending || refreshing)
                            ? { color: "lightgrey", opacity: 0.25 }
                            : { color: "forestgreen", opacity: 1 }
                          : (hasError || sending || refreshing)
                            ? { color: "black", opacity: 0.25 }
                            : { color: "limegreen", opacity: 1 }
                        }
                      /> :
                      <PlaylistAddOutlined
                        style={
                          theme.palette.mode === 'dark'
                          ? (hasError || sending || refreshing)
                            ? { color: "lightgrey", opacity: 0.25 }
                            : { color: "forestgreen", opacity: 1 }
                          : (hasError || sending || refreshing)
                            ? { color: "black", opacity: 0.25 }
                            : { color: "limegreen", opacity: 1 }
                        }
                      />
                    }
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
          </React.Fragment>
          }
          <Box
            sx={{
              mt: 4,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: '25px',
              borderWidth: '1px 1px 0px 1px',
              borderStyle: 'solid',
              borderColor: 'rgb(224, 224, 224)',
              backgroundColor: theme.palette.mode === 'dark' ? 'rgb(80, 80, 80)' : 'rgb(240, 240, 240)'

            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: theme.palette.mode === 'dark' ? '#9ba7b4' : '#555e68'
              }}
            >
              Existing Endpoints
            </span>
          </Box>
          <Box
            sx={{
              // mt: 4,
              height: "335px"
            }}
          >
            <Box
              className="ag-theme-quartz"
              sx={{ height: '100%', width: '100%' }}
              data-ag-theme-mode={isDarkMode ? 'dark' : 'light'}
            >
              <AgGridReact
                ref={gridRef}
                theme={gridTheme}
                rowData={gridData || []}
                columnDefs={columns}
                defaultColDef={defaultColDef}
                getRowId={(params) => params.data.id}
                rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: false }}
                cellSelection={false}
                suppressCellFocus={true}
                onRowClicked={onRowClicked}
                onCellDoubleClicked={onCellDoubleClicked}
                onGridReady={onGridReady}
                loading={sending || !endpoints || refreshing}
                loadingOverlayComponent={() => (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    {sending ? <Update>Updating</Update> : "Loading..."}
                  </Box>
                )}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onCancel}
            sx={{ position: "unset" }}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            loading={sending}
            disabled={unchanged || sending || refreshing}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </EndpointContext.Provider>
  );
}
