import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';

import { concat, merge, cloneDeep, isEqual } from 'lodash';

// import SnackbarUtils from '../../utils/snackbar';

import {
  fetchSpaces,
  createSpace,
  updateSpace,
  deleteSpace,
  createBlock,
  updateBlock,
  deleteBlock,
  deleteBlockResvs,
  fetchVNets,
  fetchVHubs,
  fetchSubnets,
  fetchEndpoints,
  fetchNetworks,
  refreshAll,
  getMe,
  updateMe
} from './ipamAPI';

const subnetMap = {
  AFW: "Azure Firewall",
  VGW: "Virtual Network Gateway",
  BAS: "Azure Bastion",
  AGW: "Application Gateway"
};

const initialState = {
  userId: null,
  refreshInterval: null,
  viewSettings: null,
  isAdmin: false,
  spaces: null,
  subscriptions: null,
  vNets: null,
  vHubs: null,
  subnets: null,
  endpoints: null,
  darkMode: false,
  meLoaded: false,
  refreshing: false,
};

// The functions below are called thunks and allow us to perform async logic. It
// can be dispatched like a regular action: `dispatch(incrementAsync(10))`. This
// will call the thunk with the `dispatch` function as the first argument. Async
// code can then be executed and other actions can be dispatched. Thunks are
// typically used to make async requests.

// function parseError(error) {
//   console.log("ERROR DETAILS");
//   console.log("------------------");
//   console.log(error);
//   console.log("------------------");

//   if (error.response) {
//     // The request was made and the server responded with a status code
//     // that falls out of the range of 2xx
//     return error.response.data.error;
//   } else {
//     // Something happened in setting up the request that triggered an Error
//     return error.message;
//   }
// }

export const fetchSpacesAsync = createAsyncThunk(
  'ipam/fetchSpaces',
  async (args, { rejectWithValue }) => {
    try {
      const response = await fetchSpaces(true);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const createSpaceAsync = createAsyncThunk(
  'ipam/createSpace',
  async (args, { rejectWithValue }) => {
    try {
      const response = await createSpace(args.body);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const updateSpaceAsync = createAsyncThunk(
  'ipam/updateSpace',
  async (args, { rejectWithValue }) => {
    try {
      const response = await updateSpace(args.space, args.body);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const deleteSpaceAsync = createAsyncThunk(
  'ipam/deleteSpace',
  async (args, { rejectWithValue }) => {
    try {
      const response = await deleteSpace(args.space, args.force);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const createBlockAsync = createAsyncThunk(
  'ipam/createBlock',
  async (args, { rejectWithValue }) => {
    try {
      const response = await createBlock(args.space, args.body);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const updateBlockAsync = createAsyncThunk(
  'ipam/updateBlock',
  async (args, { rejectWithValue }) => {
    try {
      const response = await updateBlock(args.space, args.block, args.body);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const deleteBlockAsync = createAsyncThunk(
  'ipam/deleteBlock',
  async (args, { rejectWithValue }) => {
    try {
      const response = await deleteBlock(args.space, args.block, args.force);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const deleteBlockResvsAsync = createAsyncThunk(
  'ipam/deleteBlockResvs',
  async (args, { rejectWithValue }) => {
    try {
      const response = await deleteBlockResvs(args.space, args.block, args.body);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchVNetsAsync = createAsyncThunk(
  'ipam/fetchVNets',
  async (args, { rejectWithValue }) => {
    try {
      const response = await fetchVNets();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchVHubsAsync = createAsyncThunk(
  'ipam/fetchVHubs',
  async (args, { rejectWithValue }) => {
    try {
      const response = await fetchVHubs();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchSubnetsAsync = createAsyncThunk(
  'ipam/fetchSubnets',
  async (args, { rejectWithValue }) => {
    try {
      const response = await fetchSubnets();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchEndpointsAsync = createAsyncThunk(
  'ipam/fetchEndpoints',
  async (args, { rejectWithValue }) => {
    try {
      const response = await fetchEndpoints();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const fetchNetworksAsync = createAsyncThunk(
  'ipam/fetchNetworks',
  async (args, { rejectWithValue }) => {
    try {
      const response = await fetchNetworks();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const refreshAllAsync = createAsyncThunk(
  'ipam/refreshAll',
  async (args, { rejectWithValue }) => {
    try {
      const response = await refreshAll();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const getMeAsync = createAsyncThunk(
  'ipam/getMe',
  async (args, { rejectWithValue }) => {
    try {
      const response = await getMe();

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const updateMeAsync = createAsyncThunk(
  'ipam/updateMe',
  async (args, { rejectWithValue }) => {
    try {
      const response = await updateMe(args.body);

      return response;
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const ipamSlice = createSlice({
  name: 'ipam',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    setUserId: (state, action) => {
      state.userId = action.payload
    },
    setDarkMode: (state, action) => {
      state.darkMode = action.payload
    }
  },
  // The `extraReducers` field lets the slice handle actions defined elsewhere,
  // including actions generated by createAsyncThunk or in other slices.
  extraReducers: (builder) => {
    builder
      .addCase(fetchSpacesAsync.fulfilled, (state, action) => {
        state.spaces = action.payload.map((space) => {
          if('size' in space && 'used' in space) {
            space.available = (space.size - space.used);
            space.utilization = Math.round((space.used / space.size) * 100) || 0;
          }

          space.blocks.map((block) => {
            block.parent_space = space.name;
            block.available = (block.size - block.used);
            block.utilization = Math.round((block.used / block.size) * 100);
            block.id = `${block.name}@${block.parent_space}`;

            return block;
          });

          return space;
        });
      })
      .addCase(fetchSpacesAsync.rejected, (state, action) => {
        console.log("fetchSpacesAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(createSpaceAsync.fulfilled, (state, action) => {
        const newSpace = action.payload;

        newSpace.size = 0;
        newSpace.used = 0;
        newSpace.available = 0;
        newSpace.utilization = 0;

        state.spaces.push(newSpace);
      })
      .addCase(createSpaceAsync.rejected, (state, action) => {
        console.log("createSpaceAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(updateSpaceAsync.fulfilled, (state, action) => {
        const spaceName = action.meta.arg.space;
        const updatedSpace = action.payload;
        const spaceIndex = state.spaces.findIndex((x) => x.name === spaceName);

        if (spaceIndex > -1) {
          state.spaces[spaceIndex] = merge(state.spaces[spaceIndex], updatedSpace);

          if(spaceName !== updatedSpace.name) {
            state.spaces[spaceIndex].blocks = state.spaces[spaceIndex].blocks.map((block) => {
              if(block.parent_space === spaceName) {
                block.parent_space = updatedSpace.name;
              }

              return block;
            });

            state.vNets = state.vNets.map((vnet) => {
              if(vnet.parent_space === spaceName) {
                vnet.parent_space = updatedSpace.name;
              }

              return vnet;
            });

            state.vHubs = state.vHubs.map((vhub) => {
              if(vhub.parent_space === spaceName) {
                vhub.parent_space = updatedSpace.name;
              }

              return vhub;
            });
          }
        }
      })
      .addCase(updateSpaceAsync.rejected, (state, action) => {
        console.log("updateSpaceAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(deleteSpaceAsync.fulfilled, (state, action) => {
        const spaceName = action.meta.arg.space;

        const spaceIndex = state.spaces.findIndex((space) => space.name === spaceName);

        if(spaceIndex > -1) {
          state.spaces.splice(spaceIndex, 1);
        }
      })
      .addCase(deleteSpaceAsync.rejected, (state, action) => {
        console.log("deleteSpaceAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(createBlockAsync.fulfilled, (state, action) => {
        const spaceName = action.meta.arg.space;
        const spaceIndex = state.spaces.findIndex((x) => x.name === spaceName);
        const newBlock = action.payload;

        newBlock.size = 0;
        newBlock.used = 0;
        newBlock.parent_space = spaceName;
        newBlock.available = 0;
        newBlock.utilization = 0;

        state.spaces[spaceIndex].blocks.push(newBlock);
      })
      .addCase(createBlockAsync.rejected, (state, action) => {
        console.log("createBlockAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(updateBlockAsync.fulfilled, (state, action) => {
        const spaceName = action.meta.arg.space;
        const blockName = action.meta.arg.block;
        const updatedBlock = action.payload;
        const spaceIndex = state.spaces.findIndex((x) => x.name === spaceName);

        if (spaceIndex > -1) {
          const blockIndex = state.spaces[spaceIndex].blocks.findIndex((x) => x.name === blockName);

          if(blockIndex > -1) {
            state.spaces[spaceIndex].blocks[blockIndex] = merge(state.spaces[spaceIndex].blocks[blockIndex], updatedBlock);

            if(blockName !== updatedBlock.name) {
              state.vNets = state.vNets.map((vnet) => {
                if(vnet.parent_block === blockName) {
                  vnet.parent_block = updatedBlock.name;
                }

                return vnet;
              });

              state.vHubs = state.vHubs.map((vhub) => {
                if(vhub.parent_block === blockName) {
                  vhub.parent_block = updatedBlock.name;
                }

                return vhub;
              });
            }
          }
        }
      })
      .addCase(updateBlockAsync.rejected, (state, action) => {
        console.log("updateBlockAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(deleteBlockAsync.fulfilled, (state, action) => {
        const spaceName = action.meta.arg.space;
        const spaceIndex = state.spaces.findIndex((x) => x.name === spaceName);
        const blockName = action.meta.arg.block;

        const targetIndex = state.spaces[spaceIndex].blocks.findIndex((block) => block.name === blockName);

        if(targetIndex > -1) {
          state.spaces[spaceIndex].blocks.splice(targetIndex, 1);
        }
      })
      .addCase(deleteBlockAsync.rejected, (state, action) => {
        console.log("deleteBlockAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(deleteBlockResvsAsync.fulfilled, (state, action) => {
        const spaceName = action.meta.arg.space;
        const spaceIndex = state.spaces.findIndex((x) => x.name === spaceName);
        const blockName = action.meta.arg.block;
        const resvList = action.meta.arg.body;

        const blockIndex = state.spaces[spaceIndex].blocks.findIndex((block) => block.name === blockName);

        if(blockIndex > -1) {
          const updatedResv = state.spaces[spaceIndex].blocks[blockIndex].resv.map((resv) => {
            if(resvList.includes(resv.id)) {
              resv.settledOn = (Date.now() / 1000);
              resv.settledBy = state.userId;
              resv.status = "cancelledByUser";
            }

            return resv;
          });

          state.spaces[spaceIndex].blocks[blockIndex].resv = updatedResv;
        }
      })
      .addCase(deleteBlockResvsAsync.rejected, (state, action) => {
        console.log("deleteBlockResvsAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(fetchVNetsAsync.fulfilled, (state, action) => {
        const vnets = action.payload.map((vnet) => {
          vnet.available = (vnet.size - vnet.used);
          vnet.utilization = Math.round((vnet.used / vnet.size) * 100);
          // vnet.prefixes = vnet.prefixes.join(", ");

          return vnet;
        });

        const subnets = vnets.map((vnet) => {
          var subnetArray = [];
        
          vnet.subnets.forEach((subnet) => {
            const subnetDetails = {
              name: subnet.name,
              id: `${vnet.id}/subnets/${subnet.name}`,
              prefix: subnet.prefix,
              resource_group: vnet.resource_group,
              subscription_id: vnet.subscription_id,
              tenant_id: vnet.tenant_id,
              vnet_name: vnet.name,
              vnet_id: vnet.id,
              used: subnet.used,
              size: subnet.size,
              available: (subnet.size - subnet.used),
              utilization: Math.round((subnet.used / subnet.size) * 100),
              type: subnetMap[subnet.type]
            };

            subnetArray.push(subnetDetails);
          });

          return subnetArray;
        }).flat();

        state.vNets = vnets;

        state.subnets = subnets;
      })
      .addCase(fetchVNetsAsync.rejected, (state, action) => {
        console.log("fetchVNetsAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(fetchSubnetsAsync.fulfilled, (state, action) => {
        const subnets = action.payload.map((subnet) => {
          subnet.available = (subnet.size - subnet.used);
          subnet.utilization = Math.round((subnet.used / subnet.size) * 100);
          subnet.type = subnetMap[subnet.type];

          return subnet;
        });

        state.subnets = subnets;
      })
      .addCase(fetchSubnetsAsync.rejected, (state, action) => {
        console.log("fetchSubnetsAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(fetchEndpointsAsync.fulfilled, (state, action) => {
        state.endpoints = action.payload;
      })
      .addCase(fetchEndpointsAsync.rejected, (state, action) => {
        console.log("fetchEndpointsAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(fetchNetworksAsync.fulfilled, (state, action) => {
        const vNetProvider = "Microsoft.Network/virtualNetworks";
        const vHubProvider = "Microsoft.Network/virtualHubs";

        const vNetData = action.payload.filter((x) => x.id.toLowerCase().includes(vNetProvider.toLowerCase()));
        const vHubData = action.payload.filter((x) => x.id.toLowerCase().includes(vHubProvider.toLowerCase()));

        const vnets = vNetData.map((vnet) => {
          vnet.available = (vnet.size - vnet.used);
          vnet.utilization = Math.round((vnet.used / vnet.size) * 100);
          // vnet.prefixes = vnet.prefixes.join(", ");

          return vnet;
        });

        state.vNets = vnets;

        const subnets = vNetData.map((vnet) => {
          var subnetArray = [];
        
          vnet.subnets.forEach((subnet) => {
            const subnetDetails = {
              name: subnet.name,
              id: `${vnet.id}/subnets/${subnet.name}`,
              prefix: subnet.prefix,
              resource_group: vnet.resource_group,
              subscription_id: vnet.subscription_id,
              tenant_id: vnet.tenant_id,
              vnet_name: vnet.name,
              vnet_id: vnet.id,
              used: subnet.used,
              size: subnet.size,
              available: (subnet.size - subnet.used),
              utilization: Math.round((subnet.used / subnet.size) * 100),
              type: subnetMap[subnet.type]
            };

            subnetArray.push(subnetDetails);
          });

          return subnetArray;
        }).flat();

        state.subnets = subnets;

        state.vHubs = vHubData;
      })
      .addCase(fetchNetworksAsync.rejected, (state, action) => {
        console.log("fetchNetworksAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(refreshAllAsync.fulfilled, (state, action) => {
        const vNetProvider = "Microsoft.Network/virtualNetworks";
        const vHubProvider = "Microsoft.Network/virtualHubs";

        state.refreshing = false;

        if(action.payload[0].status === 'fulfilled') {
          state.spaces = action.payload[0].value.map((space) => {
            if('size' in space && 'used' in space) {
              if(space.used === null) {
                space.used = 0;
              }

              space.available = (space.size - space.used);
              space.utilization = Math.round((space.used / space.size) * 100) || 0;
            }

            space.blocks.map((block) => {
              block.parent_space = space.name;
              block.available = (block.size - block.used);
              block.utilization = Math.round((block.used / block.size) * 100);
              block.id = `${block.name}@${block.parent_space}`;

              return block;
            });

            return space;
          });
        } else {
          state.spaces ??= [];
        }

        if(action.payload[1].status === 'fulfilled') {
          state.subscriptions = action.payload[1].value;
        } else {
          state.subscriptions ??= [];
        }

        if(action.payload[2].status === 'fulfilled') {
          const vNetData = action.payload[2].value.filter((x) => x.id.toLowerCase().includes(vNetProvider.toLowerCase()));
          const vHubData = action.payload[2].value.filter((x) => x.id.toLowerCase().includes(vHubProvider.toLowerCase()));

          const vnets = vNetData.map((vnet) => {
            vnet.available = (vnet.size - vnet.used);
            vnet.utilization = Math.round((vnet.used / vnet.size) * 100);
            // vnet.prefixes = vnet.prefixes.join(", ");

            return vnet;
          });

          state.vNets = vnets;

          const subnets = vNetData.map((vnet) => {
            var subnetArray = [];
          
            vnet.subnets.forEach((subnet) => {
              const subnetDetails = {
                name: subnet.name,
                id: `${vnet.id}/subnets/${subnet.name}`,
                prefix: subnet.prefix,
                resource_group: vnet.resource_group,
                subscription_id: vnet.subscription_id,
                tenant_id: vnet.tenant_id,
                vnet_name: vnet.name,
                vnet_id: vnet.id,
                used: subnet.used,
                size: subnet.size,
                available: (subnet.size - subnet.used),
                utilization: Math.round((subnet.used / subnet.size) * 100),
                type: subnetMap[subnet.type]
              };

              subnetArray.push(subnetDetails);
            });

            return subnetArray;
          }).flat();

          state.subnets = subnets;

          state.vHubs = vHubData;
        } else {
          state.vNets ??= [];
          state.subnets ??= [];
          state.vHubs ??= [];
        }

        if(action.payload[3].status === 'fulfilled') {
          const endpoints = action.payload[3].value.map((endpoint) => {
            endpoint.uniqueId = `${endpoint.id}@$${endpoint.private_ip}`

            return endpoint;
          });

          state.endpoints = endpoints;
        } else {
          state.endpoints ??= [];
        }
      })
      .addCase(refreshAllAsync.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(refreshAllAsync.rejected, (state, action) => {
        state.refreshing = false;

        console.log("refreshAllAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(getMeAsync.fulfilled, (state, action) => {
        if(state.refreshInterval !== action.payload['apiRefresh']) {
          state.refreshInterval = action.payload['apiRefresh'];
        }

        if('darkMode' in action.payload) {
          if(state.darkMode !== action.payload['darkMode']) {
            state.darkMode = action.payload['darkMode']
          }
        }

        if('views' in action.payload) {
          if(!isEqual(state.viewSettings, action.payload['views'])) {
            state.viewSettings = action.payload['views'];
          }
        }

        state.isAdmin = action.payload['isAdmin'];
        state.meLoaded = true;
      })
      .addCase(getMeAsync.rejected, (state, action) => {
        console.log("getMeAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      })
      .addCase(updateMeAsync.fulfilled, (state, action) => {
        action.meta.arg.body.forEach((update) => {
          const key = '/views/';
          const index = update.path.indexOf(key);

          if(index !== -1) {
            const viewName = update.path.substring(index + key.length);
            const viewValue = update.value;

            var newViewSettings = cloneDeep(state.viewSettings);
            newViewSettings[viewName] = viewValue;

            state.viewSettings = newViewSettings;
          }
        });
      })
      .addCase(updateMeAsync.rejected, (state, action) => {
        console.log("updateMeAsync Rejected");
        console.log(action);
        // SnackbarUtils.error(`Error fetching user settings (${action.error.message})`);
        throw action.payload;
      });
  },
});

export const { setUserId, setDarkMode } = ipamSlice.actions;

// The functions below are called selectors and allow us to select a value from
// the state. Selectors can also be defined inline where they're used instead of

export const getRefreshInterval = (state) => state.ipam.refreshInterval;
export const getViewSettings = (state) => state.ipam.viewSettings;
export const getAdminStatus = (state) => state.ipam.isAdmin;
export const getRefreshing = (state) => state.ipam.refreshing;
export const getDarkMode = (state) => state.ipam.darkMode;
export const getMeLoaded = (state) => state.ipam.meLoaded;

export const selectSpaces = (state) => state.ipam.spaces;
// export const selectBlocks = (state) => state.ipam.blocks;
export const selectSubscriptions = (state) => state.ipam.subscriptions;
export const selectVNets = (state) => state.ipam.vNets;
export const selectVHubs = (state) => state.ipam.vHubs;
export const selectSubnets = (state) => state.ipam.subnets;
export const selectEndpoints = (state) => state.ipam.endpoints;

export const selectBlocks = createSelector(
  [selectSpaces],
  (spaces) => {
    return spaces?.reduce((acc, curr) => acc.concat(curr.blocks), []) || null;
  }
);

const getSpaceName = (_, spaceName) => spaceName;

export const selectSpaceBlocks = createSelector(
  [selectSpaces, getSpaceName],
  (spaces, spaceName) => {
    const targetSpace = spaces?.find(x => x.name === spaceName);

    return targetSpace?.blocks || null;
  }
);

export const selectNetworks = createSelector(
  [selectVNets, selectVHubs],
  (vnets, vhubs) => {
    return concat(vnets, vhubs);
  }
);

export const selectUpdatedVNets = createSelector(
  [selectSubscriptions, selectVNets],
  (subscriptions, vnets) => {
    return vnets?.map((vnet) => {
      var newVNet = cloneDeep(vnet);

      newVNet.subscription_name = subscriptions?.find((x) => x.subscription_id === vnet.subscription_id)?.name || 'Unknown';

      return newVNet;
    });
  }
);

export const selectUpdatedVHubs = createSelector(
  [selectSubscriptions, selectVHubs],
  (subscriptions, vhubs) => {
    return vhubs?.map((vhub) => {
      var newVHub = cloneDeep(vhub);

      newVHub.subscription_name = subscriptions?.find((x) => x.subscription_id === vhub.subscription_id)?.name || 'Unknown';

      return newVHub;
    });
  }
);

export const selectUpdatedSubnets = createSelector(
  [selectSubscriptions, selectSubnets],
  (subscriptions, subnets) => {
    return subnets?.map((subnet) => {
      var newSubnet = cloneDeep(subnet);

      newSubnet.subscription_name = subscriptions?.find((x) => x.subscription_id === subnet.subscription_id)?.name || 'Unknown';

      return newSubnet;
    });
  }
);

export const selectUpdatedEndpoints = createSelector(
  [selectSubscriptions, selectEndpoints],
  (subscriptions, endpoints) => {
    return endpoints?.map((endpoint) => {
      var newEndpoint = cloneDeep(endpoint);

      newEndpoint.subscription_name = subscriptions?.find((x) => x.subscription_id === endpoint.subscription_id)?.name || 'Unknown';

      return newEndpoint;
    });
  }
);

export const selectUpdatedNetworks = createSelector(
  [selectSubscriptions, selectNetworks],
  (subscriptions, networks) => {
    return networks?.map((network) => {
      var newNetwork = cloneDeep(network);

      newNetwork.subscription_name = subscriptions?.find((x) => x.subscription_id === network.subscription_id)?.name || 'Unknown';

      return newNetwork;
    });
  }
);

const getSettingName = (_, settingName) => settingName;

export const selectViewSetting = createSelector(
  [getViewSettings, getSettingName],
  (viewSettings, settingName) => {
    if(viewSettings !== null) {
      return (settingName in viewSettings) ? viewSettings[settingName] : {};
    }

    return null;
  }
);

export default ipamSlice.reducer;
