import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import App from './App';
import './index.css';

import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./msal/authConfig";

const container = document.getElementById('root');
const root = createRoot(container);

/**
 * Detect if the app is loaded inside a hidden iframe (e.g. MSAL silent token acquisition).
 * When acquireTokenSilent falls back to an iframe flow, AAD redirects the iframe back to
 * the app's origin. Without this guard the full React app boots inside the iframe and every
 * component that calls acquireTokenSilent triggers a cascading "block_iframe_reload" error.
 * Skipping the render lets MSAL read the iframe hash response without interference.
 */
const isInHiddenIframe = window !== window.parent;

/**
 * MSAL should be instantiated outside of the component tree to prevent it from being re-instantiated on re-renders.
 * For more, visit: https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-react/docs/getting-started.md
 */
export const msalInstance = new PublicClientApplication(msalConfig);

/**
 * Initialize MSAL before rendering the app.
 * This is required for msal-browser v3+ to properly set up the library.
 */
msalInstance.initialize().then(() => {
  // Do not render the full application inside MSAL's hidden iframe.
  if (isInHiddenIframe) {
    return;
  }

  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <Provider store={store}>
          <App />
        </Provider>
      </MsalProvider>
    </React.StrictMode>
  );
});
