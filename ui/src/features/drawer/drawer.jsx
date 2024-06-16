import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import { useSnackbar } from "notistack";

import { styled, alpha } from "@mui/material/styles";
import { SvgIcon } from "@mui/material";

import { orderBy } from 'lodash';
import { plural, singular } from 'pluralize';

import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";

import { callMsGraph, callMsGraphPhoto } from "../../msal/graph";

import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Autocomplete,
  TextField,
  InputAdornment,
  Backdrop
} from "@mui/material";

import { createFilterOptions } from '@mui/material/Autocomplete';

import {
  Menu as MenuIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Token as TokenIcon,
  Logout as LogoutIcon,
  // Info as InfoIcon,
  // Close as CloseIcon,
  AccountCircle as AccountCircleIcon,
  // CloudDownloadOutlined as CloudDownloadIcon
} from "@mui/icons-material";

// Imports for the Drawer
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Collapse,
  Avatar,
  Badge
} from "@mui/material";

import {
  ExpandLess,
  ExpandMore,
  Settings as SettingsIcon,
} from "@mui/icons-material";

import { SpinnerCircular } from 'spinners-react';

import Home from "../../img/Home";
import Discover from "../../img/Discover";
import Space from "../../img/Space";
import Block from "../../img/Block";
import VNet from "../../img/VNet";
import Subnet from "../../img/Subnet";
import Endpoint from "../../img/Endpoint";
import Analysis from "../../img/Analysis";
import Configure from "../../img/Configure";
import Basics from "../../img/Basics";
import Associate from "../../img/Associate";
import External from "../../img/External";
import Reservation from "../../img/Reservation";
import Admin from "../../img/Admin";
import Visualize from "../../img/Visualize";
import Peering from "../../img/Peering";
import Admins from "../../img/Admins";
import Rule from "../../img/Rule";
import Tools from "../../img/Tools";
import Planner from "../../img/Planner";
import Generator from "../../img/Generator";
// import Settings from "../../img/Settings";
import Help from "../../img/Help";
import VWan from "../../img/VWan";

import Welcome from "../welcome/welcome";
import DiscoverTabs from "../tabs/discoverTabs";
import AnalyzeTabs from "../tabs/analyzeTabs";
import ToolsTabs from "../tabs/toolsTabs";
import AdminTabs from "../tabs/adminTabs";
import ConfigTabs from "../tabs/configTabs";

import Refresh from "./utils/refresh";
import UserSettings from "./utils/userSettings";
import About from "./utils/about";

import {
  setUserId,
  getAdminStatus,
  getMeLoaded,
  selectVNets,
  selectVHubs,
  selectSubnets,
  selectEndpoints
} from "../ipam/ipamSlice";

import { apiRequest } from "../../msal/authConfig";

const Search = styled("div")(({ theme }) => ({
  display: "flex",
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(3),
    width: "auto",
  },
}));

// const Update = styled(Typography)(({ theme }) => ({
//   display: 'flex',
//   justifyContent: 'center',
//   alignItems: 'center',
//   width: '100vw',
//   fontSize: '12px',
//   color: theme.palette.mode == 'dark' ? 'black' : 'white',
//   backgroundColor: theme.palette.warning.light,
//   height: '100%'
// }));

// const StyledBadge = styled(Badge)(({ theme }) => ({
//   '& .MuiBadge-badge': {
//     backgroundColor: theme.palette.warning.light,
//     color: theme.palette.warning.light,
//     boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
//     '&::after': {
//       position: 'absolute',
//       top: 0,
//       left: 0,
//       width: '100%',
//       height: '100%',
//       borderRadius: '50%',
//       animation: 'ripple 1.2s infinite ease-in-out',
//       border: '1px solid currentColor',
//       content: '""',
//     },
//   },
//   '@keyframes ripple': {
//     '0%': {
//       transform: 'scale(.8)',
//       opacity: 1,
//     },
//     '100%': {
//       transform: 'scale(2.4)',
//       opacity: 0,
//     },
//   },
// }));

export default function NavDrawer() {
  const { instance, accounts } = useMsal();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = React.useState(null);
  const [graphData, setGraphData] = React.useState(null);
  const [graphPhoto, setGraphPhoto] = React.useState(null);
  const [navChildOpen, setNavChildOpen] = React.useState({});
  const [drawerState, setDrawerState] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [searchData, setSearchData] = React.useState([]);
  const [searchInput, setSearchInput] = React.useState('');
  const [searchValue, setSearchValue] = React.useState(null);

  const navigate = useNavigate();

  const isAdmin = useSelector(getAdminStatus);
  const meLoaded = useSelector(getMeLoaded);
  const vNets = useSelector(selectVNets);
  const vHubs = useSelector(selectVHubs);
  const subnets = useSelector(selectSubnets);
  const endpoints = useSelector(selectEndpoints);

  const dispatch = useDispatch();

  const isMenuOpen = Boolean(menuAnchorEl);
  const isMobileMenuOpen = Boolean(mobileMenuAnchorEl);

  const navItems = [
    [
      {
        title: "Home",
        icon: Home,
        link: "/",
        admin: false
      }
    ],
    [
      {
        title: "Discover",
        icon: Discover,
        admin: false,
        children: [
          {
            title: "Spaces",
            icon: Space,
            link: "discover/space",
            admin: false
          },
          {
            title: "Blocks",
            icon: Block,
            link: "discover/block",
            admin: false
          },
          {
            title: "vNets",
            icon: VNet,
            link: "discover/vnet",
            admin: false
          },
          {
            title: "Subnets",
            icon: Subnet,
            link: "discover/subnet",
            admin: false
          },
          {
            title: "vHubs",
            icon: VWan,
            link: "discover/vhub",
            admin: false
          },
          {
            title: "Endpoints",
            icon: Endpoint,
            link: "discover/endpoint",
            admin: false
          }
        ]
      },
      {
        title: "Analysis",
        icon: Analysis,
        admin: false,
        children: [
          {
            title: "Visualize",
            icon: Visualize,
            link: "analyze/visualize",
            admin: false
          },
          {
            title: "Peerings",
            icon: Peering,
            link: "analyze/peering",
            admin: false
          }
        ]
      },
      {
        title: "Tools",
        icon: Tools,
        admin: false,
        children: [
          {
            title: "Planner",
            icon: Planner,
            link: "tools/planner",
            admin: false
          },
          {
            title: "Generator",
            icon: Generator,
            link: "tools/generator",
            admin: false
          }
        ]
      }
    ],
    [
      {
        title: "Configure",
        icon: Configure,
        admin: false,
        children: [
          {
            title: "Basics",
            icon: Basics,
            link: "configure/basics",
            admin: false
          },
          {
            title: "Associations",
            icon: Associate,
            link: "configure/associations",
            admin: false
          },
          {
            title: "Reservations",
            icon: Reservation,
            link: "configure/reservations",
            admin: false
          },
          {
            title: "Externals",
            icon: External,
            link: "configure/externals",
            admin: false
          }
        ]
      },
      {
        title: "Admin",
        icon: Admin,
        admin: true,
        children: [
          {
            title: "Admins",
            icon: Admins,
            link: "admin/admins",
            admin: true
          },
          {
            title: "Subscriptions",
            icon: Rule,
            link: "admin/subscriptions",
            admin: true
          },
          // {
          //   title: "Settings",
          //   icon: Settings,
          //   link: "admin/settings",
          //   admin: true
          // }
        ]
      }
    ]
  ];

  React.useEffect(() => {
    if (!graphData) {
      (async() => {
        try {
          const graphResponse = await callMsGraph();
          const photoResponse = await callMsGraphPhoto();
          await dispatch(setUserId(graphResponse.userPrincipalName));
          setGraphPhoto(photoResponse);
          setGraphData(graphResponse);
        } catch (e) {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          // enqueueSnackbar(e.message, { variant: "error" });
        }
      })();
    }
  }, [graphData, dispatch]);

  React.useEffect(() => {
    // Handler to call on window resize
    function handleResize() {
      setMenuAnchorEl(null);
      setMobileMenuAnchorEl(null);
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount

  const toggleDrawer = (open) => (event) => {
    if (event.type === "keydown" && (event.key === "Tab" || event.key === "Shift")) {
      return;
    }

    setDrawerState(open);
  };

  // React.useEffect(() => {
  //   const action = snackbarId => (
  //     <>
  //       <IconButton onClick={() => { closeSnackbar(snackbarId) }}>
  //         <CloseIcon sx={{ color: 'white' }} />
  //       </IconButton>
  //     </>
  //   );

  //   if(meLoaded && graphData) {
  //     enqueueSnackbar("Update available! See menu for details.", { action, variant: "info", preventDuplicate: true, persist: true });
  //   }
  // }, [meLoaded, graphData, enqueueSnackbar, closeSnackbar]);

  React.useEffect(() => {
    function getTitleCase(str) {
      const titleCase = str
        .toLowerCase()
        .split('_')
        .map(word => {
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    
      return titleCase;
    }

    function GetInstanceType(target) {
      var instanceType = typeof target;
    
      if(instanceType === 'object') {
        instanceType = Array.isArray(target) ? 'array': 'object';
      }
    
      return instanceType;
    }

    function objToFilter(data, header, path, exclusions) {
      const searchObj = data.reduce((prev, curr) => {

        Object.entries(curr).forEach(([key, value]) => {
          if(value !== undefined && value !== null) {
            const newKey = key.replace(/([a-zA-Z])(?=[A-Z])/g, '$1_').toLowerCase();

            if(!exclusions.includes(newKey)) {
              const titleKey = getTitleCase(newKey);
              const keyNoun = Array.isArray(value) ? plural(titleKey) : singular(titleKey);

              if(!prev.hasOwnProperty(newKey)) {
                prev[newKey] = {
                  searchKey: key,
                  noun: keyNoun,
                  comparator: Array.isArray(value) ? 'contains' : 'like',
                  type: GetInstanceType(value),
                  values: []
                };
              }

              Array.isArray(value) ? prev[newKey].values = prev[newKey].values.concat(value) : prev[newKey].values.push(value);
            }
          }
        });

        return prev;
      }, {});

      var searchItems = [];

      Object.entries(searchObj).forEach(([key, props]) => {
        searchObj[key].values = [...new Set(props.values)];
      });

      Object.values(searchObj).forEach((props) => {
        props.values.forEach((value) => {
          const phrase = props.noun + ' ' + props.comparator + ' ' + String(value);

          var searchItem = {
            category: header,
            path: path,
            phrase: phrase,
            value: value,
            filter: {
              name: props.searchKey,
              operator: 'contains',
              type: props.type,
              value: value
            }
          };

          searchItems.push(searchItem);
        });
      });

      return searchItems;
    }

    var newSearchData = [];

    if(vNets) {
      const vNetExclusions = ['id', 'peerings', 'resv', 'type', 'subnets', 'size', 'used', 'available', 'utilization', 'parent_space', 'subscription_id', 'tenant_id', 'metadata'];
      const vNetFiltered = objToFilter(vNets, 'Virtual Networks', '/discover/vnet', vNetExclusions);
      const vNetResults = orderBy(vNetFiltered, 'phrase', 'asc');

      const subnetExclusions = ['id', 'vnet_id', 'size', 'used', 'available', 'utilization', 'subscription_id', 'tenant_id', 'metadata'];
      const subnetFiltered = objToFilter(subnets, 'Subnets', '/discover/subnet', subnetExclusions);
      const subnetResults = orderBy(subnetFiltered, 'phrase', 'asc');

      newSearchData = [...newSearchData, ...vNetResults, ...subnetResults];
    }

    if(vHubs) {
      const vHubExclusions = ['id', 'peerings', 'vwan_id', 'resv', 'type', 'size', 'used', 'available', 'utilization', 'parent_space'];
      const vHubFiltered = objToFilter(vHubs, 'Virtual Hubs', '/discover/vhub', vHubExclusions);
      const vHubResults = orderBy(vHubFiltered, 'phrase', 'asc');

      newSearchData = [...newSearchData, ...vHubResults];
    }

    if(endpoints) {
      const endpointExclusions = ['id', 'unique_id', 'vnet_id', 'subnet_id', 'subscription_id', 'tenant_id', 'metadata'];
      const endpointFiltered = objToFilter(endpoints, 'Endpoints', '/discover/endpoint', endpointExclusions);
      const endpointResults = orderBy(endpointFiltered, 'phrase', 'asc');

      newSearchData = [...newSearchData, ...endpointResults];
    }

    setSearchData(newSearchData);
  }, [vNets, vHubs, subnets, endpoints]);

  const filterOptions = createFilterOptions({
    matchFrom: 'any',
    limit: 100,
    stringify: (option) => String(option.value),
  });

  const navList = () => (
    <Box
      sx={{ width: 250 }}
      role="presentation"
    >
      {navItems.map((navItem, navIndex) => {
        return (
          <React.Fragment key={`navItem-${navIndex}`}>
            <List>
              {navItem.map((item, itemIndex) => {
                return item.hasOwnProperty('children') 
                ? ((item.admin && isAdmin) || !item.admin) &&
                  <React.Fragment key={`item-${item.title}`}>
                    <ListItem
                      key={item.title}
                      component="div"
                      sx={{ "&:hover": { cursor: "pointer" } }}
                      onClick={() => { setNavChildOpen({[item.title]: !navChildOpen[item.title]}) }}
                    >
                      <ListItemIcon>
                        <SvgIcon>
                          <item.icon />
                        </SvgIcon>
                      </ListItemIcon>
                      <ListItemText primary={item.title} />
                      {navChildOpen[item.title] ? <ExpandLess /> : <ExpandMore />}
                    </ListItem>
                    <Collapse
                      in={navChildOpen[item.title]}
                      timeout="auto"
                      unmountOnExit
                    >
                    <List component="div" disablePadding>
                      {item.children.map((child, childIndex) => (
                        ((item.admin && isAdmin) || !item.admin) &&
                        <ListItemButton
                          key={child.title}
                          component={Link}
                          to={child.link}
                          sx={{ pl: 4 }}
                          onClick={toggleDrawer(false)}
                          onKeyDown={toggleDrawer(false)}
                        >
                          <ListItemIcon>
                            <SvgIcon>
                              <child.icon />
                            </SvgIcon>
                          </ListItemIcon>
                          <ListItemText primary={child.title} />
                        </ListItemButton>
                      ))}
                    </List>
                    </Collapse>
                  </React.Fragment>
                : ((item.admin && isAdmin) || !item.admin) &&
                  <ListItemButton
                    key={item.title}
                    component={Link}
                    to={item.link}
                    onClick={toggleDrawer(false)}
                    onKeyDown={toggleDrawer(false)}
                  >
                    <ListItemIcon>
                      <SvgIcon>
                        <item.icon />
                      </SvgIcon>
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                  </ListItemButton>
              })}
            </List>
            {(navIndex < (navItems.length - 1)) && <Divider />}
          </React.Fragment>
        )
      })}
    </Box>
  );

  function RequestToken() {
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async () => {
      try {
        const response = await instance.acquireTokenSilent(request);
        navigator.clipboard.writeText(response.accessToken);
        handleMenuClose();
        enqueueSnackbar('Token copied to clipboard!', { variant: 'success' });
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar("Error fetching access token", { variant: "error" });
        }
      }
    })();
  }

  function handleLogout() {
    instance.logoutRedirect().catch((e) => {
      console.error(e);
    });
  }

  function stringAvatar(name) {
    const nameSplit = name.split(" ");

    return {
      children: nameSplit.length === 1 ? `${nameSplit[0][0]}` : `${nameSplit[0][0]}${nameSplit[1][0]}`,
    };
  }

  const handleProfileMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchorEl(null);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    handleMobileMenuClose();
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
    handleMenuClose();
    handleMobileMenuClose();
  };

  const handleAboutOpen = () => {
    setAboutOpen(true);
    handleMenuClose();
    handleMobileMenuClose();
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const handleAboutClose = () => {
    setAboutOpen(false);
  };

  const menuId = "primary-search-account-menu";
  const renderMenu = (
    <Menu
      anchorEl={menuAnchorEl}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      id={menuId}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={isMenuOpen}
      onClose={handleMenuClose}
      PaperProps={{
        elevation: 0,
        style: {
          width: 200,
        },
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          mt: 1.5,
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            ml: -0.5,
            mr: 1,
          },
          '&:before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 26,
            width: 10,
            height: 10,
            bgcolor: 'background.paper',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        },
      }}
    >
      <MenuItem key='settings' onClick={() => handleSettingsOpen()}>
        <ListItemIcon>
          <AccountCircleIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Profile</ListItemText>
      </MenuItem>
      <MenuItem key='token' onClick={() => RequestToken()}>
        <ListItemIcon>
          <TokenIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Token</ListItemText>
      </MenuItem>
      {/* <MenuItem key='about' onClick={() => handleAboutOpen()}>
        <ListItemIcon>
          <InfoIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>About</ListItemText>
        <CloudDownloadIcon fontSize="small" color="warning" />
      </MenuItem> */}
      <Divider />
      <MenuItem key='logout' onClick={() => handleLogout()}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Logout</ListItemText>
      </MenuItem>
    </Menu>
  );

  const mobileMenuId = "primary-search-account-menu-mobile";
  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMenuAnchorEl}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      id={mobileMenuId}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={isMobileMenuOpen}
      onClose={handleMobileMenuClose}
      PaperProps={{
        elevation: 0,
        style: {
          width: 200,
        },
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          mt: 1.5,
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            ml: -0.5,
            mr: 1,
          },
          '&:before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 19,
            width: 10,
            height: 10,
            bgcolor: 'background.paper',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        },
      }}
    >
      <MenuItem key='mobile-settings' onClick={() => handleSettingsOpen()}>
        <ListItemIcon>
          <AccountCircleIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Profile</ListItemText>
      </MenuItem>
      <MenuItem key='mobile-token' onClick={() => RequestToken()}>
        <ListItemIcon>
          <TokenIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Token</ListItemText>
      </MenuItem>
      {/* <MenuItem key='about' onClick={() => handleAboutOpen()}>
        <ListItemIcon>
          <InfoIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>About</ListItemText>
        <CloudDownloadIcon fontSize="small" color="warning" />
      </MenuItem> */}
      <Divider />
      <MenuItem key='mobile-logout' onClick={() => handleLogout()}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Logout</ListItemText>
      </MenuItem>
    </Menu>
  );

  return (
    <React.Fragment>
      <Backdrop
        sx={{ color: '#fff', backgroundColor: 'rgba(192, 200, 200, 1)', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        transitionDuration={{ appear: 0, enter: 0, exit: 500 }}
        open={!meLoaded || !graphData}
      >
        <SpinnerCircular size={250} thickness={100} speed={100} color="#33ccff" />
      </Backdrop>
      <Refresh />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="open drawer"
              sx={{ mr: 2 }}
              onClick={toggleDrawer(true)}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ display: { xs: "none", sm: "block" } }}>
              Azure IPAM
            </Typography>
            <Search>
              <Autocomplete filterOptions={filterOptions}
                freeSolo
                id="ipam-search-bar"
                disableClearable
                options={searchData ? orderBy(searchData, 'category', 'asc') : []}
                groupBy={(option) => option.category}
                getOptionLabel={(option) => option.phrase}
                disabled={searchData.length > 0 ? false : true}
                inputValue={searchInput}
                onInputChange={(event, newSearchInput) => {
                  setSearchInput(newSearchInput);
                }}
                value={searchValue}
                onChange={(event, newValue) => {
                  setSearchInput('');
                  setSearchValue(null);
                  navigate(newValue.path, {state: newValue.filter});
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={searchData.length > 0 ? "Search..." : "Loading..."}
                    fullWidth
                    variant="standard"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment:
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'white', pl: 1}}/>
                        </InputAdornment>,
                      disableUnderline: true,
                      type: 'search',
                      sx: {
                        color: 'inherit'
                      }
                    }}
                  />
                )}
                sx={{
                  display: 'flex',
                  color: 'inherit',
                  width: '20ch',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)'
                }}
              />
            </Search>
            <Box sx={{ flexGrow: 1 }} />
            <Box sx={{ display: { xs: "none", md: "flex" } }}>
              <IconButton
                size="large"
                edge="end"
                aria-label="account of current user"
                aria-controls={menuId}
                aria-haspopup="true"
                onClick={handleProfileMenuOpen}
                color="inherit"
              >
                {/* <StyledBadge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                > */}
                { graphData ? 
                  graphPhoto ?
                  <Avatar alt={graphData.displayName} src={graphPhoto} /> :
                  <Avatar {...stringAvatar(graphData.displayName)} /> :
                  <Avatar />
                }
                {/* </StyledBadge> */}
              </IconButton>
            </Box>
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton
                size="large"
                aria-label="show more"
                aria-controls={mobileMenuId}
                aria-haspopup="true"
                onClick={handleMobileMenuOpen}
                color="inherit"
              >
                <MoreIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>
        {renderMobileMenu}
        {renderMenu}
      </Box>
      <Drawer anchor="left" open={drawerState} onClose={toggleDrawer(false)}>
        {navList()}
        <Box>
          <Divider />
          <ListItemButton
            key="Help"
            target="_blank"
            href="https://azure.github.io/ipam/#/README"
            onClick={toggleDrawer(false)}
            onKeyDown={toggleDrawer(false)}
          >
            <ListItemIcon>
              <SvgIcon>
                <Help />
              </SvgIcon>
            </ListItemIcon>
            <ListItemText primary="Help" />
          </ListItemButton>
        </Box>
      </Drawer>
      <Box sx={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>
        <UserSettings
          open={settingsOpen}
          handleClose={handleSettingsClose}
        />
        <About
          open={aboutOpen}
          handleClose={handleAboutClose}
        />
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="discover/space" element={<DiscoverTabs />} />
          <Route path="discover/block" element={<DiscoverTabs />} />
          <Route path="discover/vnet" element={<DiscoverTabs />} />
          <Route path="discover/vhub" element={<DiscoverTabs />} />
          <Route path="discover/subnet" element={<DiscoverTabs />} />
          <Route path="discover/endpoint" element={<DiscoverTabs />} />
          <Route path="analyze/visualize" element={<AnalyzeTabs />} />
          <Route path="analyze/peering" element={<AnalyzeTabs />} />
          <Route path="tools/planner" element={<ToolsTabs />} />
          <Route path="tools/generator" element={<ToolsTabs />} />
          <Route path="configure/basics" element={<ConfigTabs />} />
          <Route path="configure/associations" element={<ConfigTabs />} />
          <Route path="configure/reservations" element={<ConfigTabs />} />
          <Route path="configure/externals" element={<ConfigTabs />} />
          <Route path="admin/admins" element={<AdminTabs />} />
          <Route path="admin/subscriptions" element={<AdminTabs />} />
          {/* <Route path="admin/settings" element={<AdminTabs />} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {/* <Box
          sx={{
            bottom: 0,
            right: 0,
            position: "absolute",
            height: '20px'
          }}
        >
          <Update
            variant="subtitle2"
            display="block"
          >
            Update Available (v3.0.0)
          </Update>
        </Box> */}
      </Box>
    </React.Fragment>
  );
}
