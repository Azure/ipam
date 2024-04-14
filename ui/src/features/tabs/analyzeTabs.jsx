import * as React from 'react';
import { Link, useLocation } from "react-router-dom";

import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

import Visualize from '../analysis/visualize/visualize';
import Peering from '../analysis/peering/peering';

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

export default function AnalyzeTabs() {
  const allTabs = ['/analyze/visualize', '/analyze/peering'];

  let location = useLocation();

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 64px)'}}>
      <React.Fragment>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={allTabs.indexOf(location.pathname)}>
            <Tab label="Visualize" component={Link} to={allTabs[0]} {...a11yProps(0)} />
            <Tab label="Peering" component={Link} to={allTabs[1]} {...a11yProps(1)} />
          </Tabs>
        </Box>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={0}><Visualize /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={1}><Peering /></TabPanel>
      </React.Fragment>
    </Box>
  );
}
