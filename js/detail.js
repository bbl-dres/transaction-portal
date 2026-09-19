/* ==========================================================================
   Property detail page: hero, overview, milestones, events, documents,
   document upload.
   ========================================================================== */
const DETAIL_LINKS = [
  { label: 'Google Maps', url: p => `https://www.google.com/maps?q=${p.lat},${p.lng}` },
  { label: 'Gebäude- und Wohnungsregister', url: p => geoAdminMapUrl(p, 'ch.swisstopo.amtliches-strassenverzeichnis;ch.bfs.gebaeude_wohnungs_register') },
  { label: 'ÖREB-Kataster', url: p => geoAdminMapUrl(p, 'ch.swisstopo-vd.stand-oerebkataster') },
];
function geoAdminMapUrl(p, layers) {
  return `https://map.geo.admin.ch/#/map?lang=de&swisssearch=${p.lng},${p.lat}&swisssearch_autoselect=true&z=12&topic=ech&layers=${layers}&bgLayer=ch.swisstopo.swissimage`;
}

// Label/value pairs of the overview tab. `null` keeps a grid cell empty so the
// two-column layout stays aligned.
const IDENTIFICATION_FIELDS = [
  { label: 'Technischer Platz Bund', value: p => p.techPlatz },
  { label: 'Land, Region (Kanton)', value: p => `Schweiz, ${p.canton}` },
  { label: 'Objekt Bezeichnung', value: p => `${p.city}, ${p.address}` },
  { label: 'Adresse', value: p => `${p.address} ${p.zip} ${p.city}` },
  { label: 'Teilportfolio Bund', value: p => p.portfolio },
  { label: 'Objektart Verkauf', value: p => p.type },
  { label: 'BFS EGID (nur Schweiz)', value: p => p.egid },
  { label: 'BFS EGRID (nur Schweiz)', value: p => p.egrid },
  { label: 'Eigentum', value: p => p.ownership },
  { label: 'Baujahr', value: p => p.buildYear },
];
const OBJECT_FIELDS = [
  { label: 'Jahr Verkauf', value: p => p.year },
  { label: 'Grundstücksfläche GSF', value: p => formatArea(p.areaGSF) },
  { label: 'Eigentum Art', value: p => p.ownership },
  { label: 'Geschossfläche GF', value: p => formatArea(p.areaGF) },
  { label: 'Baujahr', value: p => p.buildYear },
  { label: 'Anzahl Geschosse', value: p => p.floors },
  { label: 'Zustand', value: p => p.condition },
  { label: 'Wohnfläche', value: p => formatArea(p.livingArea) },
  { label: 'Ausbaustandard', value: p => p.standard },
  { label: 'Anzahl Wohnungen', value: p => p.apartments },
  { label: 'Objekt ist beheizt', value: p => formatYesNo(p.isHeated) },
  { label: 'Anzahl Zimmer', value: p => p.rooms },
  { label: 'Aktueller Buchwert', value: p => formatCHF(p.bookValue) },
  { label: 'Anzahl Parkplätze', value: p => p.parkingSpaces },
  { label: 'Anschaffungswert', value: p => formatCHF(p.acquisitionValue) },
  null,
  { label: 'Baurecht vorhanden?', value: p => formatYesNo(p.hasBuildingRights) },
  null,
  { label: 'Baurechtszins', value: p => isBlank(p.buildingRightsFee) ? MISSING : formatCHF(p.buildingRightsFee) },
];
function renderDetailFields(fields, prop) {
  return fields.map(field => field
    ? renderDataItem(field.label, valueOrDash(field.value(prop)))
    : '<div class="data-item data-item-spacer" aria-hidden="true"></div>').join('');
}

// --- Switzerland outline (SVG) with highlighted canton and marker ---
let svgMapCache = null;
async function loadSvgMap() {
  if (svgMapCache) return svgMapCache;
  try {
    const response = await fetch('assets/switzerland.svg');
    svgMapCache = await response.text();
  } catch (error) {
    console.error('Error loading SVG map:', error);
  }
  return svgMapCache;
}
function latLngToSvg(lat, lng) {
  const { minLat, maxLat, minLng, maxLng, width, height } = SWISS_SVG;
  return { x: ((lng - minLng) / (maxLng - minLng)) * width, y: ((maxLat - lat) / (maxLat - minLat)) * height };
}
function highlightCantonOnMap(canton, lat, lng) {
  const svg = $('detailMapSvg') && $('detailMapSvg').querySelector('svg');
  if (!svg) return;
  $$('path.highlighted', svg).forEach(path => path.classList.remove('highlighted'));
  const cantonPath = canton && svg.getElementById(canton);
  if (cantonPath) cantonPath.classList.add('highlighted');
  if (!lat || !lng) return;
  const pos = latLngToSvg(lat, lng);
  let marker = svg.getElementById('location-marker');
  if (!marker) {
    marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('id', 'location-marker');
    marker.setAttribute('r', '12');
    marker.setAttribute('stroke-width', '3');
    marker.style.fill = 'var(--priority-high)';
    marker.style.stroke = 'var(--neutral-50)';
    svg.appendChild(marker);
  }
  marker.setAttribute('cx', pos.x);
  marker.setAttribute('cy', pos.y);
}

// --- Page ---
function openDetailPage(id) {
  const prop = findProperty(id);
  if (!prop) return;
  navigate({ ...filterParams(), view: 'detail', id });
  renderDetailPage(prop);
}
function closeDetailPage() { leavePage(); }
function exportToPdf() { window.print(); }

async function renderDetailPage(prop) {
  state.currentProperty = prop;
  $('detailBreadcrumb').textContent = `Alle Verkaufsobjekte / ${prop.year} / ${prop.econUnit} / ${prop.bldgNum}`;
  const images = [getPlaceholderImage(prop.id), ...[1, 2, 3, 4].map(n => getPlaceholderImage(prop.id + n))];
  const svgMap = await loadSvgMap();

  $('detailContent').innerHTML = `
    <div class="detail-hero">
      ${renderGallery(prop, images)}
      <div class="detail-info">
        <div class="detail-info-section detail-title-section">
          <span class="data-item-label">${prop.address} ${prop.zip} ${prop.city}</span>
          <h1>${prop.type} in ${prop.zip} ${prop.city}</h1>
          <div class="data-item-row">
            ${renderDataItem('Geschossfläche', `${prop.areaGF} m²`)}
            ${renderDataItem('Grundstück', `${prop.areaGSF} m²`)}
          </div>
        </div>
        <div class="detail-info-section">
          <span class="data-item-label">${formatCHF(pricePerSqm(prop.valueMin, prop.areaGF))} - ${formatCHF(pricePerSqm(prop.valueMax, prop.areaGF))} / m² GF</span>
          <h1>${formatPriceRange(prop.valueMin, prop.valueMax)}</h1>
          <div class="data-item-row">
            ${renderDataItem('Aktueller Buchwert', formatCHF(prop.bookValue))}
            ${renderDataItem('Anschaffungswert', formatCHF(prop.acquisitionValue))}
          </div>
        </div>
        <div class="detail-info-section">
          <span class="data-item-label">Meilenstein</span>
          <h1>${milestoneText(prop)}</h1>
        </div>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" class="tab active" data-tab="uebersicht">ÜBERSICHT</button>
      <button type="button" class="tab" data-tab="meilensteine">MEILENSTEINE</button>
      <button type="button" class="tab" data-tab="ereignisse">EREIGNISSE</button>
      <button type="button" class="tab" data-tab="dokumente">DOKUMENTE</button>
    </div>

    <div class="tab-panel active" data-tab="uebersicht">
      <h2 class="section-title">Identifikation Objekt</h2>
      <div class="detail-data-section">
        <div>
          <div class="data-grid">${renderDetailFields(IDENTIFICATION_FIELDS, prop)}</div>
          <div class="detail-links">
            <span class="data-item-label">Verortung</span>
            ${DETAIL_LINKS.map(link => `<a href="${link.url(prop)}" target="_blank" rel="noopener" class="link link-icon"><span class="material-icons-outlined">open_in_new</span>${link.label}</a>`).join('')}
          </div>
        </div>
        <div class="detail-map-container panel">
          <div class="detail-map-svg" id="detailMapSvg">${svgMap || '<div class="map-fallback">Karte nicht verfügbar</div>'}</div>
        </div>
      </div>

      <div class="detail-section-separator"></div>
      <h2 class="section-title">Angaben zum Objekt</h2>
      <div class="detail-object-section">
        <div class="data-grid">${renderDetailFields(OBJECT_FIELDS, prop)}</div>
        <div class="detail-object-right">
          <div class="detail-geo-map">
            <iframe src="https://map.geo.admin.ch/embed.html?lang=de&topic=ech&bgLayer=ch.swisstopo.swissimage&lon=${prop.lng}&lat=${prop.lat}&zoom=9&crosshair=marker" allowfullscreen="true" loading="lazy" title="Karte"></iframe>
          </div>
          <div class="detail-geo-info">
            <span class="detail-geo-coords">${formatCoord(prop.lat, 'N')} ${formatCoord(prop.lng, 'E')}</span>
            <span class="detail-geo-address">${prop.address} ${prop.city}</span>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${prop.lat},${prop.lng}" target="_blank" rel="noopener" class="link link-icon detail-route-link">
            <span class="material-icons-outlined">directions</span>Routenplaner
          </a>
        </div>
      </div>

      <div class="detail-section-separator"></div>
      <div class="detail-value-location">
        <div>
          <h2 class="section-title">Marktwert</h2>
          ${renderValueChart(prop)}
        </div>
        <div>
          <h2 class="section-title">Lage</h2>
          ${renderLocationRatings(prop)}
        </div>
      </div>
    </div>

    <div class="tab-panel" data-tab="meilensteine">
      <div class="tab-header"><h2 class="section-title">Meilensteine</h2></div>
      <div class="milestone-list">${renderMilestones(prop)}</div>
    </div>

    <div class="tab-panel" data-tab="ereignisse">
      <div class="tab-header"><h2 class="section-title">Ereignisse</h2></div>
      <div class="table-toolbar">
        ${renderSearchField({ id: 'eventSearchInput', placeholder: 'Alle Spalten filtern', oninput: 'filterTableRows(this)' })}
        <div class="table-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="eventDownloadBtn" data-requires-selection disabled onclick="downloadSelectedEvents()">
            <span class="material-icons-outlined">download</span><span>CSV herunterladen</span>
          </button>
        </div>
      </div>
      <div id="eventsTableContainer" class="table-scroll">${renderEventsTable(prop.events)}</div>
    </div>

    <div class="tab-panel" data-tab="dokumente">
      <div class="tab-header"><h2 class="section-title">Dokumente</h2></div>
      <div class="table-toolbar">
        ${renderSearchField({ id: 'documentSearchInput', placeholder: 'Alle Spalten filtern', oninput: 'filterTableRows(this)' })}
        <div class="table-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="docDeleteBtn" data-requires-selection disabled onclick="deleteSelectedDocuments()">
            <span class="material-icons-outlined">delete</span><span>Löschen</span>
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="docDownloadBtn" data-requires-selection disabled onclick="downloadSelectedDocuments()">
            <span class="material-icons-outlined">download</span><span>Herunterladen</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openUploadDialog()">
            <span class="material-icons-outlined">add</span><span>Hinzufügen</span>
          </button>
        </div>
      </div>
      <div id="documentsTableContainer" class="table-scroll">${renderDocumentsTable(prop.documents)}</div>
    </div>`;

  showPage('detailView');
  highlightCantonOnMap(prop.canton, prop.lat, prop.lng);
}

function renderGallery(prop, images) {
  const thumb = (index, inner = '') =>
    renderMedia(prop, 'detail-thumb', { image: images[index], tags: false, attrs: `data-image-index="${index}" role="button" aria-label="Bild ${index + 1} anzeigen"` }).replace('</div>', `${inner}</div>`);
  return `
    <div class="detail-gallery" id="detailGallery" data-images='${JSON.stringify(images)}'>
      ${renderMedia(prop, 'detail-main-image', { image: images[0], attrs: 'data-image-index="0" role="button" aria-label="Bild 1 anzeigen"' })}
      ${thumb(1)}${thumb(2)}${thumb(3)}
      ${thumb(4, `<div class="detail-thumb-overlay"><span class="detail-thumb-overlay-label">Alle ${images.length} Bilder anzeigen.</span><span class="detail-thumb-overlay-short">+${images.length}</span></div>`)}
    </div>`;
}

function renderValueChart(prop) {
  const hasRange = prop.valueMax > prop.valueMin;
  const position = hasRange ? ((prop.valueMean - prop.valueMin) / (prop.valueMax - prop.valueMin)) * 100 : 0;
  return `
    <div class="detail-value-main">${formatCHF(prop.valueMean)}</div>
    <div class="detail-value-bar-container">
      <div class="detail-value-labels"><span>${formatCHF(prop.valueMin)}</span><span>${formatCHF(prop.valueMax)}</span></div>
      <div class="detail-value-bar">${hasRange ? `<div class="detail-value-marker" style="left: ${position}%"></div>` : ''}</div>
      <div class="detail-value-scale"><span>Minimum</span><span>Mittelwert</span><span>Maximum</span></div>
    </div>`;
}

function renderLocationRatings(prop) {
  const ratings = prop.locationRatings;
  const overall = ratings ? ratings.overall : null;
  const stars = [1, 2, 3, 4, 5].map(i => `<span class="material-icons-outlined detail-location-star ${overall && i <= overall ? 'filled' : ''}">star</span>`).join('');
  const rows = LOCATION_RATINGS.map(({ key, label }) => {
    const value = ratings ? ratings[key] : null;
    return `
      <div class="detail-location-item">
        <span class="detail-location-label">${label}</span>
        <span class="detail-location-value">${valueOrDash(value)}</span>
        <div class="progress"><div class="progress-fill" style="width: ${value || 0}%"></div></div>
      </div>`;
  }).join('');
  return `
    <div class="detail-location-grid">
      <div class="detail-location-item">
        <span class="detail-location-label">Gesamthaft</span>
        <span class="detail-location-value">${valueOrDash(overall)}</span>
        <div class="detail-location-stars">${stars}</div>
      </div>
      ${rows}
    </div>`;
}

// --- Milestones tab ---
function renderMilestones(prop) {
  const current = prop.milestone ? prop.milestone.current : 0;
  const events = prop.events || [];
  return MILESTONE_DEFINITIONS.map(ms => {
    const completed = ms.num <= current;
    const next = ms.num === current + 1;
    const event = events.find(e => e.milestone && e.milestone.startsWith(`${ms.num}/`));
    const status = completed && event ? `Abgeschlossen am: ${formatDate(event.timestamp)}` : 'Zu erledigen.';
    const button = completed
      ? '<button type="button" class="btn btn-secondary btn-sm" disabled>Erledigt</button>'
      : `<button type="button" class="btn ${next ? 'btn-primary' : 'btn-secondary'} btn-sm" ${next ? '' : 'disabled'}>Abschliessen</button>`;
    return `
      <div class="milestone-item">
        <div class="milestone-content">
          <div class="milestone-title">Meilenstein ${ms.num}/${MILESTONE_COUNT} ${ms.label}</div>
          <div class="milestone-status">
            <span class="material-icons-outlined milestone-status-icon ${completed ? 'completed' : ''}">${completed ? 'check_circle' : 'radio_button_unchecked'}</span>
            <span>${status}</span>
          </div>
          <span class="milestone-responsibility">${ms.responsibility}</span>
        </div>
        <div class="milestone-action">${button}</div>
      </div>`;
  }).join('');
}

// --- Events tab ---
function renderEventsTable(events) {
  if (!events || events.length === 0) return renderEmptyState('event_busy', 'Keine Ereignisse vorhanden');
  return `
    <table class="data-table">
      <thead><tr>
        <th class="data-table-checkbox"><input type="checkbox" class="checkbox-input" aria-label="Alle Ereignisse auswählen" onchange="toggleAllRows(this)"></th>
        <th>Meilenstein</th><th>Benutzer</th><th>Zeitstempel</th><th>Kommentar</th>
      </tr></thead>
      <tbody>${events.map(event => `
        <tr data-event-id="${event.id}" class="event-row">
          <td class="data-table-checkbox"><input type="checkbox" class="checkbox-input" aria-label="Ereignis auswählen" onchange="updateRowSelection(this)"></td>
          <td>${event.milestone}</td>
          <td>${event.user}</td>
          <td>${formatDate(event.timestamp)}</td>
          <td>${event.comment || MISSING}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}
function downloadSelectedEvents() {
  const ids = selectedRowIds($('eventsTableContainer'), 'eventId');
  if (ids.length) alert(`CSV-Download von ${ids.length} Ereignis(sen) wird gestartet...\n\nIDs: ${ids.join(', ')}`);
}

// --- Documents tab ---
const documentSort = { column: null, direction: 'asc' };
const DOCUMENT_SORT_KEYS = { title: d => d.title || d.name, type: d => d.type, uploaded: d => d.uploadedAt };
const sortIcon = column => `<span class="material-icons-outlined sort-icon">${documentSort.column === column ? (documentSort.direction === 'asc' ? 'expand_less' : 'expand_more') : 'unfold_more'}</span>`;

function sortedDocuments(documents) {
  if (!documentSort.column) return documents;
  const key = DOCUMENT_SORT_KEYS[documentSort.column];
  const dir = documentSort.direction === 'desc' ? -1 : 1;
  return [...documents].sort((a, b) => String(key(a) || '').localeCompare(String(key(b) || ''), 'de') * dir);
}
function renderDocumentsTable(documents) {
  if (!documents || documents.length === 0) return renderEmptyState('folder_open', 'Keine Dokumente vorhanden');
  return `
    <table class="data-table">
      <thead><tr>
        <th class="data-table-checkbox"><input type="checkbox" class="checkbox-input" aria-label="Alle Dokumente auswählen" onchange="toggleAllRows(this)"></th>
        <th class="sortable" onclick="sortDocuments('title')"><span>Titel</span>${sortIcon('title')}</th>
        <th class="sortable" onclick="sortDocuments('type')"><span>Typ</span>${sortIcon('type')}</th>
        <th>Format</th>
        <th class="sortable" onclick="sortDocuments('uploaded')"><span>Hochgeladen</span>${sortIcon('uploaded')}</th>
        <th>Grösse</th>
      </tr></thead>
      <tbody>${sortedDocuments(documents).map(doc => `
        <tr data-doc-id="${doc.id}" class="doc-row">
          <td class="data-table-checkbox"><input type="checkbox" class="checkbox-input" aria-label="Dokument auswählen" onchange="updateRowSelection(this)"></td>
          <td class="doc-title"><a href="#" onclick="event.preventDefault()">${escapeHtml(doc.title || doc.name)}</a></td>
          <td>${escapeHtml(doc.type)}</td>
          <td>${escapeHtml((doc.name.split('.').pop() || '').toUpperCase())}</td>
          <td>${escapeHtml(doc.uploadedBy)}, ${formatDate(doc.uploadedAt)}</td>
          <td>${doc.size || MISSING}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}
// Re-render the documents table from the data and keep the text filter applied.
function refreshDocumentsTable() {
  const container = $('documentsTableContainer');
  if (!container || !state.currentProperty) return;
  const selected = new Set(selectedRowIds(container, 'docId'));
  container.innerHTML = renderDocumentsTable(state.currentProperty.documents);
  const table = container.querySelector('table');
  if (table) {
    $$('tbody tr', table).forEach(row => { if (selected.has(row.dataset.docId)) row.querySelector('input[type="checkbox"]').checked = true; });
    updateRowSelection(table);
  } else {
    setSelectionButtons(container.closest('.tab-panel'), false);
  }
  const search = $('documentSearchInput');
  if (search && search.value) filterTableRows(search);
}
function sortDocuments(column) {
  if (documentSort.column === column) documentSort.direction = documentSort.direction === 'asc' ? 'desc' : 'asc';
  else Object.assign(documentSort, { column, direction: 'asc' });
  refreshDocumentsTable();
}
function deleteSelectedDocuments() {
  const ids = selectedRowIds($('documentsTableContainer'), 'docId');
  if (!ids.length || !confirm(`Möchten Sie ${ids.length} Dokument(e) wirklich löschen?`)) return;
  state.currentProperty.documents = (state.currentProperty.documents || []).filter(doc => !ids.includes(doc.id));
  refreshDocumentsTable();
}
function downloadSelectedDocuments() {
  const ids = selectedRowIds($('documentsTableContainer'), 'docId');
  if (ids.length) alert(`Download von ${ids.length} Dokument(en) wird gestartet...\n\nIDs: ${ids.join(', ')}`);
}

// --- Upload dialog ---
let uploadFile = null;
function renderDocumentTypeOptions() {
  $('uploadTypeSelect').innerHTML = '<option value="">Bitte wählen…</option>' + DOCUMENT_TYPES.map(type => `<option value="${type}">${type}</option>`).join('');
}
function openUploadDialog() {
  resetUploadForm();
  openOverlay('uploadDialogOverlay');
}
function closeUploadDialog() { closeOverlay('uploadDialogOverlay'); }
function resetUploadForm() {
  uploadFile = null;
  $('uploadFileInput').value = '';
  $('uploadDropzone').classList.remove('has-file');
  $('uploadDropzoneText').innerHTML = '<span class="upload-dropzone-text">Datei auswählen</span>';
  $('uploadTypeSelect').value = '';
  $('uploadNameInput').value = '';
  $('uploadSubmitBtn').disabled = true;
}
function handleFileSelect(file) {
  if (!file) return;
  uploadFile = file;
  $('uploadDropzone').classList.add('has-file');
  $('uploadDropzoneText').innerHTML = `<span class="upload-dropzone-filename">${escapeHtml(file.name)}</span>`;
  $('uploadNameInput').value = file.name;
  validateUploadForm();
}
function validateUploadForm() {
  const complete = $('uploadDropzone').classList.contains('has-file') && $('uploadTypeSelect').value !== '' && $('uploadNameInput').value.trim() !== '';
  $('uploadSubmitBtn').disabled = !complete;
}
function submitDocumentUpload() {
  const prop = state.currentProperty;
  if (!prop) return;
  const name = $('uploadNameInput').value.trim();
  prop.documents = prop.documents || [];
  prop.documents.push({
    id: `doc-${Date.now()}`, name, title: name, type: $('uploadTypeSelect').value,
    size: formatFileSize(uploadFile && uploadFile.size), uploadedBy: 'user@example.com', uploadedAt: new Date().toISOString(),
  });
  refreshDocumentsTable();
  closeUploadDialog();
}
function initUploadDropzone() {
  const dropzone = $('uploadDropzone');
  ['dragover', 'dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.toggle('dragover', type === 'dragover');
    if (type === 'drop' && event.dataTransfer.files.length) handleFileSelect(event.dataTransfer.files[0]);
  }));
}
