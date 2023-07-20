import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { isEmpty, isEqual, pickBy, orderBy, debounce, cloneDeep } from 'lodash';

import { useSnackbar } from "notistack";

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
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Tooltip
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
  HighlightOff
} from "@mui/icons-material";

import LoadingButton from '@mui/lab/LoadingButton';

import {
  replaceBlockExternals
} from "../../../ipam/ipamAPI";

import {
  selectSubscriptions,
  selectNetworks,
  // fetchNetworksAsync,
  selectViewSetting,
  updateMeAsync
} from "../../../ipam/ipamSlice";

import {
  isSubnetOf,
  isSubnetOverlap
} from "../../../tools/utils/iputils";

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
            // onClick={onClick}
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
  const [selectionModel, setSelectionModel] = React.useState({});

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const [extName, setExtName] = React.useState("");
  const [extNameErr, setExtNameErr] = React.useState(false);
  const [extDesc, setExtDesc] = React.useState("");
  const [extDescErr, setExtDescErr] = React.useState(false);
  const [extCidr, setExtCidr] = React.useState("");
  const [extCidrErr, setExtCidrErr] = React.useState(false);
  const [hasError, setHasError] = React.useState(true);

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
    { name: "cidr", header: "CIDR", type: "string", flex: 0.25, draggable: false, visible: true },
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

  function onAddExternal() {
    if(!hasError) {
      setAdded(prev => [
        ...prev,
        {
          name: extName,
          desc: extDesc,
          cidr: extCidr
        }
      ]);

      setExtName("");
      setExtDesc("");
      setExtCidr("");
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
        setExtName("");
        setExtDesc("");
        setExtCidr("");
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

    setExtName("");
    setExtDesc("");
    setExtCidr("");

    handleClose();
  }
  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  const onNameChange = React.useCallback(() => {
    if(externals) {
      const regex = new RegExp(
        //eslint-disable-next-line
        "^(?![\._-])([a-zA-Z0-9\._-]){1,32}(?<![\._-])$"
      );

      const nameError = extName ? !regex.test(extName) : false;
      const nameExists = externals.map(e => e.name.toLowerCase()).includes(extName.toLowerCase());

      setExtNameErr(nameError || nameExists)
    }
  }, [externals, extName]);

  const updateName = React.useMemo(() => debounce(() => onNameChange(), 100), [onNameChange]);

  React.useEffect(() => {
    updateName();
  }, [extName, updateName]);

  const onDescChange = React.useCallback(() => {
    const regex = new RegExp(
      //eslint-disable-next-line
      "^(?![ /\._-])([a-zA-Z0-9 /\._-]){1,64}(?<![ /\._-])$"
    );

    setExtDescErr(extDesc ? !regex.test(extDesc) : false);
  }, [extDesc]);

  const updateDesc = React.useMemo(() => debounce(() => onDescChange(), 100), [onDescChange]);

  React.useEffect(() => {
    updateDesc();
  }, [extDesc, updateDesc]);

  const onCidrChange = React.useCallback(() => {
    const regex = new RegExp(
      "^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]).){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(/(3[0-2]|[1-2][0-9]|[0-9]))$"
    );

    const cidrError = extCidr ? !regex.test(extCidr) : false;

    var blockNetworks= [];
    var extNetworks = [];
    var cidrInBlock = false;
    var resvOverlap = true;
    var vnetOverlap = true;
    var extOverlap = true;

    if(!cidrError && extCidr.length > 0) {
      cidrInBlock = isSubnetOf(extCidr, block.cidr);

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

      resvOverlap = isSubnetOverlap(extCidr, openResv);
      vnetOverlap = isSubnetOverlap(extCidr, blockNetworks);
      extOverlap = isSubnetOverlap(extCidr, extNetworks);
    }

    if(extCidr.length > 0) {
      setExtCidrErr(cidrError || !cidrInBlock || resvOverlap || vnetOverlap || extOverlap);
    } else {
      setExtCidrErr(false);
    }
  }, [extCidr, space, block, networks, externals]);

  const updateCidr = React.useMemo(() => debounce(() => onCidrChange(), 100), [onCidrChange]);

  React.useEffect(() => {
    updateCidr();
  }, [extCidr, updateCidr]);

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

  React.useEffect(() => {
    const errorCheck = (extNameErr || extDescErr || extCidrErr);
    const emptyCheck = (extName.length === 0 || extDesc.length === 0 || extCidr.length === 0);

    setHasError(errorCheck || emptyCheck);
  }, [extName, extNameErr, extDesc, extDescErr, extCidr, extCidrErr]);

  return (
    <ExternalContext.Provider value={{ externals, setAdded, deleted, setDeleted, selectionModel, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <Dialog
        open={open}
        onClose={onCancel}
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
            External Network Association
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
              loading={sending || !subscriptions || !externals || refreshing || refreshingState}
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
                pl:2,
                height: '100%',
                display: 'flex',
                flex: '1 1 auto',
                alignItems: 'center',
                width: columnState && columnState[0].flex > 1 ? columnState[0].flex : 'calc(((100% - 40px) / 1.75) * 0.5)',
                borderRight: '1px solid rgb(224, 224, 224)',
                // backgroundColor: extNameErr ? theme.palette.mode === 'dark' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.1)' : 'unset'
              }}
              style={
                theme.palette.mode === 'dark'
                ? extNameErr
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : extNameErr
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <Tooltip
                arrow
                placement="bottom"
                title="Network Name"
              >
                <TextField
                  fullWidth
                  placeholder="Name"
                  value={extName}
                  onChange={(event) => { setExtName(event.target.value) }}
                  inputProps={{
                    spellCheck: 'false',
                    style: {
                      fontSize: '14px',
                      fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                      padding: '4px 0px 5px'
                    }
                  }}
                  sx={{
                    "& fieldset": { border: 'none' },
                  }}
                />
              </Tooltip>
            </Box>
            <Box
              sx={{
                pl:2,
                height: '100%',
                display: 'flex',
                flex: '1 1 auto',
                alignItems: 'center',
                width: columnState && columnState[1].flex > 1 ? columnState[1].flex : 'calc(((100% - 40px) / 1.75) * 1)',
                borderRight: '1px solid rgb(224, 224, 224)',
                // backgroundColor: extDescErr ? theme.palette.mode === 'dark' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.1)' : 'unset'
              }}
              style={
                theme.palette.mode === 'dark'
                ? extDescErr
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : extDescErr
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <Tooltip
                arrow
                placement="bottom"
                title="Network Description"
              >
                <TextField
                  fullWidth
                  placeholder="Description"
                  value={extDesc}
                  onChange={(event) => { setExtDesc(event.target.value) }}
                  inputProps={{
                    spellCheck: 'false',
                    style: {
                      fontSize: '14px',
                      fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                      padding: '4px 0px 5px'
                    }
                  }}
                  sx={{
                    "& fieldset": { border: 'none' },
                  }}
                />
              </Tooltip>
            </Box>
            <Box
              sx={{
                pl:2,
                pr: 2,
                height: '100%',
                display: 'flex',
                flex: '1 1 auto',
                alignItems: 'center',
                width: columnState && columnState[2].flex > 1 ? columnState[2].flex : 'calc(((100% - 40px) / 1.75) * 0.25)',
                // backgroundColor: extCidrErr ? theme.palette.mode === 'dark' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.1)' : 'unset'
              }}
              style={
                theme.palette.mode === 'dark'
                ? extCidrErr
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.5)' }
                  : { backgroundColor: 'rgb(49, 57, 67)' }
                : extCidrErr
                  ? { backgroundColor: 'rgba(255, 0, 0, 0.1)' }
                  : { backgroundColor: 'unset' }
              }
            >
              <Tooltip
                arrow
                placement="bottom"
                title="Network CIDR"
              >
                <TextField
                  fullWidth
                  placeholder="CIDR"
                  value={extCidr}
                  onChange={(event) => { setExtCidr(event.target.value) }}
                  inputProps={{
                    spellCheck: 'false',
                    style: {
                      fontSize: '14px',
                      fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                      padding: '4px 0px 5px'
                    }
                  }}
                  sx={{
                    "& fieldset": { border: 'none' },
                  }}
                />
              </Tooltip>
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
                    disabled={hasError}
                    onClick={onAddExternal}
                  >
                    <PlaylistAddOutlined
                      style={
                        theme.palette.mode === 'dark'
                        ? hasError
                          ? { color: "lightgrey", opacity: 0.25 }
                          : { color: "forestgreen", opacity: 1 }
                        : hasError
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
            disabled={unchanged || sending || refreshing || refreshingState}
            // sx={{ position: "unset" }}
          >
            Apply
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </ExternalContext.Provider>
  );
}
