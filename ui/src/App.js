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
import Slide from '@mui/material/Slide';

import Login from "./features/login/Login";

import NavDrawer from './features/drawer/drawer';

import {
  getDarkMode
} from "./features/ipam/ipamSlice";

function App() {
  const darkModeSetting = useSelector(getDarkMode);

  const darkTheme = createTheme({
    palette: {
      mode: darkModeSetting ? 'dark' : 'light',
    },
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
          <Router>
            <ThemeProvider theme={darkTheme}>
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
