import * as React from 'react';
import { Link, useLocation } from "react-router-dom";

import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

import DiscoverTable from '../DiscoverTable/Table';

import {
  spaces,
  blocks,
  vnets,
  vhubs,
  subnets,
  endpoints
} from './config/discoverConfig';

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

export default function DiscoverTabs() {
  const allTabs = ['/discover/space', '/discover/block', '/discover/vnet', '/discover/subnet', '/discover/vhub', '/discover/endpoint'];

  let location = useLocation();

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 64px)'}}>
      <React.Fragment>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={allTabs.indexOf(location.pathname)}>
            <Tab label="Spaces" component={Link} to={allTabs[0]} {...a11yProps(0)} />
            <Tab label="Blocks" component={Link} to={allTabs[1]} {...a11yProps(1)} />
            <Tab label="vNets" component={Link} to={allTabs[2]} {...a11yProps(2)} />
            <Tab label="Subnets" component={Link} to={allTabs[3]} {...a11yProps(3)} />
            <Tab label="vHubs" component={Link} to={allTabs[4]} {...a11yProps(4)} />
            <Tab label="Endpoints" component={Link} to={allTabs[5]} {...a11yProps(5)} />
            {/* <Tab label="Endpoints" component={Link} to={allTabs[5]} state={{id: 'hello'}} {...a11yProps(5)} /> */}
          </Tabs>
        </Box>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={0}><DiscoverTable map={spaces} /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={1}><DiscoverTable map={blocks} /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={2}><DiscoverTable map={vnets} /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={3}><DiscoverTable map={subnets} /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={4}><DiscoverTable map={vhubs} /></TabPanel>
        <TabPanel value={allTabs.indexOf(location.pathname)} index={5}><DiscoverTable map={endpoints} /></TabPanel>
      </React.Fragment>
    </Box>
  );
}
