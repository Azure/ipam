import React, { useRef, useMemo, useCallback, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from "@mui/material";
import { SpinnerDotted } from 'spinners-react';

// Register AG Grid modules once at module level
ModuleRegistry.registerModules([AllCommunityModule]);

// ============================================================================
// Combined Overlay Component (AG Grid v35+)
// ============================================================================

// Context for passing reactive overlay config to CombinedOverlay.
// React context changes bypass React.memo, ensuring overlays re-render
// when parent state changes — even when AG Grid itself doesn't propagate
// updated overlayComponentParams to an already-visible overlay.
const OverlayContext = React.createContext(null);

/**
 * CombinedOverlay - Single overlay component for both loading and no-rows states.
 *
 * Reads the consumer-provided noRowsOverlay component from OverlayContext
 * rather than from AG Grid props, so that React context reactivity drives
 * re-renders independently of AG Grid's overlay lifecycle.
 */
const CombinedOverlay = React.memo(({ overlayType }) => {
  const overlayConfig = React.useContext(OverlayContext);
  const NoRowsContent = overlayConfig?.noRowsOverlay;
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (overlayType === 'loading') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 2,
        }}
      >
        <SpinnerDotted
          size={40}
          thickness={100}
          speed={100}
          color={isDarkMode ? '#90caf9' : '#1976d2'}
        />
        <Box
          component="span"
          sx={{
            fontSize: '0.875rem',
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          Loading data...
        </Box>
      </Box>
    );
  }

  // noRows / noMatchingRows
  if (NoRowsContent) {
    return <NoRowsContent />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 2,
      }}
    >
      <Typography variant="overline" display="block" sx={{ mt: 1 }}>
        No data available
      </Typography>
    </Box>
  );
});

CombinedOverlay.displayName = 'CombinedOverlay';

/**
 * ConfigureGrid - A lightweight AG Grid wrapper for simple configuration panels.
 *
 * This component is designed for grids that:
 * - Display simple data without complex filtering
 * - Use click-to-select single row
 * - Have external action menus (not in grid header)
 * - Show custom "no rows" messages
 *
 * Used by: block.jsx, space.jsx
 *
 * For grids that need header menus, view persistence, and filtering,
 * use DataGrid instead.
 *
 * @param {Object} props
 * @param {Array} props.rowData - The data to display in the grid
 * @param {Array} props.columnDefs - Column definitions
 * @param {Function} props.onRowClick - Callback when a row is clicked, receives row data
 * @param {Object} props.selectedRow - Currently selected row (controlled selection)
 * @param {string} props.idProperty - Property to use as row identifier (default: 'name')
 * @param {React.Component} props.noRowsOverlay - Custom no rows overlay component (reactive via OverlayContext)
 * @param {boolean} props.isLoading - Show loading overlay (default: false)
 * @param {Object} props.gridOptions - Additional AG Grid options
 */
const ConfigureGrid = ({
  rowData,
  columnDefs,
  onRowClick,
  selectedRow,
  idProperty = 'name',
  noRowsOverlay = null,
  isLoading = false,
  gridOptions = {},
}) => {
  // Get MUI theme to determine light/dark mode
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const gridRef = useRef(null);

  // Set theme mode on body for AG Grid CSS variables
  useEffect(() => {
    document.body.dataset.agThemeMode = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  // Convert Inovua-style column defs to AG Grid format
  const agColumnDefs = useMemo(() => {
    return columnDefs.map(col => ({
      field: col.name || col.field,
      headerName: col.header || col.headerName,
      flex: col.defaultFlex || col.flex || 1,
      minWidth: col.minWidth,
      maxWidth: col.maxWidth,
      sortable: col.sortable !== false,
      resizable: col.resizable !== false,
      // Disable filtering for simple grids
      filter: false,
      floatingFilter: false,
    }));
  }, [columnDefs]);

  // Default column definition
  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: false,
  }), []);

  // Row selection configuration - single row only
  const rowSelection = useMemo(() => ({
    mode: 'singleRow',
    checkboxes: false,
    enableClickSelection: true,
  }), []);

  // Provide stable row identity so AG Grid preserves scroll position across data updates
  const getRowId = useCallback((params) => {
    return String(params.data[idProperty]);
  }, [idProperty]);

  // Handle row click
  const onRowClicked = useCallback((event) => {
    if (onRowClick) {
      onRowClick(event.data);
    }
  }, [onRowClick]);

  // Sync external selection state with grid
  useEffect(() => {
    const gridApi = gridRef.current?.api;
    if (!gridApi) return;

    // Deselect all first
    gridApi.deselectAll();

    // If there's a selected row, find and select it
    if (selectedRow) {
      gridApi.forEachNode((node) => {
        if (node.data && node.data[idProperty] === selectedRow[idProperty]) {
          node.setSelected(true);
        }
      });
    }
  }, [selectedRow, idProperty, rowData]);

  // Overlay context value — consumed by CombinedOverlay via React context.
  // Context changes bypass React.memo, guaranteeing overlay re-renders
  // when the consumer's noRowsOverlay reference changes.
  const overlayContextValue = useMemo(() => ({
    noRowsOverlay,
  }), [noRowsOverlay]);

  // Grid style
  const gridStyle = useMemo(() => ({
    height: '100%',
    width: '100%',
    fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
  }), []);

  // Create theme with custom parameters.
  // Use withParams() with named color modes for light/dark switching.
  // The data-ag-theme-mode attribute (set in useEffect above) controls which mode is active.
  // See: https://www.ag-grid.com/react-data-grid/theming-colors/#theme-modes
  const gridTheme = useMemo(() => {
    const baseParams = {
      spacing: 7,  // default is 8, reduced for tighter layout
      wrapperBorder: false,
      wrapperBorderRadius: 0
    };

    return themeQuartz
      .withParams({ ...baseParams, modalOverlayBackgroundColor: 'rgba(255, 255, 255, 0.66)' }, 'light')
      .withParams({ ...baseParams, modalOverlayBackgroundColor: 'rgba(0, 0, 0, 0.2)' }, 'dark');
  }, []);

  return (
    <OverlayContext.Provider value={overlayContextValue}>
    <div style={gridStyle} className="ag-theme-quartz">
      <AgGridReact
        ref={gridRef}
        theme={gridTheme}
        rowData={rowData}
        columnDefs={agColumnDefs}
        defaultColDef={defaultColDef}
        rowSelection={rowSelection}
        getRowId={getRowId}
        onRowClicked={onRowClicked}
        accentedSort={true}
        suppressCellFocus={true}
        animateRows={true}
        loading={isLoading}
        overlayComponent={CombinedOverlay}
        // Simplified grid - no advanced features
        suppressMovableColumns={true}
        suppressColumnVirtualisation={true}
        {...gridOptions}
      />
    </div>
    </OverlayContext.Provider>
  );
};

ConfigureGrid.displayName = 'ConfigureGrid';

export default ConfigureGrid;
