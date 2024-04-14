import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { isEqual, isEmpty, pickBy, orderBy, throttle } from 'lodash';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import { useTheme } from '@mui/material/styles';

import {
  Box,
  Tooltip,
  IconButton,
  Autocomplete,
  TextField,
  CircularProgress,
  Popper,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  Button
  // Switch
}  from "@mui/material";

import {
  Person,
  Apps,
  QuestionMark,
  PersonSearch,
  SaveAlt,
  HighlightOff,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined
} from "@mui/icons-material";

import Shrug from "../../../img/pam/Shrug";

import {
  getAdmins,
  replaceAdmins
} from "../../ipam/ipamAPI";

import {
  selectViewSetting,
  updateMeAsync
} from "../../ipam/ipamSlice";

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

const Update = styled("span")(({ theme }) => ({
  fontWeight: 'bold',
  color: theme.palette.error.light,
  textShadow: '-1px 0 white, 0 1px white, 1px 0 white, 0 -1px white'
}));

const gridStyle = {
  height: '100%',
  border: "1px solid rgba(224, 224, 224, 1)",
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

function HeaderMenu(props) {
  const { setting } = props;
  const { saving, sendResults, saveConfig, loadConfig, resetConfig } = React.useContext(AdminContext);

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
            // onClick={onClick}
            PaperProps={{
              elevation: 0,
              style: {
                width: 215,
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
                  right: 26,
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

function RenderDelete(props) {
  const { value } = props;
  const { admins, setAdmins, selectionModel } = React.useContext(AdminContext);

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
          onClick={() => setAdmins(admins.filter(x => x.id !== value.id))}
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

export default function Administration() {
  const { enqueueSnackbar } = useSnackbar();

  const [admins, setAdmins] = React.useState(null);
  const [loadedAdmins, setLoadedAdmins] = React.useState(null);
  const [gridData, setGridData] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(null);
  const [input, setInput] = React.useState("");
  const [selected, setSelected] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const [appSearch, setAppSearch] = React.useState(false);

  const viewSetting = useSelector(state => selectViewSetting(state, 'admins'));
  const dispatch = useDispatch();

  const saveTimer = React.useRef();
  const adminLoadedRef = React.useRef(false);

  const theme = useTheme();

  const columns = React.useMemo(() => [
    { name: "type", header: () => <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><PersonSearch /></span> , width: 40, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({value}) => <RenderType value={value} />, visible: true },
    { name: "name", header: "Name", type: "string", flex: 0.5, visible: true },
    { name: "email", header: "Email", type: "string", flex: 1, visible: true, render: ({value}) => value ? value : "N/A" },
    { name: "id", header: "Object ID", type: "string", flex: 0.75, visible: true },
    { name: "delete", header: () => <HeaderMenu setting="admins"/> , width: 50, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => <RenderDelete value={data} />, visible: true }
  ], []);

  const filterValue = [
    { name: "name", operator: "contains", type: "string", value: "" },
    { name: "email", operator: "contains", type: "string", value: "" },
    { name: "id", operator: "contains", type: "string", value: "" }
  ];

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

  const popperStyle = {
    popper: {
      width: "fit-content"
    }
  };

  const MyPopper = function (props) {
    return <Popper {...props} style={{ popperStyle }} placement="bottom-start" />;
  };

  function onClick(data) {
    var id = data.id;
    var newSelectionModel = {};

    setSelectionModel(prevState => {
      if(!prevState.hasOwnProperty(id)) {
        newSelectionModel[id] = data;
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
      { "op": "add", "path": `/views/admins`, "value": saveData }
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
    setColumnSortState({ name: 'name', dir: 1, type: 'string' });
  }, [columns]);

  const renderColumnContextMenu = React.useCallback((menuProps) => {
    const columnIndex = menuProps.items.findIndex((item) => item.itemId === 'columns');
    const idIndex = menuProps.items[columnIndex].items.findIndex((item) => item.value === 'delete');

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
          admins,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(admins);
    }
  },[admins, columnSortState]);

  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  function NoRowsOverlay() {
    return (
      <React.Fragment>
        <Shrug />
        <Typography variant="overline" display="block"  sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </React.Fragment>
    );
  }

  return (
    <AdminContext.Provider value={{ admins, setAdmins, selectionModel, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <Wrapper>
        <MainBody>
          <FloatingHeader>
            <Box sx={{ display: "flex", alignItems: "center", width: "35%", p: 0.5 }}>
              <Tooltip
                title={ appSearch ? "Service Principals" : "Users" }
                arrow
                PopperProps={{
                  sx: {
                      "& .MuiTooltip-tooltip": {
                        left: appSearch ? "32px" : "8px"
                      },
                      "& .MuiTooltip-arrow": {
                        left: appSearch ? "-32px !important" : "-8px !important"
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
                PopperComponent={MyPopper}
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
                    // variant="standard"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {usersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                      style: {
                        borderRadius: "0px 4px 4px 0px"
                      }
                    }}
                  />
                )}
              />
            </Box>
            <HeaderTitle>Admin Users</HeaderTitle>
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
              <ReactDataGrid
                theme={theme.palette.mode === 'dark' ? "default-dark" : "default-light"}
                idProperty="id"
                showCellBorders="horizontal"
                showZebraRows={false}
                multiSelect={true}
                showActiveRowIndicator={false}
                enableColumnAutosize={false}
                showColumnMenuGroupOptions={false}
                showColumnMenuLockOptions={false}
                enableColumnFilterContextMenu={true}
                updateMenuPositionOnColumnsChange={false}
                renderColumnContextMenu={renderColumnContextMenu}
                onBatchColumnResize={onBatchColumnResize}
                onSortInfoChange={onSortInfoChange}
                onColumnOrderChange={onColumnOrderChange}
                onColumnVisibleChange={onColumnVisibleChange}
                reservedViewportWidth={0}
                columns={columnState || []}
                columnOrder={columnOrderState}
                loading={loading || sending}
                loadingText={sending ? <Update>Updating</Update> : "Loading"}
                dataSource={gridData || []}
                defaultFilterValue={filterValue}
                onRowClick={(rowData) => onClick(rowData.data)}
                onCellDoubleClick={onCellDoubleClick}
                selected={selectionModel}
                sortInfo={columnSortState}
                emptyText={NoRowsOverlay}
                style={gridStyle}
              />
            </GridBody>
          </DataSection>
        </MainBody>
      </Wrapper>
    </AdminContext.Provider>
  );
}
