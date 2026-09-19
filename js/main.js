/* ==========================================================================
   Entry point: global event delegation and start-up.
   Module load order (index.html): config, state, utils, router, ui, filters,
   views, detail, sales-form, api-docs, main. All scripts share the global
   scope so inline handlers in the markup can call the public functions.
   ========================================================================== */

// One delegated click handler for everything rendered dynamically.
document.addEventListener('click', event => {
  const target = event.target;

  // Location search results (wizard step 1) close when clicking outside the field
  const results = $('locationSearchResults');
  if (results && !target.closest('#locationSearchField')) results.classList.remove('active');

  const tag = target.closest('.tag[data-filter]');
  if (tag) {
    event.preventDefault();
    event.stopPropagation();
    if (tag.dataset.detail === 'true') closeDetailPage();
    addFilter(tag.dataset.filter, tag.dataset.value);
    return;
  }
  const chip = target.closest('.chip[data-filter], .filter-option[data-filter]');
  if (chip) { toggleFilter(chip.dataset.filter, chip.dataset.value); return; }
  if (target.closest('#resetFilters')) { resetAllFilters(); return; }

  const tab = target.closest('.tab[data-tab]');
  if (tab) { switchTab(tab.dataset.tab); return; }

  // The checkbox itself is small: the whole cell toggles it
  const checkboxCell = target.closest('.data-table-checkbox');
  if (checkboxCell && target.tagName !== 'INPUT') {
    const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
    if (checkbox) { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change', { bubbles: true })); }
    return;
  }

  const galleryImage = target.closest('.detail-gallery [data-image-index]');
  if (galleryImage) {
    openCarousel(JSON.parse($('detailGallery').dataset.images), parseInt(galleryImage.dataset.imageIndex, 10));
    return;
  }
  const carouselThumb = target.closest('[data-carousel-index]');
  if (carouselThumb) { goToCarouselImage(parseInt(carouselThumb.dataset.carouselIndex, 10)); return; }

  const card = target.closest('.card[data-id]');
  if (card) { openDetailPage(card.dataset.id); return; }
  const row = target.closest('#listTableBody tr[data-id]');
  if (row) { openDetailPage(row.dataset.id); return; }
  const sidebarItem = target.closest('.map-sidebar-item[data-id]');
  if (sidebarItem) { flyToProperty(sidebarItem.dataset.id); return; }

  const searchResult = target.closest('.sales-form-search-result[data-label]');
  if (searchResult) { selectLocation(searchResult.dataset.label, parseFloat(searchResult.dataset.east), parseFloat(searchResult.dataset.north)); return; }

  const endpointHeader = target.closest('.api-endpoint-header');
  if (endpointHeader) endpointHeader.parentElement.classList.toggle('open');
});

// Keyboard activation for card-like elements that are not buttons
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const el = event.target.closest('.card[data-id], .filter-option[data-filter], .api-endpoint-header, .sales-form-search-result[data-label], .sales-form-rating-sector');
  if (el) { event.preventDefault(); el.click(); }
});

function init() {
  // Icons come from Google Fonts. If that CDN is blocked (offline, restrictive
  // network) the ligature names would render as words; flag it so CSS can hide them.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('24px "Material Icons Outlined"')
      .then(faces => { if (!faces.length) document.documentElement.classList.add('no-icon-font'); })
      .catch(() => document.documentElement.classList.add('no-icon-font'));
  }

  const initialParams = getRouteParams(); // before setView() rewrites the address bar
  $('filterBtn').addEventListener('click', openFilterModal);
  $('filterCloseBtn').addEventListener('click', closeFilterModal);
  $('filterResetBtn').addEventListener('click', resetAllFilters);
  $('filterModalOverlay').addEventListener('click', event => closeOnBackdrop(event, closeFilterModal));
  setupSearch();
  setupViewToggle();
  initUploadDropzone();
  renderDocumentTypeOptions();
  loadFiltersFromUrl(initialParams);
  setView(state.currentView);

  fetch('data/data.json')
    .then(response => response.json())
    .then(data => {
      state.properties = data;
      extractFilterOptions();
      applyFilters();
      applyRoute(initialParams);
    })
    .catch(error => {
      console.error('Error loading data:', error);
      $('objectGrid').innerHTML = renderEmptyState('error_outline', 'Fehler beim Laden. Starte via Live Server.');
    });
}
init();
