import * as React from "react";
import { useSelector } from 'react-redux';
import { useLocation } from "react-router";

import { useTheme } from '@mui/material/styles';

import {
  Box,
  Tooltip,
  IconButton,
  ClickAwayListener,
  Typography
} from "@mui/material";

import {
  ChevronRight
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

import { DataGrid } from "../../global/grids";

import ItemDetails from "./Utils/Details";

import { TableContext } from "./TableContext";

// ============================================================================
// Styles
// ============================================================================

const openStyle = {
  right: 0,
  transition: "all 0.5s ease-in-out",
};

const closedStyle = {
  right: -300,
  transition: "all 0.5s ease-in-out",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a single filter entry to its AG Grid filter model fragment.
 */
function toAgGridFilter(entry) {
  const { name, type, value } = entry;

  if (type === 'number') {
    return {
      [name]: {
        filterType: 'number',
        type: 'equals',
        filter: value
      }
    };
  }

  return {
    [name]: {
      filterType: 'text',
      type: 'contains',
      filter: value
    }
  };
}

/**
 * Maps filter state from location.state to AG Grid filter model format.
 * Accepts a single filter object or an array of filter objects.
 *
 * @param {Object|Array} filterState
 * @returns {Object|null} AG Grid filter model
 */
function mapFilterStateToAgGridModel(filterState) {
  if (!filterState) return null;

  // Array of filters (multi-field drill-down)
  if (Array.isArray(filterState)) {
    if (filterState.length === 0) return null;
    return filterState.reduce((model, entry) => {
      if (entry?.name && entry?.value) {
        Object.assign(model, toAgGridFilter(entry));
      }
      return model;
    }, {});
  }

  // Single filter object (search bar / simple drill-down)
  if (!filterState.name || !filterState.value) return null;
  return toAgGridFilter(filterState);
}

// ============================================================================
// Main Component
// ============================================================================

export default function DiscoverTable(props) {
  const { config, columns, detailsMap } = props.map;

  const [loading, setLoading] = React.useState(true);
  const [rowData, setRowData] = React.useState({});
  const [menuExpand, setMenuExpand] = React.useState(false);

  const stateData = useSelector(config.apiFunc);

  const gridApiRef = React.useRef(null);
  const filterApplied = React.useRef(false);

  const location = useLocation();
  const theme = useTheme();

  // Handle grid ready - store API reference and apply URL-based filter
  const handleGridReady = React.useCallback((params) => {
    gridApiRef.current = params.api;

    // Apply filter from URL state if present and not already applied
    if (location.state && !filterApplied.current) {
      const filterModel = mapFilterStateToAgGridModel(location.state);
      if (filterModel) {
        // Small delay to ensure grid is fully initialized
        setTimeout(() => {
          params.api.setFilterModel(filterModel);
          filterApplied.current = true;
        }, 100);
      }
    }
  }, [location.state]);

  // Reset filter applied flag when location changes
  React.useEffect(() => {
    filterApplied.current = false;

    // Apply new filter if grid is ready
    if (gridApiRef.current && location.state) {
      const filterModel = mapFilterStateToAgGridModel(location.state);
      if (filterModel) {
        gridApiRef.current.setFilterModel(filterModel);
        filterApplied.current = true;
      }
    }
  }, [location.state]);

  // Set loading to false when data is available
  React.useEffect(() => {
    if (stateData) {
      setLoading(false);
    }
  }, [stateData]);

  // Render expand/details button for actions column
  const actionsCellRenderer = React.useCallback((params) => {
    const onClick = (e) => {
      e.stopPropagation();
      setRowData(params.data);
      setMenuExpand(true);
    };

    return (
      <Tooltip title="Details">
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconButton
            color="primary"
            sx={{ padding: 0 }}
            onClick={onClick}
            disableFocusRipple
            disableTouchRipple
            disableRipple
          >
            <ChevronRight />
          </IconButton>
        </span>
      </Tooltip>
    );
  }, []);

  // Render details panel
  function renderDetails() {
    return (
      <ClickAwayListener onClickAway={() => setMenuExpand(false)}>
        <Box
          style={{
            zIndex: 1000,
            position: "fixed",
            display: "flex",
            flexDirection: "row",
            top: 64,
            right: -300,
            height: "calc(100vh - 64px)",
            backgroundColor: "transparent",
            ...menuExpand ? openStyle : closedStyle
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: "300px",
              backgroundColor: theme.palette.background.default,
              borderLeft: "1px solid lightgrey"
            }}
          >
            <ItemDetails title={config.title} map={detailsMap} setExpand={setMenuExpand}/>
          </Box>
        </Box>
      </ClickAwayListener>
    );
  }

  // No rows overlay component
  const NoRowsOverlay = React.useCallback(() => {
    return (
      <React.Fragment>
        <Shrug />
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </React.Fragment>
    );
  }, []);

  return (
    <TableContext.Provider value={{ stateData, rowData, menuExpand }}>
      {renderDetails()}
      <Box sx={{ flexGrow: 1, height: "100%" }}>
        <DataGrid
          viewSettingKey={config.setting}
          rowData={stateData}
          columnDefs={columns}
          idProperty={config.idProp}
          isLoading={loading}
          noRowsOverlay={NoRowsOverlay}
          actionsCellRenderer={actionsCellRenderer}
          onGridReady={handleGridReady}
        />
      </Box>
    </TableContext.Provider>
  );
}
