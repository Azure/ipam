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
 * Text matcher for columns whose underlying value is an array.
 *
 * AG Grid compares the filter text against the column's filter value, which for
 * these columns is the elements joined into one string -- so `equals` could never
 * match a row holding more than one value. This compares each element instead.
 *
 * @param {Object} params - AG Grid text matcher params
 * @returns {boolean} - Whether the row matches
 */
export const arrayTextMatcher = ({ filterOption, filterText, data, colDef }) => {
  if (!filterText) return true;

  const values = data?.[colDef.field];

  if (!Array.isArray(values)) return false;

  const needle = filterText.toLowerCase();

  const hit = values.some((item) => {
    const candidate = String(item).toLowerCase();

    switch (filterOption) {
      case 'equals':
      case 'notEqual':
        return candidate === needle;
      case 'startsWith':
        return candidate.startsWith(needle);
      case 'endsWith':
        return candidate.endsWith(needle);
      default:
        return candidate.includes(needle);
    }
  });

  // A negated operator asks whether no element matches at all.
  return (filterOption === 'notEqual' || filterOption === 'notContains') ? !hit : hit;
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
  arrayTextMatcher,
  createArrayColumnDef,
  caseInsensitiveFilterParams,
  numberFilterParams,
  dateFilterParams,
  defaultColumnSettings,
};
