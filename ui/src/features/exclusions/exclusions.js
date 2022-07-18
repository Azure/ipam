import * as React from "react";
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { isEqual } from 'lodash';

import { DataGrid, GridOverlay } from "@mui/x-data-grid";

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

const TopSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "50%",
  width: "100%",
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginBottom: theme.spacing(1.5)
}));

const BottomSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "50%",
  width: "100%",
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginTop: theme.spacing(1.5)
}));

// Grid Styles

const GridHeader = styled("div")({
  height: "50px",
  width: "100%",
  display: "flex",
  borderBottom: "1px solid rgba(224, 224, 224, 1)",
});

const GridTitle = styled("div")(({ theme }) => ({
  ...theme.typography.subtitle1,
  width: "80%",
  textAlign: "center",
  alignSelf: "center",
}));

const GridBody = styled("div")({
  height: "100%",
  width: "100%",
});

const StyledGridOverlay = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
});

function GridSection(props) {
  const { title, action, columns, rows, loading, onClick } = props;

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

  const message = `Click to ${action}`;

  return (
    <React.Fragment>
      <GridHeader
        style={{
          borderBottom: "1px solid rgba(224, 224, 224, 1)",
        }}
      >
        <Box sx={{ width: "20%" }} />
        <GridTitle>{title}</GridTitle>
        <Box sx={{ width: "20%" }} />
      </GridHeader>
      <Tooltip title={message} followCursor>
        <GridBody>
          <DataGrid
            disableColumnMenu
            // disableSelectionOnClick
            hideFooter
            hideFooterPagination
            hideFooterSelectedRowCount
            density="compact"
            rows={rows}
            columns={columns}
            onRowClick={(rowData) => onClick(rowData.row)}
            loading={loading}
            components={{
              LoadingOverlay: CustomLoadingOverlay,
              NoRowsOverlay: CustomNoRowsOverlay,
            }}
            initialState={{
              sorting: {
                sortModel: [{ field: 'name', sort: 'asc' }],
              },
            }}
            sx={{
              "&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus":
                {
                  outline: "none",
                },
              border: "none",
            }}
          />
        </GridBody>
      </Tooltip>
    </React.Fragment>
  );
}

const columns = [
  { field: "subscription_id", headerName: "Subscription ID", headerAlign: "left", align: "left", flex: 1 },
  { field: "name", headerName: "Subscription Name", headerAlign: "left", align: "left", flex: 2 },
  { field: "type", headerName: "Subscription Type", headerAlign: "left", align: "left", flex: 0.75 },
];

export default function ManageExclusions() {
  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(false);
  const [included, setIncluded] = React.useState([]);
  const [excluded, setExcluded] = React.useState([]);
  const [loadedExclusions, setLoadedExclusions] = React.useState([]);
  const [sending, setSending] = React.useState(false);

  const unchanged = isEqual(excluded, loadedExclusions);

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
        <TopSection>
          <GridSection
            title="Included Subscriptions"
            action="exclude"
            // columns={columns.map((x) => ({...x, renderCell: renderExclude}))}
            columns={columns}
            rows={included}
            loading={loading}
            onClick={subscriptionExclude}
          />
        </TopSection>
        <BottomSection>
        <GridSection
            title="Excluded Subscriptions"
            action="include"
            // columns={columns.map((x) => ({...x, renderCell: renderInclude}))}
            columns={columns}
            rows={excluded}
            loading={loading}
            onClick={subscriptionInclude}
          />
        </BottomSection>
      </MainBody>
    </Wrapper>
  );
}
