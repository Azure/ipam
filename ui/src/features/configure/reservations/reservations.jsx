import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import { styled } from "@mui/material/styles";
import { useTheme } from '@mui/material/styles';

import { isEmpty, isEqual, pickBy, orderBy, sortBy, cloneDeep, pick } from "lodash";

import { useSnackbar } from "notistack";

import moment from "moment";

import ReactDataGrid from "@inovua/reactdatagrid-community";
import "@inovua/reactdatagrid-community/index.css";
import "@inovua/reactdatagrid-community/theme/default-dark.css";
import DateFilter from "@inovua/reactdatagrid-community/DateFilter";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  TextField,
  Autocomplete,
  Typography,
  Tooltip,
  CircularProgress
} from "@mui/material";

import {
  Check,
  ContentCopy,
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
  VisibilityOffOutlined,
  PieChartOutlined,
  ClearOutlined,
  Refresh
} from "@mui/icons-material";

import {
  selectSpaces,
  selectBlocks,
  fetchSpacesAsync,
  deleteBlockResvsAsync,
  selectViewSetting,
  updateMeAsync
} from "../../ipam/ipamSlice";

import NewReservation from "./utils/newReservation";

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
  const {
    filterActive,
    setFilterActive,
    selectedSpace,
    selectedBlock,
    setNewResvOpen,
    saving,
    sendResults,
    saveConfig,
    loadConfig,
    resetConfig
  } = React.useContext(ReservationContext);

  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuRef = React.useRef(null);

  const viewSetting = useSelector(state => selectViewSetting(state, setting));

  const onClick = () => {
    setMenuOpen(prev => !prev);
  }

  const onActive = () => {
    setFilterActive(prev => !prev);
    setMenuOpen(false);
  }

  const onNewResv = () => {
    setNewResvOpen(true);
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
              onClick={onNewResv}
              disabled={ !(selectedSpace && selectedBlock) }
            >
              <ListItemIcon>
                <PieChartOutlined fontSize="small" />
              </ListItemIcon>
              New Reservation
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

const Reservations = () => {
  const { enqueueSnackbar } = useSnackbar();

  const location = useLocation();

  const [spaceInput, setSpaceInput] = React.useState('');
  const [blockInput, setBlockInput] = React.useState('');

  const [selectedSpace, setSelectedSpace] = React.useState(location.state?.space || null);
  const [selectedBlock, setSelectedBlock] = React.useState(location.state?.block || null);

  const [refreshing, setRefreshing] = React.useState(false);
  const [filterActive, setFilterActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [reservations, setReservations] = React.useState([]);
  const [gridData, setGridData] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState({});
  const [copied, setCopied] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const [newResvOpen, setNewResvOpen] = React.useState(location.state?.cidr ? true : false);

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const spaces = useSelector(selectSpaces);
  const blocks = useSelector(selectBlocks);
  const viewSetting = useSelector(state => selectViewSetting(state, 'reservations'));

  const msgTimer = React.useRef();
  const saveTimer = React.useRef();

  const dispatch = useDispatch();
  const theme = useTheme();

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

  React.useEffect(() => {
    if (spaces) {
      if (selectedSpace) {
        const spaceIndex = spaces.findIndex((x) => x.name === selectedSpace.name);

        if (spaceIndex > -1) {
          if (!isEqual(spaces[spaceIndex], selectedSpace)) {
            setSelectedSpace(spaces[spaceIndex]);
          }
        } else {
          setSelectedSpace(null);
          setSelectedBlock(null);
        }
      } else {
        setSelectedBlock(null);
      }
    } else {
      setSelectedSpace(null);
    }
  }, [spaces, selectedSpace]);

  React.useEffect(() => {
    if (blocks) {
      if (selectedBlock) {
        const blockIndex = blocks.findIndex((x) => x.id === selectedBlock.id);

        if (blockIndex > -1) {
          if (!isEqual(blocks[blockIndex], selectedBlock)) {
            setSelectedBlock(blocks[blockIndex]);
          }

          setReservations(blocks[blockIndex].resv || []);
        } else {
          setSelectedBlock(null);
          setReservations([]);
        }
      } else {
        setReservations([]);
      }
    } else {
      setSelectedBlock(null);
      setReservations([]);
    }
  }, [blocks, selectedBlock]);

  React.useEffect(() => {
    if (selectedSpace && selectedBlock) {
      if (selectedBlock.parent_space !== selectedSpace.name) {
        setSelectedBlock(null);
      }
    }
  }, [selectedSpace, selectedBlock]);

  React.useEffect(() => {
    if (!isEmpty(reservations)) {
      setSelectionModel((prev) => {
        const newSelectionmodel = cloneDeep(prev);

        Object.keys(prev).forEach((key) => {
          const found = reservations.find((x) => x.id === key);

          if (!found) {
            delete newSelectionmodel[key];
          }
        });

        return newSelectionmodel;
      });

      // setSelectionModel(newSelectionmodel);
    } else {
      setSelectionModel([]);
    }
  }, [reservations]);

  const refresh = React.useCallback(() => {
    (async() => {
      try {
        setRefreshing(true);
        await dispatch(fetchSpacesAsync());
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar(e.message, { variant: "error" });
      } finally {
        setRefreshing(false);
      }
    })();
  }, [dispatch, enqueueSnackbar]);

  function onSubmit() {
    (async () => {
      try {
        setSending(true);
        await dispatch(deleteBlockResvsAsync({ space: selectedBlock.parent_space, block: selectedBlock.name, body: Object.keys(selectionModel) }));
        setSelectionModel([]);
        setFilterActive(true);
        enqueueSnackbar("Successfully removed IP Block reservation(s)", { variant: "success" });
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

  function NoRowsOverlay() {
    return (
      <React.Fragment>
        { selectedBlock
          ? <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              {
                filterActive ?
                "No Active Reservations Found for Selected Block" :
                "No Reservations Found for Selected Block"
              }
            </Typography>
          : <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              Please Select a Space & Block
            </Typography>
        }
      </React.Fragment>
    );
  }

  return (
    <ReservationContext.Provider value={{ copied, setCopied, filterActive, setFilterActive, selectedSpace, selectedBlock, setNewResvOpen, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <NewReservation
        open={newResvOpen}
        handleClose={() => setNewResvOpen(false)}
        selectedSpace={selectedSpace}
        selectedBlock={selectedBlock}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', pt: 2, pb: 2, pr: 3, pl: 3, alignItems: 'center', borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <Autocomplete
              forcePopupIcon={false}
              id="grouped-demo"
              size="small"
              options={sortBy(spaces, 'name')}
              getOptionLabel={(option) => option.name}
              inputValue={spaceInput}
              onInputChange={(event, newInputValue) => setSpaceInput(newInputValue)}
              value={selectedSpace}
              onChange={(event, newValue) => setSelectedSpace(newValue)}
              isOptionEqualToValue={
                (option, value) => {
                  const newOption = pick(option, ['name']);
                  const newValue = pick(value, ['name']);

                  return isEqual(newOption, newValue);
                }
              }
              noOptionsText={ !spaces ? "Loading..." : "No Spaces" }
              sx={{ width: 300 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Space"
                  placeholder="Please Select Space..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <React.Fragment>
                        {!spaces ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.name}>
                    {option.name}
                  </li>
                );
              }}
              componentsProps={{
                paper: {
                  sx: {
                    width: 'fit-content'
                  }
                }
              }}
            />
            <Autocomplete
              disabled={selectedSpace === null}
              forcePopupIcon={false}
              id="grouped-demo"
              size="small"
              options={(blocks && selectedSpace) ? sortBy(blocks.filter((x) => x.parent_space === selectedSpace.name), 'name') : []}
              getOptionLabel={(option) => option.name}
              inputValue={blockInput}
              onInputChange={(event, newInputValue) => setBlockInput(newInputValue)}
              value={(selectedBlock?.parent_space === selectedSpace?.name) ? selectedBlock : null}
              onChange={(event, newValue) => setSelectedBlock(newValue)}
              isOptionEqualToValue={
                (option, value) => {
                  const newOption = pick(option, ['id', 'name']);
                  const newValue = pick(value, ['id', 'name']);

                  return isEqual(newOption, newValue);
                }
              }
              sx={{ width: 300 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Block"
                  placeholder="Please Select Block..."
                  InputProps={{
                    ...params.InputProps
                  }}
                />
              )}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.id}>
                    {option.name}
                  </li>
                );
              }}
              componentsProps={{
                paper: {
                  sx: {
                    width: 'fit-content'
                  }
                }
              }}
            />
            <TextField
              disabled
              id="block-cidr-read-only"
              label="Network"
              size="small"
              value={ selectedBlock ? selectedBlock.cidr : "" }
              sx={{
                width: '11ch'
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', ml: 'auto' }}>
            <Tooltip
              title="Remove"
              placement="top"
              style={{
                visibility: (isEmpty(selectionModel) || refreshing) ? 'hidden' : 'visible'
              }}
            >
              <span>
                <IconButton
                  color="error"
                  aria-label="save associations"
                  component="span"
                  disabled={sending}
                  onClick={onSubmit}
                >
                  <ClearOutlined />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex' }}>
            <Tooltip title="Refresh" placement="top" >
              <span>
                <IconButton
                  color="primary"
                  size="small"
                  onClick={refresh}
                  disabled={sending || refreshing || !selectedSpace || !selectedBlock }
                >
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, pb: 3, pr: 3, pl: 3, overflowY: 'auto', overflowX: 'hidden' }}>
          <Box sx={{ pt: 4, height: "100%" }}>
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
              loading={sending || refreshing}
              loadingText={sending ? <Update>Updating</Update> : "Loading"}
              dataSource={gridData || []}
              selected={selectionModel}
              onSelectionChange={({selected}) => setSelectionModel(selected)}
              onCellDoubleClick={onCellDoubleClick}
              sortInfo={columnSortState}
              filterTypes={filterTypes}
              defaultFilterValue={filterValue}
              emptyText={NoRowsOverlay}
              style={gridStyle}
            />
          </Box>
        </Box>
      </Box>
    </ReservationContext.Provider>
  );
}

export default Reservations;
