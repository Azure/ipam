import * as React from "react";
import { styled } from "@mui/material/styles";

import { isEqual, unset } from 'lodash';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { DataGrid, GridOverlay } from "@mui/x-data-grid";

import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  LinearProgress,
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

const columns = [
  { field: "name", headerName: "Name", headerAlign: "left", align: "left", flex: 1 },
  { field: "subscription_id", headerName: "Subscription", headerAlign: "left", align: "left", flex: 1 },
  { field: "resource_group", headerName: "Resource Group", headerAlign: "left", align: "left", flex: 1 },
  { field: "prefixes", headerName: "Prefixes", headerAlign: "right", align: "right", flex: 0.75 },
];

const Spotlight = styled("span")({
  fontWeight: "bold",
  color: "mediumblue"
});

export default function EditVnets(props) {
  const { open, handleClose, space, block, refresh, refreshingState } = props;

  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(false);
  const [vNets, setVNets] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const unchanged = block ? isEqual(block['vnets'].map(vnet => vnet.id).sort(), selectionModel.sort()) : false;

  React.useEffect(() => {
      (block && !refreshing && !refreshingState) && refreshData();
  }, [block]);

  React.useEffect(() => {
    if(space && block) {
      !refreshingState && setSelectionModel(block['vnets'].map(vnet => vnet.id));
    }

    refreshingState && setLoading(true);
  }, [refreshingState]);

  function refreshData() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      setVNets([]);
      setLoading(true);

      if(space && block) {
        try {
          setRefreshing(true);
          setSelectionModel([]);
          const response = await instance.acquireTokenSilent(request);
          var data = await fetchBlockAvailable(response.accessToken, space, block.name);
          data.forEach((item) => {
            item['active'] = true;
          });
          // const found = block['vnets'].map(vnet => vnet.id).filter(item => data.map(a => a.id).includes(item));
          const missing = block['vnets'].map(vnet => vnet.id).filter(item => !data.map(a => a.id).includes(item));
          missing.forEach((item) => {
            data.push(mockVNet(item));
          });
          setVNets(data);
          setSelectionModel(block['vnets'].map(vnet => vnet.id));
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
      } else {
        setVNets([])
      }

      setLoading(false);
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
      prefixes: "ErrNotFound",
      subnets: [],
      resource_group: resourceGroup.toLowerCase(),
      subscription_id: subscription,
      tenant_id: null,
      active: false
    };
  
    return mockNet
  }

  function manualRefresh() {
    console.log("MANUAL REFRESH");
    setLoading(true);
    setVNets([]);
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
        const data = await replaceBlockNetworks(response.accessToken, space, block.name, selectionModel);
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

  function CustomLoadingOverlay() {
    return (
      <GridOverlay>
        <div style={{ position: "absolute", top: 0, width: "100%" }}>
          <LinearProgress />
        </div>
      </GridOverlay>
    );
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
                disabled={refreshing}
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
                bgcolor: "rgb(255, 230, 230) !important",
                '&:hover': {
                  bgcolor: "rgb(255, 220, 220) !important",
                }
              },
              '& .ipam-block-vnet-normal': {
                bgcolor: "white",
                '&:hover': {
                  bgcolor: "white",
                }
              }
            }}
          >
            <DataGrid
              checkboxSelection
              disableColumnMenu
              hideFooter
              hideFooterPagination
              hideFooterSelectedRowCount
              density="compact"
              rows={vNets}
              columns={columns}
              loading={loading || refreshingState}
              onSelectionModelChange={(newSelectionModel) => setSelectionModel(newSelectionModel)}
              selectionModel={selectionModel}
              getRowClassName={(params) => `ipam-block-vnet-${!params.row.active ? 'stale' : 'normal'}`}
              components={{
                LoadingOverlay: CustomLoadingOverlay,
                // NoRowsOverlay: CustomNoRowsOverlay,
              }}
              sx={{
                "&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus":
                  {
                    outline: "none",
                  }
              }}
              initialState={{
                sorting: {
                  sortModel: [
                    {
                      field: 'name',
                      sort: 'asc',
                    },
                  ],
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={unchanged || sending || loading || refreshingState}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
