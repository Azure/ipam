import React from 'react';
import { BrowserRouter as Router} from "react-router-dom";

import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate
} from "@azure/msal-react";

import './App.css';

import { SnackbarProvider } from 'notistack';
import Slide from '@mui/material/Slide';

import Login from "./features/login/Login";

import NavDrawer from './features/drawer/drawer';

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
            <NavDrawer />
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
