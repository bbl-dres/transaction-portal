/* ==========================================================================
   Overview views: gallery cards, list table with KPIs, map with sidebar.
   ========================================================================== */
let map = null;
let mapLoaded = false;
let markers = [];
const markersById = new Map();

function getDataToRender() {
  return (state.filteredProperties.length > 0 || hasActiveFilters()) ? state.filteredProperties : state.properties;
}
function renderCurrentView() {
  ({ gallery: renderCards, list: renderListView, map: renderMapView })[state.currentView]();
}

// --- Gallery ---
function renderCards() {
  const data = getDataToRender();
  setObjectCount(data.length);
  $('objectGrid').innerHTML = data.length ? data.map(renderCard).join('') : renderEmptyState('search_off', 'Keine Objekte gefunden.');
}
function renderCard(prop) {
  const progress = prop.milestone ? (prop.milestone.current / prop.milestone.total) * 100 : 0;
  return `
    <div class="card panel" data-id="${prop.id}" role="link" tabindex="0">
      ${renderMedia(prop, 'card-image')}
      <div class="card-content">
        <div class="card-label">${prop.econUnit}/${prop.bldgNum} ${prop.type}</div>
        <div class="card-location">In ${prop.zip} ${prop.city}</div>
        <div class="card-price">${formatPriceRange(prop.valueMin, prop.valueMax)}</div>
        <div class="card-price-sqm">${formatCHF(pricePerSqm(prop.valueMin, prop.areaGF))} - ${formatCHF(pricePerSqm(prop.valueMax, prop.areaGF))} / m² GF</div>
        <div class="card-details">
          <span class="card-detail-label">Geschossfläche GF:</span><span class="card-detail-value">${prop.areaGF} m²</span>
          <span class="card-detail-label">Buchwert:</span><span class="card-detail-value">${formatCHF(prop.bookValue)}</span>
        </div>
        <div class="progress progress-sm"><div class="progress-fill" style="width: ${progress}%"></div></div>
        <div class="milestone-text">Meilenstein ${milestoneText(prop)}</div>
      </div>
    </div>`;
}

// --- List ---
function renderListView() {
  const data = getDataToRender();
  setObjectCount(data.length);
  const counts = countByPriority(data);
  $('statsTotalObjects').textContent = data.length;
  $('statsHighPriority').textContent = counts['0'];
  $('statsNormalPriority').textContent = counts['1'];
  $('statsLowPriority').textContent = counts['2'];
  $('listTableBody').innerHTML = data.map(prop => `
    <tr data-id="${prop.id}">
      <td><span class="material-icons-outlined object-icon">home</span></td>
      <td>${prop.econUnit}/${prop.bldgNum}</td>
      <td>${prop.type} in ${prop.zip} ${prop.city}</td>
      <td><span class="tag" data-filter="year" data-value="${prop.year}">${prop.year}</span></td>
      <td><span class="tag ${getPriorityClass(prop.priority)}" data-filter="priority" data-value="${priorityKey(prop.priority)}">${getPriorityLabel(prop)}</span></td>
      <td>${milestoneText(prop)}</td>
      <td>${prop.areaGF} m²</td>
      <td>${formatPriceRange(prop.valueMin, prop.valueMax)}</td>
    </tr>`).join('');
}

// --- Map ---
function renderMapView() {
  const data = getDataToRender();
  setObjectCount(data.length);
  $('mapSidebar').innerHTML = data.map(prop => `
    <div class="map-sidebar-item" data-id="${prop.id}">
      ${renderMedia(prop, 'map-sidebar-image')}
      <div class="map-sidebar-content">
        <div class="map-sidebar-title">${prop.type} in ${prop.zip} ${prop.city}</div>
        <div class="map-sidebar-price">${formatPriceRange(prop.valueMin, prop.valueMax)}</div>
      </div>
    </div>`).join('');
  if (!map) initializeMap();
  else if (mapLoaded) updateMapMarkers(data);
  // If the map exists but has not loaded yet, the 'load' handler renders the markers.
}

function initializeMap() {
  if (typeof maplibregl === 'undefined') {
    $('map').innerHTML = '<div class="map-fallback">Karte konnte nicht geladen werden (Kartenbibliothek nicht verfügbar).</div>';
    return;
  }
  map = new maplibregl.Map({ container: 'map', style: MAP_CONFIG.styleUrl, center: MAP_CONFIG.center, zoom: MAP_CONFIG.zoom });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.on('load', () => {
    mapLoaded = true;
    updateMapMarkers(getDataToRender());
  });
}

function updateMapMarkers(data) {
  markers.forEach(marker => marker.remove());
  markers = [];
  markersById.clear();
  const bounds = new maplibregl.LngLatBounds();
  data.filter(prop => prop.lat && prop.lng).forEach(prop => {
    const el = document.createElement('div');
    el.className = `marker ${getPriorityClass(prop.priority)}`;
    el.innerHTML = '<span class="material-icons-outlined">home</span>';
    el.addEventListener('click', () => flyToProperty(prop.id));
    const popup = new maplibregl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(`
      <div class="popup-image" style="background-image: url('${getPlaceholderImage(prop.id)}')"></div>
      <div class="popup-content">
        <div class="popup-title">${prop.type}</div>
        <div class="popup-location">${prop.address}, ${prop.city}</div>
        <div class="popup-price">${formatPriceRange(prop.valueMin, prop.valueMax)}</div>
        <button type="button" class="btn btn-primary btn-sm btn-block" onclick="openDetailPage('${prop.id}')">Details anzeigen</button>
      </div>`);
    const marker = new maplibregl.Marker({ element: el }).setLngLat([prop.lng, prop.lat]).setPopup(popup).addTo(map);
    markers.push(marker);
    markersById.set(prop.id, marker);
    bounds.extend([prop.lng, prop.lat]);
  });
  if (markers.length > 0) map.fitBounds(bounds, { padding: MAP_CONFIG.fitPadding, maxZoom: MAP_CONFIG.fitMaxZoom });
}

function flyToProperty(id) {
  const prop = findProperty(id);
  if (!prop || !prop.lat || !prop.lng) return;
  $$('.map-sidebar-item').forEach(item => {
    const active = item.dataset.id === id;
    item.classList.toggle('active', active);
    if (active && item.scrollIntoView) item.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });
  $$('.marker').forEach(m => m.classList.remove('selected'));
  const marker = markersById.get(id);
  if (!marker) return;
  marker.getElement().classList.add('selected');
  map.flyTo({ center: [prop.lng, prop.lat], zoom: MAP_CONFIG.flyZoom, duration: 1500 });
  setTimeout(() => {
    const popup = marker.getPopup();
    if (popup && !popup.isOpen()) marker.togglePopup();
  }, 1600);
}

// --- View switching ---
function setView(view) {
  state.currentView = view;
  $$('.view-btn').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('active', active);
    const label = btn.querySelector('.view-btn-label');
    if (label) label.remove();
    if (active) btn.insertAdjacentHTML('beforeend', `<span class="view-btn-label">${VIEWS[view]}</span>`);
  });
  $('galleryView').classList.toggle('active', view === 'gallery');
  $('listView').classList.toggle('active', view === 'list');
  $('mapView').classList.toggle('active', view === 'map');
  renderCurrentView();
  if (view === 'map') setTimeout(() => { if (map) map.resize(); }, 150);
  updateUrlParams();
}
function setupViewToggle() {
  $$('.view-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
}
function exportToExcel() { alert('Excel Export Placeholder'); }
