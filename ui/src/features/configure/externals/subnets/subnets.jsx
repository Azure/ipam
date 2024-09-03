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
  DeleteOutline,
  EditNoteOutlined
} from "@mui/icons-material";

import {
  selectViewSetting,
  updateMeAsync,
  getAdminStatus
} from "../../../ipam/ipamSlice";

import AddExtSubnet from "./utils/addSubnet";
import EditExtSubnet from "./utils/editSubnet";
import DeleteExtSubnet from "./utils/deleteSubnet";
import ManageExtEndpoints from "./utils/manageEndpoints";

import { ExternalContext } from "../externalContext";

const ExtSubnetContext = React.createContext({});

const gridStyle = {
  height: '100%',
  border: '1px solid rgba(224, 224, 224, 1)',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

function HeaderMenu(props) {
  const { setting } = props;
  const {
    selectedExternal,
    selectedSubnet,
    setAddExtSubOpen,
    setEditExtSubOpen,
    setDelExtSubOpen,
    setManExtEndOpen,
    saving,
    sendResults,
    saveConfig,
    loadConfig,
    resetConfig
  } = React.useContext(ExtSubnetContext);

  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuRef = React.useRef(null);

  const isAdmin = useSelector(getAdminStatus);
  const viewSetting = useSelector(state => selectViewSetting(state, setting));

  const onClick = () => {
    setMenuOpen(prev => !prev);
  }

  const onAddExtSub = () => {
    setAddExtSubOpen(true);
    setMenuOpen(false);
  }

  const onEditExtSub = () => {
    setEditExtSubOpen(true);
    setMenuOpen(false);
  }

  const onDelExtSub = () => {
    setDelExtSubOpen(true);
    setMenuOpen(false);
  }

  const onManExtEnd = () => {
    setManExtEndOpen(true);
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
              onClick={onAddExtSub}
              disabled={ !selectedExternal || !isAdmin }
            >
              <ListItemIcon>
                <AddOutlined fontSize="small" />
              </ListItemIcon>
              Add Subnet
            </MenuItem>
            <MenuItem
              onClick={onEditExtSub}
              disabled={ !selectedSubnet || !isAdmin }
            >
              <ListItemIcon>
                <EditOutlined fontSize="small" />
              </ListItemIcon>
              Edit Subnet
            </MenuItem>
            <MenuItem
              onClick={onDelExtSub}
              disabled={ !selectedSubnet || !isAdmin }
            >
              <ListItemIcon>
                <DeleteOutline fontSize="small" />
              </ListItemIcon>
              Remove Subnet
            </MenuItem>
            <MenuItem
              onClick={onManExtEnd}
              disabled={ !selectedSubnet }
            >
              <ListItemIcon>
                <EditNoteOutlined fontSize="small" />
              </ListItemIcon>
              Manage Endpoints
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

const Subnets = (props) => {
  const {
    selectedSpace,
    selectedBlock,
    selectedExternal,
    selectedSubnet,
    subnets,
    setSubnets,
    setSelectedSubnet
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

  const [addExtSubOpen, setAddExtSubOpen] = React.useState(false);
  const [editExtSubOpen, setEditExtSubOpen] = React.useState(false);
  const [delExtSubOpen, setDelExtSubOpen] = React.useState(false);
  const [manExtEndOpen, setManExtEndOpen] = React.useState(false);

  const isAdmin = useSelector(getAdminStatus);
  const viewSetting = useSelector(state => selectViewSetting(state, 'extsubnets'));

  const saveTimer = React.useRef();

  const dispatch = useDispatch();
  const theme = useTheme();

  const columns = React.useMemo(() => [
    { name: "name", header: "Name", type: "string", flex: 0.5, draggable: false, visible: true },
    { name: "desc", header: "Description", type: "string", flex: 1, draggable: false, visible: true },
    { name: "cidr", header: "Address Range", type: "string", flex: 0.30, draggable: false, visible: true },
    { name: "id", header: () => <HeaderMenu setting="extsubnets"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => "", visible: true }
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
      { "op": "add", "path": `/views/extsubnets`, "value": saveData }
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
          subnets,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(subnets);
    }
  },[subnets, columnSortState]);

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
    if(selectedExternal) {
      var newSubnets = cloneDeep(selectedExternal['subnets']);

      const newData = newSubnets.reduce((acc, curr) => {
        curr['id'] = `${selectedExternal.name}@${curr.name}}`

        acc.push(curr);

        return acc;
      }, []);

      setSubnets(newData);
    } else {
      setSubnets(null)
    }
  }, [selectedExternal, setSubnets]);

  React.useEffect(() => {
    if(Object.keys(selectionModel).length > 0) {
      setSelectedSubnet(Object.values(selectionModel)[0]);
    } else {
      setSelectedSubnet(null);
    }
  }, [selectionModel, setSelectedSubnet]);

  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  function NoRowsOverlay() {
    return (
      <React.Fragment>
        { selectedExternal
          ? <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              No Subnets Found for Selected External Network
            </Typography>
          : <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              Please Select an External Network
            </Typography>
        }
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      { isAdmin &&
        <React.Fragment>
          <AddExtSubnet
            open={addExtSubOpen}
            handleClose={() => setAddExtSubOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal : null}
            subnets={subnets}
          />
          <EditExtSubnet
            open={editExtSubOpen}
            handleClose={() => setEditExtSubOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal : null}
            subnets={subnets}
            selectedSubnet={selectedSubnet}
          />
          <DeleteExtSubnet
            open={delExtSubOpen}
            handleClose={() => setDelExtSubOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal.name : null}
            subnet={selectedSubnet ? selectedSubnet.name : null}
          />
        </React.Fragment>
      }
      <ManageExtEndpoints
        open={manExtEndOpen}
        handleClose={() => setManExtEndOpen(false)}
        space={selectedSpace ? selectedSpace.name : null}
        block={selectedBlock ? selectedBlock.name : null}
        external={selectedExternal ? selectedExternal.name : null}
        subnet={selectedSubnet ? selectedSubnet : null}
      />
      <ExtSubnetContext.Provider value={{ selectedExternal, selectedSubnet, setAddExtSubOpen, setEditExtSubOpen, setDelExtSubOpen, setManExtEndOpen,  saving, sendResults, saveConfig, loadConfig, resetConfig }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
          <Box sx={{ display: 'flex', height: '35px', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(224, 224, 224, 1)', borderBottom: 'none' }}>
            <Typography variant='button'>
              External Subnets
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
              loading={(selectedExternal && refreshing)}
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
      </ExtSubnetContext.Provider>
    </React.Fragment>
  );
}

export default Subnets;
