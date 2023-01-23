import React from 'react';
import { BrowserRouter as Router} from "react-router-dom";

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

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
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
