/**
 * IPAM Grid Components
 *
 * Shared AG Grid wrappers for the IPAM application.
 *
 * Usage:
 *
 * // Full-featured grid with header menu and view persistence
 * import { DataGrid } from '../../global/grids';
 *
 * // Simple grids for configuration panels (no menu, no persistence)
 * import { ConfigureGrid } from '../../global/grids';
 *
 * // Filter utilities
 * import { dateFilterParams, createArrayColumnDef } from '../../global/grids';
 */

// Main components
export { DataGrid, DataGridContext } from './DataGrid';
export { ConfigureGrid } from './ConfigureGrid';

// Utilities
export {
  arrayValueGetter,
  arrayFilterValueGetter,
  arrayTextFilterComparator,
  createArrayColumnDef,
  caseInsensitiveFilterParams,
  numberFilterParams,
  dateFilterParams,
  defaultColumnSettings,
} from './utils';

// Default export is DataGrid for convenience
export { DataGrid as default } from './DataGrid';
