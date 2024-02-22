import * as React from 'react';
import { Link, useLocation } from "react-router-dom";

import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

import Administration from '../admin/admin';
import ManageExclusions from '../exclusions/exclusions';
// import AdminSettings from '../admin/settings';

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
        <Box sx={{ p: 3, height: 'calc(100vh - 113px)' }}>
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

export default function AdminTabs() {
  // const allTabs = ['/admin/admins', '/admin/subscriptions', '/admin/settings'];
  const allTabs = ['/admin/admins', '/admin/subscriptions'];

  let location = useLocation();

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 64px)'}}>
      <React.Fragment>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={allTabs.indexOf(location.pathname)}>
            <Tab label="Admins" component={Link} to={allTabs[0]} {...a11yProps(0)} />
            <Tab label="Subscriptions" component={Link} to={allTabs[1]} {...a11yProps(1)} />
            {/* <Tab label="Settings" component={Link} to={allTabs[2]} {...a11yProps(2)} /> */}
          </Tabs>
        </Box>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={0}><Administration /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={1}><ManageExclusions /></TabPanel>
        {/* <TabPanel value={allTabs.indexOf(location.pathname)} index={2}><AdminSettings /></TabPanel> */}
      </React.Fragment>
    </Box>
  );
}
