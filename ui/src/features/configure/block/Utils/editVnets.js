import * as React from "react";
import { useSelector } from 'react-redux';
import { styled } from "@mui/material/styles";

import { isEqual } from 'lodash';

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

import { getRefreshing } from "../../../ipam/ipamSlice";

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

  const spacesRefreshing = useSelector(getRefreshing);

  const unchanged = block ? isEqual(block['vnets'], selectionModel) : false;

  React.useEffect(() => {
      refreshData();
  }, [block]);

  React.useEffect(() => {
    if(space && block) {
      !refreshingState && setSelectionModel(block['vnets']);
    }
  }, [refreshingState]);

  function refreshData() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    setVNets([]);
    setLoading(true);

    (async () => {
      if(space && block) {
        try {
          setRefreshing(true);
          const response = await instance.acquireTokenSilent(request);
          const data = await fetchBlockAvailable(response.accessToken, space, block.name);
          setVNets(data);
          setSelectionModel(block['vnets']);
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
        const data = await replaceBlockNetworks(response.accessToken, space, block.name, selectionModel);
        handleClose();
        enqueueSnackbar("Successfully updated IP Block vNets", { variant: "success" });
        refresh();
        refreshData();
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

  function onModelChange(newModel) {
    // Remove this function and simplify to the Data Grid
    setSelectionModel(newModel);
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
          <Box sx={{ pt: 4, height: "300px" }}>
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
              onSelectionModelChange={(newSelectionModel) => onModelChange(newSelectionModel)}
              selectionModel={selectionModel}
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
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={unchanged || sending}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
