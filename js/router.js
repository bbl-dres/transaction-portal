/* ==========================================================================
   Router: URL parameters ↔ application state, full-page views, history.
   Overview state (view, search, filters) is written with replaceState; page
   views (detail, wizard, API docs) push history entries.
   ========================================================================== */
function getRouteParams() { return Object.fromEntries(new URLSearchParams(window.location.search).entries()); }

function buildUrl(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (!isBlank(value)) search.set(key, value); });
  const query = search.toString();
  return query ? `${window.location.pathname}?${query}` : window.location.pathname;
}

// Parameters describing the current overview (view + search + filters).
function filterParams() {
  const params = {};
  if (state.currentView !== 'gallery') params.view = state.currentView;
  if (state.searchQuery) params.q = state.searchQuery;
  Object.entries(state.filters).forEach(([key, set]) => { if (set.size) params[key] = Array.from(set).join(','); });
  return params;
}

function navigate(params, { replace = false } = {}) {
  const url = buildUrl(params);
  if (replace) window.history.replaceState({}, '', url);
  else window.history.pushState({}, '', url);
}

// Keep the address bar in sync with search/filters without leaving an open page view.
function updateUrlParams() {
  const current = getRouteParams();
  const params = filterParams();
  if (PAGE_VIEWS.includes(current.view)) {
    params.view = current.view;
    if (current.id) params.id = current.id;
    if (current.step) params.step = current.step;
  }
  navigate(params, { replace: true });
}

function showPage(id) {
  document.body.classList.add('page-active');
  $$('.page-view').forEach(view => view.classList.toggle('active', view.id === id));
}
function closePages() {
  document.body.classList.remove('page-active');
  $$('.page-view.active').forEach(view => view.classList.remove('active'));
}
// Close the open page view and return to the overview (adds a history entry).
function leavePage() {
  closePages();
  navigate(filterParams());
}

// Render whatever the URL describes. Used on start-up and on back/forward.
function applyRoute(params) {
  if (params.view === 'api') return renderApiDocsView();
  if (params.view === 'sales-form') return renderSalesFormView(parseInt(params.step, 10) || 1);
  if (params.view === 'detail' && params.id) {
    const prop = findProperty(params.id);
    if (prop) return renderDetailPage(prop);
  }
  closePages();
  if (VIEWS[params.view] && params.view !== state.currentView) setView(params.view);
  else if (!params.view && state.currentView !== 'gallery') setView('gallery');
}
window.addEventListener('popstate', () => applyRoute(getRouteParams()));
