import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { isEqual } from 'lodash';

import { useTheme } from '@mui/material/styles';

import { DataGrid } from "../../../global/grids";

import {
  Box,
  Tooltip,
  IconButton,
  Typography
} from "@mui/material";

import {
  SaveAlt,
  VisibilityOutlined,
  VisibilityOffOutlined
} from "@mui/icons-material";

import Shrug from "../../../img/pam/Shrug";

import {
  getExclusions,
  replaceExclusions
} from "../../ipam/ipamAPI";

import {
  selectSubscriptions,
  refreshAllAsync
} from '../../ipam/ipamSlice';

const ExclusionContext = React.createContext({});

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
}));

// Grid Style(s)
const GridBody = styled("div")(({ theme }) => ({
  height: "100%",
  width: "100%",
  // AG Grid row styling for excluded subscriptions
  '& .exclusion-row-selected': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(220, 20, 20, 0.3) !important' : 'rgba(255, 200, 200, 0.5) !important',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(220, 100, 100, 0.4) !important' : 'rgba(255, 180, 180, 0.6) !important',
    }
  }
}));

export default function ManageExclusions() {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [selected, setSelected] = React.useState({});
  const [loadedExclusions, setLoadedExclusions] = React.useState(null);
  const [showExcludedOnly, setShowExcludedOnly] = React.useState(false);

  const subscriptions = useSelector(selectSubscriptions);
  const dispatch = useDispatch();

  const dataLoadedRef = React.useRef(false);

  const theme = useTheme();

  const unchanged = isEqual(selected, loadedExclusions);

  const columns = React.useMemo(() => [
    { field: "name", headerName: "Subscription Name", flex: 1 },
    { field: "subscription_id", headerName: "Subscription ID", flex: 1 },
    { field: "type", headerName: "Subscription Type", flex: 0.75 },
    { field: "mg_name", headerName: "Management Group Name", flex: 0.75 },
    { field: "mg_id", headerName: "Management Group ID", flex: 0.75, hide: true }
  ], []);

  const gridData = React.useMemo(() => {
    if (!subscriptions) return [];
    if (showExcludedOnly) {
      return subscriptions.filter(sub => selected[sub.id]);
    }
    return subscriptions;
  }, [subscriptions, selected, showExcludedOnly]);

  const extraMenuItems = React.useMemo(() => [
    {
      icon: showExcludedOnly ? VisibilityOutlined : VisibilityOffOutlined,
      label: showExcludedOnly ? 'Show All' : 'Show Excluded Only',
      onClick: () => setShowExcludedOnly(prev => !prev)
    }
  ], [showExcludedOnly]);

  // Row class rules for highlighting excluded subscriptions
  const rowClassRules = React.useMemo(() => ({
    'exclusion-row-selected': (params) => selected[params.data?.id]
  }), [selected]);

  React.useEffect(() => {
    (subscriptions && selected) && setLoading(false);
  }, [subscriptions, selected]);

  const loadData = React.useCallback(() => {
    (async () => {
      try {
        if(subscriptions) {
          var excluded = {};

          const exclusions = await getExclusions();

          exclusions.forEach(exclusion => {
            var targetSub = subscriptions.find((sub) => sub.subscription_id === exclusion);

            if(targetSub) {
              excluded[targetSub.id] = targetSub;
            }
          });

          setSelected(prevState => {
            return {
              ...prevState,
              ...excluded
            }
          });

          setLoadedExclusions(excluded);
        }
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar("Error fetching subscriptions/exclusions", { variant: "error" });
      }
    })();
  }, [subscriptions, enqueueSnackbar]);

  React.useEffect(() => {
    if(!dataLoadedRef.current && subscriptions) {
      dataLoadedRef.current = true;
      loadData();
    }
  }, [loadData, subscriptions]);

  function onSave() {
    (async () => {
      try {
        setSending(true);
        let selectedValues = Object.values(selected);
        let update = selectedValues.map(item => item.subscription_id);
        await replaceExclusions(update);
        enqueueSnackbar("Successfully updated exclusions", { variant: "success" });
        setLoadedExclusions(selected);
        dispatch(refreshAllAsync())
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

  function onRowClick(row) {
    var id = row.id;

    setSelected(prevState => {
      let newState = {...prevState};

      newState.hasOwnProperty(id) ? delete newState[id] : newState[id] = row;

      return newState;
    });
  }

  const NoRowsOverlay = React.useCallback(() => {
    return (
      <React.Fragment>
        <Shrug />
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </React.Fragment>
    );
  }, []);

  return (
    <ExclusionContext value={{}}>
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
                    visibility: (unchanged || !loadedExclusions) ? 'hidden' : 'visible'
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
              <DataGrid
                viewSettingKey="exclusions"
                rowData={gridData}
                columnDefs={columns}
                isLoading={loading || sending || !subscriptions || !loadedExclusions}
                noRowsOverlay={NoRowsOverlay}
                extraMenuItems={extraMenuItems}
                rowClassRules={rowClassRules}
                onRowClicked={(event) => onRowClick(event.data)}
              />
            </GridBody>
          </DataSection>
        </MainBody>
      </Wrapper>
    </ExclusionContext>
  );
}