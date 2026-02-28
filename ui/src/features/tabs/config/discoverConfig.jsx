import * as React from "react";

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

// ============================================================================
// Cell Renderers
// ============================================================================

/**
 * Renders a progress bar with color based on utilization percentage
 */
function ProgressCellRenderer(props) {
  const value = props.value;
  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <LinearProgress
        sx={{ width: "100%" }}
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

/**
 * Renders a cell with an info icon tooltip.
 * Uses cellRendererParams for configuration:
 * - condition: function(data) that returns true if info icon should show
 * - message: tooltip text to display
 * - color: text color when condition is true
 */
function InfoCellRenderer(props) {
  const { value, data, colDef } = props;
  const { condition, message, color } = colDef.cellRendererParams || {};

  // Check if condition is met (defaults to false if no condition provided)
  const showInfo = condition ? condition(data) : false;

  if (!showInfo) {
    return value;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        fontStyle: 'italic',
        color: color || 'inherit'
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
          title={message || ''}
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

/**
 * Renders array values as comma-separated string with fallback
 */
function ArrayCellRenderer(props) {
  const { value, colDef } = props;
  const fallback = colDef.cellRendererParams?.fallback ?? "";
  return value?.join(", ") ?? fallback;
}

/**
 * Value formatter for N/A fallback on empty values
 */
function naValueFormatter(params) {
  return params.value || "N/A";
}

// ============================================================================
// Filter Configurations
// ============================================================================

// Number filter params for utilization columns (0-100 range with inRange default)
const utilizationFilterParams = {
  filterOptions: ['inRange', 'equals', 'lessThan', 'greaterThan', 'lessThanOrEqual', 'greaterThanOrEqual'],
  defaultOption: 'inRange',
  inRangeInclusive: true,
};

// Number filter params for count columns (gte 0 default)
const countFilterParams = {
  filterOptions: ['greaterThanOrEqual', 'equals', 'lessThan', 'greaterThan', 'lessThanOrEqual', 'inRange'],
  defaultOption: 'greaterThanOrEqual',
};

// ============================================================================
// Spaces Configuration
// ============================================================================

export const spaces = {
  config: {
    title: "Space",
    setting: "spaces",
    apiFunc: selectSpaces,
    idProp: "name"
  },
  columns: [
    { field: "name", headerName: "Space Name", flex: 0.85 },
    {
      field: "utilization",
      headerName: "Utilization",
      flex: 0.5,
      filter: 'agNumberColumnFilter',
      filterParams: utilizationFilterParams,
      cellRenderer: ProgressCellRenderer
    },
    { field: "desc", headerName: "Description", flex: 1.00 },
    {
      field: "size",
      headerName: "Total IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    {
      field: "used",
      headerName: "Allocated IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
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

// ============================================================================
// Blocks Configuration
// ============================================================================

export const blocks = {
  config: {
    title: "Block",
    setting: "blocks",
    apiFunc: selectBlocks,
    idProp: "id"
  },
  columns: [
    { field: "name", headerName: "Block Name", flex: 0.85 },
    {
      field: "utilization",
      headerName: "Utilization",
      flex: 0.5,
      filter: 'agNumberColumnFilter',
      filterParams: utilizationFilterParams,
      cellRenderer: ProgressCellRenderer
    },
    { field: "parent_space", headerName: "Space", flex: 0.85 },
    {
      field: "size",
      headerName: "Total IP's",
      flex: 0.4,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    {
      field: "used",
      headerName: "Allocated IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    { field: "cidr", headerName: "CIDR Block", flex: 0.50 },
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

// ============================================================================
// Virtual Networks Configuration
// ============================================================================

export const vnets = {
  config: {
    title: "Virtual Network",
    setting: "vnets",
    apiFunc: selectUpdatedVNets,
    idProp: "id"
  },
  columns: [
    { field: "name", headerName: "vNet Name", flex: 0.85 },
    {
      field: "utilization",
      headerName: "Utilization",
      flex: 0.5,
      filter: 'agNumberColumnFilter',
      filterParams: utilizationFilterParams,
      cellRenderer: ProgressCellRenderer
    },
    {
      field: "parent_block",
      headerName: "Block",
      flex: 0.85,
      valueGetter: (params) => {
        const value = params.data?.parent_block;
        return Array.isArray(value) ? value.join(", ") : "<Unassigned>";
      },
      filterValueGetter: (params) => params.data?.parent_block?.join(", ") ?? ""
    },
    { field: "resource_group", headerName: "Resource Group", flex: 0.75, hide: true },
    { field: "subscription_name", headerName: "Subscription Name", flex: 0.85, hide: true },
    { field: "subscription_id", headerName: "Subscription ID", flex: 0.85, hide: true },
    {
      field: "size",
      headerName: "Total IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    {
      field: "used",
      headerName: "Allocated IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    {
      field: "prefixes",
      headerName: "Address Space",
      flex: 0.75,
      valueGetter: (params) => {
        const value = params.data?.prefixes;
        return Array.isArray(value) ? value.join(", ") : "";
      },
      filterValueGetter: (params) => params.data?.prefixes?.join(", ") ?? ""
    }
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

// ============================================================================
// Subnets Configuration
// ============================================================================

export const subnets = {
  config: {
    title: "Subnet",
    setting: "subnets",
    apiFunc: selectUpdatedSubnets,
    idProp: "id"
  },
  columns: [
    { field: "name", headerName: "Subnet Name", flex: 0.85 },
    {
      field: "utilization",
      headerName: "Utilization",
      flex: 0.5,
      filter: 'agNumberColumnFilter',
      filterParams: utilizationFilterParams,
      cellRenderer: ProgressCellRenderer
    },
    { field: "vnet_name", headerName: "Parent vNet", flex: 0.85 },
    { field: "resource_group", headerName: "Resource Group", flex: 0.75, hide: true },
    { field: "subscription_name", headerName: "Subscription Name", flex: 0.75, hide: true },
    { field: "subscription_id", headerName: "Subscription ID", flex: 0.75, hide: true },
    {
      field: "size",
      headerName: "Total IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    {
      field: "used",
      headerName: "Assigned IP's",
      flex: 0.45,
      filter: 'agNumberColumnFilter',
      filterParams: countFilterParams
    },
    { field: "prefix", headerName: "Address Space", flex: 0.50 },
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

// ============================================================================
// Virtual Hubs Configuration
// ============================================================================

export const vhubs = {
  config: {
    title: "Virtual Hub",
    setting: "vhubs",
    apiFunc: selectUpdatedVHubs,
    idProp: "id"
  },
  columns: [
    { field: "name", headerName: "vHub Name", flex: 0.6 },
    { field: "vwan_name", headerName: "Parent vWAN", flex: 0.6 },
    {
      field: "parent_block",
      headerName: "Block",
      flex: 0.75,
      valueGetter: (params) => {
        const value = params.data?.parent_block;
        return Array.isArray(value) ? value.join(", ") : "<Unassigned>";
      },
      filterValueGetter: (params) => params.data?.parent_block?.join(", ") ?? ""
    },
    { field: "subscription_name", headerName: "Subscription Name", flex: 0.75, hide: true },
    { field: "subscription_id", headerName: "Subscription ID", flex: 0.75, hide: true },
    { field: "resource_group", headerName: "Resource Group", flex: 0.75 },
    {
      field: "prefixes",
      headerName: "Address Space",
      flex: 0.35,
      valueGetter: (params) => {
        const value = params.data?.prefixes;
        return Array.isArray(value) ? value.toString() : "";
      },
      filterValueGetter: (params) => params.data?.prefixes?.toString() ?? ""
    }
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

// ============================================================================
// Endpoints Configuration
// ============================================================================

export const endpoints = {
  config: {
    title: "Endpoint",
    setting: "endpoints",
    apiFunc: selectUpdatedEndpoints,
    idProp: "uniqueId"
  },
  columns: [
    {
      field: "name",
      headerName: "Endpoint Name",
      flex: 0.75,
      cellRenderer: InfoCellRenderer,
      cellRendererParams: {
        condition: (data) => data?.metadata?.orphaned,
        message: 'Orphaned Endpoint',
        color: 'red'
      }
    },
    {
      field: "vnet_name",
      headerName: "Parent vNet",
      flex: 0.75,
      valueFormatter: naValueFormatter
    },
    {
      field: "subnet_name",
      headerName: "Parent Subnet",
      flex: 0.75,
      valueFormatter: naValueFormatter
    },
    { field: "resource_group", headerName: "Resource Group", flex: 0.75 },
    { field: "subscription_name", headerName: "Subscription Name", flex: 0.75, hide: true },
    { field: "subscription_id", headerName: "Subscription ID", flex: 0.75, hide: true },
    {
      field: "private_ip",
      headerName: "Private IP",
      flex: 0.35,
      valueFormatter: naValueFormatter
    },
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
