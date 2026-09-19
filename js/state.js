/* Mutable application state. One object, read and written by the modules. */
const state = {
  properties: [],            // all objects from data/data.json
  filteredProperties: [],    // objects matching search + filters
  searchQuery: '',
  currentView: 'gallery',    // gallery | list | map
  filters: { type: new Set(), year: new Set(), priority: new Set(), milestone: new Set(), portfolio: new Set() },
  filterOptions: { type: [], year: [], milestone: [], portfolio: [] }, // distinct values found in the data
  currentProperty: null,     // object shown on the detail page
};
