import {
  Box,
  LinearProgress,
} from "@mui/material";

import {
  selectSpaces,
  selectBlocks,
  selectVNets,
  selectSubnets,
  selectEndpoints
} from '../../ipam/ipamSlice';

import NumberFilter from '@inovua/reactdatagrid-community/NumberFilter'

function renderProgress(value) {
  return (
    <Box sx={{ width: "100%" }}>
      <LinearProgress
        variant="determinate"
        value={value <= 100 ? value : 100}
        color={
          value >= 0 && value <= 70
            ? "success"
            : value > 70 && value < 90
            ? "warning"
            : value > 90
            ? "error"
            : null
        }
      />
    </Box>
  );
}

export const spaces = {
  config: {
    title: "Space",
    apiFunc: selectSpaces,
    idProp: "name"
  },
  columns: [
    { name: "name", header: "Space Name", defaultFlex: 0.85 },
    { name: "utilization", header: "Utilization", defaultFlex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value) },
    { name: "desc", header: "Description", defaultFlex: 0.85 },
    { name: "size", header: "Total IP's", defaultFlex: 0.35, filterEditor: NumberFilter },
    { name: "used", header: "Allocated IP's", defaultFlex: 0.45, filterEditor: NumberFilter },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'desc', operator: 'contains', type: 'string', value: '' },
    { name: 'size', operator: 'gte', type: 'number', value: 0 },
    { name: 'used', operator: 'gte', type: 'number', value: 0 }
  ],
  detailsMap: {
    showProgress: true,
    progressTotal: "size",
    progressUsed: "used",
    fieldMap: [
      { name: "Space Name", value: "name" },
      { name: "Description", value: "desc" },
    ],
    showLink: false
  }
};

export const blocks = {
  config: {
    title: "Block",
    apiFunc: selectBlocks,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "Block Name", defaultFlex: 0.85 },
    { name: "utilization", header: "Utilization", defaultFlex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value) },
    { name: "parentSpace", header: "Space", defaultFlex: 0.85 },
    { name: "size", header: "Total IP's", defaultFlex: 0.35 },
    { name: "used", header: "Allocated IP's", defaultFlex: 0.45 },
    { name: "cidr", header: "CIDR Block", defaultFlex: 0.75 },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'parentSpace', operator: 'contains', type: 'string', value: '' },
    { name: 'size', operator: 'gte', type: 'number', value: 0 },
    { name: 'used', operator: 'gte', type: 'number', value: 0 },
    { name: 'cidr', operator: 'contains', type: 'string', value: '' }
  ],
  detailsMap: {
    showProgress: true,
    progressTotal: "size",
    progressUsed: "used",
    fieldMap: [
      { name: "Block Name", value: "name" },
      { name: "Space", value: "parentSpace" },
      { name: "CIDR Block", value: "cidr" }
    ],
    showLink: false
  }
};

export const vnets = {
  config: {
    title: "Virtual Network",
    apiFunc: selectVNets,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "vNet Name", defaultFlex: 0.85 },
    { name: "utilization", header: "Utilization", defaultFlex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value) },
    { name: "parentBlock", header: "Block", defaultFlex: 0.85, render: ({value}) => value ?? "<Unassigned>" },
    { name: "size", header: "Total IP's", defaultFlex: 0.35 },
    { name: "used", header: "Allocated IP's", defaultFlex: 0.45 },
    { name: "prefixes", header: "IP Space", defaultFlex: 0.75, render: ({value}) => value.join(", ") },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'parentBlock', operator: 'contains', type: 'string', value: '' },
    { name: 'size', operator: 'gte', type: 'number', value: 0 },
    { name: 'used', operator: 'gte', type: 'number', value: 0 },
    { name: 'prefixes', operator: 'contains', type: 'string', value: '' }
  ],
  detailsMap: {
    showProgress: true,
    progressTotal: "size",
    progressUsed: "used",
    fieldMap: [
      { name: "vNet Name", value: "name" },
      { name: "Space", value: "parentSpace" },
      { name: "Block", value: "parentBlock" },
      { name: "Address Space", value: "prefixes" },
      { name: "Resource Group", value: "resource_group" },
      { name: "Subscription ID", value: "subscription_id" },
      { name: "Total IP Space", value: "size" },
      { name: "Allocated IP's", value: "used" }
    ],
    showLink: true
  }
};

export const subnets = {
  config: {
    title: "Subnet",
    apiFunc: selectSubnets,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "Subnet Name", defaultFlex: 0.85 },
    { name: "utilization", header: "Utilization", defaultFlex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value) },
    { name: "vnet_name", header: "Parent vNet", defaultFlex: 0.85 },
    { name: "size", header: "Total IP's", defaultFlex: 0.35 },
    { name: "used", header: "Assigned IP's", defaultFlex: 0.45 },
    { name: "prefix", header: "IP Space", defaultFlex: 0.75 },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'vnet_name', operator: 'contains', type: 'string', value: '' },
    { name: 'size', operator: 'gte', type: 'number', value: 0 },
    { name: 'used', operator: 'gte', type: 'number', value: 0 },
    { name: 'prefix', operator: 'contains', type: 'string', value: '' }
  ],
  detailsMap: {
    showProgress: true,
    progressTotal: "size",
    progressUsed: "used",
    fieldMap: [
      { name: "Subnet Name", value: "name" },
      { name: "Parent vNet", value: "vnet_name" },
      { name: "Address Space", value: "prefix" },
      { name: "Subnet Type", value: "type" },
      { name: "Resource Group", value: "resource_group" },
      { name: "Subscription ID", value: "subscription_id" },
      { name: "Total IP Space", value: "size" },
      { name: "Allocated IP's", value: "used" }
    ],
    showLink: true
  }
};

export const endpoints = {
  config: {
    title: "Endpoint",
    apiFunc: selectEndpoints,
    idProp: "uniqueId"
  },
  columns: [
    { name: "name", header: "Endpoint Name", type: 'string', defaultFlex: 0.85 },
    { name: "vnet_name", header: "Parent vNet", type: 'string', defaultFlex: 0.5 },
    { name: "subnet_name", header: "Parent Subnet", type: 'string', defaultFlex: 0.85 },
    { name: "resource_group", header: "Resource Group", type: 'string', defaultFlex: 0.35 },
    { name: "private_ip", header: "Private IP", type: 'string', defaultFlex: 0.75, valueGetter: (params) => params.value || "N/A" },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'vnet_name', operator: 'contains', type: 'string', value: '' },
    { name: 'subnet_name', operator: 'contains', type: 'string', value: '' },
    { name: 'resource_group', operator: 'contains', type: 'string', value: '' },
    { name: 'private_ip', operator: 'contains', type: 'string', value: '' }
  ],
  detailsMap: {
    showProgress: false,
    progressTotal: "",
    progressUsed: "",
    fieldMap: [
      { name: "Endpoint Name", value: "name" },
      { name: "Parent vNet", value: "vnet_name" },
      { name: "Parent Subnet", value: "subnet_name" },
      { name: "Private IP", value: "private_ip" },
      { name: "Public IP", value: "metadata.public_ip" },
      { name: "Resource Group", value: "resource_group" },
      { name: "Subscription ID", value: "subscription_id" },
      { name: "Size", value: "metadata.size" },
      { name: "Private Endpoint Type", value: "metadata.group_id" },
      { name: "VMSS Name", value: "metadata.vmss_name" },
      { name: "VMSS Instance ID", value: "metadata.vmss_vm_num" }
    ],
    showLink: true
  }
};
