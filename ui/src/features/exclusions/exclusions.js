import * as React from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

import { isEqual } from 'lodash';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import '@inovua/reactdatagrid-community/theme/default-dark.css'

import { useTheme } from '@mui/material/styles';

import {
  Box,
  Tooltip,
  IconButton,
  Typography
} from "@mui/material";

import {
  SaveAlt
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

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
  borderRadius: "4px",
  marginBottom: theme.spacing(1.5)
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
        background: theme.palette.mode == 'dark' ? 'rgb(220, 20, 20) !important' : 'rgb(255, 230, 230) !important',
      '.InovuaReactDataGrid__row-hover-target': {
        '&:hover': {
          background: theme.palette.mode == 'dark' ? 'rgb(220, 100, 100) !important' : 'rgb(255, 220, 220) !important',
        }
      }
    }
  }
}));

const columns = [
  { name: "subscription_id", header: "Subscription ID", lockable: false, defaultFlex: 1 },
  { name: "name", header: "Subscription Name", lockable: false, defaultFlex: 1 },
  { name: "type", header: "Subscription Type", lockable: false, defaultFlex: 1 },
];

const filterValue = [
  { name: 'subscription_id', operator: 'contains', type: 'string', value: '' },
  { name: 'name', operator: 'contains', type: 'string', value: '' },
  { name: 'type', operator: 'contains', type: 'string', value: '' }
];

export default function ManageExclusions() {
  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [subscriptions, setSubscriptions] = React.useState(null);
  const [selected, setSelected] = React.useState({});
  const [loadedExclusions, setLoadedExclusions] = React.useState([]);

  const dataLoadedRef = React.useRef(false);

  const dispatch = useDispatch();

  const theme = useTheme();

  const unchanged = isEqual(selected, loadedExclusions);

  // const message = `Click to Include/Exclude`;

  React.useEffect(() => {
    (subscriptions && selected) && setLoading(false);
  }, [subscriptions, selected]);

  const loadData = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        // setLoading(true);
        const response = await instance.acquireTokenSilent(request);

        const stack = [
          (async () => await fetchSubscriptions(response.accessToken))(),
          (async () => await getExclusions(response.accessToken))()
        ];

        Promise.all(stack).then((results) => {
          var excluded = {};

          results[1].forEach(exclusion => {
            var targetSub = results[0].find((sub) => sub.subscription_id === exclusion);

            if(targetSub) {
              excluded[targetSub.id] = targetSub;
            }
          });

          setSubscriptions(results[0]);
          setSelected(prevState => {
            return {
              ...prevState,
              ...excluded
            }
          });
          setLoadedExclusions(excluded);
          // setLoading(false);
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
      } finally {
        // setLoading(false);
      }
    })();
  }, [accounts, enqueueSnackbar, instance]);

  React.useEffect(() => {
    if(!dataLoadedRef.current) {
      dataLoadedRef.current = true;
      loadData();
    }
  }, [loadData]);

  function onSave() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        setSending(true);
        let selectedValues = Object.values(selected);
        let update = selectedValues.map(item => item.subscription_id);
        const response = await instance.acquireTokenSilent(request);
        await replaceExclusions(response.accessToken, update);
        enqueueSnackbar("Successfully updated exclusions", { variant: "success" });
        setLoadedExclusions(selected);
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
    var id = elem.id;

    setSelected(prevState => {
      let newState = {...prevState};

      newState.hasOwnProperty(id) ? delete newState[id] : newState[id] = elem;

      return newState;
    });
  }

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
              theme={theme.palette.mode == 'dark' ? "default-dark" : "default-light"}
              idProperty="id"
              showCellBorders="horizontal"
              showZebraRows={false}
              multiSelect={true}
              showActiveRowIndicator={false}
              enableColumnAutosize={false}
              showColumnMenuGroupOptions={false}
              columns={columns}
              toggleRowSelectOnClick={true}
              loading={loading}
              dataSource={subscriptions || []}
              defaultFilterValue={filterValue}
              onRowClick={(rowData) => onClick(rowData.data)}
              selected={selected || {}}
              emptyText={NoRowsOverlay}
              style={gridStyle}
              className="ipam-subscription-exclusions"
            />
          </GridBody>
        </DataSection>
      </MainBody>
    </Wrapper>
  );
}
