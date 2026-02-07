/**
 * Shared filter utilities for AG Grid
 *
 * These utilities provide custom filter logic that can be reused across
 * different grid instances in the IPAM application.
 */

/**
 * Custom value getter for array fields.
 * Converts arrays to comma-separated strings for filtering.
 *
 * @param {Object} params - AG Grid value getter params
 * @returns {string} - Comma-separated string of array values
 */
export const arrayValueGetter = (params) => {
  const value = params.data?.[params.colDef.field];
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value || '';
};

/**
 * Custom filter value getter for array fields.
 * Returns the raw array for custom filtering logic.
 *
 * @param {Object} params - AG Grid filter value getter params
 * @returns {Array|string} - The array value or empty string
 */
export const arrayFilterValueGetter = (params) => {
  const value = params.data?.[params.colDef.field];
  return Array.isArray(value) ? value : [];
};

/**
 * Custom comparator for array fields in text filters.
 * Checks if any element in the array contains the filter value.
 *
 * @param {string} filterValue - The filter input value
 * @param {Array} cellValue - The cell's array value
 * @returns {boolean} - Whether the filter matches
 */
export const arrayTextFilterComparator = (filterValue, cellValue) => {
  if (!filterValue) return true;
  if (!Array.isArray(cellValue) || cellValue.length === 0) return false;

  const lowerFilter = filterValue.toLowerCase();
  return cellValue.some(item =>
    String(item).toLowerCase().includes(lowerFilter)
  );
};

/**
 * Creates a column definition for an array field with proper filtering.
 *
 * @param {string} field - The field name
 * @param {string} headerName - The header display name
 * @param {Object} additionalProps - Additional column properties
 * @returns {Object} - Column definition object
 */
export const createArrayColumnDef = (field, headerName, additionalProps = {}) => ({
  field,
  headerName,
  valueGetter: arrayValueGetter,
  filterValueGetter: (params) => {
    const value = params.data?.[field];
    // Return joined string for text filter to work properly
    return Array.isArray(value) ? value.join(' ') : (value || '');
  },
  ...additionalProps,
});

/**
 * Custom filter params for case-insensitive text matching.
 * Use this for columns that need case-insensitive filtering.
 */
export const caseInsensitiveFilterParams = {
  filterOptions: [
    'contains',
    'notContains',
    'equals',
    'notEqual',
    'startsWith',
    'endsWith',
    'blank',
    'notBlank',
  ],
  caseSensitive: false,
  trimInput: true,
};

/**
 * Custom filter params for number columns.
 */
export const numberFilterParams = {
  filterOptions: [
    'equals',
    'notEqual',
    'lessThan',
    'lessThanOrEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'inRange',
    'blank',
    'notBlank',
  ],
  allowedCharPattern: '\\d\\-\\.',
  numberParser: (text) => {
    return text == null ? null : parseFloat(text);
  },
};

/**
 * Custom filter params for date columns.
 */
export const dateFilterParams = {
  filterOptions: [
    'equals',
    'notEqual',
    'lessThan',
    'greaterThan',
    'inRange',
    'blank',
    'notBlank',
  ],
  comparator: (filterLocalDateAtMidnight, cellValue) => {
    if (!cellValue) return -1;

    const cellDate = new Date(cellValue);
    const filterDate = filterLocalDateAtMidnight;

    if (cellDate < filterDate) return -1;
    if (cellDate > filterDate) return 1;
    return 0;
  },
};

/**
 * Default column definitions that can be spread into defaultColDef.
 * These provide sensible defaults for most IPAM grid columns.
 */
export const defaultColumnSettings = {
  resizable: true,
  sortable: true,
  filter: true,
  floatingFilter: true,
  filterParams: caseInsensitiveFilterParams,
};

export default {
  arrayValueGetter,
  arrayFilterValueGetter,
  arrayTextFilterComparator,
  createArrayColumnDef,
  caseInsensitiveFilterParams,
  numberFilterParams,
  dateFilterParams,
  defaultColumnSettings,
};
