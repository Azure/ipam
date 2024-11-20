import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import { styled } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";

import { isEmpty, isEqual, pickBy, orderBy, sortBy, pick } from "lodash";

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
  TextField,
  Autocomplete,
  Typography,
  Tooltip,
  CircularProgress
} from "@mui/material";

import {
  Refresh,
  SaveAlt,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined
} from "@mui/icons-material";

import {
  fetchBlockAvailable,
  replaceBlockNetworks
} from "../../ipam/ipamAPI";

import {
  selectSpaces,
  selectBlocks,
  selectSubscriptions,
  fetchNetworksAsync,
  selectViewSetting,
  updateMeAsync,
  getAdminStatus
} from "../../ipam/ipamSlice";

const vNetPattern = "/Microsoft.Network/virtualNetworks/";
const vHubPattern = "/Microsoft.Network/virtualHubs/";

const NetworkContext = React.createContext({});

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
  const { saving, sendResults, saveConfig, loadConfig, resetConfig } = React.useContext(NetworkContext);

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

const Associations = () => {
  const { enqueueSnackbar } = useSnackbar();

  const location = useLocation();

  const [spaceInput, setSpaceInput] = React.useState('');
  const [blockInput, setBlockInput] = React.useState('');

  const [selectedSpace, setSelectedSpace] = React.useState(location.state?.space || null);
  const [selectedBlock, setSelectedBlock] = React.useState(location.state?.block || null);

  const [prevBlock, setPrevBlock] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [sendResults, setSendResults] = React.useState(null);
  const [vNets, setVNets] = React.useState(null);
  const [gridData, setGridData] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState(null);
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [columnState, setColumnState] = React.useState(null);
  const [columnOrderState, setColumnOrderState] = React.useState([]);
  const [columnSortState, setColumnSortState] = React.useState({});

  const [unchanged, setUnchanged] = React.useState(true);

  const isAdmin = useSelector(getAdminStatus);
  const spaces = useSelector(selectSpaces);
  const blocks = useSelector(selectBlocks);
  const subscriptions = useSelector(selectSubscriptions);
  const viewSetting = useSelector(state => selectViewSetting(state, 'networks'));

  const saveTimer = React.useRef();

  const dispatch = useDispatch();
  const theme = useTheme();

  const columns = React.useMemo(() => [
    { name: "name", header: "Name", type: "string", flex: 1, visible: true },
    {
      name: "type",
      header: "Type",
      type: "string",
      flex: 0.45,
      visible: true,
      // filterEditor: SelectFilter,
      // filterEditorProps: {
      //   multiple: true,
      //   wrapMultiple: false,
      //   dataSource: ['vNET', 'vHUB'].map(c => {
      //     return { id: c, label: c}
      //   }),
      // }
    },
    { name: "resource_group", header: "Resource Group", type: "string", flex: 1, visible: true },
    { name: "subscription_name", header: "Subscription Name", type: "string", flex: 1, visible: true },
    { name: "subscription_id", header: "Subscription ID", type: "string", flex: 1, visible: false },
    { name: "prefixes", header: "Prefixes", type: "array", flex: 0.75, render: ({value}) => value.join(", "), visible: true },
    { name: "id", header: () => <HeaderMenu setting="networks"/> , width: 25, resizable: false, hideable: false, sortable: false, draggable: false, showColumnMenuTool: false, render: ({data}) => "", visible: true }
  ], []);

  const filterValue = [
    { name: "name", operator: "contains", type: "string", value: "" },
    // { name: "type", operator: "inlist", type: "select", value: ["vNET", "vHUB"] },
    { name: "type", operator: "contains", type: "string", value: "" },
    { name: "resource_group", operator: "contains", type: "string", value: "" },
    { name: "subscription_name", operator: "contains", type: "string", value: "" },
    { name: "subscription_id", operator: "contains", type: "string", value: "" },
    { name: "prefixes", operator: "contains", type: "array", value: "" }
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
      { "op": "add", "path": `/views/networks`, "value": saveData }
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
          vNets,
          [columnSortState.name],
          [columnSortState.dir === -1 ? 'desc' : 'asc']
        )
      );
    } else {
      setGridData(vNets);
    }
  },[vNets, columnSortState]);

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
        } else {
          setSelectedBlock(null);
        }
      } else {
        setSelectionModel(null);
      }
    } else {
      setSelectedBlock(null);
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
    if(selectedBlock && vNets) {
      setUnchanged(isEqual(selectedBlock['vnets'].reduce((obj, vnet) => (obj[vnet.id] = vnet, obj) ,{}), selectionModel));
    } else {
      setUnchanged(true);
    }
  }, [vNets, selectedBlock, selectionModel]);

  const mockVNet = React.useCallback((id) => {
    const nameRegex = "(?<=/virtualNetworks/).*";
    const rgRegex = "(?<=/resourceGroups/).*?(?=/)";
    const subRegex = "(?<=/subscriptions/).*?(?=/)";
  
    const name = id.match(nameRegex)[0]
    const resourceGroup = id.match(rgRegex)[0]
    const subscription = id.match(subRegex)[0]
  
    const mockNet = {
      name: name,
      id: id,
      type: id.includes(vNetPattern) ? "vNET" : id.includes(vHubPattern) ? "vHUB" : "Unknown",
      prefixes: ["ErrNotFound"],
      subnets: [],
      resource_group: resourceGroup.toLowerCase(),
      subscription_name: subscriptions.find(sub => sub.subscription_id === subscription)?.name || 'Unknown',
      subscription_id: subscription,
      tenant_id: null,
      active: false
    };
  
    return mockNet
  }, [subscriptions]);

  const refreshData = React.useCallback(() => {
    (async () => {
      if(selectedBlock) {
        try {
          setRefreshing(true);

          var missing_data = [];
          var data = await fetchBlockAvailable(selectedBlock.parent_space, selectedBlock.name);

          data.forEach((item) => {
            item['type'] = item.id.includes(vNetPattern) ? "vNET" : item.id.includes(vHubPattern) ? "vHUB" : "Unknown";
            item['subscription_name'] = subscriptions.find(sub => sub.subscription_id === item.subscription_id)?.name || 'Unknown';
            item['active'] = true;
          });

          const missing = selectedBlock['vnets'].map(vnet => vnet.id).filter(item => !data.map(a => a.id.toLowerCase()).includes(item.toLowerCase()));

          missing.forEach((item) => {
            missing_data.push(mockVNet(item));
          });

          const newVNetData = [...sortBy(missing_data, 'name'), ...sortBy(data, 'name')]

          setVNets(newVNetData);

          setSelectionModel(prev => {
            if(prev) {
              const newSelection = {};

              Object.keys(prev).forEach(key => {
                if(newVNetData.map(vnet => vnet.id).includes(key)) {
                  newSelection[key] = prev[key];
                }
              });

              return newSelection;
            } else {
              return selectedBlock['vnets'].reduce((obj, vnet) => (obj[vnet.id] = vnet, obj) ,{});
            }
          });
        } catch (e) {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error fetching available IP Block networks", { variant: "error" });
        } finally {
          setRefreshing(false);
        }
      }
    })();
  }, [selectedBlock, subscriptions, enqueueSnackbar, mockVNet]);

  function onSubmit() {
    (async () => {
      try {
        setSending(true);
        await replaceBlockNetworks(selectedBlock.parent_space, selectedBlock.name, Object.keys(selectionModel));
        enqueueSnackbar("Successfully updated IP Block vNets", { variant: "success" });
        dispatch(fetchNetworksAsync());
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

  React.useEffect(() => {
    if(selectedBlock && subscriptions) {
      const newBlock = {
        identity: {
          id: selectedBlock.id,
          name: selectedBlock.name,
          cidr: selectedBlock.cidr
        },
        data: {
          vnets: selectedBlock.vnets
        }
      };

      if(isEqual(prevBlock.identity, newBlock.identity)) {
        if(!isEqual(prevBlock.data, newBlock.data)) {
          refreshData();
          setPrevBlock(newBlock);
        }
      } else {
        setSelectionModel(null);
        setVNets(null);
        refreshData();
        setPrevBlock(newBlock);
      }
    }

    if(!selectedBlock && !isEmpty(prevBlock)) {
      setSelectionModel(null);
      setVNets(null);
      setPrevBlock({});
    }
  }, [selectedBlock, subscriptions, prevBlock, refreshData]);

  function setSelection(data) {
    const newData = Object.entries(data).reduce((acc, [key, value]) => {
      const n = {
        id: value.id,
        active: value.active
      };
    
      acc[key] = n;
    
      return acc;
    }, {});

    setSelectionModel(newData);
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
              No Virtual Networks Found for Selected Block CIDR
            </Typography>
          : <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              Please Select a Space & Block
            </Typography>
        }
      </React.Fragment>
    );
  }

  return (
    <NetworkContext.Provider value={{ saving, sendResults, saveConfig, loadConfig, resetConfig }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', pt: 2, pb: 2, pr: 3, pl: 3, alignItems: 'center', borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <Autocomplete
              disabled={refreshing}
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
              disabled={selectedSpace === null || refreshing}
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
          <Box sx={{ display: 'flex', flexDirection: 'row', ml: 4 }}>
            <Box sx={{ mr: 1 }}>
              <Typography variant='body1' display='block' sx={{ fontStyle: 'italic', userSelect: 'none' }}>
                Selected:
              </Typography>
            </Box>
            <Box>
              <Typography variant='body1' display='block' sx={{ fontStyle: 'italic', userSelect: 'none' }}>
                {
                  (sending || !subscriptions || !spaces || !blocks || !vNets || refreshing ) ?
                  <span style={{ fontStyle: 'italic', userSelect: 'none' }}>(...)</span> :
                  <span style={{ fontStyle: 'italic', userSelect: 'none' }}>({Object.keys(selectionModel).length}/{vNets ? vNets.length : '?'})</span>
                }
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', ml: 'auto' }}>
            <Tooltip
              title="Save"
              placement="top"
              style={{
                visibility: (unchanged || refreshing) ? 'hidden' : 'visible'
              }}
            >
              <span>
                <IconButton
                  color="success"
                  aria-label="save associations"
                  component="span"
                  disabled={sending}
                  onClick={onSubmit}
                >
                  <SaveAlt />
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
                  onClick={refreshData}
                  disabled={sending || refreshing || !selectedSpace || !selectedBlock }
                >
                  <Refresh />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, pb: 3, pr: 3, pl: 3, overflowY: 'auto', overflowX: 'hidden' }}>
          <Box
            sx={{
              pt: 4,
              height: "100%",
              '& .ipam-block-vnet-stale': {
                  background: theme.palette.mode === 'dark' ? 'rgb(220, 20, 20) !important' : 'rgb(255, 230, 230) !important',
                '.InovuaReactDataGrid__row-hover-target': {
                  '&:hover': {
                    background: theme.palette.mode === 'dark' ? 'rgb(220, 100, 100) !important' : 'rgb(255, 220, 220) !important',
                  }
                }
              },
              '& .ipam-block-vnet-normal': {
                  background: theme.palette.mode === 'dark' ? 'rgb(49, 57, 67)' : 'white',
                '.InovuaReactDataGrid__row-hover-target': {
                  '&:hover': {
                    background: theme.palette.mode === 'dark' ? 'rgb(74, 84, 115) !important' : 'rgb(208, 213, 237) !important',
                  }
                }
              }
            }}
          >
            <ReactDataGrid
              theme={theme.palette.mode === 'dark' ? "default-dark" : "default-light"}
              idProperty="id"
              showCellBorders="horizontal"
              checkboxColumn={isAdmin}
              checkboxOnlyRowSelect
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
              loading={sending || refreshing }
              loadingText={sending ? <Update>Updating</Update> : "Loading"}
              dataSource={gridData || []}
              selected={selectionModel || []}
              onSelectionChange={({selected}) => isAdmin && setSelection(selected)}
              rowClassName={({data}) => `ipam-block-vnet-${!data.active ? 'stale' : 'normal'}`}
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
    </NetworkContext.Provider>
  );
}

export default Associations;
