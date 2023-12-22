import * as React from 'react';

import {
  Box,
  Typography
} from "@mui/material";

import ipamLogo from '../../img/logo/logo.png';

const Welcome = () => {
  return (
    <React.Fragment>
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <img src={ipamLogo} width="35%" height="auto" alt="Welcome to Azure IPAM!"/>
        <Typography variant="h3" gutterBottom component="div">
          Welcome to Azure IPAM!
        </Typography>
      </Box>
    </React.Fragment>
  )
};

export default Welcome;
