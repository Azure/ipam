import * as React from "react";
import { useSelector } from "react-redux";

import { useNavigate } from "react-router-dom";

import { useSnackbar } from "notistack";

import { isEqual, sortBy, pick } from "lodash";

import {
  Box,
  TextField,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Switch,
  IconButton,
  Tooltip,
  SvgIcon,
  Autocomplete,
  FormGroup,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Popper,
  CircularProgress
} from "@mui/material";

import LoadingButton from "@mui/lab/LoadingButton";

import {
  MenuOpenOutlined,
  ContentCopyOutlined,
  PieChartOutlined
} from "@mui/icons-material";

import {
  selectSubscriptions,
  selectSpaces,
  selectUpdatedVNets
} from "../../ipam/ipamSlice";

import {
  fetchNextAvailableVNet,
  fetchNextAvailableSubnet
} from "../../ipam/ipamAPI";

import VNet from "../../../img/VNet";
import Subnet from "../../../img/Subnet";

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

const popperStyle = {
  popper: {
    width: "fit-content"
  }
};

const MyPopper = function (props) {
  return <Popper {...props} style={{ popperStyle }} placement="bottom-start" />;
};

const Generator = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [blocks, setBlocks] = React.useState(null);
  const [networks, setNetworks] = React.useState(null);

  const [spaceInput, setSpaceInput] = React.useState('');
  const [blockInput, setBlockInput] = React.useState('');

  const [subscriptionInput, setSubscriptionInput] = React.useState('');
  const [networkInput, setNetworkInput] = React.useState('');

  const [maskInput, setMaskInput] = React.useState('');

  const [selectedSpace, setSelectedSpace] = React.useState(null);
  const [selectedBlock, setSelectedBlock] = React.useState(null);

  const [selectedSubscription, setSelectedSubscription] = React.useState(null);
  const [selectedNetwork, setSelectedNetwork] = React.useState(null);

  const [selectedMask, setSelectedMask] = React.useState(null);
  const [maskOptions, setMaskOptions] = React.useState(null);

  const [reverseSearch, setReverseSearch] = React.useState(false);
  const [smallestCIDR, setSmallestCIDR] = React.useState(false);

  const [nextAvailable, setNextAvailable] = React.useState(null);

  const [showSubnets, setShowSubnets] = React.useState(false);

  const [sending, setSending] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const subscriptions = useSelector(selectSubscriptions);
  const spaces = useSelector(selectSpaces);
  const vNets = useSelector(selectUpdatedVNets);

  const navigate = useNavigate();

  const open = Boolean(anchorEl);

  React.useEffect(() => {
    setSelectedSpace(null);
    setSelectedSubscription(null);
    setNextAvailable(null);
    setReverseSearch(false);
    setSmallestCIDR(false);
  }, [showSubnets]);

  React.useEffect(() => {
    if (!spaces) {
      setSelectedSpace(null);
    }
  }, [spaces]);

  React.useEffect(() => {
    if (spaces) {
      if (selectedSpace) {
        const spaceIndex = spaces.findIndex((x) => x.name === selectedSpace.name);

        if (spaceIndex > -1) {
          if (!isEqual(spaces[spaceIndex], selectedSpace)) {
            setSelectedSpace(spaces[spaceIndex]);
          }
        } else {
          setSelectedSpace(null);
          setSelectedBlock(null);
        }
      } else {
        setSelectedBlock(null);
      }
    } else {
      setSelectedSpace(null);
    }
  }, [spaces, selectedSpace]);

  React.useEffect(() => {
    if (blocks) {
      if (selectedBlock) {
        const blockIndex = blocks.findIndex((x) => x.id === selectedBlock.id);

        if (blockIndex > -1) {
          if (!isEqual(blocks[blockIndex], selectedBlock)) {
            setSelectedBlock(blocks[blockIndex]);
          }
        } else {
          setSelectedBlock(null);
        }
      }
    } else {
      setSelectedBlock(null);
    }
  }, [blocks, selectedBlock]);

  React.useEffect(() => {
    if (selectedSpace) {
      setBlocks(selectedSpace.blocks);
    }
  }, [selectedSpace]);

  React.useEffect(() => {
    if (selectedSpace && selectedBlock) {
      if (selectedBlock.parent_space !== selectedSpace.name) {
        setSelectedBlock(null);
      }
    }
  }, [selectedSpace, selectedBlock]);

  React.useEffect(() => {
    if (selectedBlock) {
      let prefixParts = selectedBlock.cidr.split("/");
      let currentMask = parseInt(prefixParts[1], 10);
      let availableMasks = cidrMasks.filter((opt) => opt.value >= currentMask && opt.value <= 29);

      setMaskOptions(availableMasks);
      setSelectedMask(availableMasks[0]);
    } else {
      setSelectedMask(null);
      setMaskInput("");
      setMaskOptions(null);
    }
  }, [selectedBlock]);

  React.useEffect(() => {
    if (!subscriptions) {
      setSelectedSubscription(null);
    }
  }, [subscriptions]);

  React.useEffect(() => {
    if (subscriptions && selectedSubscription) {
      const subscriptionIndex = subscriptions.findIndex((x) => x.subscription_id === selectedSubscription.subscription_id);

      if (subscriptionIndex > -1) {
        if (!isEqual(subscriptions[subscriptionIndex], selectedSubscription)) {
          setSelectedSubscription(subscriptions[subscriptionIndex]);
        }
      } else {
        setSelectedSubscription(null);
      }
    } else if (!selectedSubscription) {
      setSelectedNetwork(null);
      setNetworks(null);
    }
  }, [subscriptions, selectedSubscription]);

  React.useEffect(() => {
    if (networks && selectedNetwork) {
      const networkIndex = networks.findIndex((x) => x.id === selectedNetwork.id);

      if (networkIndex > -1) {
        if (!isEqual(networks[networkIndex], selectedNetwork)) {
          setSelectedNetwork(networks[networkIndex]);
        }
      } else {
        setSelectedNetwork(null);
      }
    }
  }, [networks, selectedNetwork]);

  React.useEffect(() => {
    if (vNets && selectedSubscription) {
      setNetworks(vNets.filter((x) => x.subscription_id === selectedSubscription.subscription_id));
    }
  }, [selectedSubscription, vNets]);

  React.useEffect(() => {
    if (selectedNetwork) {
      const maskList = selectedNetwork.prefixes.map((prefix) => {
        let prefixParts = prefix.split("/");
        let prefixMask = parseInt(prefixParts[1], 10);

        return prefixMask;
      });

      let availableMasks = cidrMasks.filter((opt) => opt.value >= Math.max(...maskList) && opt.value <= 29);

      setMaskOptions(availableMasks);
      setSelectedMask(availableMasks[0]);
    } else {
      setSelectedMask(null);
      setMaskInput("");
      setMaskOptions(null);
    }
  }, [selectedNetwork]);

  React.useEffect(() => {
    setNextAvailable(null);
  }, [selectedMask, reverseSearch, smallestCIDR]);

  const handleClick = (event) => {
    setAnchorEl(event.target);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nextAvailable);
    handleClose();
    enqueueSnackbar("Network copied to clipboard!", { variant: "success" });
  };

  function onSubmit() {
    console.log("Fetching Next Available...");
    (async () => {
      try {
        setSending(true);

        const nextAvailable = showSubnets ?
          {
            vnet_id: selectedNetwork.id,
            size: selectedMask.value,
            reverse_search: reverseSearch,
            smallest_cidr: smallestCIDR
          } :
          {
            space: selectedSpace.name,
            blocks: [selectedBlock.name],
            size: selectedMask.value,
            reverse_search: reverseSearch,
            smallest_cidr: smallestCIDR
          }

        const data = showSubnets ? (await fetchNextAvailableSubnet(nextAvailable)) : (await fetchNextAvailableVNet(nextAvailable));
        setNextAvailable(data.cidr);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', pt: 2, pb: 2, pr: 3, pl: 3, alignItems: 'center', borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
          <Autocomplete
            PopperComponent={MyPopper}
            forcePopupIcon={false}
            id="grouped-demo"
            size="small"
            options={ showSubnets ? sortBy(subscriptions, 'name') : sortBy(spaces, 'name') }
            getOptionLabel={(option) => option.name}
            inputValue={ showSubnets ? subscriptionInput : spaceInput }
            onInputChange={ (event, newInputValue) => showSubnets ? setSubscriptionInput(newInputValue) : setSpaceInput(newInputValue) }
            value={ showSubnets ? selectedSubscription : selectedSpace }
            onChange={ (event, newValue) => showSubnets ? setSelectedSubscription(newValue) : setSelectedSpace(newValue) }
            isOptionEqualToValue={
              (option, value) => {
                const newOption = showSubnets ? pick(option, ['id']) : pick(option, ['name']);
                const newValue = showSubnets ? pick(value, ['id']) : pick(value, ['name']);

                return isEqual(newOption, newValue);
              }
            }
            noOptionsText={ !spaces ? "Loading..." : "No Spaces" }
            sx={{ width: 300 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ showSubnets ? "Subscription" : "Space" }
                placeholder={ `Please Select ${showSubnets ? "Subscription" : "Space"}...` }
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {!spaces ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => {
              return (
                <li {...props} key={ showSubnets ? option.id: option.name }>
                  { showSubnets ? `${option.name} (${option.subscription_id})` : option.name }
                </li>
              );
            }}
          />
          <Autocomplete
            disabled={ showSubnets ? (selectedSubscription === null) : (selectedSpace === null) }
            forcePopupIcon={false}
            id="grouped-demo"
            size="small"
            options={ showSubnets ? (networks ? sortBy(networks, 'name') : []) : (blocks ? sortBy(blocks, 'name') : []) }
            getOptionLabel={(option) => option.name}
            inputValue={ showSubnets ? networkInput : blockInput }
            onInputChange={(event, newInputValue) => showSubnets ? setNetworkInput(newInputValue) : setBlockInput(newInputValue)}
            value={ showSubnets ? selectedNetwork : selectedBlock }
            onChange={(event, newValue) => showSubnets ? setSelectedNetwork(newValue) : setSelectedBlock(newValue)}
            isOptionEqualToValue={
              (option, value) => {
                const newOption = showSubnets ? pick(option, ['id']) : pick(option, ['id', 'name']);
                const newValue = showSubnets ? pick(value, ['id']) : pick(value, ['id', 'name']);

                return isEqual(newOption, newValue);
              }
            }
            sx={{ width: 300 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ showSubnets ? "Network" : "Block" }
                placeholder={ `Please Select ${showSubnets ? "Network" : "Block"}...` }
                InputProps={{
                  ...params.InputProps
                }}
              />
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
          <Tooltip
            title={
              showSubnets ?
              (
                selectedNetwork ?
                <>
                  {
                    selectedNetwork.prefixes.map((prefix) => (
                      <React.Fragment key={prefix}>
                        {prefix}<br />
                      </React.Fragment>
                    ))
                  }
                </> :
                ""
              ) :
              ( selectedBlock ? selectedBlock.cidr : "" )
            }
          >
          <TextField
            disabled
            size="small"
            id="block-cidr-read-only"
            label={ showSubnets ? "Prefix" : "Network" }
            value={ showSubnets ? (selectedNetwork ? selectedNetwork.prefixes.join(", ") : "") : (selectedBlock ? selectedBlock.cidr : "") }
            variant="outlined"
            sx={{
              width: '11ch',
              '& .MuiInputBase-input': {
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
          />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', marginLeft: 'auto' }}>
          <ToggleButtonGroup
            size="small"
            color="primary"
            value={showSubnets}
            exclusive
            onChange={() => setShowSubnets(prev => !prev)}
          >
            <ToggleButton value={false} aria-label="list">
              <Tooltip title="Virtual Network">
                <SvgIcon>
                  <VNet />
                </SvgIcon>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value={true} aria-label="module">
              <Tooltip title="Subnet">
                <SvgIcon>
                  <Subnet />
                </SvgIcon>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'solid 1px rgba(0, 0, 0, 0.12)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)'
            }}
          >
            <Typography variant="h5" sx={{ p: 2 }}>
              Next Available { showSubnets ? "Subnet" : "Virtual Network" }
            </Typography>
          </Box>
          <Box
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'row',
              gap: '24px',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="button">
                Options
              </Typography>
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  height: '160px',
                  width: '250px',
                  gap: '16px',
                  border: 'solid 1px rgba(0, 0, 0, 0.12)'
                }}
              >
                <Autocomplete
                  forcePopupIcon={false}
                  disabled={ showSubnets ? (selectedNetwork === null) : (selectedBlock === null) }
                  id="cidr-mask-max"
                  size="small"
                  options={maskOptions || []}
                  getOptionLabel={(option) => option.name}
                  inputValue={maskInput}
                  onInputChange={(event, newInputValue) => setMaskInput(newInputValue)}
                  value={selectedMask}
                  onChange={(event, newValue) => setSelectedMask(newValue)}
                  sx={{ width: '5ch' }}
                  ListboxProps={{
                    style: {
                      maxHeight: "15rem"
                    },
                    position: "bottom-start"
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Mask"
                      placeholder="Mask"
                    />
                  )}
                />
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <FormGroup
                    sx={{
                      pl: 1
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          size='small'
                          checked={reverseSearch}
                          onChange={() => setReverseSearch(prev => !prev)}
                        />
                      }
                      label="Reverse Search"
                      sx={{ pb: 1 }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size='small'
                          checked={smallestCIDR}
                          onChange={() => setSmallestCIDR(prev => !prev)}
                        />
                      }
                      label="Smallest CIDR"
                    />
                  </FormGroup>
                </Box>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="button">
                Output
              </Typography>
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '160px',
                  width: '250px',
                  gap: '16px',
                  border: 'solid 1px rgba(0, 0, 0, 0.12)'
                }}
              >
                <Menu
                  id="context-menu"
                  anchorEl={anchorEl}
                  open={open}
                  onClose={handleClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'center',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  MenuListProps={{
                    'aria-labelledby': 'basic-button',
                  }}
                >
                  <MenuItem onClick={handleCopy}>
                    <ListItemIcon>
                      <ContentCopyOutlined fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Copy</ListItemText>
                  </MenuItem>
                  {
                    !showSubnets &&
                    <MenuItem onClick={() =>navigate('/configure/reservations', {state: { space: selectedSpace, block: selectedBlock, cidr: nextAvailable }})}>
                      <ListItemIcon>
                        <PieChartOutlined fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Reservation</ListItemText>
                    </MenuItem>
                  }
                </Menu>
                <TextField
                  disabled={ !nextAvailable }
                  size="small"
                  id="next-available-vnet"
                  label="Next Available"
                  value={ nextAvailable || "" }
                  variant="outlined"
                  InputProps={{
                    endAdornment:
                      <IconButton
                        disabled={ !nextAvailable }
                        disableRipple
                        onClick={handleClick}
                      >
                        <MenuOpenOutlined />
                      </IconButton>
                  }}
                  sx={{
                    width: '13ch',
                    '& .MuiOutlinedInput-root': {
                      paddingRight: 'unset',
                    }
                  }}
                />
                <LoadingButton
                  disabled={ showSubnets ? (!selectedSubscription || !selectedNetwork || !selectedMask) : (!selectedSpace || !selectedBlock || !selectedMask) }
                  variant="contained"
                  loading={sending}
                  onClick={onSubmit}
                >
                  Generate
                </LoadingButton>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default Generator;
