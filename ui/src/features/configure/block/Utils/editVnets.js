import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { isEqual, sortBy } from 'lodash';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import { useTheme } from '@mui/material/styles';

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
} from "@mui/material";

import {
  Refresh
} from "@mui/icons-material";

import LoadingButton from '@mui/lab/LoadingButton';

import {
  fetchBlockAvailable,
  replaceBlockNetworks
} from "../../../ipam/ipamAPI";

import {
  selectSubscriptions,
  fetchNetworksAsync
} from "../../../ipam/ipamSlice";

import { apiRequest } from "../../../../msal/authConfig";

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

const columns = [
  { name: "name", header: "Name", defaultFlex: 1 },
  { name: "resource_group", header: "Resource Group", defaultFlex: 1 },
  { name: "subscription_name", header: "Subscription Name", defaultFlex: 1 },
  { name: "subscription_id", header: "Subscription ID", defaultFlex: 1, defaultVisible: false },
  { name: "prefixes", header: "Prefixes", defaultFlex: 0.75, render: ({value}) => value.join(", ") },
];

export default function EditVnets(props) {
  const { open, handleClose, block, refresh, refreshingState } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [vNets, setVNets] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const subscriptions = useSelector(selectSubscriptions);
  const dispatch = useDispatch();

  const theme = useTheme();

  //eslint-disable-next-line
  const unchanged = block ? isEqual(block['vnets'].reduce((obj, vnet) => (obj[vnet.id] = vnet, obj) ,{}), selectionModel) : false;

  React.useEffect(() => {
    if(block && subscriptions) {
      setVNets(null);
      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block, subscriptions]);

  React.useEffect(() => {
    if(block) {
      // eslint-disable-next-line
      !refreshingState && setSelectionModel(block['vnets'].reduce((obj, vnet) => (obj[vnet.id] = vnet, obj) ,{}));
    }
  }, [block, refreshingState]);

  function mockVNet(id) {
    const nameRegex = "(?<=/virtualNetworks/).*";
    const rgRegex = "(?<=/resourceGroups/).*?(?=/)";
    const subRegex = "(?<=/subscriptions/).*?(?=/)";
  
    const name = id.match(nameRegex)[0]
    const resourceGroup = id.match(rgRegex)[0]
    const subscription = id.match(subRegex)[0]
  
    const mockNet = {
      name: name,
      id: id,
      prefixes: ["ErrNotFound"],
      subnets: [],
      resource_group: resourceGroup.toLowerCase(),
      subscription_name: subscriptions.find(sub => sub.subscription_id === subscription)?.name || 'Unknown',
      subscription_id: subscription,
      tenant_id: null,
      active: false
    };
  
    return mockNet
  }

  function refreshData() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      setVNets([]);

      if(block) {
        try {
          setRefreshing(true);
          setSelectionModel([]);

          var missing_data = [];
          const response = await instance.acquireTokenSilent(request);
          var data = await fetchBlockAvailable(response.accessToken, block.parent_space, block.name);
          data.forEach((item) => {
            item['subscription_name'] = subscriptions.find(sub => sub.subscription_id === item.subscription_id)?.name || 'Unknown';
            item['active'] = true;
          });
          const missing = block['vnets'].map(vnet => vnet.id).filter(item => !data.map(a => a.id).includes(item));
          missing.forEach((item) => {
            missing_data.push(mockVNet(item));
          });
          setVNets([...sortBy(missing_data, 'name'), ...sortBy(data, 'name')]);
          //eslint-disable-next-line
          setSelectionModel(block['vnets'].reduce((obj, vnet) => (obj[vnet.id] = vnet, obj) ,{}));
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) {
            instance.acquireTokenRedirect(request);
          } else {
            console.log("ERROR");
            console.log("------------------");
            console.log(e);
            console.log("------------------");
            enqueueSnackbar("Error fetching available IP Block networks", { variant: "error" });
          }
        } finally {
          setRefreshing(false);
        }
      }
    })();
  }

  function manualRefresh() {
    refresh();
    refreshData();
  }

  function onSubmit() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        const response = await instance.acquireTokenSilent(request);
        await replaceBlockNetworks(response.accessToken, block.parent_space, block.name, Object.keys(selectionModel));
        handleClose();
        enqueueSnackbar("Successfully updated IP Block vNets", { variant: "success" });
        dispatch(fetchNetworksAsync(response.accessToken));
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.error, { variant: "error" });
        }
      } finally {
        setSending(false);
        refresh();
      }
    })();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        style: {
          overflowY: "unset"
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", flexDirection: "row" }}>
          <Box>
          Virtual Network Association
          </Box>
          <Box sx={{ ml: "auto" }}>
            <IconButton
              color="primary"
              size="small"
              onClick={manualRefresh}
              disabled={sending || refreshing || refreshingState}
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
          Select the Virtual Networks below which should be associated with the Block <Spotlight>'{block && block.name}'</Spotlight>
        </DialogContentText>
        <Box
          sx={{
            pt: 4,
            height: "400px",
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
            checkboxColumn
            checkboxOnlyRowSelect
            showZebraRows={false}
            multiSelect={true}
            click
            showActiveRowIndicator={false}
            enableColumnAutosize={false}
            showColumnMenuGroupOptions={false}
            showColumnMenuLockOptions={false}
            columns={columns}
            loading={sending || !subscriptions || !vNets || refreshing || refreshingState}
            loadingText={sending ? <Update>Updating</Update> : "Loading"}
            dataSource={vNets || []}
            selected={selectionModel}
            onSelectionChange={({selected}) => setSelectionModel(selected)}
            rowClassName={({data}) => `ipam-block-vnet-${!data.active ? 'stale' : 'normal'}`}
            style={gridStyle}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <LoadingButton onClick={onSubmit} loading={sending} disabled={unchanged || sending || refreshing || refreshingState}>
          Apply
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
