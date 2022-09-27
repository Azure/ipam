import * as React from "react";
import { styled } from "@mui/material/styles";
import GlobalStyles from '@mui/material/GlobalStyles';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";

import {
  Box,
  Autocomplete,
  TextField,
  CircularProgress
} from "@mui/material";

import { fetchTreeView } from '../ipam/ipamAPI';

import { apiRequest } from "../../msal/authConfig";

import * as d3 from "d3";
import Sunburst from 'sunburst-chart';

const color = d3.scaleOrdinal(d3.schemePaired);

const StyledBox = styled(Box)({
  display: "flex",
  height: "80%",
  width: "100%",
  justifyContent: "center",
  alignItems: "center",
});

const StyledDiv = styled('div')({
  display: "flex",
  height: "500px",
  width: "500px",
});

export default function AnalysisTool() {
  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(null);
  const [selected, setSelected] = React.useState(null);

  const loading = open && !options
  
  const chart = React.useRef(null)
  const ref = React.useRef(null);

  React.useEffect(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    if (!options && inProgress === InteractionStatus.None) {
      (async () => {
        try {
          const response = await instance.acquireTokenSilent(request);
          const data = await fetchTreeView(response.accessToken);

          setOptions(data);
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) {
            instance.acquireTokenRedirect(request);
          } else {
            console.log("ERROR");
            console.log("------------------");
            console.log(e);
            console.log("------------------");
            enqueueSnackbar("Error fetching Tree View", { variant: "error" });
          }
        }
      })();
    }
  }, []);

  React.useEffect(() => {
    if(!chart.current) {
      chart.current = Sunburst()
      chart.current
        .data(selected)
        .label('name')
        .color(d => color(d.name))
        .width(500)
        .height(500)
        .excludeRoot(true)
        .tooltipTitle(d => `<i>${d.name}</i>`)
        .tooltipContent(d => d.ip ? `<i>${d.ip}</i>` : ``)
      (ref.current);
    }
  }, []);

  React.useEffect(() => {
    if(selected) {
      chart.current
      .data(selected)
    }
  }, [selected]);

  return(
    <React.Fragment>
      <GlobalStyles styles={{
        "&.sunburst-viz text .text-contour": {
          display: "none"
        },
        "&.sunburst-tooltip": {
          whiteSpace: "normal !important"
        }
      }} />
      <Box sx={{ p: 3 }}>
        <Autocomplete
          key="12345"
          id="asynchronous-demo"
          autoHighlight
          // freeSolo
          forcePopupIcon={false}
          sx={{ width: 400, ml: 3, mr: 2 }}
          open={open}
          value={selected}
          onOpen={() => {
            setOpen(true);
          }}
          onClose={() => {
            setOpen(false);
          }}
          onChange={(event, newValue) => {
            newValue ? setSelected(newValue) : setSelected([null]);
          }}
          isOptionEqualToValue={(option, value) => option.children[0].name === value.children[0].name}
          getOptionLabel={(option) => `${option.children[0].name}`}
          noOptionsText={'No Spaces Found'}
          options={options || []}
          loading={loading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Space"
              variant="standard"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <React.Fragment>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </React.Fragment>
                ),
              }}
            />
          )}
        />
      </Box>
      <StyledBox>
        <StyledDiv id="sunburst" ref={ref}></StyledDiv>
      </StyledBox>
    </React.Fragment>
  );
}
