/* ==========================================================================
   Search and filters: chips, filter dialog, URL parameters.
   ========================================================================== */
const FILTER_GROUPS = [
  { key: 'type', containerId: 'filterNutzung', options: () => state.filterOptions.type.map(v => ({ value: v, label: v })) },
  { key: 'year', containerId: 'filterYear', options: () => state.filterOptions.year.map(v => ({ value: String(v), label: v })) },
  { key: 'priority', containerId: 'filterPriority', options: () => PRIORITIES },
  { key: 'milestone', containerId: 'filterMilestone', options: () => state.filterOptions.milestone.map(m => ({ value: m.value, label: `${m.value} ${m.label}` })) },
  { key: 'portfolio', containerId: 'filterPortfolio', options: () => state.filterOptions.portfolio.map(v => ({ value: v, label: v })) },
];

// Distinct values in the data for the filter dialog.
function extractFilterOptions() {
  const types = new Set(), years = new Set(), portfolios = new Set(), milestones = new Map();
  state.properties.forEach(prop => {
    if (prop.type) types.add(prop.type);
    if (prop.year) years.add(prop.year);
    if (prop.portfolio) portfolios.add(prop.portfolio);
    if (prop.milestone) milestones.set(milestoneKey(prop), prop.milestone.label);
  });
  state.filterOptions.type = Array.from(types).sort();
  state.filterOptions.year = Array.from(years).sort((a, b) => a - b);
  state.filterOptions.portfolio = Array.from(portfolios).sort();
  state.filterOptions.milestone = Array.from(milestones, ([value, label]) => ({ value, label }));
}

function hasActiveFilters() { return Object.values(state.filters).some(set => set.size > 0) || Boolean(state.searchQuery); }
function getActiveFilterCount() { return Object.values(state.filters).reduce((n, set) => n + set.size, 0); }

function loadFiltersFromUrl(params) {
  if (VIEWS[params.view]) state.currentView = params.view;
  if (params.q) {
    state.searchQuery = params.q;
    $('searchInput').value = params.q;
    $('searchInputClear').classList.add('visible');
  }
  Object.keys(state.filters).forEach(key => {
    if (params[key]) params[key].split(',').forEach(value => state.filters[key].add(value));
  });
}

function matchesFilters(prop) {
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    const fields = [prop.econUnit, prop.bldgNum, prop.title, prop.type, prop.city, prop.zip, prop.address, prop.canton];
    if (!fields.some(field => String(field || '').toLowerCase().includes(query))) return false;
  }
  const f = state.filters;
  if (f.type.size && !f.type.has(prop.type)) return false;
  if (f.year.size && !f.year.has(String(prop.year))) return false;
  if (f.priority.size && !f.priority.has(priorityKey(prop.priority))) return false;
  if (f.milestone.size && !f.milestone.has(milestoneKey(prop))) return false;
  if (f.portfolio.size && !f.portfolio.has(prop.portfolio)) return false;
  return true;
}

function toggleFilter(key, value) {
  const set = state.filters[key];
  if (!set) return;
  if (set.has(value)) set.delete(value); else set.add(value);
  applyFilters();
}
function addFilter(key, value) {
  if (!state.filters[key]) return;
  state.filters[key].add(value);
  applyFilters();
}
function resetAllFilters() {
  Object.values(state.filters).forEach(set => set.clear());
  state.searchQuery = '';
  $('searchInput').value = '';
  $('searchInputClear').classList.remove('visible');
  applyFilters();
}

// Re-evaluate the data set and every element that reflects the filter state.
function applyFilters() {
  state.filteredProperties = state.properties.filter(matchesFilters);
  renderCurrentView();
  updateUrlParams();
  updateFilterButtonState();
  renderPriorityChips();
  if (isOverlayOpen('filterModalOverlay')) renderFilterModal();
}

function updateFilterButtonState() {
  const count = getActiveFilterCount();
  $('filterBtn').classList.toggle('has-filters', count > 0);
  $('filterCount').textContent = count;
  $('filterCount').classList.toggle('visible', count > 0);
}

function renderPriorityChips() {
  const counts = countByPriority(state.properties);
  $('filterPills').innerHTML = PRIORITIES.map(p => `
    <button type="button" class="chip ${state.filters.priority.has(p.value) ? 'active' : ''}" data-filter="priority" data-value="${p.value}">
      ${p.label} (${counts[p.value] || 0})
      <span class="material-icons-outlined close-icon">close</span>
    </button>`).join('') + `
    <button type="button" class="icon-btn icon-btn-sm reset-filters ${hasActiveFilters() ? 'visible' : ''}" id="resetFilters" title="Alle Filter zurücksetzen" aria-label="Alle Filter zurücksetzen">
      <span class="material-icons-outlined">replay</span>
    </button>`;
}

function renderFilterModal() {
  FILTER_GROUPS.forEach(group => {
    $(group.containerId).innerHTML = group.options().map(option => `
      <div class="filter-option ${state.filters[group.key].has(String(option.value)) ? 'selected' : ''}" data-filter="${group.key}" data-value="${option.value}" role="button" tabindex="0">
        <span>${option.label}</span>
        <span class="material-icons-outlined close-icon">close</span>
      </div>`).join('');
  });
}
function openFilterModal() {
  renderFilterModal();
  openOverlay('filterModalOverlay');
  $('filterBtn').classList.add('panel-open');
}
function closeFilterModal() {
  closeOverlay('filterModalOverlay');
  $('filterBtn').classList.remove('panel-open');
}

function setupSearch() {
  const searchInput = $('searchInput');
  const clearBtn = $('searchInputClear');
  const runSearch = debounce(() => { state.searchQuery = searchInput.value.trim(); applyFilters(); }, 300);
  searchInput.addEventListener('input', () => {
    clearBtn.classList.toggle('visible', searchInput.value.length > 0);
    runSearch();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.classList.remove('visible');
    applyFilters();
    searchInput.focus();
  });
  // The full placeholder is truncated on phones; swap in the short variant there.
  const longPlaceholder = searchInput.placeholder;
  const shortPlaceholder = searchInput.dataset.placeholderShort;
  if (shortPlaceholder && window.matchMedia) {
    const phoneQuery = window.matchMedia('(max-width: 640px)');
    const applyPlaceholder = () => { searchInput.placeholder = phoneQuery.matches ? shortPlaceholder : longPlaceholder; };
    applyPlaceholder();
    if (phoneQuery.addEventListener) phoneQuery.addEventListener('change', applyPlaceholder);
  }
}
