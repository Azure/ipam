import { createContext } from 'react';

/**
 * Context for sharing grid state between DataGrid and its child components.
 * This context provides access to grid configuration, column management,
 * and menu state.
 */
export const DataGridContext = createContext({
  // Saving state
  saving: false,
  sendResults: null,

  // Config persistence callbacks
  saveConfig: () => {},
  loadConfig: () => {},
  resetConfig: () => {},

  // Column management
  columnDefs: [],
  toggleColumnVisibility: () => {},
  getVisibleColumns: () => [],

  // Grid reference
  gridRef: null,

  // Menu state management
  menuOpen: false,
  setMenuOpen: () => {},
  menuAnchor: null,
  setMenuAnchor: () => {},

  // View settings (from Redux or props)
  viewSetting: null,
});

export default DataGridContext;
