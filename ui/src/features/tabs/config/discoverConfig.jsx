import {
  selectSpaces,
  selectBlocks,
  selectUpdatedVNets,
  selectUpdatedVHubs,
  selectUpdatedSubnets,
  selectUpdatedEndpoints
} from '../../ipam/ipamSlice';

import InfoCellRenderer from '../../DiscoverTable/Utils/InfoCellRenderer';
import ProgressCellRenderer from '../../DiscoverTable/Utils/ProgressCellRenderer';
import DrillDownCellRenderer from '../../DiscoverTable/Utils/DrillDownCellRenderer';

import { arrayTextMatcher } from '../../../global/grids';

/**
 * Value formatter for N/A fallback on empty values
 */
function naValueFormatter(params) {
  return params.value || "N/A";
}

/**
 * Value getter for a network's flattened parent container fields, which hold an
 * array and fall back to a placeholder when a network sits in no Block.
 */
function containerValueGetter(params) {
  const value = params.data?.[params.colDef.field];

  return value?.length ? value.join(", ") : "<Unassigned>";
}

/**
 * Filter value getter matching containerValueGetter, without the placeholder.
 */
function containerFilterValueGetter(params) {
  return params.data?.[params.colDef.field]?.join(", ") ?? "";
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

// Text filter params for parent container columns, which match per array element
const containerFilterParams = { textMatcher: arrayTextMatcher };

// ============================================================================
// Drill-Down Filters
// A drill-down asks for the children of one specific parent, so each filter
// has to name every field needed to identify that parent uniquely.
// ============================================================================

// A Block name is unique only within its Space.
//
// These two columns are matched independently, so a network sitting in Blocks
// across several Spaces can satisfy the Space from one Block and the name from
// another, and appear under a Block it does not belong to. Pairing them would
// mean a blended Block/Space column that exists only to serve this filter, so
// the extra rows are accepted instead. Note the drill-down icon itself is exact.
const blockChildFilter = [
  { field: 'parent_spaces', valueFrom: 'parent_space' },
  { field: 'parent_blocks', valueFrom: 'name' }
];

// A vNet name is unique only within its resource group and subscription.
const vnetChildFilter = [
  { field: 'vnet_name', valueFrom: 'name' },
  { field: 'resource_group', valueFrom: 'resource_group' },
  { field: 'subscription_id', valueFrom: 'subscription_id' }
];

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
    {
      field: "name",
      headerName: "Space Name",
      flex: 0.85,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          {
            label: 'Blocks',
            path: '/discover/block',
            index: 'blocksBySpace',
            keyFrom: 'name',
            // Space names are unique on their own.
            filter: [{ field: 'parent_space', valueFrom: 'name' }]
          }
        ]
      }
    },
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
    {
      field: "name",
      headerName: "Block Name",
      flex: 0.85,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          { label: 'Virtual Networks', path: '/discover/vnet', index: 'vnetsByBlock', keyFrom: 'id', filter: blockChildFilter },
          { label: 'Virtual Hubs', path: '/discover/vhub', index: 'vhubsByBlock', keyFrom: 'id', filter: blockChildFilter }
        ]
      }
    },
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
    {
      field: "name",
      headerName: "vNet Name",
      flex: 0.85,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          { label: 'Subnets', path: '/discover/subnet', index: 'subnetsByVNet', keyFrom: 'id', filter: vnetChildFilter }
        ]
      }
    },
    {
      field: "utilization",
      headerName: "Utilization",
      flex: 0.5,
      filter: 'agNumberColumnFilter',
      filterParams: utilizationFilterParams,
      cellRenderer: ProgressCellRenderer
    },
    {
      field: "parent_spaces",
      headerName: "Space",
      flex: 0.75,
      valueGetter: containerValueGetter,
      filterValueGetter: containerFilterValueGetter,
      filterParams: containerFilterParams
    },
    {
      field: "parent_blocks",
      headerName: "Block",
      flex: 0.75,
      valueGetter: containerValueGetter,
      filterValueGetter: containerFilterValueGetter,
      filterParams: containerFilterParams
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
      { name: "Space(s)", value: "parent_spaces" },
      { name: "Block(s)", value: "parent_blocks" },
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
    {
      field: "name",
      headerName: "Subnet Name",
      flex: 0.85,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          {
            label: 'Endpoints',
            path: '/discover/endpoint',
            index: 'endpointsBySubnet',
            keyFrom: 'id',
            // An Endpoint carries its own resource group and subscription, not
            // its parent network's, so those cannot narrow this any further.
            filter: [
              { field: 'vnet_name', valueFrom: 'vnet_name' },
              { field: 'subnet_name', valueFrom: 'name' }
            ]
          }
        ]
      }
    },
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
    {
      field: "name",
      headerName: "vHub Name",
      flex: 0.6,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          {
            label: 'Endpoints',
            path: '/discover/endpoint',
            index: 'endpointsByNetwork',
            keyFrom: 'id',
            // Endpoints record a vHub under vnet_name, so this shares a namespace
            // with vNet names and cannot be narrowed any further.
            filter: [{ field: 'vnet_name', valueFrom: 'name' }]
          }
        ]
      }
    },
    { field: "vwan_name", headerName: "Parent vWAN", flex: 0.6 },
    {
      field: "parent_spaces",
      headerName: "Space",
      flex: 0.6,
      valueGetter: containerValueGetter,
      filterValueGetter: containerFilterValueGetter,
      filterParams: containerFilterParams
    },
    {
      field: "parent_blocks",
      headerName: "Block",
      flex: 0.6,
      valueGetter: containerValueGetter,
      filterValueGetter: containerFilterValueGetter,
      filterParams: containerFilterParams
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
      { name: "Space(s)", value: "parent_spaces" },
      { name: "Block(s)", value: "parent_blocks" },
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
      headerName: "Parent Network",
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
      { name: "Parent Network", value: "vnet_name" },
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
