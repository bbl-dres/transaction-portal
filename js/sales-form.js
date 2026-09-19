/* ==========================================================================
   "Auftrag erstellen" wizard (four steps). Step content is rendered from the
   definitions in config.js; salesFormData holds everything the user entered.
   ========================================================================== */
function createSalesFormData() {
  return {
    currentStep: 1, visitedSteps: new Set([1]),
    location: { searchText: '', label: '', coords: { E: null, N: null } },   // step 1
    propertyType: null, saleYear: null, saleReason: null,
    floors: '', livingArea: '', apartments: '', rooms: '', parkingSpaces: '',  // step 2
    isHeated: null, hasBuildingRights: null, buildingRightsFee: '',
    areas: {}, sia416Expanded: false, photos: [], condition: 3, standard: 3,
    residentialLeases: '', commercialLeases: '', monthlyRent: '', rentArrears: '',  // step 3
    hasVerbalAgreements: null, verbalAgreementsDescription: '',
  };
}
const salesFormData = createSalesFormData();
const STEP_COUNT = 4;

// Text inputs per step: element id → state key (required ones show a red border while empty).
const STEP_FIELDS = {
  2: [
    { id: 'floorsInput', key: 'floors', required: true },
    { id: 'livingAreaInput', key: 'livingArea' },
    { id: 'apartmentsInput', key: 'apartments' },
    { id: 'roomsInput', key: 'rooms' },
    { id: 'parkingSpacesInput', key: 'parkingSpaces', required: true },
    { id: 'buildingRightsFeeInput', key: 'buildingRightsFee' },
  ],
  3: [
    { id: 'residentialLeasesInput', key: 'residentialLeases', required: true },
    { id: 'commercialLeasesInput', key: 'commercialLeases', required: true },
    { id: 'monthlyRentInput', key: 'monthlyRent', required: true },
    { id: 'rentArrearsInput', key: 'rentArrears', required: true },
    { id: 'verbalAgreementsInput', key: 'verbalAgreementsDescription' },
  ],
};

// --- Open / close / navigate ---
function openSalesForm() {
  resetSalesFormData();
  navigate({ ...filterParams(), view: 'sales-form', step: 1 });
  renderSalesFormView(1);
}
function closeSalesForm() {
  resetSalesFormData();
  leavePage();
}
function resetSalesFormData() { Object.assign(salesFormData, createSalesFormData()); }
function renderSalesFormView(step = salesFormData.currentStep) {
  salesFormData.currentStep = step;
  salesFormData.visitedSteps.add(step);
  showPage('salesFormView');
  updateSalesFormSidebar();
  renderSalesFormStepContent();
}
function goToSalesFormStep(step) {
  navigate({ ...getRouteParams(), view: 'sales-form', step });
  renderSalesFormView(step);
}
function nextSalesFormStep() { if (salesFormData.currentStep < STEP_COUNT) goToSalesFormStep(salesFormData.currentStep + 1); }
function prevSalesFormStep() { if (salesFormData.currentStep > 1) goToSalesFormStep(salesFormData.currentStep - 1); }
function submitSalesForm() {
  alert('Demo: Der Auftrag wurde erfolgreich erstellt!\n\nDies ist nur eine Demonstration - in der Produktion würden die Daten an den Server gesendet werden.');
  closeSalesForm();
}

function updateSalesFormSidebar() {
  $$('.sales-form-step').forEach((step, index) => {
    const num = index + 1;
    const completed = num < salesFormData.currentStep && salesFormData.visitedSteps.has(num);
    step.classList.toggle('active', num === salesFormData.currentStep);
    step.classList.toggle('completed', completed);
    step.querySelector('.sales-form-step-icon').innerHTML = completed ? '<span class="material-icons-outlined">check</span>' : num;
  });
  $('salesFormProgressBar').style.width = `${(salesFormData.currentStep / STEP_COUNT) * 100}%`;
}
function renderSalesFormStepContent() {
  const steps = { 1: [renderStep1, setupStep1Handlers], 2: [renderStep2, setupStep2Handlers], 3: [renderStep3, setupStep3Handlers], 4: [renderStep4] };
  const [render, setup] = steps[salesFormData.currentStep] || steps[1];
  $('salesFormContent').innerHTML = render();
  if (setup) setup();
}

// --- Shared fragments ---
const requiredClass = value => (isBlank(value) ? 'required' : '');
function renderStepHeader(title, description) {
  return `<div class="sales-form-step-header"><h2 class="sales-form-step-title">${title}</h2><p class="sales-form-step-description">${description}</p></div>`;
}
function renderStepNav({ back = true, next = true } = {}) {
  return `<div class="sales-form-nav">
    ${back ? '<button type="button" class="btn btn-link" onclick="prevSalesFormStep()"><span class="material-icons-outlined">chevron_left</span>Zurück</button>' : ''}
    ${next ? '<button type="button" class="btn btn-primary" onclick="nextSalesFormStep()">Weiter<span class="material-icons-outlined">chevron_right</span></button>' : ''}
  </div>`;
}
function renderNumberField({ id, label, value, required = false, suffix = '', placeholder = 'Angabe fehlt', full = false }) {
  const input = `<input type="number" class="input ${required ? requiredClass(value) : ''}" id="${id}" placeholder="${placeholder}" value="${escapeHtml(value)}">`;
  return `<div class="form-field ${full ? 'full-width' : ''}">
    <label class="form-label ${required ? 'required' : ''}" for="${id}">${label}</label>
    ${suffix ? `<div class="input-with-suffix">${input}<span class="input-suffix">${suffix}</span></div>` : input}
  </div>`;
}
function renderRadioField({ name, label, options, value, required = false, horizontal = true, full = false }) {
  return `<div class="form-field ${full ? 'full-width' : ''}">
    <label class="form-label ${required ? 'required' : ''}">${label}</label>
    <div class="radio-group ${horizontal ? 'horizontal' : ''} ${required && isBlank(value) ? 'required' : ''}">
      ${options.map(opt => `<label class="radio"><input type="radio" name="${name}" value="${opt.value}" ${String(value) === String(opt.value) ? 'checked' : ''}>${opt.label}</label>`).join('')}
    </div>
  </div>`;
}
function renderInfoBox(text) {
  return `<div class="info-box"><span class="material-icons-outlined">lightbulb</span><p>${text}</p></div>`;
}
const YES_NO = [{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nein' }];
const yesNoValue = v => (v === true ? 'yes' : v === false ? 'no' : '');

// Wire text inputs of a step to salesFormData (and the required-border toggle).
function bindTextInputs(fields, onInput) {
  fields.forEach(({ id, key, required }) => {
    const input = $(id);
    if (!input) return;
    input.addEventListener('input', event => {
      salesFormData[key] = event.target.value;
      if (required) input.classList.toggle('required', isBlank(event.target.value));
      if (onInput) onInput();
    });
  });
}
function bindRadios(name, handler) {
  $$(`input[name="${name}"]`).forEach(radio => radio.addEventListener('change', event => handler(event.target.value, event)));
}

// --- Step 1: Objekt erfassen ---
function renderStep1() {
  const { location } = salesFormData;
  const hasLocation = location.coords.E && location.coords.N;
  return `
    ${renderStepHeader('1. Objekt erfassen', 'Suchen Sie nach der Adresse und geben Sie die Basisinformationen zum Objekt ein.')}
    <div class="sales-form-step-content">
      <div class="sales-form-section form-field">
        <label class="form-label required" for="locationSearchInput">Adresse oder Standort suchen</label>
        <div class="search-field" id="locationSearchField">
          <span class="material-icons-outlined search-field-icon">search</span>
          <input type="text" class="input ${hasLocation ? '' : 'required'}" id="locationSearchInput" placeholder="Mit Adresse, PLZ oder Ort suchen..." value="${escapeHtml(location.searchText)}" autocomplete="off">
          <button type="button" class="icon-btn icon-btn-sm input-clear ${location.searchText ? 'visible' : ''}" id="searchClearBtn" onclick="clearSearchInput()" aria-label="Suche löschen"><span class="material-icons-outlined">close</span></button>
          <div class="sales-form-search-results" id="locationSearchResults"></div>
        </div>
        ${hasLocation ? `
          <div class="info-box info-box-accent sales-form-selected-location">
            <span class="material-icons-outlined">location_on</span>
            <span class="info-box-text">${escapeHtml(location.label)}</span>
            <button type="button" class="icon-btn icon-btn-sm" onclick="clearSelectedLocation()" aria-label="Standort entfernen"><span class="material-icons-outlined">close</span></button>
          </div>` : ''}
      </div>

      <div class="sales-form-section">
        <label class="form-label">Verortung</label>
        <div class="sales-form-map-container">
          ${hasLocation
            ? `<iframe src="https://map.geo.admin.ch/embed.html?lang=de&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe&E=${location.coords.E}&N=${location.coords.N}&zoom=10&crosshair=marker" title="Karte"></iframe>`
            : '<div class="sales-form-map-placeholder"><span class="material-icons-outlined">map</span><span>Suchen Sie nach einem Standort, um die Karte anzuzeigen</span></div>'}
        </div>
      </div>

      <div class="sales-form-section">
        <label class="form-label">Das Objekt ist ein(e)...</label>
        <div class="sales-form-type-grid">
          ${PROPERTY_TYPES.map(type => `
            <label class="sales-form-type-card ${salesFormData.propertyType === type.id ? 'selected' : ''}" data-type="${type.id}">
              <input type="radio" name="propertyType" value="${type.id}" ${salesFormData.propertyType === type.id ? 'checked' : ''}>
              <span class="material-icons-outlined sales-form-type-card-icon">${type.icon}</span>
              <span class="sales-form-type-card-label">${type.label}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="sales-form-divider"></div>
      <div class="sales-form-input-grid">
        <div class="form-field">
          <label class="form-label required" for="saleYearSelect">In welchem Geschäftsjahr soll die Liegenschaft verkauft werden?</label>
          <select class="input input-select ${requiredClass(salesFormData.saleYear)}" id="saleYearSelect">
            <option value="">Auswahl Verkaufsjahr</option>
            ${SALE_YEARS.map(year => `<option value="${year}" ${salesFormData.saleYear === year ? 'selected' : ''}>${year}</option>`).join('')}
          </select>
        </div>
        ${renderRadioField({ name: 'saleReason', label: 'Aus welchem Grund möchten Sie die Liegenschaft verkaufen?', options: SALE_REASONS, value: salesFormData.saleReason, required: true, horizontal: false })}
      </div>
    </div>
    ${renderStepNav({ back: false })}`;
}
function setupStep1Handlers() {
  const searchInput = $('locationSearchInput');
  const searchResults = $('locationSearchResults');
  const clearBtn = $('searchClearBtn');
  const search = debounce(searchGeoAdmin, 300);
  searchInput.addEventListener('input', event => {
    const query = event.target.value.trim();
    salesFormData.location.searchText = query;
    clearBtn.classList.toggle('visible', query.length > 0);
    if (query.length < 2) { searchResults.classList.remove('active'); return; }
    search(query);
  });
  searchInput.addEventListener('focus', () => { if (searchInput.value.length >= 2) searchResults.classList.add('active'); });

  $$('.sales-form-type-card').forEach(card => card.addEventListener('click', () => {
    salesFormData.propertyType = card.dataset.type;
    $$('.sales-form-type-card').forEach(c => c.classList.toggle('selected', c === card));
  }));
  $('saleYearSelect').addEventListener('change', event => {
    salesFormData.saleYear = event.target.value ? parseInt(event.target.value, 10) : null;
    event.target.classList.toggle('required', !salesFormData.saleYear);
  });
  bindRadios('saleReason', (value, event) => {
    salesFormData.saleReason = value;
    event.target.closest('.radio-group').classList.remove('required');
  });
}
async function searchGeoAdmin(query) {
  const results = $('locationSearchResults');
  results.innerHTML = renderEmptyState('', 'Suche...', { small: true });
  results.classList.add('active');
  try {
    const response = await fetch(`${GEO_ADMIN_SEARCH_URL}?searchText=${encodeURIComponent(query)}&type=locations&limit=10`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      results.innerHTML = renderEmptyState('', 'Keine Ergebnisse gefunden', { small: true });
      return;
    }
    results.innerHTML = data.results.map(({ attrs }) => `
      <div class="sales-form-search-result" data-label="${escapeHtml(attrs.label)}" data-east="${attrs.y}" data-north="${attrs.x}" role="button" tabindex="0">
        <div class="sales-form-search-result-title">${attrs.label}</div>
        <div class="sales-form-search-result-subtitle">${escapeHtml(attrs.origin || '')}</div>
      </div>`).join('');
  } catch (error) {
    console.error('Error searching geo.admin.ch:', error);
    results.innerHTML = renderEmptyState('', 'Fehler bei der Suche', { small: true });
  }
}
function selectLocation(label, east, north) {
  Object.assign(salesFormData.location, { label, searchText: label, coords: { E: east, N: north } });
  renderSalesFormStepContent();
}
function clearSelectedLocation() {
  salesFormData.location = createSalesFormData().location;
  renderSalesFormStepContent();
}
function clearSearchInput() {
  salesFormData.location.searchText = '';
  $('locationSearchInput').value = '';
  $('searchClearBtn').classList.remove('visible');
  $('locationSearchResults').classList.remove('active');
}

// --- Step 2: Angaben zum Objekt ---
function renderStep2() {
  const d = salesFormData;
  return `
    ${renderStepHeader('2. Angaben zum Objekt', 'Diese Informationen stammen aus internen und externen Partner-Datenbanken. Bitte korrigieren Sie eventuelle Fehler direkt im Formular.')}
    <div class="sales-form-step-content">
      <div class="sales-form-input-grid two-column">
        ${renderNumberField({ id: 'floorsInput', label: 'Anzahl Geschosse', value: d.floors, required: true })}
        ${renderRadioField({ name: 'isHeated', label: 'Objekt ist beheizt?', options: YES_NO, value: yesNoValue(d.isHeated) })}
        ${renderNumberField({ id: 'livingAreaInput', label: 'Wohnfläche in m² (nur Wohnbau)', value: d.livingArea, suffix: 'm²' })}
        <div class="form-field">
          ${renderRadioField({ name: 'hasBuildingRights', label: 'Baurecht vorhanden?', options: YES_NO, value: yesNoValue(d.hasBuildingRights) }).replace('<div class="form-field ">', '<div>')}
          ${d.hasBuildingRights === true ? `<input type="number" class="input mt-2" id="buildingRightsFeeInput" placeholder="Baurechtszins in CHF" value="${escapeHtml(d.buildingRightsFee)}" aria-label="Baurechtszins in CHF">` : ''}
        </div>
        ${renderNumberField({ id: 'apartmentsInput', label: 'Anzahl Wohnungen (nur Wohnbau)', value: d.apartments })}
        ${renderNumberField({ id: 'roomsInput', label: 'Anzahl Zimmer (nur Wohnbau)', value: d.rooms })}
        ${renderNumberField({ id: 'parkingSpacesInput', label: 'Anzahl Parkplätze', value: d.parkingSpaces, required: true })}
      </div>

      <div class="sia-416-widget">
        <div class="sia-416-title">Bemessungen nach SIA 416</div>
        ${SIA_416_SECTIONS.map(renderSiaSection).join('')}
        <button type="button" class="toggle-btn sia-416-toggle ${d.sia416Expanded ? 'expanded' : ''}" id="sia416Toggle" onclick="toggleSia416()">
          <span class="material-icons-outlined">expand_more</span>
          <span id="sia416ToggleText">${d.sia416Expanded ? 'Zusätzliche Angaben ausblenden' : 'Zusätzliche Angaben einblenden'}</span>
        </button>
      </div>
      ${renderInfoBox('Mit Stern* markierte Informationen sind Pflichtfelder. Angaben zur Grundstücksfläche werden automatisch aus der <a href="https://map.geo.admin.ch/#/map?lang=de&center=2669393.97,1204289.63&z=2&topic=ech&layers=ch.swisstopo-vd.stand-oerebkataster&bgLayer=ch.swisstopo.pixelkarte-farbe" target="_blank" rel="noopener">Amtlichen Vermessung</a> ermittelt.')}

      <div class="sales-form-photos-section">
        <div class="sales-form-photos-title">Fotos</div>
        <p class="sales-form-photos-description">Im folgenden Abschnitt können Objekt Fotos hochgeladen werden. Mehrere Bilder können einzeln hochgeladen werden.</p>
        <label class="btn btn-secondary"><input type="file" accept="image/*" multiple class="visually-hidden" onchange="handlePhotoUpload(event)">Bild hochladen</label>
        <div class="sales-form-photos-grid" id="photosGrid">${renderPhotoThumbs()}</div>
      </div>
      ${renderInfoBox('Für eine präzise Bewertung sind Fotos von <a href="#" class="link">aussen</a> und <a href="#" class="link">innen erforderlich</a>. Sollten keine Bilder verfügbar sein, lassen Sie das Feld bitte leer. Achten Sie darauf, keine urheberrechtlich geschützten Bilder hochzuladen.')}

      <div class="sales-form-rating-section">
        ${renderRatingScale('condition')}
        ${renderRatingScale('standard', 'mt-8')}
      </div>
    </div>
    ${renderStepNav()}`;
}
function renderSiaRow(row, section) {
  const value = salesFormData.areas[row.key] || '';
  const isReference = row.key === section.reference;
  return `
    <div class="sia-416-row">
      <span class="sia-416-abbr ${row.required ? 'required' : ''}">${row.key}</span>
      <span class="sia-416-name">${row.name}</span>
      <div class="input-with-suffix">
        <input type="number" class="input ${row.required ? requiredClass(value) : ''}" id="area${row.key}Input" data-area="${row.key}" placeholder="Angabe fehlt" value="${escapeHtml(value)}" aria-label="${row.name}">
        <span class="input-suffix">${section.unit || 'm²'}</span>
      </div>
      <span class="sia-416-percent" id="${row.key.toLowerCase()}Percent">${isReference ? '' : `0% ${section.reference}`}</span>
    </div>`;
}
function renderSiaSection(section) {
  const visible = salesFormData.sia416Expanded ? 'visible' : '';
  let html = '';
  let optionalRows = [];
  const flush = () => { if (optionalRows.length) { html += `<div class="sia-416-optional ${visible}">${optionalRows.join('')}</div>`; optionalRows = []; } };
  section.rows.forEach(row => {
    const markup = renderSiaRow(row, section);
    if (row.optional) optionalRows.push(markup); else { flush(); html += markup; }
  });
  flush();
  const inner = `<div class="sia-416-section"><div class="subsection-title">${section.title}</div>${html}</div>`;
  return section.optional ? `<div class="sia-416-optional ${visible}" id="sia416${section.id}">${inner}</div>` : inner;
}
function renderRatingScale(key, extraClass = '') {
  const scale = RATING_SCALES[key];
  return `
    <div class="sales-form-rating ${extraClass}">
      <div class="sales-form-rating-label">${scale.label}</div>
      <div class="sales-form-rating-grid" id="${key}Rating" data-rating="${key}">
        <div class="sales-form-rating-track-line"></div>
        ${scale.sectors.map(sector => `
          <div class="sales-form-rating-sector ${sector.value === salesFormData[key] ? 'active' : ''}" data-value="${sector.value}" data-target="${key}" role="radio" aria-checked="${sector.value === salesFormData[key]}" aria-label="${sector.summary}">
            <div class="sales-form-rating-sector-icon">${sector.icon ? `<span class="material-icons-outlined">${sector.icon}</span>` : ''}</div>
            <div class="sales-form-rating-sector-dot"><span class="sales-form-rating-dot"></span></div>
            <div class="sales-form-rating-sector-label">${sector.label || ''}</div>
          </div>`).join('')}
      </div>
    </div>
    ${renderInfoBox(scale.info)}`;
}
function renderPhotoThumbs() {
  return salesFormData.photos.map((photo, index) => `
    <div class="media sales-form-photo-thumb" style="background-image: url('${photo}')">
      <button type="button" class="icon-btn sales-form-photo-remove" onclick="removePhoto(${index})" aria-label="Foto entfernen"><span class="material-icons-outlined">close</span></button>
    </div>`).join('');
}
function setupStep2Handlers() {
  bindTextInputs(STEP_FIELDS[2]);
  $$('input[data-area]').forEach(input => input.addEventListener('input', event => {
    const key = input.dataset.area;
    salesFormData.areas[key] = event.target.value;
    const row = SIA_416_ROWS.find(r => r.key === key);
    if (row && row.required) input.classList.toggle('required', isBlank(event.target.value));
    updateAreaPercentages();
  }));
  bindRadios('isHeated', value => { salesFormData.isHeated = value === 'yes'; });
  bindRadios('hasBuildingRights', value => { salesFormData.hasBuildingRights = value === 'yes'; renderSalesFormStepContent(); });
  $$('.sales-form-rating-sector').forEach(sector => sector.addEventListener('click', () => {
    const key = sector.dataset.target;
    const value = parseInt(sector.dataset.value, 10);
    salesFormData[key] = value;
    $$(`[data-rating="${key}"] .sales-form-rating-sector`).forEach(s => {
      const active = parseInt(s.dataset.value, 10) === value;
      s.classList.toggle('active', active);
      s.setAttribute('aria-checked', active);
    });
  }));
}
function updateAreaPercentages() {
  SIA_416_SECTIONS.forEach(section => {
    const reference = parseFloat(salesFormData.areas[section.reference]) || 0;
    section.rows.filter(row => row.key !== section.reference).forEach(row => {
      const el = $(`${row.key.toLowerCase()}Percent`);
      if (!el) return;
      const value = parseFloat(salesFormData.areas[row.key]) || 0;
      el.textContent = `${reference > 0 ? Math.round((value / reference) * 100) : 0}% ${section.reference}`;
    });
  });
}
function toggleSia416() {
  salesFormData.sia416Expanded = !salesFormData.sia416Expanded;
  $$('.sia-416-optional').forEach(section => section.classList.toggle('visible', salesFormData.sia416Expanded));
  $('sia416Toggle').classList.toggle('expanded', salesFormData.sia416Expanded);
  $('sia416ToggleText').textContent = salesFormData.sia416Expanded ? 'Zusätzliche Angaben ausblenden' : 'Zusätzliche Angaben einblenden';
}
function handlePhotoUpload(event) {
  Array.from(event.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => { salesFormData.photos.push(e.target.result); $('photosGrid').innerHTML = renderPhotoThumbs(); };
    reader.readAsDataURL(file);
  });
}
function removePhoto(index) {
  salesFormData.photos.splice(index, 1);
  $('photosGrid').innerHTML = renderPhotoThumbs();
}

// --- Step 3: Angaben zum Mieter ---
function renderStep3() {
  const d = salesFormData;
  return `
    ${renderStepHeader('3. Angaben zum Mieter', 'Fast geschafft. Für eine genauere Marktwertbewertung benötigen wir ein paar zusätzliche Angaben zum Mieter.')}
    <div class="sales-form-step-content">
      <div class="sales-form-input-grid">
        ${renderNumberField({ id: 'residentialLeasesInput', label: 'Anzahl Wohnungsmietverträge', value: d.residentialLeases, required: true })}
        ${renderNumberField({ id: 'commercialLeasesInput', label: 'Anzahl Geschäftsmietverträge', value: d.commercialLeases, required: true })}
        ${renderNumberField({ id: 'monthlyRentInput', label: 'Total Mietertrag netto pro Monat in CHF', value: d.monthlyRent, required: true, suffix: 'CHF' })}
        ${renderNumberField({ id: 'rentArrearsInput', label: 'Höhe Mietzinsausstände in CHF', value: d.rentArrears, required: true, suffix: 'CHF' })}
        ${renderRadioField({ name: 'hasVerbalAgreements', label: 'Mündliche Vereinbarungen mit Mietern, Nachbarn etc.', options: YES_NO, value: yesNoValue(d.hasVerbalAgreements), required: true, full: true })}
        ${d.hasVerbalAgreements === true ? `
          <div class="form-field full-width">
            <label class="form-label" for="verbalAgreementsInput">Beschreibung Mündliche Vereinbarungen</label>
            <textarea class="input input-textarea" id="verbalAgreementsInput" placeholder="Angabe fehlt">${escapeHtml(d.verbalAgreementsDescription)}</textarea>
          </div>` : ''}
      </div>
    </div>
    ${renderStepNav()}`;
}
function setupStep3Handlers() {
  bindTextInputs(STEP_FIELDS[3]);
  bindRadios('hasVerbalAgreements', value => { salesFormData.hasVerbalAgreements = value === 'yes'; renderSalesFormStepContent(); });
}

// --- Step 4: Zusammenfassung ---
const ratingSummary = key => { const s = RATING_SCALES[key].sectors.find(sec => sec.value === salesFormData[key]); return s ? `${s.summary} (${s.value}/5)` : ''; };
const SUMMARY_SECTIONS = [
  { title: '1. Objekt erfassen', step: 1, items: [
    { label: 'Standort', value: d => d.location.label, full: true },
  ] },
  { title: '1. Objekt erfassen', step: 1, items: [
    { label: 'Objektart', value: d => (PROPERTY_TYPES.find(t => t.id === d.propertyType) || {}).label },
    { label: 'Verkaufsjahr', value: d => d.saleYear },
    { label: 'Verkaufsgrund', value: d => (SALE_REASONS.find(r => r.value === d.saleReason) || {}).label },
  ] },
  { title: '2. Angaben zum Objekt', step: 2, items: [
    { label: 'Anzahl Geschosse', value: d => d.floors },
    { label: 'Beheizt', value: d => (d.isHeated === null ? '' : formatYesNo(d.isHeated)) },
    { label: 'Wohnfläche', value: d => (d.livingArea ? `${d.livingArea} m²` : '') },
    { label: 'Baurecht', value: d => (d.hasBuildingRights === null ? '' : formatYesNo(d.hasBuildingRights)) },
    { label: 'Anzahl Wohnungen', value: d => d.apartments },
    { label: 'Anzahl Zimmer', value: d => d.rooms },
    { label: 'Anzahl Parkplätze', value: d => d.parkingSpaces },
    { label: 'Geschossfläche (GF)', value: d => (d.areas.GF ? `${d.areas.GF} m²` : '') },
    { label: 'Vermietbare Fläche (VMF)', value: d => (d.areas.VMF ? `${d.areas.VMF} m²` : '') },
    { label: 'Zustand', value: () => ratingSummary('condition') },
    { label: 'Ausbaustandard', value: () => ratingSummary('standard') },
    { label: 'Fotos', value: d => (d.photos.length ? `${d.photos.length} Bild(er) hochgeladen` : ''), emptyText: 'Keine Fotos' },
  ] },
  { title: '3. Angaben zum Mieter', step: 3, items: [
    { label: 'Wohnungsmietverträge', value: d => d.residentialLeases },
    { label: 'Geschäftsmietverträge', value: d => d.commercialLeases },
    { label: 'Monatlicher Mietertrag', value: d => (d.monthlyRent ? formatCHF(parseInt(d.monthlyRent, 10)) : '') },
    { label: 'Mietzinsausstände', value: d => (d.rentArrears ? formatCHF(parseInt(d.rentArrears, 10)) : '') },
    { label: 'Mündliche Vereinbarungen', value: d => (d.hasVerbalAgreements === null ? '' : formatYesNo(d.hasVerbalAgreements)) },
    { label: 'Beschreibung', value: d => d.verbalAgreementsDescription, full: true, when: d => d.hasVerbalAgreements === true && d.verbalAgreementsDescription },
  ] },
];
function renderStep4() {
  const d = salesFormData;
  return `
    ${renderStepHeader('4. Zusammenfassung', 'Bitte überprüfen Sie Ihre Angaben. Sie können die einzelnen Abschnitte bearbeiten, indem Sie auf "Bearbeiten" klicken.')}
    <div class="sales-form-step-content">
      <div class="sales-form-summary">
        ${SUMMARY_SECTIONS.map(section => `
          <div class="sales-form-summary-section">
            <div class="sales-form-summary-header">
              <span class="sales-form-summary-title">${section.title}</span>
              <button type="button" class="link link-icon sales-form-summary-edit-btn" onclick="goToSalesFormStep(${section.step})"><span class="material-icons-outlined">edit</span>Bearbeiten</button>
            </div>
            <div class="sales-form-summary-content">
              <div class="sales-form-summary-grid">
                ${section.items.filter(item => !item.when || item.when(d)).map(item => {
                  const value = item.value(d);
                  const empty = isBlank(value);
                  return renderDataItem(item.label, empty ? (item.emptyText || 'Nicht angegeben') : escapeHtml(value), { compact: true, full: item.full, empty });
                }).join('')}
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="sales-form-submit-section">
        <button type="button" class="btn btn-primary btn-lg" onclick="submitSalesForm()">Auftrag erstellen</button>
      </div>
    </div>
    ${renderStepNav({ next: false })}`;
}
