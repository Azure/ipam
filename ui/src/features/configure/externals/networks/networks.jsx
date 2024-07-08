import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useTheme } from "@mui/material/styles";

import { isEmpty, pickBy, orderBy, cloneDeep } from "lodash";

import { useSnackbar } from "notistack";

import ReactDataGrid from "@inovua/reactdatagrid-community";
import "@inovua/reactdatagrid-community/index.css";
import "@inovua/reactdatagrid-community/theme/default-dark.css";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
  CircularProgress,
  Divider
} from "@mui/material";

import {
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined,
  AddOutlined,
  EditOutlined,
  DeleteOutline
} from "@mui/icons-material";

import {
  selectViewSetting,
  updateMeAsync,
  getAdminStatus
} from "../../../ipam/ipamSlice";

import AddExtNetwork from "./utils/addNetwork";
import EditExtNetwork from "./utils/editNetwork";
import DeleteExtNetwork from "./utils/deleteNetwork";

import { ExternalContext } from "../externalContext";

const ExtNetworkContext = React.createContext({});

const gridStyle = {
  height: '100%',
  border: '1px solid rgba(224, 224, 224, 1)',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

function HeaderMenu(props) {
  const { setting } = props;
  const {
    selectedSpace,
    selectedBlock,
    selectedExternal,
    setAddExtOpen,
    setEditExtOpen,
    setDelExtOpen,
    saving,
    sendResults,
    saveConfig,
    loadConfig,
    resetConfig
  } = React.useContext(ExtNetworkContext);

  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuRef = React.useRef(null);

  const isAdmin = useSelector(getAdminStatus);
  const viewSetting = useSelector(state => selectViewSetting(state, setting));

  const onClick = () => {
    setMenuOpen(prev => !prev);
  }

  const onAddExt = () => {
    setAddExtOpen(true);
    setMenuOpen(false);
  }

  const onEditExt = () => {
    setEditExtOpen(true);
    setMenuOpen(false);
  }

  const onDelExt = () => {
    setDelExtOpen(true);
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
              onClick={onAddExt}
              disabled={ !selectedSpace || !selectedBlock || !isAdmin }
            >
              <ListItemIcon>
                <AddOutlined fontSize="small" />
              </ListItemIcon>
              Add Network
            </MenuItem>
            <MenuItem
              onClick={onEditExt}
              disabled={ !selectedExternal || !isAdmin }
            >
              <ListItemIcon>
                <EditOutlined fontSize="small" />
              </ListItemIcon>
              Edit Network
            </MenuItem>
            <MenuItem
              onClick={onDelExt}
              disabled={ !selectedExternal || !isAdmin }
            >
              <ListItemIcon>
                <DeleteOutline fontSize="small" />
              </ListItemIcon>
              Delete Network
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

const Networks = (props) => {
  const {
    selectedSpace,
    selectedBlock,
    selectedExternal,
    externals,
    setExternals,
    setSelectedExternal
  } = props;
  const { refreshing } = React.useContext(ExternalContext);

  const { enqueueSnackbar } = useSnackbar();

  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [gridData, setGridData] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState({});

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const [addExtOpen, setAddExtOpen] = React.useState(false);
  const [editExtOpen, setEditExtOpen] = React.useState(false);
  const [delExtOpen, setDelExtOpen] = React.useState(false);

  const isAdmin = useSelector(getAdminStatus);
  const viewSetting = useSelector(state => selectViewSetting(state, 'extnetworks'));

  const saveTimer = React.useRef();

  const dispatch = useDispatch();
  const theme = useTheme();

  const columns = React.useMemo(() => [
    { name: "name", header: "Name", type: "string", flex: 0.5, draggable: false, visible: true },
    { name: "desc", header: "Description", type: "string", flex: 1, draggable: false, visible: true },
    { name: "cidr", header: "CIDR", type: "string", flex: 0.30, draggable: false, visible: true },
    { name: "id", header: () => <HeaderMenu setting="extnetworks"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => "", visible: true }
  ], []);

  const filterValue = [
    { name: "name", operator: "contains", type: "string", value: "" },
    { name: "desc", operator: "contains", type: "string", value: "" },
    { name: "cidr", operator: "contains", type: "string", value: "" }
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
      { "op": "add", "path": `/views/extnetworks`, "value": saveData }
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

  React.useEffect(() => {
    if(selectedBlock) {
      var newExternals = cloneDeep(selectedBlock['externals']);

      const newData = newExternals.reduce((acc, curr) => {
        curr['id'] = `${selectedSpace}@${selectedBlock.name}@${curr.name}}`

        acc.push(curr);

        return acc;
      }, []);

      setExternals(newData);
    } else {
      setExternals(null);
    }
  }, [selectedSpace, selectedBlock, setExternals]);

  React.useEffect(() => {
    if(Object.keys(selectionModel).length > 0) {
      setSelectedExternal(Object.values(selectionModel)[0]);
    } else {
      setSelectedExternal(null);
    }
  }, [selectionModel, setSelectedExternal]);

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
              No External Networks Found for Selected Block
            </Typography>
          : <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              Please Select a Space & Block
            </Typography>
        }
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      { isAdmin &&
        <React.Fragment>
          <AddExtNetwork
            open={addExtOpen}
            handleClose={() => setAddExtOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock : null}
            externals={externals}
          />
          <EditExtNetwork
            open={editExtOpen}
            handleClose={() => setEditExtOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock : null}
            externals={externals}
            selectedExternal={selectedExternal}
          />
          <DeleteExtNetwork
            open={delExtOpen}
            handleClose={() => setDelExtOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal.name : null}
          />
        </React.Fragment>
      }
      <ExtNetworkContext.Provider value={{ selectedSpace, selectedBlock, selectedExternal, setAddExtOpen, setEditExtOpen, setDelExtOpen, selectionModel, saving, sendResults, saveConfig, loadConfig, resetConfig }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
          <Box sx={{ display: 'flex', height: '35px', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(224, 224, 224, 1)', borderBottom: 'none' }}>
            <Typography variant='button'>
              External Networks
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', height: '100%' }}>
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
              loading={refreshing}
              loadingText={"Loading"}
              dataSource={gridData || []}
              sortInfo={columnSortState}
              defaultFilterValue={filterValue}
              onRowClick={(rowData) => onClick(rowData.data)}
              onCellDoubleClick={onCellDoubleClick}
              selected={selectionModel}
              emptyText={NoRowsOverlay}
              style={gridStyle}
            />
          </Box>
        </Box>
      </ExtNetworkContext.Provider>
    </React.Fragment>
  );
}

export default Networks;
