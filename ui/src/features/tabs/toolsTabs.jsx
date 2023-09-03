import * as React from 'react';
import { Link, useLocation } from "react-router-dom";

import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

import Planner from '../tools/planner';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: 'calc(100vh - 112px)' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export default function ToolsTabs() {
  const allTabs = ['/tools/planner'];

  let location = useLocation();

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 137px)'}}>
      <React.Fragment>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={allTabs.indexOf(location.pathname)}>
            <Tab label="Planner" component={Link} to={allTabs[0]} {...a11yProps(0)} />
          </Tabs>
        </Box>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={0}><Planner /></TabPanel>
      </React.Fragment>
    </Box>
  );
}
