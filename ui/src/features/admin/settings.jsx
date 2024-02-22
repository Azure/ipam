import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';

import { useSnackbar } from 'notistack';

import { isEqual } from 'lodash';

import {
  Box,
  Tooltip,
  IconButton,
  Paper,
  FormGroup,
  FormControlLabel,
  Switch,
  Typography,
  Unstable_Grid2 as Grid,
} from "@mui/material";

import {
  SaveAlt
} from "@mui/icons-material";

import {} from "../ipam/ipamAPI";

import {} from '../ipam/ipamSlice';

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
  // border: "1px solid rgba(224, 224, 224, 1)"
}));

// Grid Style(s)
const GridBody = styled("div")(({ theme }) => ({
  height: "100%",
  width: "100%"
}));

const Item = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function AdminSettings() {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [selected, setSelected] = React.useState({});
  const [loadedExclusions, setLoadedExclusions] = React.useState(null);

  const dispatch = useDispatch();

  const unchanged = isEqual(selected, loadedExclusions);

  function onSave() {
    (async () => {
      try {
        setSending(true);
        let selectedValues = Object.values(selected);
        let update = selectedValues.map(item => item.subscription_id);
        // await replaceExclusions(update);
        enqueueSnackbar("Successfully updated exclusions", { variant: "success" });
        // setLoadedExclusions(selected);
        // dispatch(refreshAllAsync())
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

  return (
    <ExclusionContext.Provider value={{}}>
      <Wrapper>
        <MainBody>
          <FloatingHeader>
            <Box sx={{ width: "20%" }}></Box>
            <HeaderTitle>Admin Settings</HeaderTitle>
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
              <Box sx={{ flexGrow: 1 }}>
                <Grid container spacing={2}>
                  <Grid xs={2}>
                    <Item>
                      <Typography variant="button" display="block" gutterBottom>
                        Automatic Updates
                      </Typography>
                      <FormGroup sx={{ pb: 1 }}>
                        <FormControlLabel control={<Switch defaultChecked />} label="Enabled" />
                      </FormGroup>
                    </Item>
                  </Grid>
                  <Grid xs={10}>
                    <Item>xs=4</Item>
                  </Grid>
                </Grid>
              </Box>
            </GridBody>
          </DataSection>
        </MainBody>
      </Wrapper>
    </ExclusionContext.Provider>
  );
}
