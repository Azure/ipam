import * as React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

import { isEqual } from 'lodash';

import { DataGrid, GridOverlay } from '@mui/x-data-grid';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';

import {
  Box,
  Typography,
  LinearProgress,
  Tooltip,
  IconButton
} from "@mui/material";

import {
  SaveAlt
} from "@mui/icons-material";

import {
  fetchSubscriptions,
  getExclusions,
  replaceExclusions
} from "../ipam/ipamAPI";

import {
  refreshAllAsync
} from '../ipam/ipamSlice';

import { apiRequest } from "../../msal/authConfig";

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
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginBottom: theme.spacing(1.5)
}));

// Grid Styles

const GridBody = styled("div")({
  height: "100%",
  width: "100%",
  '& .ipam-sub-excluded': {
    backgroundColor: "rgb(255, 230, 230) !important",
    '&:hover': {
      backgroundColor: "rgb(255, 220, 220) !important",
    }
  },
  '& .ipam-sub-included': {
    backgroundColor: "rgb(255, 255, 255, 0.1) !important",
    '&:hover': {
      backgroundColor: "none",
    }
  }
});

const StyledGridOverlay = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
});

const columns = [
  { name: "subscription_id", header: "Subscription ID", defaultFlex: 1 },
  { name: "name", header: "Subscription Name", defaultFlex: 1 },
  { name: "type", header: "Subscription Type", defaultFlex: 1 },
];

const filterValue = [
  { name: 'subscription_id', operator: 'contains', type: 'string', value: '' },
  { name: 'name', operator: 'contains', type: 'string', value: '' },
  { name: 'type', operator: 'contains', type: 'string', value: '' }
];

export default function ManageExclusions() {
  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(false);
  const [included, setIncluded] = React.useState([]);
  const [excluded, setExcluded] = React.useState([]);
  const [rowData, setRowData] = React.useState([]);
  const [loadedExclusions, setLoadedExclusions] = React.useState([]);
  const [sending, setSending] = React.useState(false);
  const [selected, setSelected] = React.useState({});

  const dispatch = useDispatch();

  const unchanged = isEqual(excluded, loadedExclusions);

  const message = `Click to Include/Exclude`;

  const gridStyle = { height: '100%' }

  React.useEffect(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setLoading(true);
        const response = await instance.acquireTokenSilent(request);

        const stack = [
          (async () => await fetchSubscriptions(response.accessToken))(),
          (async () => await getExclusions(response.accessToken))()
        ];

        Promise.all(stack).then((results) => {
          var includedSubs = results[0];
          var excludedSubs = [];

          results[1].forEach(exclusion => {
            includedSubs = includedSubs.filter(object => {
              return object.subscription_id !== exclusion;
            });

            const excludeObj = results[0].find(element => element.subscription_id == exclusion);

            excludedSubs = [...excludedSubs, excludeObj];
          });

          setIncluded(includedSubs);
          setExcluded(excludedSubs);
          setLoadedExclusions(excludedSubs);
          setLoading(false);
        });
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error fetching subscriptions/exclusions", { variant: "error" });
        }

        setLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    setRowData(included.concat(excluded));
  }, [included, excluded]);

  function subscriptionExclude(elem) {
    const newArr = included.filter(object => {
      return object.id !== elem.id;
    });

    setIncluded(newArr);

    setExcluded(excluded => [...excluded, elem]);
  }

  function subscriptionInclude(elem) {
    const newArr = excluded.filter(object => {
      return object.id !== elem.id;
    });

    setExcluded(newArr);

    setIncluded(included => [...included, elem]);
  }

  function onSave() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        let update = excluded.map(item => item.subscription_id);
        const response = await instance.acquireTokenSilent(request);
        const data = await replaceExclusions(response.accessToken, update);
        enqueueSnackbar("Successfully updated exclusions", { variant: "success" });
        setLoadedExclusions(excluded);
        dispatch(refreshAllAsync(response.accessToken))
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

  function onClick(elem) {
    // excluded.includes(elem) ? subscriptionInclude(elem) : subscriptionExclude(elem);
    var id = elem.id;

    setSelected(prevState => {
      let newState = Object.assign({}, prevState);

      newState.hasOwnProperty(id) ? delete newState[id] : newState[id] = true;      
          
      return newState;
    });
  }

  function getClass(elem) {
    return excluded.includes(elem) ? 'ipam-sub-excluded' : 'ipam-sub-included';
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

  function CustomNoRowsOverlay() {
    return (
      <StyledGridOverlay>
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          No Subscriptions Selected
        </Typography>
      </StyledGridOverlay>
    );
  }

  return (
    <Wrapper>
      <MainBody>
        <FloatingHeader>
          <Box sx={{ width: "20%" }}></Box>
          <HeaderTitle>Subscription Management</HeaderTitle>
          <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ width: "20%", ml: 2, mr: 2 }}>
            <Tooltip title="Save" >
              <IconButton
                color="primary"
                aria-label="upload picture"
                component="span"
                style={{
                  visibility: unchanged ? 'hidden' : 'visible'
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
              idProperty="id"
              columns={columns}
              defaultFilterValue={filterValue}
              style={gridStyle}
              dataSource={rowData}
              loading={loading}
              showZebraRows={false}
              toggleRowSelectOnClick={true}
              multiSelect={true}
              onRowClick={(rowData) => onClick(rowData.data)}
              selected={selected}
              showActiveRowIndicator={false}
            />
          </GridBody>
        </DataSection>
      </MainBody>
    </Wrapper>
  );
}
