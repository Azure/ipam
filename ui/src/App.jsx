import React from 'react';
import { BrowserRouter as Router} from "react-router";
import { useSelector } from 'react-redux';

import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";

import './App.css';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { SnackbarProvider } from 'notistack';

import Slide from '@mui/material/Slide';

import NavDrawer from './features/drawer/drawer';
import AuthHandler from './msal/authHandler';
import { loginRequest } from './msal/authConfig';

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
      <AuthHandler />
      <MsalAuthenticationTemplate
        interactionType={InteractionType.Redirect}
        authenticationRequest={loginRequest}
      >
        <SnackbarProvider
          anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
          }}
          TransitionComponent={Slide}
        >
          <Router>
            <ThemeProvider theme={ipamTheme}>
              <CssBaseline />
              <NavDrawer />
            </ThemeProvider>
          </Router>
        </SnackbarProvider>
      </MsalAuthenticationTemplate>
    </div>
  );
}

export default App;
