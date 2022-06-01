import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";

import { useSnackbar } from "notistack";

import { styled, alpha } from "@mui/material/styles";
import { SvgIcon } from "@mui/material";

import { Routes, Route, Link, Navigate } from "react-router-dom";

import { callMsGraph } from "../../msal/graph";

import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  InputBase,
  Menu,
  MenuItem,
} from "@mui/material";

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

import {
  refreshAllAsync
} from '../../features/ipam/ipamSlice';

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
import Conflict from "../../img/Conflict";

import UserSettings from "./userSettings";

import Welcome from "../welcome/Welcome";
import DiscoverTabs from "../tabs/discoverTabs";
import AnalyzeTabs from "../tabs/analyzeTabs";
// import AnalysisTool from "../analysis/analysis";
import Administration from "../admin/admin";
import ConfigureIPAM from "../configure/configure";

import Refresh from "./refresh";

import {
  getAdminStatus
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

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: {
      width: "20ch",
    },
  },
}));

export default function NavDrawer() {
  const { instance, inProgress, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null);
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] = React.useState(null);
  const [graphData, setGraphData] = React.useState(null);
  const [graphError, setGraphError] = React.useState(false);
  const [navChildOpen, setNavChildOpen] = React.useState({});
  const [drawerState, setDrawerState] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const isAdmin = useSelector(getAdminStatus);
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
      },
    ],
    [
      {
        title: "Discover",
        icon: Discover,
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
        children: [
          {
            title: "Visualize",
            icon: Visualize,
            link: "analyze/visualize",
            admin: false
          },
          // {
          //   title: "Conflicts",
          //   icon: Conflict,
          //   link: "analyze/conflict",
          //   admin: false
          // }
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
        link: "admin",
        admin: true
      },
    ]
  ];

  // React.useEffect(() => {
  //   let graphTimer = setTimeout(() => {
  //     const request = {
  //       // ...loginRequest,
  //       scopes: ["User.Read"],
  //       account: accounts[0],
  //       forceRefresh: true,
  //     };
  
  //     (async() => {
  //       try {
  //         const response = await instance.acquireTokenSilent(request);
  //         const graphResponse = await callMsGraph(response.accessToken);
  //         await setGraphData(graphResponse);
  //       } catch {
  //         setGraphError(x => !x);
  //       }
  //     })();
  //   }, 5000);

  //   return () => {
  //     clearTimeout(graphTimer);
  //   };
  // }, [graphError]);

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

  // React.useEffect(() => {
  //   const request = {
  //     scopes: ["api://de6cc43c-c275-46fc-9d9e-89b82fa930ec/access_as_user"],
  //     account: accounts[0],
  //   };

  //   (async() => {
  //     const response = await instance.acquireTokenSilent(request);
  //     dispatch(refreshAllAsync(response.accessToken))
  //   })();
  // }, []);

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
                ? <React.Fragment key={`item-${item.title}`}>
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
    return {
      children: `${name.split(" ")[0][0]}${name.split(" ")[1][0]}`,
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
            {/* <Search>
              <SearchIconWrapper>
                <SearchIcon />
              </SearchIconWrapper>
              <StyledInputBase placeholder="Search…" inputProps={{ "aria-label": "search" }} />
            </Search> */}
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
          <Route path="analyze/conflict" element={<AnalyzeTabs />} />
          <Route path="configure" element={<ConfigureIPAM />} />
          <Route path="admin" element={<Administration />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </React.Fragment>
  );
}
