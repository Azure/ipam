import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { isEmpty, isEqual, pickBy, orderBy, cloneDeep } from 'lodash';

import { useSnackbar } from "notistack";

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import Draggable from 'react-draggable';

import { useTheme } from '@mui/material/styles';

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
  Paper
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
  HighlightOff,
  InfoOutlined
} from "@mui/icons-material";

import LoadingButton from '@mui/lab/LoadingButton';

import {
  replaceBlockExternals
} from "../../../ipam/ipamAPI";

import {
  fetchNetworksAsync,
  selectSubscriptions,
  selectNetworks,
  selectViewSetting,
  updateMeAsync
} from "../../../ipam/ipamSlice";

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../tools/utils/iputils";

import {
  EXTERNAL_NAME_REGEX,
  EXTERNAL_DESC_REGEX,
  CIDR_REGEX
} from "../../../../global/globals";

const ExternalContext = React.createContext({});

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
  const { externals, setAdded, deleted, setDeleted, selectionModel } = React.useContext(ExternalContext);

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
            if(externals.find(e => e.name === value.name) && !deleted.includes(value.name)) {
              setDeleted(prev => [...prev, value.name]);
            } else {
              setAdded(prev => prev.filter(e => e.name !== value.name));
            }
          }}
        >
          <HighlightOff />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function HeaderMenu(props) {
  const { setting } = props;
  const { saving, sendResults, saveConfig, loadConfig, resetConfig } = React.useContext(ExternalContext);

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

export default function EditExternals(props) {
  const { open, handleClose, space, block, refresh, refreshing, refreshingState } = props;

  const { enqueueSnackbar } = useSnackbar();

  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [externals, setExternals] = React.useState(null);
  const [added, setAdded] = React.useState([]);
  const [deleted, setDeleted] = React.useState([]);
  const [gridData, setGridData] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [refreshingData, setRefreshingData] = React.useState(false);
  const [selectionModel, setSelectionModel] = React.useState({});

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const [extName, setExtName] = React.useState({ value: "", error: true });
  const [extDesc, setExtDesc] = React.useState({ value: "", error: true });
  const [extCidr, setExtCidr] = React.useState({ value: "", error: true });

  const subscriptions = useSelector(selectSubscriptions);
  const networks = useSelector(selectNetworks);
  const viewSetting = useSelector(state => selectViewSetting(state, 'externals'));
  const dispatch = useDispatch();

  const saveTimer = React.useRef();

  const theme = useTheme();

  //eslint-disable-next-line
  const unchanged = (block && externals) ? isEqual(block['externals'], externals.map(({id, ...rest}) => rest)) : false;

  const columns = React.useMemo(() => [
    { name: "name", header: "Name", type: "string", flex: 0.5, draggable: false, visible: true },
    { name: "desc", header: "Description", type: "string", flex: 1, draggable: false, visible: true },
    { name: "cidr", header: "CIDR", type: "string", flex: 0.30, draggable: false, visible: true },
    { name: "id", header: () => <HeaderMenu setting="externals"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => <RenderDelete value={data} />, visible: true }
  ], []);

  const filterValue = [
    { name: "name", operator: "contains", type: "string", value: "" },
    { name: "desc", operator: "contains", type: "string", value: "" },
    { name: "cidr", operator: "contains", type: "string", value: "" }
  ];

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
      { "op": "add", "path": `/views/externals`, "value": saveData }
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
          externals,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(externals);
    }
  },[externals, columnSortState]);

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

  function refreshData() {
    (async() => {
      try {
        setRefreshingData(true);
        await dispatch(fetchNetworksAsync());
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar(e.message, { variant: "error" });
      } finally {
        setRefreshingData(false);
      }
    })();
  }

  function refreshAll() {
    refresh();
    refreshData();
  }

  function onAddExternal() {
    if(!hasError) {
      setAdded(prev => [
        ...prev,
        {
          name: extName.value,
          desc: extDesc.value,
          cidr: extCidr.value
        }
      ]);

      setExtName({ value: "", error: true });
      setExtDesc({ value: "", error: true });
      setExtCidr({ value: "", error: true });
    }
  }

  function onSubmit() {
    (async () => {
      try {
        setSending(true);
        const bodyData = externals.map(({id, ...rest}) => rest);
        await replaceBlockExternals(block.parent_space, block.name, bodyData);
        handleClose();
        setAdded([]);
        setDeleted([]);
        setExtName({ value: "", error: true });
        setExtDesc({ value: "", error: true });
        setExtCidr({ value: "", error: true });
        enqueueSnackbar("Successfully updated Block External Networks", { variant: "success" });
        refresh();
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

  function onCancel() {
    setAdded([]);
    setDeleted([]);

    setExtName({ value: "", error: true });
    setExtDesc({ value: "", error: true });
    setExtCidr({ value: "", error: true });

    handleClose();
  }
  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  function onNameChange(event) {
    const newName = event.target.value;

    if(externals) {
      const regex = new RegExp(
        EXTERNAL_NAME_REGEX
      );

      const nameError = newName ? !regex.test(newName) : false;
      const nameExists = externals.map(e => e.name.toLowerCase()).includes(newName.toLowerCase());

      setExtName({
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

    setExtDesc({
      value: newDesc,
      error: (newDesc ? !regex.test(newDesc) : false)
    });
  }

  function onCidrChnage(event) {
    const newCidr = event.target.value;

    const regex = new RegExp(
      CIDR_REGEX
    );

    const cidrError = newCidr ? !regex.test(newCidr) : false;

    var blockNetworks= [];
    var extNetworks = [];

    var cidrInBlock = false;
    var resvOverlap = true;
    var vnetOverlap = true;
    var extOverlap = true;

    if(!cidrError && newCidr.length > 0) {
      cidrInBlock = isSubnetOf(newCidr, block.cidr);

      const openResv = block?.resv.reduce((acc, curr) => {
        if(!curr['settledOn']) {
          acc.push(curr['cidr']);
        }

        return acc;
      }, []);

      if(space && block && networks) {
        blockNetworks = networks?.reduce((acc, curr) => {
          if(curr['parent_space'] && curr['parent_block']) {
            if(curr['parent_space'] === space && curr['parent_block'].includes(block.name)) {
              acc = acc.concat(curr['prefixes']);
            }
          }

          return acc;
        }, []);
      }

      if(externals) {
        extNetworks = externals?.reduce((acc, curr) => {
          acc.push(curr['cidr']);

          return acc;
        }, []);
      }

      resvOverlap = isSubnetOverlap(newCidr, openResv);
      vnetOverlap = isSubnetOverlap(newCidr, blockNetworks);
      extOverlap = isSubnetOverlap(newCidr, extNetworks);
    }

    setExtCidr({
      value: newCidr,
      error: (cidrError || !cidrInBlock || resvOverlap || vnetOverlap || extOverlap)
    });
  }

  const hasError = React.useMemo(() => {
    const errorCheck = (extName.error || extDesc.error || extCidr.error);
    const emptyCheck = (extName.value.length === 0 || extDesc.value.length === 0 || extCidr.value.length === 0);

    return (errorCheck || emptyCheck);
  }, [extName, extDesc, extCidr]);

  React.useEffect(() => {
    if(block) {
      var newExternals = cloneDeep(block['externals']);

      newExternals = newExternals.filter(e => !deleted.includes(e.name));
      newExternals = newExternals.concat(added);

      const newData = newExternals.reduce((acc, curr) => {
        curr['id'] = `${space}@${block.name}@${curr.name}}`

        acc.push(curr);

        return acc;
      }, []);

      setExternals(newData);
    }
  }, [space, block, added, deleted]);

  return (
    <ExternalContext.Provider value={{ externals, setAdded, deleted, setDeleted, selectionModel, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
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
            External Network Association
            </Box>
            <Box sx={{ ml: "auto" }}>
              <IconButton
                color="primary"
                size="small"
                onClick={refreshAll}
                disabled={refreshing || refreshingData || sending}
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
            Define the External Networks below which should be associated with the Block <Spotlight>'{block && block.name}'</Spotlight>
          </DialogContentText>
          <Box
            sx={{
              pt: 4,
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
              loading={sending || !subscriptions || !externals || refreshing || refreshingData || refreshingState}
              loadingText={sending ? <Update>Updating</Update> : "Loading"}
              dataSource={gridData || []}
              sortInfo={columnSortState}
              defaultFilterValue={filterValue}
              onRowClick={(rowData) => onClick(rowData.data)}
              onCellDoubleClick={onCellDoubleClick}
              selected={selectionModel}
              style={gridStyle}
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: '25px',
              borderWidth: '0px 1px 1px 1px',
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
              Add New External Network
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
                ? (extName.error && extName.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : (extName.error && extName.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <OutlinedInput
                fullWidth
                placeholder="Name"
                value={extName.value}
                onChange={onNameChange}
                inputProps={{
                  spellCheck: 'false',
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
                ? (extDesc.error && extDesc.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : (extDesc.error && extDesc.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <OutlinedInput
                fullWidth
                placeholder="Description"
                value={extDesc.value}
                onChange={onDescChange}
                inputProps={{
                  spellCheck: 'false',
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
                ? (extCidr.error && extCidr.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : (extCidr.error && extCidr.value.length > 0)
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <OutlinedInput
                fullWidth
                placeholder="CIDR"
                value={extCidr.value}
                onChange={onCidrChnage}
                inputProps={{
                  spellCheck: 'false',
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
                        - Must be in valid CIDR notation format
                        <br />&nbsp;&nbsp;&nbsp;&nbsp;• Example: 1.2.3.4/5
                        <br />- Must be a subset of the containing Block CIDR
                        <br />- Cannot overlap any associated Networks
                        <br />&nbsp;&nbsp;&nbsp;&nbsp;• Virtual Networks
                        <br />&nbsp;&nbsp;&nbsp;&nbsp;• Virtual Hubs
                        <br />- Cannot overlap any unfulfilled Reservations
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
                  pr: 1,
                  "& fieldset": { border: 'none' },
                }}
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
                title="Add Network"
              >
                <span>
                  <IconButton
                    disableRipple
                    disabled={(hasError || sending || refreshing || refreshingData)}
                    onClick={onAddExternal}
                  >
                    <PlaylistAddOutlined
                      style={
                        theme.palette.mode === 'dark'
                        ? (hasError || sending || refreshing || refreshingData)
                          ? { color: "lightgrey", opacity: 0.25 }
                          : { color: "forestgreen", opacity: 1 }
                        : (hasError || sending || refreshing || refreshingData)
                          ? { color: "black", opacity: 0.25 }
                          : { color: "limegreen", opacity: 1 }
                      }
                    />
                  </IconButton>
                </span>
              </Tooltip>
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
          <LoadingButton
            onClick={onSubmit}
            loading={sending}
            disabled={unchanged || sending || refreshing || refreshingData || refreshingState}
            // sx={{ position: "unset" }}
          >
            Apply
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </ExternalContext.Provider>
  );
}
