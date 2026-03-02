import {
  selectSpaces,
  selectBlocks,
  selectUpdatedVNets,
  selectUpdatedVHubs,
  selectUpdatedSubnets,
  selectUpdatedEndpoints,
  selectParentSpaceNames,
  selectBlocksWithVNets,
  selectBlocksWithVHubs,
  selectParentVNetNames,
  selectParentSubnetNames,
  selectParentNetworkNames
} from '../../ipam/ipamSlice';

import InfoCellRenderer from '../../DiscoverTable/Utils/InfoCellRenderer';
import ProgressCellRenderer from '../../DiscoverTable/Utils/ProgressCellRenderer';
import DrillDownCellRenderer from '../../DiscoverTable/Utils/DrillDownCellRenderer';

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
    {
      field: "name",
      headerName: "Space Name",
      flex: 0.85,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          { label: 'Blocks', path: '/discover/block', filterField: 'parent_space', hasChildrenSelector: selectParentSpaceNames }
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
          { label: 'Virtual Networks', path: '/discover/vnet', filterField: 'parent_block', hasChildrenSelector: selectBlocksWithVNets },
          { label: 'Virtual Hubs', path: '/discover/vhub', filterField: 'parent_block', hasChildrenSelector: selectBlocksWithVHubs }
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
          { label: 'Subnets', path: '/discover/subnet', filterField: 'vnet_name', hasChildrenSelector: selectParentVNetNames }
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
    {
      field: "name",
      headerName: "Subnet Name",
      flex: 0.85,
      cellRenderer: DrillDownCellRenderer,
      cellRendererParams: {
        targets: [
          { label: 'Endpoints', path: '/discover/endpoint', filterField: 'subnet_name', hasChildrenSelector: selectParentSubnetNames }
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
          { label: 'Endpoints', path: '/discover/endpoint', filterField: 'vnet_name', hasChildrenSelector: selectParentNetworkNames }
        ]
      }
    },
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
