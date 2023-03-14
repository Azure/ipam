import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from "react-router-dom";

import { cloneDeep, pickBy } from 'lodash';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import filter from '@inovua/reactdatagrid-community/filter'
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import { useTheme } from '@mui/material/styles';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { useSnackbar } from "notistack";

import {
  Box,
  Tooltip,
  IconButton,
  ClickAwayListener,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon
} from "@mui/material";

import {
  ChevronRight,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

import {
  getMeAsync,
  selectViewSetting
} from "../ipam/ipamSlice";

import { updateMe } from "../ipam/ipamAPI";

import { apiRequest } from "../../msal/authConfig";

import { TableContext } from "./TableContext";
import ItemDetails from "./Utils/Details";

const filterTypes = Object.assign({}, ReactDataGrid.defaultProps.filterTypes, {
  array: {
    name: 'array',
    emptyValue: null,
    operators: [
      {
        name: 'contains',
        fn: ({ value, filterValue, data }) => {
          return filterValue !== (null || '') ? value.join(",").includes(filterValue) : true;
        }
      },
      {
        name: 'notContains',
        fn: ({ value, filterValue, data }) => {
          return filterValue !== (null || '') ? !value.join(",").includes(filterValue) : true;
        }
      },
      {
        name: 'eq',
        fn: ({ value, filterValue, data }) => {
          return filterValue !== (null || '') ? value.includes(filterValue) : true;
        }
      },
      {
        name: 'neq',
        fn: ({ value, filterValue, data }) => {
          return filterValue !== (null || '') ? !value.includes(filterValue) : true;
        }
      }
    ]
  }
});

const openStyle = {
  right: 0,
  transition: "all 0.5s ease-in-out",
};

const closedStyle = {
  right: -300,
  transition: "all 0.5s ease-in-out",
};

const gridStyle = {
  height: '100%',
  border: "1px solid rgba(224, 224, 224, 1)",
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

function HeaderMenu(props) {
  const { setting } = props;
  const { saveConfig, loadConfig, resetConfig } = React.useContext(TableContext);

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
          disabled={viewSetting == null}
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
    </Box>
  )
}

export default function DiscoverTable(props) {
  const { config, columns, filterSettings, detailsMap } = props.map;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [columnState, setColumnState] = React.useState(columns);
  const [columnOrderState, setColumnOrderState] = React.useState(columns.flatMap(({name}) => name));
  const [columnSortState, setColumnSortState] = React.useState({ name: 'name', dir: 1, type: 'string' });
  const [gridData, setGridData] = React.useState(null);
  const [rowData, setRowData] = React.useState({});
  const [filterData, setFilterData] = React.useState(filterSettings);
  const [menuExpand, setMenuExpand] = React.useState(false);

  const stateData = useSelector(config.apiFunc);
  const viewSetting = useSelector(state => selectViewSetting(state, config.setting));
  const dispatch = useDispatch();

  const location = useLocation();

  const theme = useTheme();

  function renderExpand(data) {  
    const onClick = (e) => {
      e.stopPropagation();
      setRowData(data);
      setMenuExpand(true);
    };
  
    const flexCenter = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }

    return (
      <Tooltip title="Details">
        <span style={{...flexCenter}}>
          <IconButton
            color="primary"
            sx={{
              padding: 0
            }}
            onClick={onClick}
            disableFocusRipple
            disableTouchRipple
            disableRipple
          >
            <ChevronRight />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  const onBatchColumnResize = (batchColumnInfo) => {
    // console.log(batchColumnInfo);
    const colsMap = batchColumnInfo.reduce((acc, colInfo) => {
      const { column, flex } = colInfo
      acc[column.name] = { flex }
      return acc
    }, {});

    const columns = columnState.map(c => {
      return Object.assign({}, c, colsMap[c.name]);
    })

    console.log(columns);
    // saveConfig(columns);
    setColumnState(columns);
  }

  const onColumnOrderChange = (columnOrder) => {
    // const colsMap = columnState.reduce((acc, colInfo) => {

    //   acc[colInfo.name] = colInfo;

    //   return acc;
    // }, {})

    // const columns = columnOrder.map(c => {
    //   return colsMap[c];
    // });

    // console.log(columns);
    // saveConfig(columns);
    console.log(columnOrder);
    setColumnOrderState(columnOrder);
  }

  const onColumnVisibleChange = ({ column, visible }) => {
    const columns = columnState.map(c => {
      if(c.name === column.name) {
        return Object.assign({}, c, { visible });
      } else {
        return c;
      }
    });

    console.log(columns);
    // saveConfig(columns);
    setColumnState(columns);
  }

  const onSortInfoChange = (sortInfo) => {
    console.log(sortInfo);
    // saveConfig(sortInfo);
    setColumnSortState(sortInfo);
  }

  const saveConfig = () => {
    const values = columnState.reduce((acc, colInfo) => {
      const { name, flex, visible } = colInfo;

      var data = {}

      acc[name] = { flex, visible };

      return acc;
    }, {});

    const saveData = {
      values: values,
      order: columnOrderState,
      sort: columnSortState
    }

    var body = [
      { "op": "add", "path": `/views/${config.setting}`, "value": saveData }
    ];

    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSaving(true);
        const response = await instance.acquireTokenSilent(request);
        await updateMe(response.accessToken, body);
        enqueueSnackbar("View settings saved", { variant: "success" });
        dispatch(getMeAsync(response.accessToken));
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error saving view settings", { variant: "error" });
        }
      } finally {
        setSaving(false);
      }
    })();
  };

  const loadConfig = () => {
    const { values, order, sort } = viewSetting;

    let newColumns = [...columns];

    newColumns.push(
      { name: "id", header: () => <HeaderMenu setting={config.setting}/>, width: 50, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => renderExpand(data) }
    );

    const colsMap = newColumns.reduce((acc, colInfo) => {

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
  };

  const resetConfig = () => {
    let newColumns = [...columns];

    newColumns.push(
      { name: "id", header: () => <HeaderMenu setting={config.setting}/>, width: 50, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => renderExpand(data) }
    );

    setColumnState(newColumns);
    setColumnOrderState(newColumns.flatMap(({name}) => name));
    setColumnSortState({ name: 'name', dir: 1, type: 'string' });
  }

  React.useEffect(() => {
    if(columns && viewSetting) {
      console.log(columns);
      loadConfig();
    } else {
      let newColumns = [...columns];

      newColumns.push(
        { name: "id", header: () => <HeaderMenu setting={config.setting}/>, width: 50, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => renderExpand(data) }
      );

      setColumnState(newColumns);
      setColumnOrderState(newColumns.flatMap(({name}) => name));
    }
  },[config, columns, viewSetting]);

  React.useEffect(() => {
    if(location.state) {
      var searchFilter = cloneDeep(filterSettings);

      const target = searchFilter.find((obj) => obj.name === location.state.name);

      Object.assign(target, location.state);

      setFilterData(searchFilter);
    }
  },[location, filterSettings]);

  React.useEffect(() => {
    stateData && setGridData(filter(stateData, filterData, filterTypes));
  },[stateData, filterData]);

  React.useEffect(() => {
    gridData && setLoading(false);
  },[gridData]);

  function renderDetails() {
    return (
      <ClickAwayListener onClickAway={() => setMenuExpand(false)}>
        <Box
          style={{
            zIndex: 1000,
            position: "fixed",
            display: "flex",
            flexDirection: "row",
            top: 64,
            right: -300,
            height: "calc(100vh - 64px)",
            backgroundColor: "transparent",
            ...menuExpand ? openStyle : closedStyle
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: "300px",
              backgroundColor: theme.palette.background.default,
              borderLeft: "1px solid lightgrey"
            }}
          >
            <ItemDetails title={config.title} map={detailsMap} setExpand={setMenuExpand}/>
          </Box>
        </Box>
      </ClickAwayListener>
    );
  }

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
    <TableContext.Provider value={{ stateData, rowData, menuExpand, saveConfig, loadConfig, resetConfig }}>
      {renderDetails()}
      <Box sx={{ flexGrow: 1, height: "100%" }}>
        <ReactDataGrid
          theme={theme.palette.mode === 'dark' ? "default-dark" : "default-light"}
          idProperty={config.idProp}
          showCellBorders="horizontal"
          showZebraRows={false}
          showActiveRowIndicator={false}
          enableColumnAutosize={false}
          showColumnMenuGroupOptions={false}
          showColumnMenuLockOptions={false}
          enableColumnFilterContextMenu={true}
          updateMenuPositionOnColumnsChange={false}
          onBatchColumnResize={onBatchColumnResize}
          onSortInfoChange={onSortInfoChange}
          onColumnOrderChange={onColumnOrderChange}
          onColumnVisibleChange={onColumnVisibleChange}
          reservedViewportWidth={0}
          filterTypes={filterTypes}
          columns={columnState}
          columnOrder={columnOrderState}
          // sortInfo={columnSortState}
          loading={loading}
          dataSource={gridData || []}
          filterValue={filterData}
          onFilterValueChange={(newFilterValue) => setFilterData(newFilterValue)}
          // defaultSortInfo={{ name: 'name', dir: 1, type: 'string' }}
          defaultSortInfo={columnSortState}
          emptyText={NoRowsOverlay}
          style={gridStyle}
        />
      </Box>
    </TableContext.Provider>
  );
}

// data.map((item) => Object.entries(item).reduce((obj, [k, v]) => { Array.isArray(v) ? obj[k] = v.join(", ") : obj[k] = v; return obj; }, {}));
