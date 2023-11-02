import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { isEqual, isEmpty, pickBy, orderBy } from 'lodash';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import { useTheme } from '@mui/material/styles';

import {
  Box,
  Tooltip,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  CircularProgress
} from "@mui/material";

import {
  SaveAlt,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

import {
  getExclusions,
  replaceExclusions
} from "../ipam/ipamAPI";

import {
  selectSubscriptions,
  refreshAllAsync,
  selectViewSetting,
  updateMeAsync
} from '../ipam/ipamSlice';

const ExclusionContext = React.createContext({});

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
  width: "80%",
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

// Grid Style(s)
const GridBody = styled("div")(({ theme }) => ({
  height: "100%",
  width: "100%",
  '& .ipam-subscription-exclusions': {
    '.InovuaReactDataGrid__row--selected': {
        background: theme.palette.mode === 'dark' ? 'rgb(220, 20, 20) !important' : 'rgb(255, 230, 230) !important',
      '.InovuaReactDataGrid__row-hover-target': {
        '&:hover': {
          background: theme.palette.mode === 'dark' ? 'rgb(220, 100, 100) !important' : 'rgb(255, 220, 220) !important',
        }
      }
    }
  }
}));

function HeaderMenu(props) {
  const { setting } = props;
  const { saving, sendResults, saveConfig, loadConfig, resetConfig } = React.useContext(ExclusionContext);

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

export default function ManageExclusions() {
  const { enqueueSnackbar } = useSnackbar();

  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [selected, setSelected] = React.useState({});
  const [loadedExclusions, setLoadedExclusions] = React.useState(null);
  const [gridData, setGridData] = React.useState(null);

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const subscriptions = useSelector(selectSubscriptions);
  const viewSetting = useSelector(state => selectViewSetting(state, 'exclusions'));
  const dispatch = useDispatch();

  const saveTimer = React.useRef();
  const dataLoadedRef = React.useRef(false);

  const theme = useTheme();

  const unchanged = isEqual(selected, loadedExclusions);

  // const message = `Click to Include/Exclude`;

  const columns = React.useMemo(() => [
    { name: "name", header: "Subscription Name", type: "string", flex: 1, visible: true },
    { name: "subscription_id", header: "Subscription ID", type: "string", flex: 1, visible: true },
    { name: "type", header: "Subscription Type", type: "string", flex: 0.75, visible: true },
    { name: "mg_name", header: "Management Group Name", type: "string", flex: 0.75, visible: true },
    { name: "mg_id", header: "Management Group ID", type: "string", flex: 0.75, visible: false },
    { name: "id", header: () => <HeaderMenu setting="exclusions"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => "", visible: true }
  ], []);

  const filterValue = [
    { name: "name", operator: "contains", type: "string", value: "" },
    { name: "subscription_id", operator: "contains", type: "string", value: "" },
    { name: "type", operator: "contains", type: "string", value: "" },
    { name: "mg_name", operator: "contains", type: "string", value: "" },
    { name: "mg_id", operator: "contains", type: "string", value: "" }
  ];

  React.useEffect(() => {
    (subscriptions && selected) && setLoading(false);
  }, [subscriptions, selected]);

  const loadData = React.useCallback(() => {
    (async () => {
      try {
        if(subscriptions) {
          // setLoading(true);
          var excluded = {};

          const exclusions = await getExclusions();
            
          exclusions.forEach(exclusion => {
            var targetSub = subscriptions.find((sub) => sub.subscription_id === exclusion);

            if(targetSub) {
              excluded[targetSub.id] = targetSub;
            }
          });

          setSelected(prevState => {
            return {
              ...prevState,
              ...excluded
            }
          });

          setLoadedExclusions(excluded);
        }
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar("Error fetching subscriptions/exclusions", { variant: "error" });
      } finally {
        // setLoading(false);
      }
    })();
  }, [subscriptions, enqueueSnackbar]);

  React.useEffect(() => {
    if(!dataLoadedRef.current && subscriptions) {
      dataLoadedRef.current = true;
      loadData();
    }
  }, [loadData, subscriptions]);

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
        let selectedValues = Object.values(selected);
        let update = selectedValues.map(item => item.subscription_id);
        await replaceExclusions(update);
        enqueueSnackbar("Successfully updated exclusions", { variant: "success" });
        setLoadedExclusions(selected);
        dispatch(refreshAllAsync())
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

  function onClick(elem) {
    var id = elem.id;

    setSelected(prevState => {
      let newState = {...prevState};

      newState.hasOwnProperty(id) ? delete newState[id] : newState[id] = elem;

      return newState;
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
      { "op": "add", "path": `/views/exclusions`, "value": saveData }
    ];

    (async () => {
      try {
        setSaving(true);
        await dispatch(updateMeAsync({ body: body}));
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
          subscriptions,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(subscriptions);
    }
  },[subscriptions, columnSortState]);

  const onCellDoubleClick = React.useCallback((event, cellProps) => {
    const { value } = cellProps

    navigator.clipboard.writeText(value);
    enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
  }, [enqueueSnackbar]);

  function NoRowsOverlay() {
    return (
      <React.Fragment>
        <Shrug />
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </React.Fragment>
    );
  }

  return (
    <ExclusionContext.Provider value={{ saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <Wrapper>
        <MainBody>
          <FloatingHeader>
            <Box sx={{ width: "20%" }}></Box>
            <HeaderTitle>Subscription Exclusions</HeaderTitle>
            <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ width: "20%", ml: 2, mr: 2 }}>
              <Tooltip title="Save" >
                <IconButton
                  color="primary"
                  aria-label="upload picture"
                  component="span"
                  style={{
                    visibility: (unchanged || loading) ? 'hidden' : 'visible'
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
                toggleRowSelectOnClick={true}
                loading={loading || sending || !subscriptions || !loadedExclusions}
                loadingText={sending ? <Update>Updating</Update> : "Loading"}
                dataSource={gridData || []}
                defaultFilterValue={filterValue}
                onRowClick={(rowData) => onClick(rowData.data)}
                onCellDoubleClick={onCellDoubleClick}
                selected={selected || {}}
                sortInfo={columnSortState}
                emptyText={NoRowsOverlay}
                style={gridStyle}
                className="ipam-subscription-exclusions"
              />
            </GridBody>
          </DataSection>
        </MainBody>
      </Wrapper>
    </ExclusionContext.Provider>
  );
}
