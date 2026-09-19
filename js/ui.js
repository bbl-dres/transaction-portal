/* ==========================================================================
   Generic UI behaviour: overlays, tabs, selectable tables, carousel,
   keyboard shortcuts, login dialog.
   ========================================================================== */

// --- Overlays (dialogs, filter modal, carousel) ---
const openOverlays = new Set();
function openOverlay(id) {
  $(id).classList.add('active');
  openOverlays.add(id);
  document.body.style.overflow = 'hidden';
}
function closeOverlay(id) {
  $(id).classList.remove('active');
  openOverlays.delete(id);
  if (openOverlays.size === 0) document.body.style.overflow = '';
}
function isOverlayOpen(id) { return $(id).classList.contains('active'); }
// For onclick on the backdrop element itself.
function closeOnBackdrop(event, closeFn) { if (event.target === event.currentTarget) closeFn(); }

// --- Tabs: <button class="tab" data-tab="x"> shows <div class="tab-panel" data-tab="x"> ---
function switchTab(name) {
  const key = String(name).toLowerCase();
  $$('.tab[data-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === key));
  $$('.tab-panel[data-tab]').forEach(panel => panel.classList.toggle('active', panel.dataset.tab === key));
}

// --- Selectable tables: header checkbox, row highlight, buttons that need a selection ---
function toggleAllRows(headerCheckbox) {
  const table = headerCheckbox.closest('table');
  $$('tbody input[type="checkbox"]', table).forEach(cb => { cb.checked = headerCheckbox.checked; });
  updateRowSelection(headerCheckbox);
}
function updateRowSelection(element) {
  const table = element.closest('table');
  const boxes = $$('tbody input[type="checkbox"]', table);
  boxes.forEach(cb => cb.closest('tr').classList.toggle('selected', cb.checked));
  const checked = boxes.filter(cb => cb.checked).length;
  const header = table.querySelector('thead input[type="checkbox"]');
  if (header) {
    header.checked = boxes.length > 0 && checked === boxes.length;
    header.indeterminate = checked > 0 && checked < boxes.length;
  }
  setSelectionButtons(table.closest('.tab-panel') || document, checked > 0);
}
function setSelectionButtons(scope, enabled) {
  $$('[data-requires-selection]', scope).forEach(btn => { btn.disabled = !enabled; });
}
function selectedRowIds(scope, dataKey) {
  return $$('tbody input[type="checkbox"]:checked', scope).map(cb => cb.closest('tr').dataset[dataKey]);
}
function filterTableRows(input) {
  const scope = input.closest('.tab-panel') || document;
  const term = input.value.trim().toLowerCase();
  $$('tbody tr', scope).forEach(row => { row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none'; });
}

// --- Image carousel ---
let carouselImages = [];
let carouselIndex = 0;
function openCarousel(images, startIndex = 0) {
  carouselImages = images;
  carouselIndex = startIndex;
  updateCarouselView();
  openOverlay('carouselOverlay');
}
function closeCarousel() { closeOverlay('carouselOverlay'); }
function navigateCarousel(direction) { goToCarouselImage(carouselIndex + direction); }
function goToCarouselImage(index) {
  if (index < 0 || index >= carouselImages.length) return;
  carouselIndex = index;
  updateCarouselView();
}
function updateCarouselView() {
  $('carouselCounter').textContent = `${carouselIndex + 1} / ${carouselImages.length}`;
  $('carouselImage').src = carouselImages[carouselIndex].replace('w=400&h=300', 'w=1200&h=900');
  document.querySelector('.carousel-nav-btn.prev').disabled = carouselIndex === 0;
  document.querySelector('.carousel-nav-btn.next').disabled = carouselIndex === carouselImages.length - 1;
  $('carouselThumbnails').innerHTML = carouselImages.map((img, idx) => `
    <div class="media carousel-thumb ${idx === carouselIndex ? 'active' : ''}" style="background-image: url('${img}')" data-carousel-index="${idx}" role="button" aria-label="Bild ${idx + 1}"></div>`).join('');
}

// --- Login dialog (mock) ---
function openLoginDialog() {
  $('loginEmail').value = '';
  $('loginPassword').value = '';
  openOverlay('loginDialogOverlay');
}
function closeLoginDialog() { closeOverlay('loginDialogOverlay'); }
function submitLogin() { closeLoginDialog(); }

// --- Keyboard: Escape closes the topmost layer, arrows drive the carousel ---
document.addEventListener('keydown', event => {
  if (isOverlayOpen('carouselOverlay')) {
    if (event.key === 'Escape') closeCarousel();
    else if (event.key === 'ArrowLeft') navigateCarousel(-1);
    else if (event.key === 'ArrowRight') navigateCarousel(1);
    return;
  }
  if (event.key !== 'Escape') return;
  if (isOverlayOpen('uploadDialogOverlay')) closeUploadDialog();
  else if (isOverlayOpen('loginDialogOverlay')) closeLoginDialog();
  else if (isOverlayOpen('filterModalOverlay')) closeFilterModal();
  else if ($('detailView').classList.contains('active')) closeDetailPage();
});
