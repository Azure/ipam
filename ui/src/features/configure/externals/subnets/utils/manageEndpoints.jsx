import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { styled } from "@mui/material/styles";

import { omit, isEmpty, isEqual, pickBy, orderBy, cloneDeep } from "lodash";

import { useSnackbar } from "notistack";

import ReactDataGrid from "@inovua/reactdatagrid-community";
import "@inovua/reactdatagrid-community/index.css";
import "@inovua/reactdatagrid-community/theme/default-dark.css";

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
  // HighlightOff,
  InfoOutlined
} from "@mui/icons-material";

import LoadingButton from "@mui/lab/LoadingButton";

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

const gridStyle = {
  height: '100%',
  border: '1px solid rgba(224, 224, 224, 1)',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

function RenderDelete(props) {
  const { value } = props;
  const { setChanges, selectionModel } = React.useContext(EndpointContext);

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
            display: (isEqual([value.id], Object.keys(selectionModel))) ? "flex" : "none"
          }}
          disableFocusRipple
          disableTouchRipple
          disableRipple
          onClick={() => {
            var endpointDetails = cloneDeep(value);

            endpointDetails['op'] = "delete";

            setChanges(prev => [
              ...prev,
              endpointDetails
            ]);
          }}
        >
          {/* <HighlightOff /> */}
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
  }

  const onSave = () => {
    saveConfig();
    setMenuOpen(false);
  }

  const onLoad = () => {
    loadConfig();
    setMenuOpen(false);
  }

  const onReset = () => {
    resetConfig();
    setMenuOpen(false);
  }

  return (
    <Box
      ref={menuRef}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
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
              disabled={ !viewSetting || isEmpty(viewSetting) }
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
  )
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
  const [selectionModel, setSelectionModel] = React.useState({});

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const [endName, setEndName] = React.useState({ value: "", error: true });
  const [endDesc, setEndDesc] = React.useState({ value: "", error: true });

  const [endAddrInput, setEndAddrInput] = React.useState("");
  const [endAddr, setEndAddr] = React.useState(null);

  const isAdmin = useSelector(getAdminStatus);
  const viewSetting = useSelector(state => selectViewSetting(state, 'extendpoints'));

  const dispatch = useDispatch();

  const saveTimer = React.useRef();

  const theme = useTheme();

  const unchanged = (subnet && endpoints) ? isEqual(subnet['endpoints'], endpoints.map(({id, ...rest}) => rest)) : false;

  const columns = React.useMemo(() => [
    { name: "name", header: "Name", type: "string", flex: 0.5, draggable: false, visible: true },
    { name: "desc", header: "Description", type: "string", flex: 1, draggable: false, visible: true },
    { name: "ip", header: "IP Address", type: "string", flex: 0.30, draggable: false, visible: true },
    { name: "id", header: () => <HeaderMenu setting="extendpoints"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => <RenderDelete value={data} />, visible: true }
  ], []);

  const filterValue = [
    { name: "name", operator: "contains", type: "string", value: "" },
    { name: "desc", operator: "contains", type: "string", value: "" },
    { name: "ip", operator: "contains", type: "string", value: "" }
  ];

  function onClick(data) {
    var id = data.id;
    var newSelectionModel = {};

    setSelectionModel(prevState => {
      if(!prevState.hasOwnProperty(id)) {
        newSelectionModel[id] = data;

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
      } else {
        setEndName({ value: "", error: true });
        setEndDesc({ value: "", error: true });
        setEndAddrInput("");
        setEndAddr(null);

        const endpointAddresses = endpoints.map(e => e.ip);
        const newAddressOptions = expandCIDR(subnet.cidr).slice(1,-1).filter(addr => !endpointAddresses.includes(addr));
  
        setAddressOptions(["<auto>", ...newAddressOptions]);
      }
      
      return newSelectionModel;
    });
  }

  const onBatchColumnResize = (batchColumnInfo) => {
    const colsMap = batchColumnInfo.reduce((acc, colInfo) => {
      const { column, flex } = colInfo
      acc[column.name] = { flex }
      return acc
    }, {});

    const newColumns = columnState.map(c => {
      return Object.assign({}, c, colsMap[c.name]);
    })

    console.log(batchColumnInfo);

    setColumnState(newColumns);
  }

  const onColumnOrderChange = (columnOrder) => {
    setColumnOrderState(columnOrder);
  }

  const onColumnVisibleChange = ({ column, visible }) => {
    const newColumns = columnState.map(c => {
      if(c.name === column.name) {
        return Object.assign({}, c, { visible });
      } else {
        return c;
      }
    });

    setColumnState(newColumns);
  }

  const onSortInfoChange = (sortInfo) => {
    setColumnSortState(sortInfo);
  }

  const saveConfig = () => {
    const values = columnState.reduce((acc, colInfo) => {
      const { name, flex, visible } = colInfo;

      acc[name] = { flex, visible };

      return acc;
    }, {});

    const saveData = {
      values: values,
      order: columnOrderState,
      sort: columnSortState
    }

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
  };

  const loadConfig = React.useCallback(() => {
    const { values, order, sort } = viewSetting;

    const colsMap = columns.reduce((acc, colInfo) => {

      acc[colInfo.name] = colInfo;

      return acc;
    }, {})

    const loadColumns = order.map(item => {
      const assigned = pickBy(values[item], v => v !== undefined)

      return Object.assign({}, colsMap[item], assigned);
    });

    setColumnState(loadColumns);
    setColumnOrderState(order);
    setColumnSortState(sort);
  }, [columns, viewSetting]);

  const resetConfig = React.useCallback(() => {
    setColumnState(columns);
    setColumnOrderState(columns.flatMap(({name}) => name));
    setColumnSortState(null);
  }, [columns]);

  const renderColumnContextMenu = React.useCallback((menuProps) => {
    const columnIndex = menuProps.items.findIndex((item) => item.itemId === 'columns');
    const idIndex = menuProps.items[columnIndex].items.findIndex((item) => item.value === 'id');

    menuProps.items[columnIndex].items.splice(idIndex, 1);
  }, []);

  React.useEffect(() => {
    if(!columnState && viewSetting) {
      if(columns && !isEmpty(viewSetting)) {
        loadConfig();
      } else {
        resetConfig();
      }
    }
  },[columns, viewSetting, columnState, loadConfig, resetConfig]);

  React.useEffect(() => {
    if(columnSortState) {
      setGridData(
        orderBy(
          endpoints,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(endpoints);
    }
  },[endpoints, columnSortState]);

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

  function onAddExternal() {
    if(!hasError) {
      var endpointDetails =         {
        name: endName.value,
        desc: endDesc.value,
        ip: endAddr
      };

      endpointDetails['id'] = md5(JSON.stringify(endpointDetails));

      if (Object.keys(selectionModel).length !== 0) {
        const updates = {
          op: "update",
          old: Object.values(selectionModel)[0],
          new: endpointDetails
        }

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

      setSelectionModel({});
      setChanges([]);

      setEndName({ value: "", error: true });
      setEndDesc({ value: "", error: true });
      setEndAddrInput("");
      setEndAddr(null);
    }
  }, [open, handleClose]);

  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  function onNameChange(event) {
    const newName = event.target.value;

    if(endpoints) {
      const regex = new RegExp(
        EXTERNAL_NAME_REGEX
      );

      const nameError = newName ? !regex.test(newName) : false;
      const nameExists = endpoints?.reduce((acc, curr) => {
        if(Object.keys(selectionModel).length !== 0) {
          if (curr['name'].toLowerCase() !== Object.values(selectionModel)[0].name.toLowerCase()) {
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
    <EndpointContext.Provider value={{ endpoints, setChanges, selectionModel, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
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
                Object.keys(selectionModel).length !== 0 ?
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
                width: columnState && columnState[0].flex > 1 ? columnState[0].flex : 'calc(((100% - 40px) / 1.80) * 0.5)',
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
                width: columnState && columnState[1].flex > 1 ? columnState[1].flex : 'calc(((100% - 40px) / 1.80) * 1)',
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
                width: columnState && columnState[2].flex > 1 ? columnState[2].flex : 'calc(((100% - 40px) / 1.80) * 0.3)',
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
                title={ Object.keys(selectionModel).length !== 0 ? "Update Network" : "Add Network" }
              >
                <span>
                  <IconButton
                    disableRipple
                    disabled={(hasError || sending || refreshing)}
                    onClick={onAddExternal}
                  >
                    {
                      Object.keys(selectionModel).length !== 0 ?
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
            <ReactDataGrid
              theme={theme.palette.mode === 'dark' ? "default-dark" : "default-light"}
              idProperty="id"
              showCellBorders="horizontal"
              showZebraRows={false}
              multiSelect={true}
              click
              showActiveRowIndicator={false}
              enableColumnAutosize={false}
              showColumnMenuGroupOptions={false}
              showColumnMenuLockOptions={false}
              updateMenuPositionOnColumnsChange={false}
              renderColumnContextMenu={renderColumnContextMenu}
              onBatchColumnResize={onBatchColumnResize}
              onSortInfoChange={onSortInfoChange}
              onColumnOrderChange={onColumnOrderChange}
              onColumnVisibleChange={onColumnVisibleChange}
              reservedViewportWidth={0}
              columns={columnState || []}
              columnOrder={columnOrderState}
              loading={sending || !endpoints || refreshing}
              loadingText={sending ? <Update>Updating</Update> : "Loading"}
              dataSource={gridData || []}
              sortInfo={columnSortState}
              defaultFilterValue={filterValue}
              onRowClick={(rowData) => { isAdmin && onClick(rowData.data)}}
              onCellDoubleClick={onCellDoubleClick}
              selected={selectionModel}
              style={gridStyle}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onCancel}
            sx={{ position: "unset" }}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={onSubmit}
            loading={sending}
            disabled={unchanged || sending || refreshing}
            // sx={{ position: "unset" }}
          >
            Apply
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </EndpointContext.Provider>
  );
}
