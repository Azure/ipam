import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation } from "react-router";
import { useTheme } from "@mui/material/styles";

import { isEmpty, isEqual, sortBy, pick } from "lodash";

import { useSnackbar } from "notistack";

import { DataGrid } from "../../../global/grids";

import {
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Autocomplete,
  Typography,
  Tooltip,
} from "@mui/material";

import {
  Refresh,
  SaveAlt,
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
  getAdminStatus
} from "../../ipam/ipamSlice";

const vNetPattern = "/Microsoft.Network/virtualNetworks/";
const vHubPattern = "/Microsoft.Network/virtualHubs/";

const Associations = () => {
  const { enqueueSnackbar } = useSnackbar();

  const location = useLocation();

  const [spaceInput, setSpaceInput] = React.useState('');
  const [blockInput, setBlockInput] = React.useState('');

  const [selectedSpace, setSelectedSpace] = React.useState(location.state?.space || null);
  const [selectedBlock, setSelectedBlock] = React.useState(location.state?.block || null);

  const [prevBlock, setPrevBlock] = React.useState({});
  const [vNets, setVNets] = React.useState(null);
  const [selectedRows, setSelectedRows] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [unchanged, setUnchanged] = React.useState(true);

  const isAdmin = useSelector(getAdminStatus);
  const spaces = useSelector(selectSpaces);
  const blocks = useSelector(selectBlocks);
  const subscriptions = useSelector(selectSubscriptions);

  const dispatch = useDispatch();
  const theme = useTheme();

  // Column definitions for AG Grid
  const columns = React.useMemo(() => [
    { field: "name", headerName: "Name", flex: 1 },
    { field: "type", headerName: "Type", flex: 0.45 },
    { field: "resource_group", headerName: "Resource Group", flex: 1 },
    { field: "subscription_name", headerName: "Subscription Name", flex: 1 },
    { field: "subscription_id", headerName: "Subscription ID", flex: 1, hide: true },
    {
      field: "prefixes",
      headerName: "Prefixes",
      flex: 0.75,
      valueGetter: (params) => {
        const value = params.data?.prefixes;
        return Array.isArray(value) ? value.join(', ') : '';
      },
      filterValueGetter: (params) => {
        const value = params.data?.prefixes;
        return Array.isArray(value) ? value.join(' ') : '';
      }
    },
  ], []);

  // Row class rules for AG Grid (stale vs normal rows)
  const rowClassRules = React.useMemo(() => ({
    'ipam-block-vnet-stale': (params) => !params.data?.active,
    'ipam-block-vnet-normal': (params) => params.data?.active,
  }), []);

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
        setSelectedRows([]);
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

  // Check if selection has changed from original block vnets
  React.useEffect(() => {
    if(selectedBlock && vNets) {
      const blockVnets = Array.isArray(selectedBlock.vnets) ? selectedBlock.vnets : [];
      const blockVnetIds = blockVnets.map(vnet => vnet.id).sort();
      const selectedIds = selectedRows.map(row => row.id).sort();
      setUnchanged(isEqual(blockVnetIds, selectedIds));
    } else {
      setUnchanged(true);
    }
  }, [vNets, selectedBlock, selectedRows]);

  const mockVNet = React.useCallback((id) => {
    const typeLookup = { virtualnetworks: 'vNET', virtualhubs: 'vHUB' };

    const segments = id.split('/').filter(Boolean);

    const subscriptionIndex = segments.findIndex(segment => segment.toLowerCase() === 'subscriptions');
    const resourceGroupIndex = segments.findIndex(segment => segment.toLowerCase() === 'resourcegroups');

    const subscription = subscriptionIndex > -1 ? segments[subscriptionIndex + 1] : null;
    const resourceGroup = resourceGroupIndex > -1 ? segments[resourceGroupIndex + 1] : null;

    const providerIndex = segments.findIndex(segment => segment.toLowerCase() === 'microsoft.network');
    const typeSegment = providerIndex > -1 ? segments[providerIndex + 1] : null;
    const nameSegment = providerIndex > -1 ? segments[providerIndex + 2] : null;

    const mockNet = {
      name: nameSegment || id,
      id: id,
      type: typeLookup[(typeSegment || '').toLowerCase()] || 'Unknown',
      prefixes: ["ErrNotFound"],
      subnets: [],
      resource_group: resourceGroup ? resourceGroup.toLowerCase() : 'Unknown',
      subscription_name: subscription ? subscriptions.find(sub => sub.subscription_id === subscription)?.name || 'Unknown' : 'Unknown',
      subscription_id: subscription || 'Unknown',
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

          const blockVnets = Array.isArray(selectedBlock.vnets) ? selectedBlock.vnets : [];
          const missing = blockVnets.map(vnet => vnet.id).filter(item => !data.map(a => a.id.toLowerCase()).includes(item.toLowerCase()));

          missing.forEach((item) => {
            missing_data.push(mockVNet(item));
          });

          const newVNetData = [...sortBy(missing_data, 'name'), ...sortBy(data, 'name')]

          setVNets(newVNetData);

          // Set initial selection based on block vnets
          setSelectedRows(prev => {
            if(prev && prev.length > 0) {
              // Keep existing selection that's still valid
              return prev.filter(row => newVNetData.some(vnet => vnet.id === row.id));
            } else {
              // Initialize with block vnets
              return newVNetData.filter(vnet => blockVnets.some(bv => bv.id === vnet.id));
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
        await replaceBlockNetworks(selectedBlock.parent_space, selectedBlock.name, selectedRows.map(row => row.id));
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
        setSelectedRows([]);
        setVNets(null);
        refreshData();
        setPrevBlock(newBlock);
      }
    }

    if(!selectedBlock && !isEmpty(prevBlock)) {
      setSelectedRows([]);
      setVNets(null);
      setPrevBlock({});
    }
  }, [selectedBlock, subscriptions, prevBlock, refreshData]);

  // Handle selection changes from the grid
  const handleSelectionChanged = React.useCallback((rows) => {
    if (isAdmin) {
      setSelectedRows(rows);
    }
  }, [isAdmin]);

  // No rows overlay component
  const NoRowsOverlay = React.useCallback(() => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          { selectedBlock
            ? "No Virtual Networks Found for Selected Block CIDR"
            : "Please Select a Space & Block"
          }
        </Typography>
      </Box>
    );
  }, [selectedBlock]);

  return (
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
                  <span style={{ fontStyle: 'italic', userSelect: 'none' }}>({selectedRows.length}/{vNets ? vNets.length : '?'})</span>
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
              // Stale row styling (vNets no longer present)
              '& .ag-row.ipam-block-vnet-stale': {
                backgroundColor: theme.palette.mode === 'dark' ? 'rgb(120, 40, 40)' : 'rgb(255, 235, 235)',
                '&.ag-row-hover': {
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgb(140, 60, 60)' : 'rgb(255, 220, 220)',
                }
              },
            }}
          >
            <DataGrid
              viewSettingKey="networks"
              idProperty="id"
              rowData={vNets || []}
              columnDefs={columns}
              multiSelect={true}
              checkboxSelect={isAdmin}
              isLoading={sending || refreshing}
              initialSelectedRows={selectedRows}
              onRowSelectionChanged={handleSelectionChanged}
              rowClassRules={rowClassRules}
              noRowsOverlayComponent={NoRowsOverlay}
            />
          </Box>
        </Box>
      </Box>
  );
}

export default Associations;
