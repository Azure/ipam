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

function renderProgress(params) {
  return (
    <Box sx={{ width: "100%" }}>
      <LinearProgress
        variant="determinate"
        value={params.value <= 100 ? params.value : 100}
        color={
          params.value >= 0 && params.value <= 70
            ? "success"
            : params.value > 70 && params.value < 90
            ? "warning"
            : params.value > 90
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
    idFunc: (row) => row.name
  },
  columns: [
    { field: "name", headerName: "Space Name", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "utilization", headerName: "Utilization", type: 'number', headerAlign: "left", align: "left", flex: 0.5, renderCell: renderProgress },
    { field: "desc", headerName: "Description", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "size", headerName: "Total IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.35 },
    { field: "used", headerName: "Allocated IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.45 },
  ],
  filterSettings: [
    { type: "select", title: "Space Name", dataField: "name" },
    { type: "range", title: "Assigned IP's", dataField: "used", step: 16 }
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
    idFunc: (row) => row.id
  },
  columns: [
    { field: "name", headerName: "Block Name", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "utilization", headerName: "Utilization", type: 'number', headerAlign: "left", align: "left", flex: 0.5, renderCell: renderProgress },
    { field: "parentSpace", headerName: "Space", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "size", headerName: "Total IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.35 },
    { field: "used", headerName: "Allocated IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.45 },
    { field: "cidr", headerName: "CIDR Block", type: 'string', headerAlign: "right", align: "right", flex: 0.75 },
  ],
  filterSettings: [
    { type: "select", title: "Block Name", dataField: "name" },
    { type: "select", title: "Space Name", dataField: "parentSpace" },
    { type: "range", title: "Assigned IP's", dataField: "used", step: 16 }
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
    idFunc: (row) => row.id
  },
  columns: [
    { field: "name", headerName: "vNet Name", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "utilization", headerName: "Utilization", type: 'number', headerAlign: "left", align: "left", flex: 0.5, renderCell: renderProgress },
    { field: "parentBlock", headerName: "Block", type: 'string', headerAlign: "left", align: "left", flex: 0.85, renderCell: (params) => params.value ?? "<Unassigned>" },
    { field: "size", headerName: "Total IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.35 },
    { field: "used", headerName: "Allocated IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.45 },
    { field: "prefixes", headerName: "IP Space", type: 'string', headerAlign: "right", align: "right", flex: 0.75 },
  ],
  filterSettings: [
    { type: "select", title: "vNet Name", dataField: "name" },
    { type: "select", title: "Block Name", dataField: "parentBlock" },
    { type: "select", title: "Resource Group", dataField: "resource_group" },
    { type: "range", title: "Total IP's", dataField: "size", step: 16 }
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
    idFunc: (row) => row.id
  },
  columns: [
    { field: "name", headerName: "Subnet Name", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "utilization", headerName: "Utilization", type: 'number', headerAlign: "left", align: "left", flex: 0.5, renderCell: renderProgress },
    { field: "vnet_name", headerName: "Parent vNet", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "size", headerName: "Total IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.35 },
    { field: "used", headerName: "Assigned IP's", type: 'number', headerAlign: "right", align: "right", flex: 0.45 },
    { field: "prefix", headerName: "IP Space", type: 'string', headerAlign: "right", align: "right", flex: 0.75 },
  ],
  filterSettings: [
    { type: "select", title: "Subnet Name", dataField: "name" },
    { type: "select", title: "vNet Name", dataField: "vnet_name" },
    { type: "select", title: "Resource Group", dataField: "resource_group" },
    { type: "range", title: "Total IP's", dataField: "size", step: 16 }
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
    idFunc: (row) => `${row.id}@$${row.private_ip}`
  },
  columns: [
    { field: "name", headerName: "Endpoint Name", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "vnet_name", headerName: "Parent vNet", type: 'string', headerAlign: "left", align: "left", flex: 0.5 },
    { field: "subnet_name", headerName: "Parent Subnet", type: 'string', headerAlign: "left", align: "left", flex: 0.85 },
    { field: "resource_group", headerName: "Resource Group", type: 'string', headerAlign: "left", align: "left", flex: 0.35 },
    { field: "private_ip", headerName: "Private IP", type: 'string', headerAlign: "right", align: "right", flex: 0.75, valueGetter: (params) => params.value || "N/A" },
  ],
  filterSettings: [
    { type: "select", title: "Resource Group", dataField: "resource_group" },
    { type: "select", title: "vNet Name", dataField: "vnet_name" },
    { type: "select", title: "Subnet Name", dataField: "subnet_name" },
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
