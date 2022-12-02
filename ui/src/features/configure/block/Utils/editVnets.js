import * as React from "react";
import { styled } from "@mui/material/styles";

import { isEqual } from 'lodash';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';

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

import {
  fetchBlockAvailable,
  replaceBlockNetworks
} from "../../../ipam/ipamAPI";

import { apiRequest } from "../../../../msal/authConfig";

const Spotlight = styled("span")({
  fontWeight: "bold",
  color: "mediumblue"
});

const gridStyle = {
  height: '100%',
  border: '1px solid rgba(224, 224, 224, 1)',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

const columns = [
  { name: "name", header: "Name", defaultFlex: 1 },
  { name: "subscription_id", header: "Subscription", defaultFlex: 1 },
  { name: "resource_group", header: "Resource Group", defaultFlex: 1 },
  { name: "prefixes", header: "Prefixes", defaultFlex: 0.75, render: ({value}) => value.join(", ") },
];

export default function EditVnets(props) {
  const { open, handleClose, space, block, refresh, refreshingState } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [vNets, setVNets] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  //eslint-disable-next-line
  const unchanged = block ? isEqual(block['vnets'].reduce((obj, vnet) => (obj[vnet.id] = vnet, obj) ,{}), selectionModel) : false;

  React.useEffect(() => {
    block && refreshData();
  }, [block]);

  React.useEffect(() => {
    if(space && block) {
      !refreshingState && setSelectionModel(block['vnets'].map(vnet => vnet.id));
    }
  }, [space, block, refreshingState]);

  function refreshData() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      setVNets([]);

      if(space && block) {
        try {
          setRefreshing(true);
          setSelectionModel([]);
          const response = await instance.acquireTokenSilent(request);
          var data = await fetchBlockAvailable(response.accessToken, space, block.name);
          data.forEach((item) => {
            item['active'] = true;
          });
          const missing = block['vnets'].map(vnet => vnet.id).filter(item => !data.map(a => a.id).includes(item));
          missing.forEach((item) => {
            data.push(mockVNet(item));
          });
          setVNets(data);
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
      subscription_id: subscription,
      tenant_id: null,
      active: false
    };
  
    return mockNet
  }

  function manualRefresh() {
    refresh();
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
        await replaceBlockNetworks(response.accessToken, space, block.name, selectionModel);
        handleClose();
        enqueueSnackbar("Successfully updated IP Block vNets", { variant: "success" });
        refresh();
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.response.data.error, { variant: "error" });
        }
      } finally {
        setSending(false);
      }
    })();
  }

  return (
    <div sx={{ height: "300px", width: "100%" }}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
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
                disabled={refreshing || refreshingState}
              >
                <Refresh />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select the Virtual Networks below which should be associated with the Block <Spotlight>'{block && block.name}'</Spotlight>
          </DialogContentText>
          <Box
            sx={{
              pt: 4,
              height: "300px",
              '& .ipam-block-vnet-stale': {
                  background: 'rgb(255, 230, 230) !important',
                '.InovuaReactDataGrid__row-hover-target': {
                  '&:hover': {
                    background: 'rgb(255, 220, 220) !important',
                  }
                }
              },
              '& .ipam-block-vnet-normal': {
                  background: 'white',
                '.InovuaReactDataGrid__row-hover-target': {
                  '&:hover': {
                    background: 'rgb(208, 213, 237) !important',
                  }
                }
              }
            }}
          >
            <ReactDataGrid
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
              columns={columns}
              loading={refreshing}
              dataSource={vNets}
              selected={selectionModel}
              onSelectionChange={({selected}) => setSelectionModel(selected)}
              rowClassName={({data}) => `ipam-block-vnet-${!data.active ? 'stale' : 'normal'}`}
              style={gridStyle}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={unchanged || sending || refreshing || refreshingState}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
