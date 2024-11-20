import * as React from "react";
import { useSelector } from "react-redux";
import { ThemeProvider, createTheme, styled } from "@mui/material/styles";

import { find,isEqual, orderBy } from "lodash";

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
} from "@mui/material";

import Grid from "@mui/material/Grid2";

import {
  FilterList as FilterListIcon,
  FilterListOff as FilterListOffIcon
} from "@mui/icons-material";

import {
  selectBlocks,
  selectUpdatedVNets
} from "../../ipam/ipamSlice";

import { availableSubnets, isSubnetOverlap } from "./utils/iputils";

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
  fontSize: 'clamp(12px, 1vw, 15px)',
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
  const [vNetData, setVNetData] = React.useState(null);
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

  const blocks = useSelector(selectBlocks);
  const vNets = useSelector(selectUpdatedVNets);

  React.useEffect(() => {
    if (vNets) {
      if (showAll) {
        setVNetData(vNets);
      } else {
        const data = vNets.reduce((vAcc, vCurr) => {
          if (vCurr['parent_block'] !== null) {
            vCurr['parent_block'].forEach((p) => {
              const block = blocks.find((block) => block.name === p && block['parent_space'] === vCurr['parent_space']);

              const blockPrefixes = vCurr.prefixes.reduce((bAcc, bCurr) => {
                if (isSubnetOverlap(bCurr, [block.cidr])) {
                  bAcc.push(bCurr);
                }

                return bAcc;
              }, []);

              const temp = {
                ...vCurr,
                parent_block: p,
                prefixes: blockPrefixes
              };

              vAcc.push(temp)
            });
          } else {
            const temp = {
              ...vCurr,
              parent_block: null
            }

            vAcc.push(temp)
          }
        
          return vAcc;
        }, []);

        setVNetData(data);
      }
    }
  }, [blocks, vNets, showAll]);

  React.useEffect(() => {
    if(!find(vNetData, selectedVNet)) {
      setSelectedVNet(null);
      setVNetInput('');
    }
  }, [vNetData, selectedVNet]);

  React.useEffect(() => {
    setSelectedVNet(null);
    setVNetInput('');
  }, [showAll]);

  React.useEffect(() => {
    if(vNetData) {
      showAll
      ? setVNetOptions(orderBy(vNetData, ['subscription_name', 'name'], ['asc', 'asc']))
      : setVNetOptions(orderBy(vNetData.filter(v => v.parent_space !== null), ['parent_space', 'parent_block', 'name'], ['asc', 'asc', 'asc']));
    } else {
      setVNetOptions([]);
    }
  }, [showAll, vNetData]);

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
      let subnetsObj = availableSubnets(selectedPrefix, selectedMask.value, exclusions);

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
    <ThemeProvider theme={plannerTheme}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', pt: 2, pb: 2, pr: 3, pl: 3, alignItems: 'center', borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <Autocomplete
              forcePopupIcon={false}
              id="grouped-demo"
              size="small"
              options={vNetOptions}
              groupBy={(option) => showAll ? option.subscription_name : `${option.parent_space} ➜ ${option.parent_block}`}
              getOptionLabel={(option) => option.name}
              inputValue={vNetInput}
              onInputChange={(event, newInputValue) => setVNetInput(newInputValue)}
              value={selectedVNet}
              onChange={(event, newValue) => setSelectedVNet(newValue)}
              isOptionEqualToValue={(option, value) => isEqual(option, value)}
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
                        {!vNetData ? <CircularProgress color="inherit" size={20} /> : null}
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
                  label="Mask"
                  placeholder="Mask"
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
            [...new Set(subnetData.map((x) => x.mask))].map((mask) => {
            return (
              <React.Fragment key={`fragment-${mask}`}>
                <Separator key={`sep-${mask}`} name={mask} total={subnetData.filter((x) => x.mask === mask).length} used={subnetData.filter((x) => x.mask === mask && x.overlap).length} />
                <Grid key={`grid-container-${mask}`} container spacing={2}>
                  {
                    subnetData?.filter((x) => x.mask === mask).map((item) => {
                      return (
                        <Grid key={`grid-item-${item.network}-${mask}`} size={{ xs: 5, sm: 3, md: 2, xxl: 1 }}>
                          <Item
                            overlap={+item.overlap}
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
