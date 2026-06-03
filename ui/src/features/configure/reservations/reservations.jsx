import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation } from "react-router";

import { isEmpty, isEqual, sortBy, pick } from "lodash";

import { useSnackbar } from "notistack";

import moment from "moment";

import { DataGrid } from "../../../global/grids/DataGrid";

import {
  Box,
  IconButton,
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
  deleteBlockResvsAsync
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
  "errCIDROverlap": {
    msg: "A vNET with overlapping CIDR has already been associated with the target IP Block.",
    icon: ErrorOutline,
    color: "error"
  },
  "errCIDRExists": {
    msg: "A vNET with overlapping CIDR has already been associated with the target IP Block.",
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
  const { copied, setCopied } = React.use(ReservationContext);

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
  const [reservations, setReservations] = React.useState([]);
  const [selectedRows, setSelectedRows] = React.useState([]);
  const [copied, setCopied] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const [newResvOpen, setNewResvOpen] = React.useState(location.state?.cidr ? true : false);

  const spaces = useSelector(selectSpaces);
  const blocks = useSelector(selectBlocks);

  const msgTimerRef = React.useRef(null);

  const dispatch = useDispatch();

  const columns = React.useMemo(() => [
    { field: "cidr", headerName: "CIDR", flex: 0.5 },
    { field: "createdBy", headerName: "Created By", flex: 1 },
    { field: "desc", headerName: "Description", flex: 1.5 },
    {
      field: "createdOn",
      headerName: "Creation Date",
      flex: 0.75,
      valueFormatter: (params) => params.value ? moment.unix(params.value).format('lll') : null,
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: (filterDate, cellValue) => {
          if (!cellValue) return -1;
          const cellDate = moment.unix(cellValue).startOf('day').toDate();
          const filterDateStart = moment(filterDate).startOf('day').toDate();
          if (cellDate < filterDateStart) return -1;
          if (cellDate > filterDateStart) return 1;
          return 0;
        }
      }
    },
    {
      field: "settledOn",
      headerName: "Settled Date",
      flex: 0.75,
      hide: true,
      valueFormatter: (params) => params.value ? moment.unix(params.value).format('lll') : null,
      filter: 'agDateColumnFilter',
      filterParams: {
        comparator: (filterDate, cellValue) => {
          if (!cellValue) return -1;
          const cellDate = moment.unix(cellValue).startOf('day').toDate();
          const filterDateStart = moment(filterDate).startOf('day').toDate();
          if (cellDate < filterDateStart) return -1;
          if (cellDate > filterDateStart) return 1;
          return 0;
        }
      }
    },
    { field: "settledBy", headerName: "Settled By", flex: 1, hide: true },
    {
      field: "status",
      headerName: "Status",
      width: 90,
      minWidth: 90,
      maxWidth: 90,
      resizable: false,
      sortable: false,
      filter: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      cellRenderer: (params) => <ReservationStatus value={params.value} />
    }
  ], []);

  const actionsCellRenderer = React.useCallback((params) => {
    return <ReservationId value={params.data} />;
  }, []);

  const extraMenuItems = React.useMemo(() => [
    {
      icon: filterActive ? VisibilityOffOutlined : VisibilityOutlined,
      label: filterActive ? 'Showing Active' : 'Showing All',
      onClick: () => setFilterActive(prev => !prev)
    },
    {
      icon: PieChartOutlined,
      label: 'New Reservation',
      onClick: () => setNewResvOpen(true),
      disabled: !(selectedSpace && selectedBlock)
    }
  ], [filterActive, selectedSpace, selectedBlock]);

  const onRowSelectionChanged = React.useCallback((rows) => {
    setSelectedRows(rows);
  }, []);

  // Derive filtered grid data synchronously to prevent a flash of
  // the no-rows overlay when reservations or filter state changes.
  const gridData = React.useMemo(() => {
    return filterActive ? reservations.filter(x => x.settledOn === null) : reservations;
  }, [reservations, filterActive]);

  React.useEffect(() => {
    if(copied !== "") {
      clearTimeout(msgTimerRef.current);

      msgTimerRef.current = setTimeout(
        function() {
          setCopied("");
        }, 3000
      );
    }
  }, [msgTimerRef, copied]);

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
      setSelectedRows((prev) => {
        return prev.filter(row => reservations.find(x => x.id === row.id));
      });
    } else {
      setSelectedRows([]);
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
        await dispatch(deleteBlockResvsAsync({ space: selectedBlock.parent_space, block: selectedBlock.name, body: selectedRows.map(r => r.id) }));
        setSelectedRows([]);
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

  const NoRowsOverlay = React.useCallback(() => {
    return (
      <React.Fragment>
        { selectedBlock
          ? <Typography
              variant="overline"
              sx={{
                display: "block",
                mt: 1
              }}>
              {
                filterActive ?
                "No Active Reservations Found for Selected Block" :
                "No Reservations Found for Selected Block"
              }
            </Typography>
          : <Typography
              variant="overline"
              sx={{
                display: "block",
                mt: 1
              }}>
              Please Select a Space & Block
            </Typography>
        }
      </React.Fragment>
    );
  }, [selectedBlock, filterActive]);

  return (
    <ReservationContext value={{ copied, setCopied }}>
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
                  slotProps={{
                    ...params.slotProps,

                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <React.Fragment>
                          {!spaces ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.slotProps.input.endAdornment}
                        </React.Fragment>
                      ),
                    }
                  }}
                />
              )}
              renderOption={(props, option) => {
                return (
                  <li key={option.name} {...props}>
                    {option.name}
                  </li>
                );
              }}
              slotProps={{
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
                  slotProps={{
                    ...params.slotProps,

                    input: {
                      ...params.slotProps.input
                    }
                  }}
                />
              )}
              renderOption={(props, option) => {
                return (
                  <li key={option.id} {...props}>
                    {option.name}
                  </li>
                );
              }}
              slotProps={{
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
                visibility: (isEmpty(selectedRows) || refreshing) ? 'hidden' : 'visible'
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
            <DataGrid
              viewSettingKey="reservations"
              rowData={gridData}
              columnDefs={columns}
              onRowSelectionChanged={onRowSelectionChanged}
              multiSelect={true}
              checkboxSelect={true}
              extraMenuItems={extraMenuItems}
              isLoading={sending || refreshing}
              noRowsOverlay={NoRowsOverlay}
              actionsCellRenderer={actionsCellRenderer}
            />
          </Box>
        </Box>
      </Box>
    </ReservationContext>
  );
}

export default Reservations;