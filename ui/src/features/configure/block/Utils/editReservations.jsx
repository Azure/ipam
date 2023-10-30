import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { isEmpty, pickBy, orderBy } from 'lodash';

import { useSnackbar } from "notistack";

import moment from 'moment';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'
import DateFilter from '@inovua/reactdatagrid-community/DateFilter'

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
  Tooltip,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Paper
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
  TimerOffOutlined,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined,
  VisibilityOutlined,
  VisibilityOffOutlined
} from "@mui/icons-material";

import LoadingButton from '@mui/lab/LoadingButton';

import {
  deleteBlockResvsAsync,
  selectViewSetting,
  updateMeAsync
} from "../../../ipam/ipamSlice";

import { ConfigureContext } from "../../configureContext";

// Python -> Javascript
// import time
// time.time() -> 1647638968.5812438

// const unixtime = 1647638968.5812438;
// const jstime = new Date(unixtime * 1000);

// Javascript -> Python
// (Date.now() / 1000); -> 1679618040.762

// from datetime import datetime

// unixtime = 1679618040.762
// pytime = datetime.fromtimestamp(unixtime)

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
  "cancelledByTimeout": {
    msg: "Reservation cancelled due to expiration.",
    icon: TimerOffOutlined,
    color: "error"
  }
};

const ReservationContext = React.createContext({});

// window.moment = moment;

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

function HeaderMenu(props) {
  const { setting } = props;
  const { filterActive, setFilterActive, saving, sendResults, saveConfig, loadConfig, resetConfig } = React.useContext(ReservationContext);

  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuRef = React.useRef(null);

  const viewSetting = useSelector(state => selectViewSetting(state, setting));

  const onClick = () => {
    setMenuOpen(prev => !prev);
  }

  const onActive = () => {
    setFilterActive(prev => !prev)
    setMenuOpen(false);
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
              onClick={onActive}
            >
              <ListItemIcon>
                {
                  filterActive ?
                  <VisibilityOffOutlined fontSize="small" /> :
                  <VisibilityOutlined fontSize="small" />
                }
              </ListItemIcon>
              { filterActive ? 'Showing Active' : 'Showing All' }
            </MenuItem>
            <Divider />
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

function ReservationStatus(props) {
  const { value } = props;

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

function ReservationId(props) {
  const { value } = props;
  const { copied, setCopied } = React.useContext(ReservationContext);

  const contentCopied = (copied === value.id);

  const onClick = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value.id);
    setCopied(value.id);
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
        value.settledOn === null ?
        <div style={{ textAlign: "center" }}>
          Click to Copy
          <br />
          <br />{value.id}
        </div> :
        null
      }
    >
      <span style={{...flexCenter}}>
        { !contentCopied
          ?
            <IconButton
              disableRipple
              disableFocusRipple
              disableTouchRipple
              color="primary"
              size="small"
              sx={{
                padding: 0
              }}
              onClick={onClick}
              disabled={value.settledOn !== null}
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

export default function EditReservations(props) {
  const { open, handleClose, block } = props;
  const { refresh, refreshing } = React.useContext(ConfigureContext);

  const { enqueueSnackbar } = useSnackbar();

  const [filterActive, setFilterActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [reservations, setReservations] = React.useState([]);
  const [gridData, setGridData] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [copied, setCopied] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const viewSetting = useSelector(state => selectViewSetting(state, 'reservations'));
  const dispatch = useDispatch();

  const msgTimer = React.useRef();
  const saveTimer = React.useRef();

  const theme = useTheme();

  const empty = selectionModel.length === 0;

  window.moment = moment;

  const filterTypes = Object.assign({}, ReactDataGrid.defaultProps.filterTypes, {
    unixdate: {
      name: 'unixdate',
      emptyValue: '',
      operators: [
        {
          name: 'after',
          fn: ({ value, filterValue, column, data }) => {
            return filterValue !== (null || '') ? moment.unix(value).isAfter(window.moment(filterValue, column.dateFormat)) : true;
          }
        },
        {
          name: 'afterOrOn',
          fn: ({ value, filterValue, column, data }) => {
            return filterValue !== (null || '') ? moment.unix(value).isSameOrAfter(window.moment(filterValue, column.dateFormat)) : true;
          }
        },
        {
          name: 'before',
          fn: ({ value, filterValue, column, data }) => {
            return filterValue !== (null || '') ? moment.unix(value).isBefore(window.moment(filterValue, column.dateFormat)) : true;
          }
        },
        {
          name: 'beforeOrOn',
          fn: ({ value, filterValue, column, data }) => {
            return filterValue !== (null || '') ? moment.unix(value).isSameOrBefore(window.moment(filterValue, column.dateFormat)) : true;
          }
        },
        {
          name: 'eq',
          fn: ({ value, filterValue, column, data }) => {
            return filterValue !== (null || '') ? moment.unix(value).isSame(window.moment(filterValue, column.dateFormat)) : true;
          }
        },
        {
          name: 'neq',
          fn: ({ value, filterValue, column, data }) => {
            return filterValue !== (null || '') ? !moment.unix(value).isSame(window.moment(filterValue, column.dateFormat)) : true;
          }
        }
      ]
    }
  });

  const columns = React.useMemo(() => [
    { name: "cidr", header: "CIDR", type: "string", flex: 0.5, visible: true },
    { name: "createdBy", header: "Created By", type: "string", flex: 1, visible: true },
    { name: "desc", header: "Description", type: "string", flex: 1.5, visible: true },
    {
      name: "createdOn",
      header: "Creation Date",
      type: "unixdate",
      flex: 0.75,
      dateFormat: 'lll',
      filterEditor: DateFilter,
      filterEditorProps: (props, { index }) => {
        return {
          dateFormat: 'lll',
        }
      },
      render: ({value}) => moment.unix(value).format('lll'),
      visible: true
    },
    {
      name: "settledOn",
      header: "Settled Date",
      type: "unixdate",
      flex: 0.75,
      dateFormat: 'lll',
      filterEditor: DateFilter,
      filterEditorProps: (props, { index }) => {
        return {
          dateFormat: 'lll',
        }
      },
      render: ({value}) => value ? moment.unix(value).format('lll') : null,
      visible: false
    },
    { name: "settledBy", header: "Settled By", type: "string", flex: 1, visible: false },
    { name: "status", header: "Status", headerAlign: "center", width: 90, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({value}) => <ReservationStatus value={value} />, visible: true },
    { name: "id", header: () => <HeaderMenu setting="reservations"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => <ReservationId value={data} />, visible: true }
  ], []);

  const filterValue = [
    { name: "cidr", operator: "contains", type: "string", value: "" },
    { name: "createdBy", operator: "contains", type: "string", value: "" },
    { name: "desc", operator: "contains", type: "string", value: "" },
    { name: "createdOn", operator: "afterOrOn", type: "unixdate", value: "" },
    { name: "settledOn", operator: "afterOrOn", type: "unixdate", value: "" },
    { name: "settledBy", operator: "contains", type: "string", value: "" }
  ];

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
      { "op": "add", "path": `/views/reservations`, "value": saveData }
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
    setColumnSortState({ name: 'createdOn', dir: 1, type: 'date' });
  }, [columns]);

  const renderColumnContextMenu = React.useCallback((menuProps) => {
    const columnIndex = menuProps.items.findIndex((item) => item.itemId === 'columns');
    const idIndex = menuProps.items[columnIndex].items.findIndex((item) => item.value === 'id');

    menuProps.items[columnIndex].items.splice(idIndex, 1);
  }, []);

  React.useEffect(() => {
    setReservations(block?.resv || []);
  }, [block]);

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
    const newReservations = filterActive ? reservations.filter(x => x.settledOn === null) : reservations;

    if(columnSortState) {
      setGridData(
        orderBy(
          newReservations,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(newReservations);
    }
  }, [reservations, filterActive, columnSortState]);

  React.useEffect(() => {
    if(copied !== "") {
      clearTimeout(msgTimer.current);

      msgTimer.current = setTimeout(
        function() {
          setCopied("");
        }, 3000
      );
    }
  }, [msgTimer, copied]);

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

  function onClose() {
    handleClose();
    setFilterActive(true);
    setSelectionModel([]);
  }

  function onSubmit() {
    (async () => {
      try {
        setSending(true);
        await dispatch(deleteBlockResvsAsync({ space: block.parent_space, block: block.name, body: Object.keys(selectionModel) }));
        onClose();
        setSelectionModel([]);
        setFilterActive(true);
        enqueueSnackbar("Successfully removed IP Block reservation(s)", { variant: "success" });
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

  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  return (
    <ReservationContext.Provider value={{ copied, setCopied, filterActive, setFilterActive, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <div>
        <Dialog
          open={open}
          onClose={onClose}
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
                Block Reservations
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
              Select the CIDR reservations for Block <Spotlight>'{block?.name}'</Spotlight> to be removed
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
                updateMenuPositionOnColumnsChange={false}
                renderColumnContextMenu={renderColumnContextMenu}
                onBatchColumnResize={onBatchColumnResize}
                onSortInfoChange={onSortInfoChange}
                onColumnOrderChange={onColumnOrderChange}
                onColumnVisibleChange={onColumnVisibleChange}
                reservedViewportWidth={0}
                columns={columnState || []}
                columnOrder={columnOrderState}
                loading={refreshing || sending}
                loadingText={sending ? <Update>Updating</Update> : "Loading"}
                dataSource={gridData || []}
                selected={selectionModel}
                onSelectionChange={({selected}) => setSelectionModel(selected)}
                onCellDoubleClick={onCellDoubleClick}
                sortInfo={columnSortState}
                filterTypes={filterTypes}
                defaultFilterValue={filterValue}
                style={gridStyle}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={onClose}
              sx={{ position: "unset" }}
            >
              Cancel
            </Button>
            <LoadingButton
              onClick={onSubmit}
              loading={sending}
              disabled={empty || sending}
              // sx={{ position: "unset" }}
            >
              Remove
            </LoadingButton>
          </DialogActions>
        </Dialog>
      </div>
    </ReservationContext.Provider>
  );
}
