import * as React from 'react';
import { Link, useLocation } from "react-router-dom";

import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

import Basics from '../configure/basics/basics';
import Associations from '../configure/associations/associations';
import Reservations from '../configure/reservations/reservations';
import Externals from '../configure/externals/externals';

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

export default function ConfigTabs() {
  const allTabs = ['/configure/basics', '/configure/associations', '/configure/reservations', '/configure/externals'];

  let location = useLocation();

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 137px)'}}>
      <React.Fragment>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={allTabs.indexOf(location.pathname)}>
            <Tab label="Basics" component={Link} to={allTabs[0]} {...a11yProps(0)} />
            <Tab label="Associations" component={Link} to={allTabs[1]} {...a11yProps(1)} />
            <Tab label="Reservations" component={Link} to={allTabs[2]} {...a11yProps(2)} />
            <Tab label="Externals" component={Link} to={allTabs[3]} {...a11yProps(3)} />
          </Tabs>
        </Box>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={0}><Basics /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={1}><Associations /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={2}><Reservations /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={3}><Externals /></TabPanel>
      </React.Fragment>
    </Box>
  );
}
