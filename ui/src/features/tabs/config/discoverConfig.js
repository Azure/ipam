import {
  Box,
  LinearProgress,
  Tooltip
} from "@mui/material";

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import {
  selectSpaces,
  selectBlocks,
  // selectVNets,
  selectUpdatedVNets,
  // selectVHubs,
  selectUpdatedVHubs,
  // selectSubnets,
  selectUpdatedSubnets,
  // selectEndpoints,
  selectUpdatedEndpoints
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
            : value >= 90
            ? "error"
            : "info"
        }
      />
    </Box>
  );
}

function infoCell(value, message, color) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        fontStyle: 'italic',
        color: color
      }}
    >
      {value}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          paddingLeft: '3px',
          height: '30px'
        }}>
        <Tooltip
          arrow
          title={message}
          placement="top"
          PopperProps={{
            popperOptions: {
              modifiers: [
                {
                  name: 'offset',
                  options: {
                    offset: [0, -10]
                  }
                }
              ]
            }
          }}
        >
          <InfoOutlinedIcon
            fontSize="small"
            style={{
              width: '12px'
            }}
          />
        </Tooltip>
      </Box>
    </Box>
  );
}

export const spaces = {
  config: {
    title: "Space",
    setting: "spaces",
    apiFunc: selectSpaces,
    idProp: "name"
  },
  columns: [
    { name: "name", header: "Space Name", type: "string", flex: 0.85, visible: true },
    { name: "utilization", header: "Utilization", type: "number", flex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value), visible: true },
    { name: "desc", header: "Description", type: "string", flex: 1.00, visible: true },
    { name: "size", header: "Total IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
    { name: "used", header: "Allocated IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
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
    setting: "blocks",
    apiFunc: selectBlocks,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "Block Name", type: "string", flex: 0.85, visible: true },
    { name: "utilization", header: "Utilization", type: "number", flex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value), visible: true },
    { name: "parent_space", header: "Space", type: "string", flex: 0.85, visible: true },
    { name: "size", header: "Total IP's", type: "number", flex: 0.4, filterEditor: NumberFilter, visible: true },
    { name: "used", header: "Allocated IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
    { name: "cidr", header: "CIDR Block", type: "string", flex: 0.50, visible: true },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'parent_space', operator: 'contains', type: 'string', value: '' },
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
      { name: "Space", value: "parent_space" },
      { name: "CIDR Block", value: "cidr" }
    ],
    showLink: false
  }
};

export const vnets = {
  config: {
    title: "Virtual Network",
    setting: "vnets",
    apiFunc: selectUpdatedVNets,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "vNet Name", type: "string", flex: 0.85, visible: true },
    { name: "utilization", header: "Utilization", type: "number", flex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value), visible: true },
    { name: "parent_block", header: "Block", type: "array", flex: 0.85, render: ({value}) => value?.join(", ") ?? "<Unassigned>", visible: true },
    { name: "resource_group", header: "Resource Group", type: "string", flex: 0.75, visible: false },
    { name: "subscription_name", header: "Subscription Name", type: "string", flex: 0.85, visible: false },
    { name: "subscription_id", header: "Subscription ID", type: "string", flex: 0.85, visible: false },
    { name: "size", header: "Total IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
    { name: "used", header: "Allocated IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
    { name: "prefixes", header: "Address Space", type: "array", flex: 0.75, render: ({value}) => value.join(", "), visible: true }
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'parent_block', operator: 'contains', type: 'array', value: '' },
    { name: 'resource_group', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_name', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_id', operator: 'contains', type: 'string', value: '' },
    { name: 'size', operator: 'gte', type: 'number', value: 0 },
    { name: 'used', operator: 'gte', type: 'number', value: 0 },
    { name: 'prefixes', operator: 'contains', type: 'array', value: '' }
  ],
  detailsMap: {
    showProgress: true,
    progressTotal: "size",
    progressUsed: "used",
    fieldMap: [
      { name: "vNet Name", value: "name" },
      { name: "Space", value: "parent_space" },
      { name: "Block(s)", value: "parent_block" },
      { name: "Address Space", value: "prefixes" },
      { name: "Resource Group", value: "resource_group" },
      { name: "Subscription Name", value: "subscription_name" },
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
    setting: "subnets",
    apiFunc: selectUpdatedSubnets,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "Subnet Name", type: "String", flex: 0.85, visible: true },
    { name: "utilization", header: "Utilization", type: "number", flex: 0.5, filterEditor: NumberFilter, render: ({value}) => renderProgress(value), visible: true },
    { name: "vnet_name", header: "Parent vNet", type: "string", flex: 0.85, visible: true },
    { name: "resource_group", header: "Resource Group", type: "string", flex: 0.75, visible: false },
    { name: "subscription_name", header: "Subscription Name", type: "string", flex: 0.75, visible: false },
    { name: "subscription_id", header: "Subscription ID", type: "String", flex: 0.75, visible: false },
    { name: "size", header: "Total IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
    { name: "used", header: "Assigned IP's", type: "number", flex: 0.45, filterEditor: NumberFilter, visible: true },
    { name: "prefix", header: "Address Space", type: "string", flex: 0.50, visible: true },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'utilization', operator: 'inrange', type: 'number', value: { start: 0, end: 100 } },
    { name: 'vnet_name', operator: 'contains', type: 'string', value: '' },
    { name: 'resource_group', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_name', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_id', operator: 'contains', type: 'string', value: '' },
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
      { name: "Subscription Name", value: "subscription_name" },
      { name: "Subscription ID", value: "subscription_id" },
      { name: "Total IP Space", value: "size" },
      { name: "Allocated IP's", value: "used" }
    ],
    showLink: true
  }
};

export const vhubs = {
  config: {
    title: "Virtual Hub",
    setting: "vhubs",
    apiFunc: selectUpdatedVHubs,
    idProp: "id"
  },
  columns: [
    { name: "name", header: "vNet Name", type: "string", flex: 0.6, visible: true },
    { name: "vwan_name", header: "Parent vWAN", type: "string", flex: 0.6, visible: true },
    { name: "parent_block", header: "Block", type: "array", flex: 0.75, render: ({value}) => value?.join(", ") ?? "<Unassigned>", visible: true },
    { name: "subscription_name", header: "Subscription Name", type: "string", flex: 0.75, visible: false },
    { name: "subscription_id", header: "Subscription ID", type: "string", flex: 0.75, visible: false },
    { name: "resource_group", header: "Resource Group", type: "string", flex: 0.75, visible: true },
    { name: "prefixes", header: "Address Space", type: "array", flex: 0.35, render: ({value}) => value.toString(), visible: true }
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'vwan_name', operator: 'contains', type: 'string', value: '' },
    { name: 'parent_block', operator: 'contains', type: 'array', value: '' },
    { name: 'subscription_name', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_id', operator: 'contains', type: 'string', value: '' },
    { name: 'resource_group', operator: 'contains', type: 'string', value: '' },
    { name: 'prefixes', operator: 'contains', type: 'array', value: '' }
  ],
  detailsMap: {
    showProgress: false,
    progressTotal: "",
    progressUsed: "",
    fieldMap: [
      { name: "vHub Name", value: "name" },
      { name: "vWAN Name", value: "vwan_name" },
      { name: "Space", value: "parent_space" },
      { name: "Block(s)", value: "parent_block" },
      { name: "Address Space", value: "prefixes" },
      { name: "Resource Group", value: "resource_group" },
      { name: "Subscription Name", value: "subscription_name" },
      { name: "Subscription ID", value: "subscription_id" },
    ],
    showLink: true
  }
};

export const endpoints = {
  config: {
    title: "Endpoint",
    setting: "endpoints",
    apiFunc: selectUpdatedEndpoints,
    idProp: "uniqueId"
  },
  columns: [
    { name: "name", header: "Endpoint Name", type: "string", flex: 0.75, render: ({value, data}) => data.metadata?.orphaned ? infoCell(value, 'Orphaned Endpoint', 'red') : value, visible: true },
    { name: "vnet_name", header: "Parent vNet", type: "string", flex: 0.75, render: ({value}) => value || "N/A", visible: true },
    { name: "subnet_name", header: "Parent Subnet", type: "string", flex: 0.75, render: ({value}) => value || "N/A", visible: true },
    { name: "resource_group", header: "Resource Group", type: "string", flex: 0.75, visible: true },
    { name: "subscription_name", header: "Subscription Name", type: "string", flex: 0.75, visible: false },
    { name: "subscription_id", header: "Subscription ID", type: "string", flex: 0.75, visible: false },
    { name: "private_ip", header: "Private IP", type: "string", flex: 0.35, render: ({value}) => value || "N/A", visible: true },
  ],
  filterSettings: [
    { name: 'name', operator: 'contains', type: 'string', value: '' },
    { name: 'vnet_name', operator: 'contains', type: 'string', value: '' },
    { name: 'subnet_name', operator: 'contains', type: 'string', value: '' },
    { name: 'resource_group', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_name', operator: 'contains', type: 'string', value: '' },
    { name: 'subscription_id', operator: 'contains', type: 'string', value: '' },
    { name: 'private_ip', operator: 'contains', type: 'string', value: '' }
  ],
  detailsMap: {
    showProgress: false,
    progressTotal: "",
    progressUsed: "",
    fieldMap: [
      { name: "Endpoint Name", value: "name" },
      { name: "Kind", value: "metadata.kind" },
      { name: "Type", value: "metadata.type" },
      { name: "Parent vNet", value: "vnet_name" },
      { name: "Parent Subnet", value: "subnet_name" },
      { name: "Private IP", value: "private_ip" },
      { name: "Public IP", value: "metadata.public_ip" },
      { name: "Resource Group", value: "resource_group" },
      { name: "Subscription Name", value: "subscription_name" },
      { name: "Subscription ID", value: "subscription_id" },
      { name: "Size", value: "metadata.size" },
      { name: "Private Endpoint Type", value: "metadata.group_id" },
      { name: "VMSS Name", value: "metadata.vmss_name" },
      { name: "VMSS Instance ID", value: "metadata.vmss_vm_num" },
      { name: "Orphaned", value: "metadata.orphaned" }
    ],
    showLink: true
  }
};
