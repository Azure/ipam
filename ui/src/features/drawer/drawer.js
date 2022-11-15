import * as React from "react";
import { useSelector } from 'react-redux';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";

import { useSnackbar } from "notistack";

import { styled, alpha } from "@mui/material/styles";
import { SvgIcon } from "@mui/material";

import { orderBy } from 'lodash';
import { plural, singular } from 'pluralize';

import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";

import { callMsGraph } from "../../msal/graph";

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
  InputAdornment
} from "@mui/material";

import { createFilterOptions } from '@mui/material/Autocomplete';

import {
  Menu as MenuIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  Token as TokenIcon,
  Logout as LogoutIcon,
} from "@mui/icons-material";

// Imports for the Drawer
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Collapse,
  Avatar,
} from "@mui/material";

import {
  ExpandLess,
  ExpandMore,
  Settings as SettingsIcon,
} from "@mui/icons-material";

import Home from "../../img/Home";
import Discover from "../../img/Discover";
import Space from "../../img/Space";
import Block from "../../img/Block";
import VNet from "../../img/VNet";
import Subnet from "../../img/Subnet";
import Endpoint from "../../img/Endpoint";
import Analysis from "../../img/Analysis";
import Configure from "../../img/Configure";
import Admin from "../../img/Admin";
import Visualize from "../../img/Visualize";
import Peering from "../../img/Peering";
// import Conflict from "../../img/Conflict";
import Person from "../../img/Person";
import Rule from "../../img/Rule";

import UserSettings from "./userSettings";

import Welcome from "../welcome/Welcome";
import DiscoverTabs from "../tabs/discoverTabs";
import AnalyzeTabs from "../tabs/analyzeTabs";
import AdminTabs from "../tabs/adminTabs";
import ConfigureIPAM from "../configure/configure";

import Refresh from "./refresh";

import {
  getAdminStatus,
  selectVNets,
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

export default function NavDrawer() {
  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = React.useState(null);
  const [graphData, setGraphData] = React.useState(null);
  const [navChildOpen, setNavChildOpen] = React.useState({});
  const [drawerState, setDrawerState] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [searchData, setSearchData] = React.useState([]);
  const [searchInput, setSearchInput] = React.useState('');
  const [searchValue, setSearchValue] = React.useState(null);

  const navigate = useNavigate();

  const isAdmin = useSelector(getAdminStatus);
  const vNets = useSelector(selectVNets);
  const subnets = useSelector(selectSubnets);
  const endpoints = useSelector(selectEndpoints);

  const isMenuOpen = Boolean(menuAnchorEl);
  const isMobileMenuOpen = Boolean(mobileMenuAnchorEl);

  const navItems = [
    [
      {
        title: "Home",
        icon: Home,
        link: "/",
        admin: false
      },
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
    ],
    [
      {
        title: "Configure",
        icon: Configure,
        link: "configure",
        admin: false
      },
      {
        title: "Admin",
        icon: Admin,
        admin: true,
        children: [
          {
            title: "Admins",
            icon: Person,
            link: "admin/admins",
            admin: true
          },
          {
            title: "Subscriptions",
            icon: Rule,
            link: "admin/subscriptions",
            admin: true
          }
        ]
      },
    ]
  ];

  React.useEffect(() => {
    const request = {
      // ...loginRequest,
      scopes: ["User.Read"],
      account: accounts[0],
      forceRefresh: true,
    };

    if (!graphData && inProgress === InteractionStatus.None) {
      (async() => {
        try {
          const response = await instance.acquireTokenSilent(request);
          const graphResponse = await callMsGraph(response.accessToken);
          await setGraphData(graphResponse);
        } catch (e) {
          if (e instanceof InteractionRequiredAuthError) {
            instance.acquireTokenRedirect(request);
          } else {
            console.log("ERROR");
            console.log("------------------");
            console.log(e);
            console.log("------------------");
            // enqueueSnackbar(e.response.data.error, { variant: "error" });
          }
        }
      })();
    }
  }, [instance, accounts, inProgress, graphData]);

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

    function objToFilter(data, header, path, exclusions) {
      const searchObj = data.reduce((prev, curr) => {

        Object.entries(curr).forEach(([key, value]) => {
          const newKey = key.replace(/([a-zA-Z])(?=[A-Z])/g, '$1_').toLowerCase();
          const titleKey = getTitleCase(newKey);
          const keyNoun = Array.isArray(value) ? plural(titleKey) : singular(titleKey);

          if(!exclusions.includes(newKey)) {
            if(!prev.hasOwnProperty(newKey)) {
              prev[newKey] = {
                searchKey: key,
                noun: keyNoun,
                comparator: Array.isArray(value) ? 'contains' : 'like',
                values: []
              };
            }

            Array.isArray(value) ? prev[newKey].values = prev[newKey].values.concat(value) : prev[newKey].values.push(value);
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
              id: 1,
              columnField: props.searchKey,
              operatorValue: 'contains',
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
      const vNetExclusions = ['id', 'peerings', 'resv', 'subnets', 'size', 'used', 'available', 'utilization', 'parent_space', 'subscription_id', 'tenant_id'];
      const vNetResults = objToFilter(vNets, 'Virtual Networks', '/discover/vnet', vNetExclusions);

      const subnetExclusions = ['id', 'vnet_id', 'size', 'used', 'available', 'utilization', 'subscription_id', 'tenant_id'];
      const subnetResults = objToFilter(subnets, 'Subnets', '/discover/subnet', subnetExclusions);

      newSearchData = [...newSearchData, ...vNetResults, ...subnetResults];
    }

    if(endpoints) {
      const endpointExclusions = ['id', 'vnet_id', 'subnet_id', 'metadata', 'subscription_id', 'tenant_id'];
      const endpointResults = objToFilter(endpoints, 'Endpoints', '/discover/endpoint', endpointExclusions);

      newSearchData = [...newSearchData, ...endpointResults];
    }

    setSearchData(newSearchData);
  }, [vNets, endpoints]);

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
                      onClick={() => { setNavChildOpen({...navChildOpen, [item.title]: !navChildOpen[item.title]}) }}
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
                        <ListItem
                          button
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
                        </ListItem>
                      ))}
                    </List>
                    </Collapse>
                  </React.Fragment>
                : ((item.admin && isAdmin) || !item.admin) &&
                  <ListItem
                    button
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
                  </ListItem>
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

  function handleLogout(instance) {
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

  const handleSettingsClose = () => {
    setSettingsOpen(false);
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
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        Settings
      </MenuItem>
      <MenuItem key='token' onClick={() => RequestToken()}>
        <ListItemIcon>
          <TokenIcon fontSize="small" />
        </ListItemIcon>
        Token
      </MenuItem>
      <Divider />
      <MenuItem key='logout' onClick={() => handleLogout(instance)}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        Logout
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
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        Settings
      </MenuItem>
      <MenuItem key='mobile-token' onClick={() => RequestToken()}>
        <ListItemIcon>
          <TokenIcon fontSize="small" />
        </ListItemIcon>
        Token
      </MenuItem>
      <Divider />
      <MenuItem key='mobile-logout' onClick={() => handleLogout(instance)}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        Logout
      </MenuItem>
    </Menu>
  );

  return (
    <React.Fragment>
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
                {graphData ? <Avatar {...stringAvatar(graphData.displayName)} /> : <Avatar />}
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
      </Drawer>
      <Box sx={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>
        <UserSettings
          open={settingsOpen}
          handleClose={handleSettingsClose}
        />
        <Routes>
          <Route path="/" element={<Welcome />} />
          {/* <Route path="manage/*" element={<DiscoverTabs />} /> */}
          <Route path="discover/space" element={<DiscoverTabs />} />
          <Route path="discover/block" element={<DiscoverTabs />} />
          <Route path="discover/vnet" element={<DiscoverTabs />} />
          <Route path="discover/subnet" element={<DiscoverTabs />} />
          <Route path="discover/endpoint" element={<DiscoverTabs />} />
          <Route path="analyze/visualize" element={<AnalyzeTabs />} />
          <Route path="analyze/peering" element={<AnalyzeTabs />} />
          <Route path="configure" element={<ConfigureIPAM />} />
          {/* <Route path="admin" element={<Administration />} /> */}
          <Route path="admin/admins" element={<AdminTabs />} />
          <Route path="admin/subscriptions" element={<AdminTabs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </React.Fragment>
  );
}

// Top 100 films as rated by IMDb users. http://www.imdb.com/chart/top
const top100Films = [
  { title: 'The Shawshank Redemption', year: 1994 },
  { title: 'The Godfather', year: 1972 },
  { title: 'The Godfather: Part II', year: 1974 },
  { title: 'The Dark Knight', year: 2008 },
  { title: '12 Angry Men', year: 1957 },
  { title: "Schindler's List", year: 1993 },
  { title: 'Pulp Fiction', year: 1994 },
  {
    title: 'The Lord of the Rings: The Return of the King',
    year: 2003,
  },
  { title: 'The Good, the Bad and the Ugly', year: 1966 },
  { title: 'Fight Club', year: 1999 },
  {
    title: 'The Lord of the Rings: The Fellowship of the Ring',
    year: 2001,
  },
  {
    title: 'Star Wars: Episode V - The Empire Strikes Back',
    year: 1980,
  },
  { title: 'Forrest Gump', year: 1994 },
  { title: 'Inception', year: 2010 },
  {
    title: 'The Lord of the Rings: The Two Towers',
    year: 2002,
  },
  { title: "One Flew Over the Cuckoo's Nest", year: 1975 },
  { title: 'Goodfellas', year: 1990 },
  { title: 'The Matrix', year: 1999 },
  { title: 'Seven Samurai', year: 1954 },
  {
    title: 'Star Wars: Episode IV - A New Hope',
    year: 1977,
  },
  { title: 'City of God', year: 2002 },
  { title: 'Se7en', year: 1995 },
  { title: 'The Silence of the Lambs', year: 1991 },
  { title: "It's a Wonderful Life", year: 1946 },
  { title: 'Life Is Beautiful', year: 1997 },
  { title: 'The Usual Suspects', year: 1995 },
  { title: 'Léon: The Professional', year: 1994 },
  { title: 'Spirited Away', year: 2001 },
  { title: 'Saving Private Ryan', year: 1998 },
  { title: 'Once Upon a Time in the West', year: 1968 },
  { title: 'American History X', year: 1998 },
  { title: 'Interstellar', year: 2014 },
  { title: 'Casablanca', year: 1942 },
  { title: 'City Lights', year: 1931 },
  { title: 'Psycho', year: 1960 },
  { title: 'The Green Mile', year: 1999 },
  { title: 'The Intouchables', year: 2011 },
  { title: 'Modern Times', year: 1936 },
  { title: 'Raiders of the Lost Ark', year: 1981 },
  { title: 'Rear Window', year: 1954 },
  { title: 'The Pianist', year: 2002 },
  { title: 'The Departed', year: 2006 },
  { title: 'Terminator 2: Judgment Day', year: 1991 },
  { title: 'Back to the Future', year: 1985 },
  { title: 'Whiplash', year: 2014 },
  { title: 'Gladiator', year: 2000 },
  { title: 'Memento', year: 2000 },
  { title: 'The Prestige', year: 2006 },
  { title: 'The Lion King', year: 1994 },
  { title: 'Apocalypse Now', year: 1979 },
  { title: 'Alien', year: 1979 },
  { title: 'Sunset Boulevard', year: 1950 },
  {
    title: 'Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb',
    year: 1964,
  },
  { title: 'The Great Dictator', year: 1940 },
  { title: 'Cinema Paradiso', year: 1988 },
  { title: 'The Lives of Others', year: 2006 },
  { title: 'Grave of the Fireflies', year: 1988 },
  { title: 'Paths of Glory', year: 1957 },
  { title: 'Django Unchained', year: 2012 },
  { title: 'The Shining', year: 1980 },
  { title: 'WALL·E', year: 2008 },
  { title: 'American Beauty', year: 1999 },
  { title: 'The Dark Knight Rises', year: 2012 },
  { title: 'Princess Mononoke', year: 1997 },
  { title: 'Aliens', year: 1986 },
  { title: 'Oldboy', year: 2003 },
  { title: 'Once Upon a Time in America', year: 1984 },
  { title: 'Witness for the Prosecution', year: 1957 },
  { title: 'Das Boot', year: 1981 },
  { title: 'Citizen Kane', year: 1941 },
  { title: 'North by Northwest', year: 1959 },
  { title: 'Vertigo', year: 1958 },
  {
    title: 'Star Wars: Episode VI - Return of the Jedi',
    year: 1983,
  },
  { title: 'Reservoir Dogs', year: 1992 },
  { title: 'Braveheart', year: 1995 },
  { title: 'M', year: 1931 },
  { title: 'Requiem for a Dream', year: 2000 },
  { title: 'Amélie', year: 2001 },
  { title: 'A Clockwork Orange', year: 1971 },
  { title: 'Like Stars on Earth', year: 2007 },
  { title: 'Taxi Driver', year: 1976 },
  { title: 'Lawrence of Arabia', year: 1962 },
  { title: 'Double Indemnity', year: 1944 },
  {
    title: 'Eternal Sunshine of the Spotless Mind',
    year: 2004,
  },
  { title: 'Amadeus', year: 1984 },
  { title: 'To Kill a Mockingbird', year: 1962 },
  { title: 'Toy Story 3', year: 2010 },
  { title: 'Logan', year: 2017 },
  { title: 'Full Metal Jacket', year: 1987 },
  { title: 'Dangal', year: 2016 },
  { title: 'The Sting', year: 1973 },
  { title: '2001: A Space Odyssey', year: 1968 },
  { title: "Singin' in the Rain", year: 1952 },
  { title: 'Toy Story', year: 1995 },
  { title: 'Bicycle Thieves', year: 1948 },
  { title: 'The Kid', year: 1921 },
  { title: 'Inglourious Basterds', year: 2009 },
  { title: 'Snatch', year: 2000 },
  { title: '3 Idiots', year: 2009 },
  { title: 'Monty Python and the Holy Grail', year: 1975 },
];
