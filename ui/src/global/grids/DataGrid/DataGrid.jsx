import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { isEmpty, sortBy, compact, map, filter, find } from 'lodash';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  CircularProgress,
  Divider,
  Typography,
} from "@mui/material";
import {
  TaskAltOutlined,
  CancelOutlined,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  ViewColumnOutlined,
  ChevronRightOutlined,
  CheckOutlined,
  FilterListOffOutlined
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { SpinnerDotted } from 'spinners-react';

import { DataGridContext } from './DataGridContext';
import {
  selectViewSetting,
  updateMeAsync,
} from '../../../features/ipam/ipamSlice';

// Register AG Grid modules once at module level
ModuleRegistry.registerModules([AllCommunityModule]);

// Constants
const ACTIONS_COLUMN_FIELD = 'actions';
const DEFAULT_VIEW_SETTING_KEY = 'defaultGrid';
const MENU_CLOSE_DELAY = 0;
const SUCCESS_INDICATOR_TIMEOUT = 3000;

// ============================================================================
// Column Visibility Menu Component
// ============================================================================
const ColumnVisibilityMenu = React.memo(({ anchorEl, open, onClose }) => {
  const { columnDefs, toggleColumnVisibility, getVisibleColumns, gridRef } = React.useContext(DataGridContext);
  const [visibleColumns, setVisibleColumns] = useState([]);

  // Update visible columns when menu opens
  useEffect(() => {
    if (open) {
      setVisibleColumns(getVisibleColumns());
    }
  }, [open, getVisibleColumns]);

  // Get columns in their current grid order
  const getColumnsInGridOrder = useCallback(() => {
    if (!gridRef?.current?.api) {
      return filter(columnDefs, col => col.field !== ACTIONS_COLUMN_FIELD);
    }

    try {
      const columnState = gridRef.current.api.getColumnState();
      if (!columnState) return filter(columnDefs, col => col.field !== ACTIONS_COLUMN_FIELD);

      const dataColumnsInOrder = compact(
        map(
          sortBy(filter(columnState, state => state.colId !== ACTIONS_COLUMN_FIELD), 'sort'),
          state => find(columnDefs, def => def.field === state.colId)
        )
      );

      return dataColumnsInOrder.length > 0
        ? dataColumnsInOrder
        : filter(columnDefs, col => col.field !== ACTIONS_COLUMN_FIELD);
    } catch (error) {
      console.warn('Error getting column order:', error);
      return filter(columnDefs, col => col.field !== ACTIONS_COLUMN_FIELD);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnDefs]);

  const dataColumns = useMemo(() => getColumnsInGridOrder(), [getColumnsInGridOrder]);

  const handleColumnToggle = useCallback((field) => {
    toggleColumnVisibility(field);
    setTimeout(() => setVisibleColumns(getVisibleColumns()), MENU_CLOSE_DELAY);
  }, [toggleColumnVisibility, getVisibleColumns]);

  if (!open) return null;

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      slotProps={{
        paper: {
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 0,
            minWidth: 200,
          },
        },
      }}
    >
      {dataColumns.map((col) => (
        <MenuItem
          key={col.field}
          onClick={() => handleColumnToggle(col.field)}
          sx={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 'auto',
              marginRight: 1,
              visibility: visibleColumns.includes(col.field) ? 'visible' : 'hidden'
            }}
          >
            <CheckOutlined fontSize="small" color="primary" />
          </ListItemIcon>
          <Box
            component="span"
            sx={{
              fontSize: '0.875rem',
              textTransform: 'capitalize'
            }}
          >
            {col.headerName || col.field}
          </Box>
        </MenuItem>
      ))}
    </Menu>
  );
});

ColumnVisibilityMenu.displayName = 'ColumnVisibilityMenu';

// ============================================================================
// Header Menu Placeholder Component (renders icon in grid header)
// ============================================================================
const HeaderMenuPlaceholder = React.memo(() => {
  const { saving, sendResults, menuOpen, setMenuOpen, setMenuAnchor } = React.useContext(DataGridContext);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      setMenuAnchor(containerRef.current);
    }
  }, [setMenuAnchor]);

  const handleClick = useCallback((event) => {
    if (!saving && sendResults === null) {
      event.stopPropagation();
      setMenuOpen(prev => !prev);
    }
  }, [setMenuOpen, saving, sendResults]);

  const handleKeyDown = useCallback((event) => {
    if (saving || sendResults !== null) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(prev => !prev);
    }
  }, [saving, sendResults, setMenuOpen]);

  return (
    <Box
      ref={containerRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
        cursor: (!saving && sendResults === null) ? "pointer" : "default",
      }}
      role="button"
      tabIndex={0}
      aria-haspopup="menu"
      aria-expanded={menuOpen ? 'true' : 'false'}
      aria-controls="table-state-menu"
    >
      {saving && <CircularProgress size={20} />}
      {sendResults !== null && !saving && (
        sendResults ? <TaskAltOutlined color="success" /> : <CancelOutlined color="error" />
      )}
      {!saving && sendResults === null && <ExpandCircleDownOutlined />}
    </Box>
  );
});

HeaderMenuPlaceholder.displayName = 'HeaderMenuPlaceholder';

// ============================================================================
// Standalone Header Menu Component (outside of AG Grid)
// ============================================================================
const StandaloneHeaderMenu = React.memo(({ viewSettingKey = DEFAULT_VIEW_SETTING_KEY, extraMenuItems = [] }) => {
  const {
    saveConfig,
    loadConfig,
    resetConfig,
    gridRef,
    menuOpen,
    setMenuOpen,
    menuAnchor,
    viewSetting
  } = React.useContext(DataGridContext);

  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);

  const handleMenuToggle = useCallback(() => {
    setMenuOpen(prev => !prev);
  }, [setMenuOpen]);

  const handleMenuAction = useCallback((action) => {
    action();
    setMenuOpen(false);
  }, [setMenuOpen]);

  const handleExtraMenuItemClick = useCallback((item) => {
    if (item.onClick) {
      item.onClick();
    }
    if (item.closeMenuAfterClick !== false) {
      setMenuOpen(false);
    }
  }, [setMenuOpen]);

  const handleClearFilters = useCallback(() => {
    if (gridRef?.current?.api) {
      gridRef.current.api.setFilterModel(null);
    }
    setMenuOpen(false);
  }, [gridRef, setMenuOpen]);

  const handleColumnMenuOpen = useCallback((event) => {
    event.stopPropagation();
    setColumnMenuAnchor(event.currentTarget);
    setColumnMenuOpen(true);
  }, []);

  const handleColumnMenuClose = useCallback(() => {
    setColumnMenuOpen(false);
    setColumnMenuAnchor(null);
  }, []);

  const generateMenuKey = useCallback((item, index) => {
    return item.key || `extra-menu-item-${index}`;
  }, []);

  if (!menuAnchor) return null;

  return (
    <>
      <Menu
        id="table-state-menu"
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuToggle}
        disableAutoFocusItem
        MenuListProps={{
          'aria-label': 'Table settings menu',
          disableListWrap: true,
          autoFocusItem: true,
          onKeyDown: (e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              handleMenuToggle();
            }
          }
        }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              '&::before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 28,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          },
        }}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        {/* Extra menu items passed from parent */}
        {extraMenuItems.map((item, index) => (
          <MenuItem
            key={generateMenuKey(item, index)}
            onClick={() => handleExtraMenuItemClick(item)}
            disabled={item.disabled}
          >
            {item.icon && (
              <ListItemIcon>
                <item.icon fontSize="small" />
              </ListItemIcon>
            )}
            {item.label}
          </MenuItem>
        ))}

        {extraMenuItems.length > 0 && <Divider />}

        <MenuItem
          onClick={() => handleMenuAction(loadConfig)}
          disabled={!viewSetting || isEmpty(viewSetting)}
        >
          <ListItemIcon>
            <FileDownloadOutlined fontSize="small" />
          </ListItemIcon>
          Load Saved View
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction(saveConfig)}>
          <ListItemIcon>
            <FileUploadOutlined fontSize="small" />
          </ListItemIcon>
          Save Current View
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction(resetConfig)}>
          <ListItemIcon>
            <ReplayOutlined fontSize="small" />
          </ListItemIcon>
          Reset Default View
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleClearFilters}>
          <ListItemIcon>
            <FilterListOffOutlined fontSize="small" />
          </ListItemIcon>
          Clear All Filters
        </MenuItem>

        <MenuItem onClick={handleColumnMenuOpen}>
          <ListItemIcon>
            <ViewColumnOutlined fontSize="small" />
          </ListItemIcon>
          Manage Columns
          <ChevronRightOutlined
            fontSize="small"
            sx={{ marginLeft: 'auto', marginRight: '-8px' }}
          />
        </MenuItem>
      </Menu>

      <ColumnVisibilityMenu
        anchorEl={columnMenuAnchor}
        open={columnMenuOpen}
        onClose={handleColumnMenuClose}
      />
    </>
  );
});

StandaloneHeaderMenu.displayName = 'StandaloneHeaderMenu';

// ============================================================================
// Custom Loading Overlay Component
// ============================================================================
const CustomLoadingOverlay = React.memo(() => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

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
});

CustomLoadingOverlay.displayName = 'CustomLoadingOverlay';

// ============================================================================
// Main DataGrid Component
// ============================================================================
/**
 * DataGrid - A full-featured AG Grid wrapper component for IPAM.
 *
 * This component provides a standardized grid with:
 * - Header dropdown menu with custom actions
 * - Column visibility management
 * - Save/Load/Reset view configuration (persisted via Redux)
 * - Dark/Light theme support
 * - Single and multi-row selection
 * - Loading overlay
 * - Copy-on-double-click (enabled by default)
 *
 * @param {string} props.viewSettingKey - Required. Unique identifier for view persistence (e.g., 'networks', 'spaces').
 * @param {Array} props.rowData - The data to display in the grid
 * @param {Array} props.columnDefs - Column definitions
 * @param {Function} props.onRowSelectionChanged - Callback when selection changes (receives array for multiSelect, single row otherwise)
 * @param {boolean} props.multiSelect - Enable multi-row selection (default: false)
 * @param {boolean} props.checkboxSelect - Show checkboxes and only allow selection via checkbox click (default: false)
 * @param {Array} props.extraMenuItems - Additional menu items for the header dropdown
 * @param {Array} props.initialSelectedRows - Rows to select initially
 * @param {Object} props.rowClassRules - AG Grid row class rules for conditional row styling
 * @param {boolean} props.isLoading - Show loading overlay (default: false)
 * @param {React.Component} props.noRowsOverlayComponent - Custom component to display when grid has no rows
 * @param {string} props.noRowsOverlayText - Text for default no rows overlay
 * @param {boolean} props.copyOnDoubleClick - Copy cell value to clipboard on double-click (default: true)
 * @param {string} props.idProperty - Property to use as row ID (default: 'id')
 * @param {boolean} props.noBorder - Remove grid wrapper border (default: false) - useful when grid is inside a bordered container
 * @param {Function} props.actionsCellRenderer - Custom cell renderer for the actions column (receives params object)
 * @param {Function} props.onRowClicked - Custom row click handler (receives event object) - overrides default single-select toggle
 * @param {Function} props.onGridReady - Callback when grid is ready, receives { api, columnApi } for programmatic control
 */
const DataGrid = ({
  rowData,
  columnDefs,
  viewSettingKey = DEFAULT_VIEW_SETTING_KEY,
  onRowSelectionChanged,
  multiSelect = false,
  checkboxSelect = false,
  extraMenuItems = [],
  initialSelectedRows = [],
  rowClassRules = {},
  isLoading = false,
  noRowsOverlayComponent,
  noRowsOverlayText,
  copyOnDoubleClick = true,
  idProperty = 'id',
  noBorder = false,
  actionsCellRenderer = null,
  onRowClicked = null,
  onGridReady: onGridReadyProp = null,
}) => {
  // Get MUI theme to determine light/dark mode
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();

  // Get view settings from Redux store
  const viewSetting = useSelector(state => selectViewSetting(state, viewSettingKey));

  // Set theme mode on body for AG Grid CSS variables
  useEffect(() => {
    document.body.dataset.agThemeMode = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  // Create theme with optional border removal and compactness
  const gridTheme = useMemo(() => {
    const baseParams = {
      spacing: 7,  // default is 8, reduced for tighter layout
      ...(noBorder ? { wrapperBorder: false, wrapperBorderRadius: 0 } : {})
    };

    return themeQuartz
      .withParams({ ...baseParams, modalOverlayBackgroundColor: 'rgba(255, 255, 255, 0.66)' }, 'light')
      .withParams({ ...baseParams, modalOverlayBackgroundColor: 'rgba(0, 0, 0, 0.2)' }, 'dark');
  }, [noBorder]);

  // Resolve no-rows overlay: use provided component, or fall back to a default
  const NoRowsOverlay = useMemo(() => {
    if (noRowsOverlayComponent) {
      return noRowsOverlayComponent;
    }

    return () => (
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
          {noRowsOverlayText || 'No data available'}
        </Typography>
      </Box>
    );
  }, [noRowsOverlayComponent, noRowsOverlayText]);

  // Overlay component selector (replaces legacy loadingOverlayComponent / noRowsOverlayComponent)
  const overlayComponentSelector = useCallback((params) => {
    if (params.overlayType === 'loading') {
      return { component: CustomLoadingOverlay };
    }
    if (params.overlayType === 'noRows' || params.overlayType === 'noMatchingRows') {
      return { component: NoRowsOverlay };
    }
    return undefined;
  }, [NoRowsOverlay]);

  // Component state
  const [saving, setSaving] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const gridRef = useRef(null);
  const initialSelectionApplied = useRef(false);

  // Memoized column definitions with actions column appended
  const colDefs = useMemo(() => {
    const actionsColumn = {
      field: ACTIONS_COLUMN_FIELD,
      headerName: "",
      width: 50,
      minWidth: 50,
      maxWidth: 50,
      sortable: false,
      filter: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      suppressSizeToFit: true,
      suppressAutoSize: true,
      resizable: false,
      suppressColumnsToolPanel: true,
      headerComponent: HeaderMenuPlaceholder,
      cellRenderer: actionsCellRenderer || (() => ''),
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    };

    return [...columnDefs, actionsColumn];
  }, [columnDefs, actionsCellRenderer]);

  // Helper function to get data column fields (excluding actions)
  const getDataColumnFields = useCallback(() => {
    return map(filter(colDefs, col => col.field !== ACTIONS_COLUMN_FIELD), 'field');
  }, [colDefs]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((field) => {
    const gridApi = gridRef.current?.api;
    if (!gridApi) return;

    const column = gridApi.getColumn(field);
    if (!column) return;

    const isVisible = column.isVisible();
    const dataColumnFields = getDataColumnFields();
    const visibleDataColumns = filter(dataColumnFields, colField => {
      const col = gridApi.getColumn(colField);
      return col?.isVisible();
    });

    // Prevent hiding the last visible column
    if (isVisible && visibleDataColumns.length === 1) {
      return;
    }

    gridApi.setColumnsVisible([field], !isVisible);
  }, [getDataColumnFields]);

  // Get list of currently visible columns
  const getVisibleColumns = useCallback(() => {
    const gridApi = gridRef.current?.api;
    if (!gridApi) return getDataColumnFields();

    const dataColumnFields = getDataColumnFields();
    return filter(dataColumnFields, field => {
      const column = gridApi.getColumn(field);
      return column?.isVisible();
    });
  }, [getDataColumnFields]);

  // ============================================================================
  // Config Management Functions
  // ============================================================================

  const saveConfig = useCallback(async () => {
    setSaving(true);

    const gridApi = gridRef.current?.api;
    if (gridApi) {
      try {
        const columnState = gridApi.getColumnState();

        // Filter out system columns from saved state (actions and selection columns)
        const filteredColumnState = columnState.filter(col =>
          col.colId !== ACTIONS_COLUMN_FIELD &&
          !col.colId.startsWith('ag-Grid-')
        );

        // Build save payload
        const saveData = {
          columnState: filteredColumnState,
        };

        const body = [
          { "op": "add", "path": `/views/${viewSettingKey}`, "value": saveData }
        ];

        await dispatch(updateMeAsync({ body }));
        setSendResults(true);
      } catch (error) {
        console.error('Error saving config:', error);
        setSendResults(false);
      } finally {
        setSaving(false);
        setTimeout(() => setSendResults(null), SUCCESS_INDICATOR_TIMEOUT);
      }
      return;
    }

    // Fallback if no grid API
    setSaving(false);
    setSendResults(false);
    setTimeout(() => setSendResults(null), SUCCESS_INDICATOR_TIMEOUT);
  }, [dispatch, viewSettingKey]);

  const loadConfig = useCallback(() => {
    setSaving(true);

    const gridApi = gridRef.current?.api;

    // Check if viewSetting exists and has the expected AG Grid format
    if (gridApi && viewSetting) {
      try {
        // Handle new AG Grid format
        if (viewSetting.columnState) {
          gridApi.applyColumnState({
            state: viewSetting.columnState,
            applyOrder: true,
          });
        }

        setSendResults(true);
      } catch (error) {
        console.error('Error loading config:', error);
        // Gracefully handle old format - just ignore and reset
        console.warn('View settings may be in old format, ignoring...');
        setSendResults(false);
      }
    } else {
      setSendResults(false);
    }

    setSaving(false);
    setTimeout(() => setSendResults(null), SUCCESS_INDICATOR_TIMEOUT);
  }, [viewSetting]);

  const resetConfig = useCallback(() => {
    setSaving(true);

    const gridApi = gridRef.current?.api;
    if (gridApi) {
      try {
        // Build default column state respecting original column definitions
        const defaultColumnState = map(
          filter(colDefs, col => col.field !== ACTIONS_COLUMN_FIELD),
          (colDef) => ({
            colId: colDef.field,
            hide: colDef.hide === true, // Respect the hide property from column definition
            width: colDef.width || null,
            flex: colDef.flex !== undefined ? colDef.flex : 1,
            sort: colDef.sort || null,
            sortIndex: colDef.sortIndex || null,
            aggFunc: null,
            pivot: false,
            pivotIndex: null,
            pinned: colDef.pinned || null,
            rowGroup: false,
            rowGroupIndex: null
          })
        );

        gridApi.applyColumnState({
          state: defaultColumnState,
          applyOrder: true,
          defaultState: { sort: null, sortIndex: null }
        });

        gridApi.setFilterModel(null);

        setSendResults(true);
      } catch (error) {
        console.error('Error during reset:', error);
        setSendResults(false);
      }
    }

    setSaving(false);
    setTimeout(() => setSendResults(null), SUCCESS_INDICATOR_TIMEOUT);
  }, [colDefs]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const gridContextValue = useMemo(() => ({
    saving,
    sendResults,
    columnDefs: filter(colDefs, col => col.field !== ACTIONS_COLUMN_FIELD),
    toggleColumnVisibility,
    getVisibleColumns,
    saveConfig,
    loadConfig,
    resetConfig,
    gridRef,
    menuOpen,
    setMenuOpen,
    menuAnchor,
    setMenuAnchor,
    viewSetting,
  }), [
    saving,
    sendResults,
    colDefs,
    toggleColumnVisibility,
    getVisibleColumns,
    saveConfig,
    loadConfig,
    resetConfig,
    menuOpen,
    menuAnchor,
    viewSetting,
  ]);

  // ============================================================================
  // Grid Configuration
  // ============================================================================

  const defaultColDef = useMemo(() => ({
    initialFlex: 1,
    resizable: true,
    filter: true,
    floatingFilter: true,
  }), []);

  const rowSelection = useMemo(() => ({
    mode: multiSelect ? 'multiRow' : 'singleRow',
    checkboxes: checkboxSelect,
    // For single-select, we handle click selection manually to support toggle behavior
    enableClickSelection: multiSelect ? !checkboxSelect : false,
    headerCheckbox: checkboxSelect && multiSelect,
  }), [multiSelect, checkboxSelect]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const onColumnMoved = useCallback(() => {
    // Column move logic can be added here if needed
  }, []);

  const onColumnResized = useCallback((params) => {
    if (!params.finished) return;

    setTimeout(() => {
      const gridApi = gridRef.current?.api;
      if (!gridApi) return;

      const currentState = gridApi.getColumnState();
      const hasFlexColumns = currentState.some(col =>
        col.colId !== ACTIONS_COLUMN_FIELD && !col.hide && col.flex > 0
      );

      // Ensure at least one column has flex to fill remaining space
      if (!hasFlexColumns) {
        const visibleDataColumns = filter(currentState, col =>
          col.colId !== ACTIONS_COLUMN_FIELD && !col.hide
        );

        if (visibleDataColumns.length > 0) {
          const lastDataColumn = visibleDataColumns[visibleDataColumns.length - 1];
          const updatedState = map(currentState, col => ({
            ...col,
            flex: col.colId === lastDataColumn.colId ? 1 : null,
            width: null
          }));

          gridApi.applyColumnState({
            state: updatedState,
            applyOrder: false
          });
        }
      }
    }, MENU_CLOSE_DELAY);
  }, []);

  // Initial row selection handling
  const initialRowSelection = useMemo(() => {
    if (!initialSelectedRows || initialSelectedRows.length === 0) {
      return {};
    }

    return initialSelectedRows.reduce((acc, row) => {
      const rowId = row[idProperty];
      if (rowId !== undefined && rowId !== null) {
        acc[rowId] = true;
      }
      return acc;
    }, {});
  }, [initialSelectedRows, idProperty]);

  // Track if view settings have been applied
  const viewSettingsApplied = useRef(false);

  const onGridReady = useCallback((params) => {
    const { api } = params;

    // Apply saved view settings when grid is ready
    if (viewSetting && viewSetting.columnState && !viewSettingsApplied.current) {
      try {
        api.applyColumnState({
          state: viewSetting.columnState,
          applyOrder: true,
        });

        viewSettingsApplied.current = true;
      } catch (error) {
        console.error('Error applying saved view settings:', error);
      }
    }

    // Apply initial selection when grid is ready and has data
    if (Object.keys(initialRowSelection).length > 0 && !initialSelectionApplied.current) {
      requestAnimationFrame(() => {
        api.deselectAll();

        api.forEachNode((node) => {
          const rowId = node.data?.[idProperty];
          if (rowId !== undefined && rowId !== null && initialRowSelection[rowId]) {
            node.setSelected(true);
          }
        });

        initialSelectionApplied.current = true;

        if (onRowSelectionChanged) {
          const selectedRows = api.getSelectedRows();
          onRowSelectionChanged(selectedRows);
        }
      });
    }

    // Call external onGridReady callback if provided
    if (onGridReadyProp) {
      onGridReadyProp(params);
    }
  }, [initialRowSelection, onRowSelectionChanged, idProperty, viewSetting, onGridReadyProp]);

  // Reset selection state when initialSelectedRows changes
  useEffect(() => {
    initialSelectionApplied.current = false;
  }, [initialSelectedRows]);

  // Apply saved view settings when they become available (after initial load from Redux)
  useEffect(() => {
    const gridApi = gridRef.current?.api;
    if (!gridApi || !viewSetting || viewSettingsApplied.current) return;

    // Only apply if we have the new AG Grid format
    if (viewSetting.columnState) {
      try {
        gridApi.applyColumnState({
          state: viewSetting.columnState,
          applyOrder: true,
        });

        viewSettingsApplied.current = true;
      } catch (error) {
        console.error('Error applying saved view settings:', error);
      }
    }
  }, [viewSetting]);

  // Apply selection when initialSelectedRows changes after grid is ready
  // Only runs when initialSelectedRows is explicitly provided (not the default empty array)
  useEffect(() => {
    const gridApi = gridRef.current?.api;
    if (!gridApi) return;

    // Only apply if we have rows to select
    if (Object.keys(initialRowSelection).length === 0) {
      return;
    }

    // Apply selection
    requestAnimationFrame(() => {
      gridApi.deselectAll();

      gridApi.forEachNode((node) => {
        if (node.data?.[idProperty] && initialRowSelection[node.data[idProperty]]) {
          node.setSelected(true);
        }
      });

      initialSelectionApplied.current = true;
    });
  }, [initialRowSelection, idProperty]);

  // Handle selection changes (primarily for multi-select mode)
  const onSelectionChanged = useCallback(() => {
    // For single-select, we handle selection in onRowClicked to support toggle behavior
    if (!multiSelect) return;

    const gridApi = gridRef.current?.api;
    if (!gridApi || !onRowSelectionChanged) return;

    const selectedRows = gridApi.getSelectedRows();
    onRowSelectionChanged(selectedRows);
  }, [onRowSelectionChanged, multiSelect]);

  // Handle row click for single-select toggle behavior
  const handleRowClicked = useCallback((event) => {
    // If custom onRowClicked handler is provided, use it instead
    if (onRowClicked) {
      onRowClicked(event);
      return;
    }

    // Only handle clicks for single-select mode
    if (multiSelect || !onRowSelectionChanged) return;

    const clickedNode = event.node;
    const wasSelected = clickedNode.isSelected();

    if (wasSelected) {
      // Clicking a selected row deselects it
      clickedNode.setSelected(false);
      onRowSelectionChanged(null);
    } else {
      // Clicking an unselected row selects it
      clickedNode.setSelected(true);
      onRowSelectionChanged(event.data);
    }
  }, [multiSelect, onRowSelectionChanged, onRowClicked]);

  // Handle cell double-click - copies value to clipboard by default
  const handleCellDoubleClick = useCallback((params) => {
    if (copyOnDoubleClick) {
      const value = params.value;
      if (value !== undefined && value !== null) {
        navigator.clipboard.writeText(String(value));
        enqueueSnackbar("Cell value copied to clipboard", { variant: "success" });
      }
    }
  }, [copyOnDoubleClick, enqueueSnackbar]);

  // Get row ID from data using idProperty
  const getRowId = useCallback((params) => {
    return params.data?.[idProperty];
  }, [idProperty]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <DataGridContext.Provider value={gridContextValue}>
      <div style={{ width: "100%", height: "100%" }} className="ag-theme-quartz">
        <AgGridReact
          ref={gridRef}
          theme={gridTheme}
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          accentedSort={true}
          suppressMovableColumns={false}
          animateRows={true}
          rowSelection={rowSelection}
          cellSelection={false}
          suppressCellFocus={true}
          suppressColumnVirtualisation={true}
          colResizeDefault="shift"
          onColumnMoved={onColumnMoved}
          onColumnResized={onColumnResized}
          onGridReady={onGridReady}
          onRowClicked={handleRowClicked}
          onSelectionChanged={onSelectionChanged}
          onCellDoubleClicked={handleCellDoubleClick}
          rowClassRules={rowClassRules}
          overlayComponentSelector={overlayComponentSelector}
          loading={isLoading}
        />
        <StandaloneHeaderMenu viewSettingKey={viewSettingKey} extraMenuItems={extraMenuItems} />
      </div>
    </DataGridContext.Provider>
  );
};

DataGrid.displayName = 'DataGrid';

export default DataGrid;
