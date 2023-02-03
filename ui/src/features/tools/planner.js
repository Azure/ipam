import * as React from 'react';
import { useSelector } from 'react-redux';
import { ThemeProvider, createTheme, styled } from '@mui/material/styles';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { useSnackbar } from 'notistack';

import { find } from 'lodash';

import {
  Box,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  CircularProgress
} from '@mui/material';

import Grid from '@mui/material/Unstable_Grid2';

import {
  FilterList as FilterListIcon,
  FilterListOff as FilterListOffIcon
} from '@mui/icons-material';

import {
  selectVNets
} from "../ipam/ipamSlice";

import {
  fetchSubscriptions
} from "../ipam/ipamAPI";

import { apiRequest } from "../../msal/authConfig";

import { availableSubnets } from './utils/iputils';

const plannerTheme = (theme) => createTheme({
  ...theme,
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
      xxl: 1920
    },
  },
});

const Item = styled(Paper)(({ theme, overlap }) => ({
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  fontSize: 'clamp(12px, 1vw, 16px)',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  backgroundColor: overlap ? (theme.palette.mode === 'dark' ? 'darkred' : 'orangered') : (theme.palette.mode === 'dark' ? 'darkgreen' : 'lawngreen')
}));

const cidrMasks = [
  { name: '/8', value: 8},
  { name: '/9', value: 9},
  { name: '/10', value: 10},
  { name: '/11', value: 11},
  { name: '/12', value: 12},
  { name: '/13', value: 13},
  { name: '/14', value: 14},
  { name: '/15', value: 15},
  { name: '/16', value: 16},
  { name: '/17', value: 17},
  { name: '/18', value: 18},
  { name: '/19', value: 19},
  { name: '/20', value: 20},
  { name: '/21', value: 21},
  { name: '/22', value: 22},
  { name: '/23', value: 23},
  { name: '/24', value: 24},
  { name: '/25', value: 25},
  { name: '/26', value: 26},
  { name: '/27', value: 27},
  { name: '/28', value: 28},
  { name: '/29', value: 29},
  { name: '/30', value: 30},
  { name: '/31', value: 31},
  { name: '/32', value: 32}
];

const Separator = (props) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "row", pt: 2, pb: 2 }}>
      <div style={{ flexGrow: 0.1 }}>
        <hr />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', margin: '0px 8px' }}>
        <Typography>
          MASK: {props.name} | ({props.used}/{props.total} Used)
        </Typography>
      </div>
      <div style={{ flexGrow: 2 }}>
        <hr />
      </div>
    </Box>
  );
};

const Planner = () => {
  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [subscriptions, setSubscriptions] = React.useState(null);
  const [newVNets, setNewVNets] = React.useState([]);

  const [subnetData, setSubnetData] = React.useState(null);

  const [vNetInput, setVNetInput] = React.useState('');
  const [maskInput, setMaskInput] = React.useState('');

  const [selectedVNet, setSelectedVNet] = React.useState(null);
  const [selectedPrefix, setSelectedPrefix] = React.useState('');
  const [selectedMask, setSelectedMask] = React.useState(null);
  const [exclusions, setExclusions] = React.useState([]);

  const [vNetOptions, setVNetOptions] = React.useState([]);
  const [prefixOptions, setPrefixOptions] = React.useState(null);
  const [maskOptions, setMaskOptions] = React.useState([]);

  const [showAll, setShowAll] = React.useState(false);

  const subsLoadingRef = React.useRef(false);

  const vNets = useSelector(selectVNets);

  const loading = !vNets || subsLoadingRef.current;

  const refreshSubscriptions = React.useCallback(() => {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        subsLoadingRef.current = true;
        const response = await instance.acquireTokenSilent(request);
        const data = await fetchSubscriptions(response.accessToken);
        setSubscriptions(data);
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error fetching subnets", { variant: "error" });
        }
      } finally {
        subsLoadingRef.current = false;
      }
    })();
  }, [accounts, enqueueSnackbar, instance]);

  React.useEffect(() => {
    !subsLoadingRef.current && refreshSubscriptions();
  }, [vNets, refreshSubscriptions]);

  React.useEffect(() => {
    if (vNets && subscriptions) {
      const subMap = subscriptions.reduce((prev, curr) => {
        return {
          ...prev,
          [curr.subscription_id]: curr.name,
        };
      }, {});

      const newNets = vNets.map((vnet) => {
        var subName = subMap[vnet.subscription_id] || vnet.subscription_id;

        return {
          ...vnet,
          subscription_name: subName,
        };
      });

      setNewVNets(newNets);
    }
  }, [vNets, subscriptions]);

  React.useEffect(() => {
    if(!find(newVNets, selectedVNet)) {
      setSelectedVNet(null);
      setVNetInput('');
    }
  }, [newVNets, selectedVNet]);

  React.useEffect(() => {
    setSelectedVNet(null);
    setVNetInput('');
  }, [showAll]);

  React.useEffect(() => {
    showAll
    ? setVNetOptions(newVNets.sort((a, b) => (a.subscription_name > b.subscription_name) ? 1 : -1))
    : setVNetOptions(newVNets.filter(v => v.parentSpace !== null).sort((a, b) => (a.parentSpace > b.parentSpace) ? 1 : (a.parentSpace === b.parentSpace) ? ((a.parentBlock > b.parentBlock) ? 1 : -1) : -1 ));
  }, [showAll, newVNets]);

  React.useEffect(() => {
    if (selectedVNet) {
      let exclusions = selectedVNet.subnets.map((sub) => sub.prefix);
      let prefixParts = selectedVNet.prefixes[0].split("/");
      let currentMask = parseInt(prefixParts[1], 10);
      let availableMasks = cidrMasks.filter((opt) => opt.value > currentMask && opt.value <= currentMask + 10);

      setExclusions(exclusions);
      setPrefixOptions(selectedVNet.prefixes);
      setSelectedPrefix(selectedVNet.prefixes[0]);
      setMaskOptions(availableMasks);
      setSelectedMask(availableMasks[0]);
    } else {
      setExclusions([]);
      setPrefixOptions(null);
      setSelectedPrefix("");
      setSelectedMask(null);
      setMaskInput("");
      setMaskOptions([]);
    }
  }, [selectedVNet]);

  React.useEffect(() => {
    if (selectedPrefix) {
      let prefixParts = selectedPrefix.split("/");
      let currentMask = parseInt(prefixParts[1], 10);
      let availableMasks = cidrMasks.filter((opt) => opt.value > currentMask && opt.value <= currentMask + 10);

      setMaskOptions(availableMasks);
      setSelectedMask(availableMasks[0]);
    } else {
      setSelectedMask(null);
      setMaskInput("");
      setMaskOptions([]);
    }
  }, [selectedPrefix]);

  React.useEffect(() => {
    if (selectedVNet && selectedPrefix && selectedMask) {
      let prefixParts = selectedPrefix.split("/");
      let currentMask = parseInt(prefixParts[1], 10);

      let query = {
        address: prefixParts[0],
        netmask: currentMask,
        netmaskRange: { max: selectedMask.value, min: currentMask || 16 },
      };

      let subnetsObj = availableSubnets(query, exclusions);

      setSubnetData(subnetsObj);
    } else {
      setSubnetData(null);
    }
  }, [selectedVNet, selectedPrefix, selectedMask, exclusions]);

  const handleShowAll = (event, newFilter) => {
    if (newFilter !== null) {
      setShowAll(newFilter);
    }
  };

  return (
    <ThemeProvider theme={(theme) => plannerTheme(theme)}>
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', pt: 2, pb: 2, pr: 3, pl: 3, alignItems: 'center', borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
          <Autocomplete
            // freeSolo
            forcePopupIcon={false}
            id="grouped-demo"
            size="small"
            options={vNetOptions}
            groupBy={(option) => showAll ? option.subscription_name : `${option.parentSpace} ➜ ${option.parentBlock}`}
            getOptionLabel={(option) => option.name}
            inputValue={vNetInput}
            onInputChange={(event, newInputValue) => setVNetInput(newInputValue)}
            value={selectedVNet}
            onChange={(event, newValue) => setSelectedVNet(newValue)}
            sx={{ width: 300 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Virtual Network"
                placeholder={showAll ? "By Subscription" : "By Space ➜ Block"}
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
            renderGroup={(params) => (
              <li key={params.group}>
                <Box sx={{ top: '-8px', padding: '4px 10px', whiteSpace: 'nowrap' }}>{params.group}</Box>
                <ul style={{ padding: 0 }}>{params.children}</ul>
              </li>
            )}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.id}>
                  {option.name}
                </li>
              );
            }}
            componentsProps={{
              paper: {
                sx: {
                  width: 'fit-content'
                }
              }
            }}
          />
          <FormControl size="small">
            <InputLabel
              disabled={selectedVNet === null}
              id="prefix-select-label"
            >
              Address Space
            </InputLabel>
            <Select
              disabled={selectedVNet === null}
              labelId="prefix-select-label"
              id="vnet-select"
              value={selectedPrefix}
              label="Address Space"
              onChange={(event) => setSelectedPrefix(event.target.value)}
              sx={{ width: '22ch' }}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 36 * 10,
                  }
                },
              }}
            >
              {prefixOptions ?
                prefixOptions.map((opt) => (
                  <MenuItem
                    key={opt}
                    value={opt}
                  >
                    {opt}
                  </MenuItem>
                )) : null
              }
            </Select>
          </FormControl> 
          <Autocomplete
            // freeSolo
            forcePopupIcon={false}
            disabled={selectedPrefix === ''}
            id="cidr-mask-max"
            size="small"
            options={maskOptions}
            getOptionLabel={(option) => option.name}
            inputValue={maskInput}
            onInputChange={(event, newInputValue) => setMaskInput(newInputValue)}
            value={selectedMask}
            onChange={(event, newValue) => setSelectedMask(newValue)}
            sx={{ width: '5ch' }}
            renderInput={(params) => (
              <TextField
                {...params}
                // inputProps={{
                //   ...params.inputProps,
                //   onKeyDown: (e) => {
                //     if (e.key === 'Enter') {
                //       e.stopPropagation();
                //     }
                //   },
                // }}
                label="Mask"
                placeholder="Max"
              />
            )}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', marginLeft: 'auto' }}>
          <ToggleButtonGroup
            size="small"
            color="primary"
            value={showAll}
            exclusive
            onChange={handleShowAll}
          >
            <ToggleButton value={false} aria-label="list">
              <Tooltip title="Filter Networks">
                <FilterListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value={true} aria-label="module">
              <Tooltip title="All Networks">
                <FilterListOffIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Box sx={{ flexGrow: 1, pb: 3, pr: 3, pl: 3, overflowY: 'auto', overflowX: 'hidden' }}>
        {
          subnetData &&
          [...new Set(subnetData.subnets.map((x) => x.mask))].map((mask) => {
          return (
            <React.Fragment key={`fragment-${mask}`}>
              <Separator key={`sep-${mask}`} name={mask} total={subnetData.subnets.filter((x) => x.mask === mask).length} used={subnetData.subnets.filter((x) => x.mask === mask && x.overlap).length} />
              <Grid key={`grid-container-${mask}`} container spacing={2}>
                {
                  subnetData?.subnets.filter((x) => x.mask === mask).map((item) => {
                    return (
                      <Grid key={`grid-item-${item.network}-${mask}`} xs={5} sm={3} md={2} xxl={1}>
                        <Item
                          overlap={item.overlap}
                        >
                          {item.network}/{mask}
                        </Item>
                      </Grid>
                    );
                  })
                }
              </Grid>
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
    </ThemeProvider>
  );
}

export default Planner;
