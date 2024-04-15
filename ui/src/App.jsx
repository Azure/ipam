import React from 'react';
import { BrowserRouter as Router} from "react-router-dom";
import { useSelector } from 'react-redux';

import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate
} from "@azure/msal-react";

import './App.css';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { SnackbarProvider } from 'notistack';
import { SnackbarUtilsConfigurator } from './utils/snackbar';

import Slide from '@mui/material/Slide';

import Login from "./features/login/login";

import NavDrawer from './features/drawer/drawer';

import {
  getDarkMode
} from "./features/ipam/ipamSlice";

function App() {
  const darkModeSetting = useSelector(getDarkMode);

  const ipamTheme = createTheme({
    palette: {
      mode: darkModeSetting ? 'dark' : 'light',
    },
    components: {
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true
        },
      },
    }
  });

  return (
    <div className="App">
      <AuthenticatedTemplate>
        <SnackbarProvider
          anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
          }}
          TransitionComponent={Slide}
        >
          <SnackbarUtilsConfigurator />
          <Router>
            <ThemeProvider theme={ipamTheme}>
              <CssBaseline />
              <NavDrawer />
            </ThemeProvider>
          </Router>
        </SnackbarProvider>
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </div>
  );
}

export default App;
