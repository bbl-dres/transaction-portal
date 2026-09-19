    let properties = [];
    let filteredProperties = [];
    let searchQuery = '';
    let currentView = 'gallery';
    let map = null;
    let mapLoaded = false;
    let markers = [];
    let markersMap = new Map();

    // Advanced filter state
    let advancedFilters = {
      type: new Set(),        // Nutzung
      year: new Set(),        // Verkaufsjahr
      priority: new Set(),    // Priorisierung
      milestone: new Set(),   // Meilenstein
      portfolio: new Set()    // Portfolio
    };

    // Unique values from data (populated after load)
    let filterOptions = {
      type: [],
      year: [],
      priority: [],
      milestone: [],
      portfolio: []
    };

    // Carousel state
    let carouselImages = [];
    let carouselIndex = 0;

    function getUrlParams() {
      const params = new URLSearchParams(window.location.search);
      return {
        view: params.get('view'),
        id: params.get('id'),
        q: params.get('q'),
        type: params.get('type'),
        year: params.get('year'),
        priority: params.get('priority'),
        milestone: params.get('milestone'),
        portfolio: params.get('portfolio')
      };
    }

    function updateUrlParams() {
      const params = new URLSearchParams();
      if (currentView !== 'gallery') params.set('view', currentView);
      if (searchQuery) params.set('q', searchQuery);

      // Add all advanced filters
      Object.keys(advancedFilters).forEach(key => {
        if (advancedFilters[key].size > 0) {
          params.set(key, Array.from(advancedFilters[key]).join(','));
        }
      });

      const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    function loadFiltersFromUrl() {
      const params = getUrlParams();
      if (params.view && ['gallery', 'list', 'map'].includes(params.view)) currentView = params.view;
      if (params.q) {
        searchQuery = params.q;
        document.getElementById('searchInput').value = searchQuery;
        document.getElementById('searchInputClear').classList.add('visible');
      }

      // Load all advanced filters from URL
      ['type', 'year', 'priority', 'milestone', 'portfolio'].forEach(key => {
        if (params[key]) {
          params[key].split(',').forEach(val => advancedFilters[key].add(val));
        }
      });
    }

    function getPriorityClass(priority) { return (priority === null || priority === undefined) ? 'priority-null' : `priority-${priority}`; }
    function getPriorityLabel(priority, priorityLabel) { return (priority === null || priority === undefined) ? 'Keine Angabe' : priorityLabel; }
    function getPriorityValue(priority) { return (priority === null || priority === undefined) ? 'null' : String(priority); }
    function formatCHF(value) { return (!value) ? 'CHF 0' : 'CHF ' + value.toLocaleString('de-CH').replace(/,/g, "'"); }
    function formatNumber(value) { return (!value && value !== 0) ? '0' : value.toLocaleString('de-CH').replace(/,/g, "'"); }
    function formatPriceRange(min, max) { return ((!min) && (!max)) ? 'CHF 0 - CHF 0' : formatCHF(min) + ' - ' + formatCHF(max); }
    function pricePerSqm(price, area) { return (!price || !area) ? 0 : Math.round(price / area); }
    function formatCoord(value, dir) {
      if (!value) return '-';
      const abs = Math.abs(value);
      const deg = Math.floor(abs);
      const minFloat = (abs - deg) * 60;
      const min = Math.floor(minFloat);
      const sec = ((minFloat - min) * 60).toFixed(1);
      return `${deg}°${min}'${sec}"${dir}`;
    }

    function getPlaceholderImage(type, id) {
      const idStr = String(id);
      const hash = idStr.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
      const imageIndex = Math.abs(hash) % 5;
      const images = ['https://images.unsplash.com/photo-1568605114967-8130f3a36994', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab', 'https://images.unsplash.com/photo-1581094794329-c8112a89af12'];
      return images[imageIndex] + '?w=400&h=300&fit=crop';
    }

    // Extract unique filter options from data
    function extractFilterOptions() {
      const types = new Set();
      const years = new Set();
      const priorities = new Map(); // value -> label
      const milestones = new Map(); // current/total -> label
      const portfolios = new Set();

      properties.forEach(prop => {
        if (prop.type) types.add(prop.type);
        if (prop.year) years.add(prop.year);

        const pKey = prop.priority !== null && prop.priority !== undefined ? String(prop.priority) : 'null';
        const pLabel = getPriorityLabel(prop.priority, prop.priorityLabel);
        priorities.set(pKey, pLabel);

        if (prop.milestone) {
          const mKey = `${prop.milestone.current}/${prop.milestone.total}`;
          milestones.set(mKey, prop.milestone.label);
        }

        if (prop.portfolio) portfolios.add(prop.portfolio);
      });

      filterOptions.type = Array.from(types).sort();
      filterOptions.year = Array.from(years).sort((a, b) => a - b);
      filterOptions.priority = Array.from(priorities.entries()).map(([value, label]) => ({ value, label }));
      filterOptions.milestone = Array.from(milestones.entries()).map(([value, label]) => ({ value, label }));
      filterOptions.portfolio = Array.from(portfolios).sort();
    }

    // Check if any filters are active
    function hasActiveFilters() {
      return Object.values(advancedFilters).some(set => set.size > 0) || searchQuery;
    }

    // Count total active filters (excluding search)
    function getActiveFilterCount() {
      let count = 0;
      Object.values(advancedFilters).forEach(set => count += set.size);
      return count;
    }

    // Get priority counts from all properties
    function getPriorityCounts() {
      const counts = { '0': 0, '1': 0, '2': 0, '3': 0, 'null': 0 };
      properties.forEach(prop => {
        const pKey = prop.priority !== null && prop.priority !== undefined ? String(prop.priority) : 'null';
        if (counts.hasOwnProperty(pKey)) counts[pKey]++;
      });
      return counts;
    }

    // Update the filter button appearance and count
    function updateFilterButtonState() {
      const btn = document.getElementById('filterBtn');
      const countEl = document.getElementById('filterCount');
      const count = getActiveFilterCount();

      if (count > 0) {
        btn.classList.add('has-filters');
        countEl.textContent = count;
        countEl.style.display = 'inline';
      } else {
        btn.classList.remove('has-filters');
        countEl.style.display = 'none';
      }
    }

    // Render priority pills and reset button
    function renderPriorityPills() {
      const container = document.getElementById('filterPills');
      const counts = getPriorityCounts();

      // Priority labels mapping
      const priorityLabels = {
        '0': 'Hohe Priorität',
        '1': 'Normale Priorität',
        '2': 'Geringe Priorität',
        '3': 'Keine Priorität',
        'null': 'Keine Angabe'
      };

      // Build pills HTML
      let html = ['0', '1', '2', '3', 'null'].map(pKey => {
        const isActive = advancedFilters.priority.has(pKey);
        return `
          <button class="filter-pill ${isActive ? 'active' : ''}" data-priority="${pKey}">
            ${priorityLabels[pKey]} (${counts[pKey]})
            <span class="material-icons-outlined close-icon">close</span>
          </button>
        `;
      }).join('');

      // Add reset button
      html += `
        <button class="reset-filters ${hasActiveFilters() ? 'visible' : ''}" id="resetFilters" title="Alle Filter zurücksetzen">
          <span class="material-icons-outlined">replay</span>
        </button>
      `;

      container.innerHTML = html;

      // Add click handlers for priority pills
      container.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const priority = pill.dataset.priority;
          if (advancedFilters.priority.has(priority)) {
            advancedFilters.priority.delete(priority);
          } else {
            advancedFilters.priority.add(priority);
          }
          applyFilters();
          renderFilterModal();
        });
      });

      // Add click handler for reset button
      const resetBtn = container.querySelector('#resetFilters');
      if (resetBtn) {
        resetBtn.addEventListener('click', resetAllFilters);
      }
    }

    // Reset all filters
    function resetAllFilters() {
      Object.keys(advancedFilters).forEach(key => advancedFilters[key].clear());
      searchQuery = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('searchInputClear').classList.remove('visible');
      applyFilters();
      if (document.getElementById('filterModalOverlay').classList.contains('active')) {
        renderFilterModal();
      }
    }

    // Apply all filters
    function applyFilters() {
      filteredProperties = properties.filter(prop => {
        // Search query filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const searchFields = [prop.econUnit, prop.bldgNum, prop.title, prop.type, prop.city, prop.zip, prop.address, prop.canton].map(f => (f || '').toString().toLowerCase());
          if (!searchFields.some(field => field.includes(query))) return false;
        }

        // Type filter (OR within category)
        if (advancedFilters.type.size > 0 && !advancedFilters.type.has(prop.type)) {
          return false;
        }

        // Year filter (OR within category)
        if (advancedFilters.year.size > 0 && !advancedFilters.year.has(String(prop.year))) {
          return false;
        }

        // Priority filter (OR within category)
        if (advancedFilters.priority.size > 0) {
          const pKey = prop.priority !== null && prop.priority !== undefined ? String(prop.priority) : 'null';
          if (!advancedFilters.priority.has(pKey)) return false;
        }

        // Milestone filter (OR within category)
        if (advancedFilters.milestone.size > 0) {
          const mKey = prop.milestone ? `${prop.milestone.current}/${prop.milestone.total}` : '';
          if (!advancedFilters.milestone.has(mKey)) return false;
        }

        // Portfolio filter (OR within category)
        if (advancedFilters.portfolio.size > 0 && !advancedFilters.portfolio.has(prop.portfolio)) {
          return false;
        }

        return true;
      });

      if (currentView === 'gallery') renderCards();
      else if (currentView === 'list') renderListView();
      else if (currentView === 'map') renderMapView();

      updateUrlParams();
      updateFilterButtonState();
      renderPriorityPills();
    }

    // Render filter modal options
    function renderFilterModal() {
      // Helper to create option HTML with close icon
      const createOption = (isSelected, filterKey, value, label) => `
        <div class="filter-option ${isSelected ? 'selected' : ''}" data-filter="${filterKey}" data-value="${value}">
          <span>${label}</span>
          <span class="material-icons-outlined close-icon">close</span>
        </div>
      `;

      // Nutzung (type)
      const typeContainer = document.getElementById('filterNutzung');
      typeContainer.innerHTML = filterOptions.type.map(t =>
        createOption(advancedFilters.type.has(t), 'type', t, t)
      ).join('');

      // Verkaufsjahr (year)
      const yearContainer = document.getElementById('filterYear');
      yearContainer.innerHTML = filterOptions.year.map(y =>
        createOption(advancedFilters.year.has(String(y)), 'year', y, y)
      ).join('');

      // Priorisierung (priority) - show all 5 options
      const priorityContainer = document.getElementById('filterPriority');
      const priorityLabels = {
        '0': 'Hohe Priorität',
        '1': 'Normale Priorität',
        '2': 'Geringe Priorität',
        '3': 'Keine Priorität',
        'null': 'Keine Angabe'
      };
      priorityContainer.innerHTML = ['0', '1', '2', '3', 'null'].map(pKey =>
        createOption(advancedFilters.priority.has(pKey), 'priority', pKey, priorityLabels[pKey])
      ).join('');

      // Meilenstein (milestone)
      const milestoneContainer = document.getElementById('filterMilestone');
      milestoneContainer.innerHTML = filterOptions.milestone.map(m =>
        createOption(advancedFilters.milestone.has(m.value), 'milestone', m.value, `${m.value} ${m.label}`)
      ).join('');

      // Portfolio
      const portfolioContainer = document.getElementById('filterPortfolio');
      portfolioContainer.innerHTML = filterOptions.portfolio.map(p =>
        createOption(advancedFilters.portfolio.has(p), 'portfolio', p, p)
      ).join('');

      // Add click handlers
      document.querySelectorAll('.filter-modal .filter-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const filterKey = opt.dataset.filter;
          const filterValue = opt.dataset.value;

          if (advancedFilters[filterKey].has(filterValue)) {
            advancedFilters[filterKey].delete(filterValue);
            opt.classList.remove('selected');
          } else {
            advancedFilters[filterKey].add(filterValue);
            opt.classList.add('selected');
          }

          applyFilters();
          // Update close icons visibility
          renderFilterModal();
        });
      });
    }

    // Filter Modal open/close
    function openFilterModal() {
      renderFilterModal();
      document.getElementById('filterModalOverlay').classList.add('active');
      document.getElementById('filterBtn').classList.add('panel-open');
      document.body.style.overflow = 'hidden';
    }

    function closeFilterModal() {
      document.getElementById('filterModalOverlay').classList.remove('active');
      document.getElementById('filterBtn').classList.remove('panel-open');
      document.body.style.overflow = '';
    }

    // --- Image Carousel Functions ---
    function openCarousel(images, startIndex = 0) {
      carouselImages = images;
      carouselIndex = startIndex;
      updateCarouselView();
      document.getElementById('carouselOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeCarousel() {
      document.getElementById('carouselOverlay').classList.remove('active');
      document.body.style.overflow = '';
    }

    function navigateCarousel(direction) {
      const newIndex = carouselIndex + direction;
      if (newIndex >= 0 && newIndex < carouselImages.length) {
        carouselIndex = newIndex;
        updateCarouselView();
      }
    }

    function goToCarouselImage(index) {
      if (index >= 0 && index < carouselImages.length) {
        carouselIndex = index;
        updateCarouselView();
      }
    }

    function updateCarouselView() {
      // Update counter
      document.getElementById('carouselCounter').textContent = `${carouselIndex + 1} / ${carouselImages.length}`;

      // Update main image with higher resolution
      const currentImage = carouselImages[carouselIndex].replace('w=400&h=300', 'w=1200&h=900');
      document.getElementById('carouselImage').src = currentImage;

      // Update navigation buttons
      document.querySelector('.carousel-nav-btn.prev').disabled = carouselIndex === 0;
      document.querySelector('.carousel-nav-btn.next').disabled = carouselIndex === carouselImages.length - 1;

      // Update thumbnails
      const thumbsContainer = document.getElementById('carouselThumbnails');
      thumbsContainer.innerHTML = carouselImages.map((img, idx) => `
        <div class="carousel-thumb ${idx === carouselIndex ? 'active' : ''}"
             style="background-image: url('${img}')"
             onclick="goToCarouselImage(${idx})"></div>
      `).join('');
    }

    function getDataToRender() { return (filteredProperties.length > 0 || hasActiveFilters()) ? filteredProperties : properties; }

    function renderCards() {
      const grid = document.getElementById('objectGrid');
      const data = getDataToRender();
      document.getElementById('objectCount').textContent = data.length;
      grid.innerHTML = data.map(prop => `
        <div class="card" data-id="${prop.id}">
          <div class="card-image" style="background-image: url('${getPlaceholderImage(prop.type, prop.id)}')">
            <div class="image-tags">
              <span class="year-tag" data-filter="year" data-value="${prop.year}">${prop.year}</span>
              <span class="priority-tag ${getPriorityClass(prop.priority)}" data-filter="priority" data-value="${getPriorityValue(prop.priority)}">${getPriorityLabel(prop.priority, prop.priorityLabel)}</span>
            </div>
          </div>
          <div class="card-content">
            <div class="card-label">${prop.econUnit}/${prop.bldgNum} ${prop.type}</div>
            <div class="card-location">In ${prop.zip} ${prop.city}</div>
            <div class="card-price">${formatPriceRange(prop.valueMin, prop.valueMax)}</div>
            <div class="card-price-sqm">${formatCHF(pricePerSqm(prop.valueMin, prop.areaGF))} - ${formatCHF(pricePerSqm(prop.valueMax, prop.areaGF))} / m² GF</div>
            <div class="card-details">
              <span class="card-detail-label">Geschossfläche GF:</span><span class="card-detail-value">${prop.areaGF} m²</span>
              <span class="card-detail-label">Buchwert:</span><span class="card-detail-value">${formatCHF(prop.bookValue)}</span>
            </div>
            <div class="card-milestone">
              <div class="milestone-bar"><div class="milestone-progress" style="width: ${(prop.milestone.current / prop.milestone.total) * 100}%"></div></div>
              <div class="milestone-text">Meilenstein ${prop.milestone.current}/${prop.milestone.total} ${prop.milestone.label}</div>
            </div>
          </div>
        </div>`).join('');
    }

    function renderListView() {
      const data = getDataToRender();
      document.getElementById('objectCount').textContent = data.length;
      const stats = { total: data.length, high: 0, normal: 0, low: 0 };
      data.forEach(p => {
        if (p.priorityLabel === 'Hohe Priorität') stats.high++;
        else if (p.priorityLabel === 'Normale Priorität') stats.normal++;
        else if (p.priorityLabel === 'Geringe Priorität') stats.low++;
      });
      document.getElementById('statsTotalObjects').textContent = stats.total;
      document.getElementById('statsHighPriority').textContent = stats.high;
      document.getElementById('statsNormalPriority').textContent = stats.normal;
      document.getElementById('statsLowPriority').textContent = stats.low;

      const tbody = document.getElementById('listTableBody');
      tbody.innerHTML = data.map(prop => `
        <tr data-id="${prop.id}">
          <td><span class="material-icons-outlined object-icon">home</span></td>
          <td>${prop.econUnit}/${prop.bldgNum}</td>
          <td>${prop.type} in ${prop.zip} ${prop.city}</td>
          <td><span class="year-tag" data-filter="year" data-value="${prop.year}">${prop.year}</span></td>
          <td><span class="priority-tag ${getPriorityClass(prop.priority)}" data-filter="priority" data-value="${getPriorityValue(prop.priority)}">${getPriorityLabel(prop.priority, prop.priorityLabel)}</span></td>
          <td>${prop.milestone.current}/${prop.milestone.total} ${prop.milestone.label}</td>
          <td>${prop.areaGF} m²</td>
          <td>${formatPriceRange(prop.valueMin, prop.valueMax)}</td>
        </tr>`).join('');
    }

    // --- REPAIRED SIDEBAR RENDER FUNCTION ---
    function renderMapView() {
      const data = getDataToRender();
      document.getElementById('objectCount').textContent = data.length;
      const sidebar = document.getElementById('mapSidebar');
      
      // Neue Struktur: Bild-Container mit Tags (Overlay) -> Inhalt (Name + Preis)
      sidebar.innerHTML = data.map(prop => `
        <div class="map-sidebar-item" data-id="${prop.id}">
          <div class="map-sidebar-image" style="background-image: url('${getPlaceholderImage(prop.type, prop.id)}')">
            <div class="image-tags">
              <span class="year-tag" data-filter="year" data-value="${prop.year}">${prop.year}</span>
              <span class="priority-tag ${getPriorityClass(prop.priority)}" data-filter="priority" data-value="${getPriorityValue(prop.priority)}">${getPriorityLabel(prop.priority, prop.priorityLabel)}</span>
            </div>
          </div>
          <div class="map-sidebar-content">
            <div class="map-sidebar-title">${prop.type} in ${prop.zip} ${prop.city}</div>
            <div class="map-sidebar-price">${formatPriceRange(prop.valueMin, prop.valueMax)}</div>
          </div>
        </div>`).join('');

      if (!map) {
        initializeMap();
      } else if (mapLoaded) {
        updateMapMarkers(data);
      }
      // Wenn map existiert aber noch nicht geladen ist,
      // werden die Marker automatisch beim 'load'-Event aktualisiert
    }

    function flyToProperty(id) {
      const prop = properties.find(p => p.id === id);
      if (!prop || !prop.lat || !prop.lng) return;
      document.querySelectorAll('.map-sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.id === id) {
          item.classList.add('active');
          if (item.scrollIntoView) item.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        }
      });
      document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
      const md = markersMap.get(id);
      if (md) {
        md.marker.getElement().classList.add('selected');
        map.flyTo({ center: [prop.lng, prop.lat], zoom: 13, duration: 1500 });
        setTimeout(() => {
          const popup = md.marker.getPopup();
          if (popup && !popup.isOpen()) {
            md.marker.togglePopup();
          }
        }, 1600);
      }
    }

    function initializeMap() {
      if (typeof maplibregl === 'undefined') {
        document.getElementById('map').innerHTML = '<div class="map-fallback">Karte konnte nicht geladen werden (Kartenbibliothek nicht verfügbar).</div>';
        return;
      }
      map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [8.2275, 46.8182], zoom: 7
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.on('load', () => {
        mapLoaded = true;
        updateMapMarkers(getDataToRender());
      });
    }

    function updateMapMarkers(data) {
      markers.forEach(marker => marker.remove());
      markers = []; markersMap.clear();
      const bounds = new maplibregl.LngLatBounds();
      data.forEach(prop => {
        if (prop.lat && prop.lng) {
          const el = document.createElement('div');
          el.className = `marker marker-${prop.priority !== null ? prop.priority : 'null'}`;
          el.innerHTML = '<span class="material-icons-outlined">home</span>';
          el.addEventListener('click', () => {
            document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
            el.classList.add('selected');
            flyToProperty(prop.id);
          });

          const popup = new maplibregl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(`
            <div class="popup-image" style="background-image: url('${getPlaceholderImage(prop.type, prop.id)}')"></div>
            <div class="popup-content">
              <div class="popup-title">${prop.type}</div>
              <div class="popup-location">${prop.address}, ${prop.city}</div>
              <div class="popup-price">${formatPriceRange(prop.valueMin, prop.valueMax)}</div>
              <div class="popup-link" onclick="openDetailPage('${prop.id}')">Details anzeigen</div>
            </div>`);

          const marker = new maplibregl.Marker({ element: el }).setLngLat([prop.lng, prop.lat]).setPopup(popup).addTo(map);
          markers.push(marker);
          markersMap.set(prop.id, { marker, prop });
          bounds.extend([prop.lng, prop.lat]);
        }
      });
      if (markers.length > 0) map.fitBounds(bounds, { padding: 80, maxZoom: 10 });
    }

    function setView(view) {
      currentView = view;
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
        const label = btn.querySelector('.view-btn-label');
        if (label) label.remove();
      });
      const activeBtn = document.querySelector(`.view-btn[data-view="${view}"]`);
      if (activeBtn) {
        activeBtn.classList.add('active');
        const label = document.createElement('span');
        label.className = 'view-btn-label';
        label.textContent = { gallery: 'Galerie', list: 'Liste', map: 'Karte' }[view];
        activeBtn.appendChild(label);
      }

      document.getElementById('galleryView').classList.remove('active');
      document.getElementById('listView').classList.remove('active');
      document.getElementById('mapView').classList.remove('active');

      if (view === 'gallery') {
        document.getElementById('galleryView').classList.add('active');
        renderCards();
      } else if (view === 'list') {
        document.getElementById('listView').classList.add('active');
        renderListView();
      } else if (view === 'map') {
        document.getElementById('mapView').classList.add('active');
        renderMapView();
        setTimeout(() => { if (map) map.resize(); }, 150);
      }
      updateUrlParams();
    }

    function setupViewToggle() {
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          if (view) setView(view);
        });
      });
    }

    function exportToExcel() { alert('Excel Export Placeholder'); }

    function setupFilterModal() {
      // Open filter modal
      document.getElementById('filterBtn').addEventListener('click', openFilterModal);

      // Close filter modal
      document.getElementById('filterCloseBtn').addEventListener('click', closeFilterModal);
      document.getElementById('filterModalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeFilterModal();
      });

      // Reset filters button in modal
      document.getElementById('filterResetBtn').addEventListener('click', () => {
        resetAllFilters();
      });

      // Keyboard navigation (handles carousel, filter modal, and detail view)
      document.addEventListener('keydown', (e) => {
        const carouselActive = document.getElementById('carouselOverlay').classList.contains('active');

        // Carousel keyboard controls
        if (carouselActive) {
          if (e.key === 'Escape') {
            closeCarousel();
          } else if (e.key === 'ArrowLeft') {
            navigateCarousel(-1);
          } else if (e.key === 'ArrowRight') {
            navigateCarousel(1);
          }
          return;
        }

        // Other Escape handlers
        if (e.key === 'Escape') {
          if (document.getElementById('filterModalOverlay').classList.contains('active')) {
            closeFilterModal();
          } else if (document.getElementById('detailView').classList.contains('active')) {
            closeDetailPage();
          }
        }
      });
    }

    function setupSearch() {
      const searchInput = document.getElementById('searchInput');
      const clearBtn = document.getElementById('searchInputClear');
      let debounceTimer;

      // The full placeholder is truncated on phones; swap in the short variant there.
      const longPlaceholder = searchInput.placeholder;
      const shortPlaceholder = searchInput.dataset.placeholderShort;
      if (shortPlaceholder && window.matchMedia) {
        const phoneQuery = window.matchMedia('(max-width: 640px)');
        const applyPlaceholder = () => { searchInput.placeholder = phoneQuery.matches ? shortPlaceholder : longPlaceholder; };
        applyPlaceholder();
        if (phoneQuery.addEventListener) phoneQuery.addEventListener('change', applyPlaceholder);
        else if (phoneQuery.addListener) phoneQuery.addListener(applyPlaceholder);
      }
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        clearBtn.classList.toggle('visible', e.target.value.length > 0);
        debounceTimer = setTimeout(() => {
          searchQuery = e.target.value.trim();
          applyFilters();
        }, 300);
      });
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearBtn.classList.remove('visible');
        applyFilters();
        searchInput.focus();
      });
    }

    // Canton code mapping for SVG highlighting (Wikipedia SVG uses canton codes directly)
    const cantonCodeMap = {
      'AG': 'AG', 'AI': 'AI', 'AR': 'AR', 'BE': 'BE', 'BL': 'BL',
      'BS': 'BS', 'FR': 'FR', 'GE': 'GE', 'GL': 'GL', 'GR': 'GR',
      'JU': 'JU', 'LU': 'LU', 'NE': 'NE', 'NW': 'NW', 'OW': 'OW',
      'SG': 'SG', 'SH': 'SH', 'SO': 'SO', 'SZ': 'SZ', 'TG': 'TG',
      'TI': 'TI', 'UR': 'UR', 'VD': 'VD', 'VS': 'VS', 'ZG': 'ZG', 'ZH': 'ZH'
    };

    // Convert lat/lng to SVG coordinates for Wikipedia SVG
    // SVG viewBox: 0 0 1052.361 744.094
    function latLngToSvg(lat, lng) {
      const minLat = 45.82, maxLat = 47.81;
      const minLng = 5.95, maxLng = 10.49;
      const svgWidth = 1052.361;
      const svgHeight = 744.094;
      const x = ((lng - minLng) / (maxLng - minLng)) * svgWidth;
      const y = ((maxLat - lat) / (maxLat - minLat)) * svgHeight;
      return { x, y };
    }

    let svgMapCache = null;

    async function loadSvgMap() {
      if (svgMapCache) return svgMapCache;
      try {
        const response = await fetch('assets/switzerland.svg');
        svgMapCache = await response.text();
        return svgMapCache;
      } catch (e) {
        console.error('Error loading SVG map:', e);
        return null;
      }
    }

    function openDetailPage(id) {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;

      // Update URL
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'detail');
      params.set('id', id);
      window.history.pushState({ view: 'detail', id }, '', `?${params.toString()}`);

      renderDetailPage(prop);
    }

    async function renderDetailPage(prop) {
      // Set breadcrumb
      document.getElementById('detailBreadcrumb').textContent = `Alle Verkaufsobjekte / ${prop.year} / ${prop.econUnit} / ${prop.bldgNum}`;

      // Get multiple placeholder images for gallery
      const mainImage = getPlaceholderImage(prop.type, prop.id);
      const thumbImages = [
        getPlaceholderImage(prop.type, prop.id + '1'),
        getPlaceholderImage(prop.type, prop.id + '2'),
        getPlaceholderImage(prop.type, prop.id + '3'),
        getPlaceholderImage(prop.type, prop.id + '4')
      ];

      // All gallery images for carousel
      const allGalleryImages = [mainImage, ...thumbImages];

      // Load SVG map
      const svgMap = await loadSvgMap();
      const svgMapHtml = svgMap || '<div class="map-fallback">Karte nicht verfügbar</div>';

      // Render content
      document.getElementById('detailContent').innerHTML = `
        <div class="detail-hero">
          <!-- Gallery -->
          <div class="detail-gallery" id="detailGallery" data-images='${JSON.stringify(allGalleryImages)}'>
            <div class="detail-main-image clickable" style="background-image: url('${mainImage}')" data-image-index="0">
              <div class="image-tags">
                <span class="year-tag" data-filter="year" data-value="${prop.year}" data-detail="true">${prop.year}</span>
                <span class="priority-tag ${getPriorityClass(prop.priority)}" data-filter="priority" data-value="${getPriorityValue(prop.priority)}" data-detail="true">${getPriorityLabel(prop.priority, prop.priorityLabel)}</span>
              </div>
            </div>
            <div class="detail-thumb clickable" style="background-image: url('${thumbImages[0]}')" data-image-index="1"></div>
            <div class="detail-thumb clickable" style="background-image: url('${thumbImages[1]}')" data-image-index="2"></div>
            <div class="detail-thumb clickable" style="background-image: url('${thumbImages[2]}')" data-image-index="3"></div>
            <div class="detail-thumb clickable" style="background-image: url('${thumbImages[3]}')" data-image-index="4">
              <div class="detail-thumb-overlay">
                <span class="detail-thumb-overlay-label">Alle ${allGalleryImages.length} Bilder anzeigen.</span>
                <span class="detail-thumb-overlay-short">+${allGalleryImages.length}</span>
              </div>
            </div>
          </div>

          <!-- Info Sections -->
          <div class="detail-info">
            <!-- Title & Address -->
            <div class="detail-info-section detail-title-section">
              <h1>${prop.type} in ${prop.zip} ${prop.city}</h1>
              <div class="detail-data-label">${prop.address} ${prop.zip} ${prop.city}</div>
              <div class="detail-areas">
                <div class="detail-area">
                  <span class="material-icons-outlined detail-area-icon">square_foot</span>
                  <span class="detail-area-value">${prop.areaGF} m²</span>
                  <span class="detail-area-label">Geschossfläche</span>
                </div>
                <div class="detail-area">
                  <span class="material-icons-outlined detail-area-icon">landscape</span>
                  <span class="detail-area-value">${prop.areaGSF} m²</span>
                  <span class="detail-area-label">Grundstück</span>
                </div>
              </div>
            </div>

            <!-- Price -->
            <div class="detail-info-section detail-title-section">
              <h1>${formatPriceRange(prop.valueMin, prop.valueMax)}</h1>
              <div class="detail-data-label">${formatCHF(pricePerSqm(prop.valueMin, prop.areaGF))} - ${formatCHF(pricePerSqm(prop.valueMax, prop.areaGF))} / m² GF</div>
              <div class="detail-price-cards">
                <div class="detail-price-card">
                  <span class="detail-price-card-value">${formatCHF(prop.bookValue)}</span>
                  <span class="detail-price-card-label">Aktueller Buchwert</span>
                </div>
                <div class="detail-price-card">
                  <span class="detail-price-card-value">${formatCHF(prop.acquisitionValue)}</span>
                  <span class="detail-price-card-label">Anschaffungswert</span>
                </div>
              </div>
            </div>

            <!-- Status -->
            <div class="detail-info-section detail-title-section">
              <h1>${prop.milestone.current}/${prop.milestone.total} ${prop.milestone.label}</h1>
              <div class="detail-data-label">Meilenstein</div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="detail-tabs">
          <button class="detail-tab active" onclick="switchTab('ÜBERSICHT')">ÜBERSICHT</button>
          <button class="detail-tab" onclick="switchTab('MEILENSTEINE')">MEILENSTEINE</button>
          <button class="detail-tab" onclick="switchTab('EREIGNISSE')">EREIGNISSE</button>
          <button class="detail-tab" onclick="switchTab('DOKUMENTE')">DOKUMENTE</button>
        </div>

        <!-- Tab Content -->
        <div class="detail-tab-content">
          <!-- ÜBERSICHT Tab -->
          <div class="tab-content-uebersicht active">
            <h2 class="section-title">Identifikation Objekt</h2>
            <div class="detail-data-section">
              <div class="detail-data-column">
                <div class="detail-data-grid">
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.techPlatz || '-'}</div>
                    <div class="detail-data-label">Technischer Platz Bund</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">Schweiz, ${prop.canton}</div>
                    <div class="detail-data-label">Land, Region (Kanton)</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.city}, ${prop.address}</div>
                    <div class="detail-data-label">Objekt Bezeichnung</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.address} ${prop.zip} ${prop.city}</div>
                    <div class="detail-data-label">Adresse</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.portfolio || '-'}</div>
                    <div class="detail-data-label">Teilportfolio Bund</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.type}</div>
                    <div class="detail-data-label">Objektart Verkauf</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.egid || '-'}</div>
                    <div class="detail-data-label">BFS EGID (nur Schweiz)</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.egrid || '-'}</div>
                    <div class="detail-data-label">BFS EGRID (nur Schweiz)</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.ownership || '-'}</div>
                    <div class="detail-data-label">Eigentum</div>
                  </div>
                  <div class="detail-data-item">
                    <div class="detail-data-value">${prop.buildYear || '-'}</div>
                    <div class="detail-data-label">Baujahr</div>
                  </div>
                </div>
                <div class="detail-links">
                  <a href="https://www.google.com/maps?q=${prop.lat},${prop.lng}" target="_blank" rel="noopener" class="detail-link">
                    <span class="material-icons-outlined">open_in_new</span>
                    Google Maps
                  </a>
                  <a href="https://map.geo.admin.ch/#/map?lang=de&swisssearch=${prop.lng},${prop.lat}&swisssearch_autoselect=true&z=12&topic=ech&layers=ch.swisstopo.amtliches-strassenverzeichnis;ch.bfs.gebaeude_wohnungs_register&bgLayer=ch.swisstopo.swissimage" target="_blank" rel="noopener" class="detail-link">
                    <span class="material-icons-outlined">open_in_new</span>
                    Gebäude- und Wohnungsregister
                  </a>
                  <a href="https://map.geo.admin.ch/#/map?lang=de&swisssearch=${prop.lng},${prop.lat}&swisssearch_autoselect=true&z=12&topic=ech&layers=ch.swisstopo-vd.stand-oerebkataster&bgLayer=ch.swisstopo.swissimage" target="_blank" rel="noopener" class="detail-link">
                    <span class="material-icons-outlined">open_in_new</span>
                    ÖREB-Kataster
                  </a>
                  <div class="detail-data-label">Verortung</div>
                </div>
              </div>

              <!-- Switzerland Map -->
              <div class="detail-map-container">
                <div class="detail-map-svg" id="detailMapSvg">${svgMapHtml}</div>
              </div>
            </div>

          <!-- Section Separator -->
          <div class="detail-section-separator"></div>

          <!-- Angaben zum Objekt -->
          <h2 class="section-title">Angaben zum Objekt</h2>
          <div class="detail-object-section">
            <div class="detail-object-left">
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.year || '-'}</div>
                <div class="detail-data-label">Jahr Verkauf</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.areaGSF ? prop.areaGSF + ' m²' : '-'}</div>
                <div class="detail-data-label">Grundstücksfläche GSF</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.ownership || '-'}</div>
                <div class="detail-data-label">Eigentum Art</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.areaGF ? prop.areaGF + ' m²' : '-'}</div>
                <div class="detail-data-label">Geschossfläche GF</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.buildYear || '-'}</div>
                <div class="detail-data-label">Baujahr</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.floors || '-'}</div>
                <div class="detail-data-label">Anzahl Geschosse</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.condition || '-'}</div>
                <div class="detail-data-label">Zustand</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.livingArea ? prop.livingArea + ' m²' : 'Null'}</div>
                <div class="detail-data-label">Wohnfläche</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.standard || '-'}</div>
                <div class="detail-data-label">Ausbaustandard</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.apartments !== null ? prop.apartments : 'Null'}</div>
                <div class="detail-data-label">Anzahl Wohnungen</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.isHeated !== null ? (prop.isHeated ? 'Ja' : 'Nein') : 'Null'}</div>
                <div class="detail-data-label">Objekt ist beheizt</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.rooms !== null ? prop.rooms : 'Null'}</div>
                <div class="detail-data-label">Anzahl Zimmer</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${formatCHF(prop.bookValue)}</div>
                <div class="detail-data-label">Aktueller Buchwert</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.parkingSpaces !== null ? prop.parkingSpaces : 'Null'}</div>
                <div class="detail-data-label">Anzahl Parkplätze</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${formatCHF(prop.acquisitionValue)}</div>
                <div class="detail-data-label">Anschaffungswert</div>
              </div>
              <div class="detail-data-item detail-data-item-spacer" aria-hidden="true">
                <div class="detail-data-value">&nbsp;</div>
                <div class="detail-data-label">&nbsp;</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.hasBuildingRights !== null ? (prop.hasBuildingRights ? 'Ja' : 'Nein') : 'Null'}</div>
                <div class="detail-data-label">Baurecht vorhanden?</div>
              </div>
              <div class="detail-data-item detail-data-item-spacer" aria-hidden="true">
                <div class="detail-data-value">&nbsp;</div>
                <div class="detail-data-label">&nbsp;</div>
              </div>
              <div class="detail-data-item">
                <div class="detail-data-value">${prop.buildingRightsFee !== null ? 'CHF ' + formatNumber(prop.buildingRightsFee) : 'CHF Null'}</div>
                <div class="detail-data-label">Baurechtszins</div>
              </div>
            </div>
            <div class="detail-object-right">
              <div class="detail-geo-map">
                <iframe
                  src="https://map.geo.admin.ch/embed.html?lang=de&topic=ech&bgLayer=ch.swisstopo.swissimage&lon=${prop.lng}&lat=${prop.lat}&zoom=9&crosshair=marker"
                  allowfullscreen="true"
                  loading="lazy">
                </iframe>
              </div>
              <div class="detail-geo-info">
                <span class="detail-geo-coords">${formatCoord(prop.lat, 'N')} ${formatCoord(prop.lng, 'E')}</span>
                <span class="detail-geo-address">${prop.address} ${prop.city}</span>
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${prop.lat},${prop.lng}" target="_blank" rel="noopener" class="detail-route-link">
                <span class="material-icons-outlined">directions</span>
                Routenplaner
              </a>
            </div>
          </div>

          <!-- Section Separator -->
          <div class="detail-section-separator"></div>

          <!-- Marktwert & Lage -->
          <div class="detail-value-location">
            <!-- Marktwert -->
            <div class="detail-value-section">
              <h2>Marktwert</h2>
              <div class="detail-value-chart">
                <div class="detail-value-main">${formatCHF(prop.valueMean)}</div>
                <div class="detail-value-bar-container">
                  <div class="detail-value-labels">
                    <span>${formatCHF(prop.valueMin)}</span>
                    <span>${formatCHF(prop.valueMax)}</span>
                  </div>
                  <div class="detail-value-bar">
                    ${prop.valueMax > prop.valueMin ?
                      '<div class="detail-value-marker" style="left: ' + (((prop.valueMean - prop.valueMin) / (prop.valueMax - prop.valueMin)) * 100) + '%"></div>'
                      : ''}
                  </div>
                  <div class="detail-value-scale">
                    <span>Minimum</span>
                    <span>Mittelwert</span>
                    <span>Maximum</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Lage -->
            <div class="detail-location-section">
              <h2>Lage</h2>
              <div class="detail-location-grid">
                <div class="detail-location-item">
                  <span class="detail-location-label">Gesamthaft</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.overall : 'Null'}</span>
                  <div class="detail-location-stars">
                    ${[1,2,3,4,5].map(i => '<span class="material-icons-outlined detail-location-star ' + (prop.locationRatings && i <= prop.locationRatings.overall ? 'filled' : '') + '">star</span>').join('')}
                  </div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Besonnung</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.sunExposure : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.sunExposure : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Sicht</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.view : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.view : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Image des Quartiers</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.neighborhoodImage : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.neighborhoodImage : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Dienstleistungen</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.services : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.services : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Freizeit & Erholung</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.leisureRecreation : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.leisureRecreation : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Öffentlicher Verkehr</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.publicTransport : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.publicTransport : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Strassenanbindung</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.roadConnection : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.roadConnection : 10}%"></div></div>
                </div>
                <div class="detail-location-item">
                  <span class="detail-location-label">Lärmbelastung</span>
                  <span class="detail-location-value">${prop.locationRatings ? prop.locationRatings.noisePollution : 'Null'}</span>
                  <div class="detail-location-bar"><div class="detail-location-bar-fill" style="width: ${prop.locationRatings ? prop.locationRatings.noisePollution : 10}%"></div></div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <!-- EREIGNISSE Tab -->
          <div class="tab-content-ereignisse">
            <div class="tab-container">
              <div class="tab-header">
                <h2 class="tab-title">Ereignisse</h2>
              </div>
              <div class="tab-toolbar">
                <div class="tab-search">
                  <span class="material-icons-outlined">search</span>
                  <input type="text" id="eventSearchInput" placeholder="Alle Spalten filtern" onkeyup="filterEvents(this.value)">
                </div>
                <div class="tab-actions">
                  <button class="table-action-btn" id="eventDownloadBtn" onclick="downloadSelectedEvents()" title="CSV herunterladen">
                    <span class="material-icons-outlined">download</span>
                    <span>CSV herunterladen</span>
                  </button>
                </div>
              </div>
              <div id="eventsTableContainer" class="table-scroll">
                ${renderEventsTable(prop.events)}
              </div>
            </div>
          </div>

          <!-- MEILENSTEINE Tab -->
          <div class="tab-content-meilensteine">
            <div class="tab-container">
              <div class="tab-header">
                <h2 class="tab-title">Meilensteine</h2>
              </div>
              <div class="milestone-list">
                ${renderMilestones(prop)}
              </div>
            </div>
          </div>

          <!-- DOKUMENTE Tab -->
          <div class="tab-content-dokumente">
            <div class="tab-container">
              <div class="tab-header">
                <h2 class="tab-title">Dokumente</h2>
              </div>
              <div class="tab-toolbar">
                <div class="tab-search">
                  <span class="material-icons-outlined">search</span>
                  <input type="text" id="documentSearchInput" placeholder="Alle Spalten filtern" onkeyup="filterDocuments(this.value)">
                </div>
                <div class="tab-actions">
                  <button class="table-action-btn" id="docDeleteBtn" onclick="deleteSelectedDocuments()" title="Löschen">
                    <span class="material-icons-outlined">delete</span>
                    <span>Löschen</span>
                  </button>
                  <button class="table-action-btn" id="docDownloadBtn" onclick="downloadSelectedDocuments()" title="Herunterladen">
                    <span class="material-icons-outlined">download</span>
                    <span>Herunterladen</span>
                  </button>
                  <button class="table-btn-outline" onclick="openUploadDialog()" title="Hinzufügen">
                    <span class="material-icons-outlined">add</span>
                    <span>Hinzufügen</span>
                  </button>
                </div>
              </div>
              <div id="documentsTableContainer" class="table-scroll">
                ${renderDocumentsTable(prop.documents)}
              </div>
            </div>
          </div>
        </div>
      `;

      // Show detail view
      document.body.classList.add('detail-active');
      document.getElementById('detailView').classList.add('active');

      // Store current property for document operations
      currentDocumentProperty = prop;

      // Highlight canton and position marker on map
      setTimeout(() => {
        highlightCantonOnMap(prop.canton, prop.lat, prop.lng);
      }, 100);
    }

    function highlightCantonOnMap(canton, lat, lng) {
      const svgContainer = document.getElementById('detailMapSvg');
      if (!svgContainer) return;

      const svg = svgContainer.querySelector('svg');
      if (!svg) return;

      // Remove previous highlights
      svg.querySelectorAll('path.highlighted').forEach(path => {
        path.classList.remove('highlighted');
      });

      // Highlight current canton
      const cantonId = cantonCodeMap[canton];
      if (cantonId) {
        const cantonPath = svg.getElementById(cantonId);
        if (cantonPath) {
          cantonPath.classList.add('highlighted');
        }
      }

      // Position or create marker
      if (lat && lng) {
        const pos = latLngToSvg(lat, lng);
        let marker = svg.getElementById('location-marker');

        if (!marker) {
          // Create marker if it doesn't exist
          marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          marker.setAttribute('id', 'location-marker');
          marker.setAttribute('r', '12');
          marker.style.fill = 'var(--priority-high)';
          marker.style.stroke = 'var(--neutral-50)';
          marker.setAttribute('stroke-width', '3');
          svg.appendChild(marker);
        }

        marker.setAttribute('cx', pos.x);
        marker.setAttribute('cy', pos.y);
        marker.style.display = 'block';
      }
    }

    function closeDetailPage() {
      document.body.classList.remove('detail-active');
      document.getElementById('detailView').classList.remove('active');

      // Update URL back to list view
      const params = new URLSearchParams(window.location.search);
      params.delete('id');
      if (currentView !== 'gallery') {
        params.set('view', currentView);
      } else {
        params.delete('view');
      }
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.pushState({ view: currentView }, '', newUrl);
    }

    function exportToPdf() {
      window.print();
    }

    // --- API Docs View ---
    function openApiDocsPage() {
      window.history.pushState({ view: 'api' }, '', '?view=api');
      renderApiDocsView();
    }

    function closeApiDocsPage() {
      document.body.classList.remove('api-docs-active');
      document.getElementById('apiDocsView').classList.remove('active');
      const params = new URLSearchParams(window.location.search);
      params.delete('view');
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.pushState({ view: currentView }, '', newUrl);
    }

    function renderApiDocsView() {
      document.body.classList.add('api-docs-active');
      document.getElementById('apiDocsView').classList.add('active');

      const endpoints = [
        {
          group: 'Verkaufsobjekte',
          items: [
            { method: 'get', path: '/api/v1/properties', desc: 'Alle Verkaufsobjekte abrufen',
              params: [
                { name: 'type', type: 'string', req: false, desc: 'Objekttyp filtern (z.B. Bürogebäude, Wohnliegenschaft)' },
                { name: 'priority', type: 'integer', req: false, desc: 'Priorität filtern (0=Hoch, 1=Mittel, 2=Tief, 3=Keine)' },
                { name: 'year', type: 'string', req: false, desc: 'Verkaufsjahr filtern (z.B. 2025)' },
                { name: 'canton', type: 'string', req: false, desc: 'Kanton filtern (z.B. BE, ZH)' },
                { name: 'limit', type: 'integer', req: false, desc: 'Maximale Anzahl Ergebnisse (Standard: 50)' },
                { name: 'offset', type: 'integer', req: false, desc: 'Offset für Paginierung (Standard: 0)' },
              ],
              response: `{
  "data": [
    {
      "id": "OBJ-2025-001",
      "type": "Bürogebäude",
      "address": "Bundesgasse 32",
      "zip": "3003",
      "city": "Bern",
      "canton": "BE",
      "year": "2025",
      "priority": 0,
      "valueMin": 5200000,
      "valueMax": 6800000,
      "areaGF": 4200,
      "lat": 46.9480,
      "lng": 7.4474
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}` },
            { method: 'get', path: '/api/v1/properties/{id}', desc: 'Einzelnes Verkaufsobjekt abrufen',
              params: [
                { name: 'id', type: 'string', req: true, desc: 'Eindeutige Objekt-ID (z.B. OBJ-2025-001)' },
              ],
              response: `{
  "id": "OBJ-2025-001",
  "type": "Bürogebäude",
  "address": "Bundesgasse 32",
  "zip": "3003",
  "city": "Bern",
  "canton": "BE",
  "year": "2025",
  "priority": 0,
  "milestone": "In Vorbereitung",
  "econUnit": "WE-1234",
  "bldgNum": "BG-5678",
  "portfolio": "zivil",
  "valueMin": 5200000,
  "valueMax": 6800000,
  "areaGF": 4200,
  "areaHNF": 3100,
  "areaVMF": 800,
  "lat": 46.9480,
  "lng": 7.4474,
  "condition": "Gut",
  "yearBuilt": 1985,
  "floors": 5,
  "parkingSpaces": 24,
  "energyRating": "C",
  "documents": [
    { "name": "Grundbuchauszug.pdf", "size": "2.4 MB" }
  ]
}` },
            { method: 'post', path: '/api/v1/properties', desc: 'Neues Verkaufsobjekt erstellen',
              params: [
                { name: 'type', type: 'string', req: true, desc: 'Objekttyp' },
                { name: 'address', type: 'string', req: true, desc: 'Adresse des Objekts' },
                { name: 'zip', type: 'string', req: true, desc: 'Postleitzahl' },
                { name: 'city', type: 'string', req: true, desc: 'Ort' },
                { name: 'canton', type: 'string', req: true, desc: 'Kanton (2-Buchstaben-Code)' },
                { name: 'year', type: 'string', req: true, desc: 'Verkaufsjahr' },
                { name: 'valueMin', type: 'number', req: false, desc: 'Minimaler Schätzwert in CHF' },
                { name: 'valueMax', type: 'number', req: false, desc: 'Maximaler Schätzwert in CHF' },
              ],
              response: `{
  "id": "OBJ-2025-043",
  "message": "Verkaufsobjekt erfolgreich erstellt."
}` },
            { method: 'put', path: '/api/v1/properties/{id}', desc: 'Verkaufsobjekt aktualisieren',
              params: [
                { name: 'id', type: 'string', req: true, desc: 'Eindeutige Objekt-ID' },
                { name: '...', type: 'object', req: false, desc: 'Beliebige Felder zum Aktualisieren (gleiche Struktur wie POST)' },
              ],
              response: `{
  "id": "OBJ-2025-001",
  "message": "Verkaufsobjekt erfolgreich aktualisiert."
}` },
            { method: 'delete', path: '/api/v1/properties/{id}', desc: 'Verkaufsobjekt löschen',
              params: [
                { name: 'id', type: 'string', req: true, desc: 'Eindeutige Objekt-ID' },
              ],
              response: `{
  "message": "Verkaufsobjekt erfolgreich gelöscht."
}` },
          ]
        },
        {
          group: 'Dokumente',
          items: [
            { method: 'get', path: '/api/v1/properties/{id}/documents', desc: 'Dokumente eines Objekts abrufen',
              params: [
                { name: 'id', type: 'string', req: true, desc: 'Eindeutige Objekt-ID' },
              ],
              response: `{
  "data": [
    {
      "id": "DOC-001",
      "name": "Grundbuchauszug.pdf",
      "size": "2.4 MB",
      "uploadedAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "DOC-002",
      "name": "Gebäudeversicherung.pdf",
      "size": "1.1 MB",
      "uploadedAt": "2025-01-16T14:00:00Z"
    }
  ]
}` },
            { method: 'post', path: '/api/v1/properties/{id}/documents', desc: 'Dokument hochladen',
              params: [
                { name: 'id', type: 'string', req: true, desc: 'Eindeutige Objekt-ID' },
                { name: 'file', type: 'binary', req: true, desc: 'Datei (multipart/form-data)' },
              ],
              response: `{
  "id": "DOC-003",
  "name": "Energieausweis.pdf",
  "message": "Dokument erfolgreich hochgeladen."
}` },
          ]
        },
        {
          group: 'Statistiken',
          items: [
            { method: 'get', path: '/api/v1/stats', desc: 'Gesamtstatistiken abrufen',
              params: [],
              response: `{
  "totalProperties": 42,
  "totalValue": { "min": 185000000, "max": 245000000 },
  "byPriority": { "high": 8, "medium": 15, "low": 12, "none": 7 },
  "byCanton": { "BE": 12, "ZH": 8, "VD": 5, "GE": 4 },
  "byYear": { "2025": 18, "2026": 14, "2027": 10 }
}` },
          ]
        }
      ];

      document.getElementById('apiDocsContent').innerHTML = `
        <div style="margin-bottom: var(--space-6);">
          <h2 style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-2);">Verkaufsplattform API</h2>
          <p style="color: var(--neutral-500); margin-bottom: var(--space-2);">Version 1.0.0 &middot; Base URL: <code style="background: var(--neutral-100); padding: 2px 8px; border-radius: var(--radius-sm);">https://api.verkaufsplattform.admin.ch</code></p>
          <p style="color: var(--neutral-500); font-size: var(--font-size-sm);">REST API für den Zugriff auf Verkaufsobjekte des Bundesamts für Bauten und Logistik. Authentifizierung via API-Key im Header <code style="background: var(--neutral-100); padding: 2px 8px; border-radius: var(--radius-sm);">X-API-Key</code>.</p>
        </div>
        ${endpoints.map(group => `
          <div class="api-endpoint-group">
            <div class="api-endpoint-group-title">${group.group}</div>
            ${group.items.map(ep => `
              <div class="api-endpoint" onclick="this.classList.toggle('open')">
                <div class="api-endpoint-header">
                  <span class="api-method ${ep.method}">${ep.method}</span>
                  <span class="api-endpoint-path">${ep.path}</span>
                  <span class="api-endpoint-desc">${ep.desc}</span>
                </div>
                <div class="api-endpoint-body" onclick="event.stopPropagation()">
                  ${ep.params.length > 0 ? `
                    <div class="api-section-label">Parameter</div>
                    <table class="api-param-table">
                      <thead><tr><th>Name</th><th>Typ</th><th>Pflicht</th><th>Beschreibung</th></tr></thead>
                      <tbody>
                        ${ep.params.map(p => `<tr>
                          <td><code>${p.name}</code></td>
                          <td><code>${p.type}</code></td>
                          <td><span class="api-badge ${p.req ? 'required' : 'optional'}">${p.req ? 'Pflicht' : 'Optional'}</span></td>
                          <td>${p.desc}</td>
                        </tr>`).join('')}
                      </tbody>
                    </table>
                  ` : '<p style="color: var(--neutral-500); font-size: var(--font-size-sm);">Keine Parameter erforderlich.</p>'}
                  <div class="api-section-label">Antwort-Beispiel</div>
                  <div class="api-response-example">${ep.response}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      `;
    }

    // Document types for upload dialog
    const documentTypes = [
      '3D-Modelldaten',
      'Ansichtsplan',
      'Auszug ÖREB-Kataster',
      'Akte zu Unterhalt',
      'Grundrissplan',
      'Indikative Marktwertbewertung',
      'Kauf- Dienstbarkeitsvertrag',
      'Mieterdossier',
      'Mietvertrag',
      'Schliessplan / Sicherungsschein',
      'Serviceverträge',
      'Sonstiges'
    ];

    // Current property for document operations
    let currentDocumentProperty = null;

    // Tab switching functionality
    function switchTab(tabName) {
      // Update tab buttons
      const tabs = document.querySelectorAll('.detail-tab');
      tabs.forEach(tab => {
        if (tab.textContent === tabName) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // Update tab content
      const uebersichtContent = document.querySelector('.tab-content-uebersicht');
      const meilensteineContent = document.querySelector('.tab-content-meilensteine');
      const ereignisseContent = document.querySelector('.tab-content-ereignisse');
      const dokumenteContent = document.querySelector('.tab-content-dokumente');

      // Hide all tabs first
      uebersichtContent.classList.remove('active');
      meilensteineContent.classList.remove('active');
      ereignisseContent.classList.remove('active');
      dokumenteContent.classList.remove('active');

      // Show the selected tab
      if (tabName === 'ÜBERSICHT') {
        uebersichtContent.classList.add('active');
      } else if (tabName === 'MEILENSTEINE') {
        meilensteineContent.classList.add('active');
      } else if (tabName === 'EREIGNISSE') {
        ereignisseContent.classList.add('active');
      } else if (tabName === 'DOKUMENTE') {
        dokumenteContent.classList.add('active');
      }
    }

    // Get file extension
    function getFileExtension(filename) {
      return filename.split('.').pop().toLowerCase();
    }

    // Get document icon based on file extension
    function getDocumentIcon(filename) {
      const ext = getFileExtension(filename);
      const iconMap = {
        'pdf': { icon: 'picture_as_pdf', class: 'pdf' },
        'xlsx': { icon: 'table_chart', class: 'xlsx' },
        'xls': { icon: 'table_chart', class: 'xls' },
        'png': { icon: 'image', class: 'png' },
        'jpg': { icon: 'image', class: 'jpg' },
        'jpeg': { icon: 'image', class: 'jpeg' },
        'gif': { icon: 'image', class: 'gif' },
        'glb': { icon: 'view_in_ar', class: 'glb' },
        'gltf': { icon: 'view_in_ar', class: 'gltf' },
        'obj': { icon: 'view_in_ar', class: 'obj' }
      };
      return iconMap[ext] || { icon: 'description', class: 'default' };
    }

    // Format document upload date with time
    function formatDocumentDate(isoDate) {
      const date = new Date(isoDate);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    }

    // Format document date only (without time)
    function formatDocumentDateOnly(isoDate) {
      const date = new Date(isoDate);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    }

    // Milestone definitions
    const milestoneDefinitions = [
      { num: 1, label: 'Neuer Auftrag', responsibility: 'BBL Portfolio Management' },
      { num: 2, label: 'Auftrag geprüft', responsibility: 'BBL Portfolio Management' },
      { num: 3, label: 'Repriorisiert', responsibility: 'BBL Portfolio Management' },
      { num: 4, label: 'Zum Verkauf freigegeben', responsibility: 'BBL Portfolio Management' },
      { num: 5, label: 'Vermarktung gestartet', responsibility: 'Externer Makler' },
      { num: 6, label: 'Bieterverfahren beendet', responsibility: 'Externer Makler' },
      { num: 7, label: 'Objekt verkauft', responsibility: 'BBL Portfolio Management' }
    ];

    // Render milestones list
    function renderMilestones(prop) {
      const currentMilestone = prop.milestone?.current || 0;
      const events = prop.events || [];

      return milestoneDefinitions.map(ms => {
        const isCompleted = ms.num <= currentMilestone;
        const isNext = ms.num === currentMilestone + 1;

        // Find matching event for completed milestones
        const matchingEvent = events.find(e => e.milestone && e.milestone.includes(`${ms.num}/7`));

        let statusText = 'Zu erledigen.';
        if (isCompleted && matchingEvent) {
          statusText = `Abgeschlossen am: ${formatDocumentDateOnly(matchingEvent.timestamp)}`;
        }

        // Determine button state
        let buttonClass = 'milestone-btn ';
        let buttonText = '';
        let buttonDisabled = '';

        if (isCompleted) {
          buttonClass += 'milestone-btn-completed';
          buttonText = 'Erledigt';
          buttonDisabled = 'disabled';
        } else if (isNext) {
          buttonClass += 'milestone-btn-complete';
          buttonText = 'Abschliessen';
        } else {
          buttonClass += 'milestone-btn-pending';
          buttonText = 'Abschliessen';
          buttonDisabled = 'disabled';
        }

        return `
          <div class="milestone-item">
            <div class="milestone-content">
              <div class="milestone-title">Meilenstein ${ms.num}/7 ${ms.label}</div>
              <div class="milestone-status">
                <span class="material-icons-outlined milestone-status-icon ${isCompleted ? 'completed' : 'pending'}">
                  ${isCompleted ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span class="milestone-status-text">${statusText}</span>
              </div>
              <span class="milestone-responsibility">${ms.responsibility}</span>
            </div>
            <div class="milestone-action">
              <button class="${buttonClass}" ${buttonDisabled}>${buttonText}</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render events table
    function renderEventsTable(events) {
      if (!events || events.length === 0) {
        return `
          <div class="tab-empty">
            <span class="material-icons-outlined">event_busy</span>
            <p>Keine Ereignisse vorhanden</p>
          </div>
        `;
      }

      const rows = events.map(event => {
        const dateOnly = formatDocumentDateOnly(event.timestamp);
        const comment = event.comment || '-';
        return `
          <tr data-event-id="${event.id}" class="event-row">
            <td class="data-table-checkbox">
              <input type="checkbox" aria-label="Ereignis auswählen" onchange="updateEventSelection()">
            </td>
            <td class="event-milestone">${event.milestone}</td>
            <td class="event-user">${event.user}</td>
            <td class="event-timestamp">${dateOnly}</td>
            <td class="event-comment">${comment}</td>
          </tr>
        `;
      }).join('');

      return `
        <table class="data-table">
          <thead>
            <tr>
              <th class="data-table-checkbox">
                <input type="checkbox" aria-label="Alle Ereignisse auswählen" onchange="toggleAllEvents(this)">
              </th>
              <th>Meilenstein</th>
              <th>Benutzer</th>
              <th>Zeitstempel</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    // Toggle all event checkboxes
    function toggleAllEvents(headerCheckbox) {
      const checkboxes = document.querySelectorAll('.tab-content-ereignisse .data-table tbody input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = headerCheckbox.checked;
        cb.closest('tr').classList.toggle('selected', headerCheckbox.checked);
      });
      // Update action button state
      const downloadBtn = document.getElementById('eventDownloadBtn');
      if (downloadBtn) downloadBtn.classList.toggle('active', headerCheckbox.checked);
    }

    // Update event selection state
    function updateEventSelection() {
      const checkboxes = document.querySelectorAll('.tab-content-ereignisse .data-table tbody input[type="checkbox"]');
      const headerCheckbox = document.querySelector('.tab-content-ereignisse .data-table thead input[type="checkbox"]');
      const downloadBtn = document.getElementById('eventDownloadBtn');

      checkboxes.forEach(cb => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
      });

      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      const someChecked = Array.from(checkboxes).some(cb => cb.checked);

      if (headerCheckbox) {
        headerCheckbox.checked = allChecked;
        headerCheckbox.indeterminate = someChecked && !allChecked;
      }

      // Toggle active state on action button
      if (downloadBtn) downloadBtn.classList.toggle('active', someChecked);
    }

    // Filter events by search term
    function filterEvents(searchTerm) {
      const rows = document.querySelectorAll('.tab-content-ereignisse .data-table tbody tr');
      const term = searchTerm.toLowerCase();

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    }

    // Download selected events as CSV (placeholder)
    function downloadSelectedEvents() {
      const downloadBtn = document.getElementById('eventDownloadBtn');
      if (!downloadBtn || !downloadBtn.classList.contains('active')) return;

      const selected = document.querySelectorAll('.tab-content-ereignisse .data-table tbody input[type="checkbox"]:checked');
      if (selected.length === 0) return;

      const eventIds = Array.from(selected).map(cb => cb.closest('tr').dataset.eventId);
      alert(`CSV-Download von ${eventIds.length} Ereignis(sen) wird gestartet...\n\nIDs: ${eventIds.join(', ')}`);
    }

    // Render documents table
    function renderDocumentsTable(documents) {
      if (!documents || documents.length === 0) {
        return `
          <div class="tab-empty">
            <span class="material-icons-outlined">folder_open</span>
            <p>Keine Dokumente vorhanden</p>
          </div>
        `;
      }

      const rows = documents.map(doc => {
        const format = getFileExtension(doc.name).toUpperCase();
        const size = doc.size || '-';
        const dateOnly = formatDocumentDateOnly(doc.uploadedAt);
        const uploadedInfo = `${doc.uploadedBy}, ${dateOnly}`;
        return `
          <tr data-doc-id="${doc.id}" class="doc-row">
            <td class="data-table-checkbox">
              <input type="checkbox" aria-label="Dokument auswählen" onchange="updateDocumentSelection()">
            </td>
            <td class="doc-title"><a href="#" onclick="event.preventDefault()">${doc.title || doc.name}</a></td>
            <td class="doc-type">${doc.type}</td>
            <td class="doc-format">${format}</td>
            <td class="doc-uploaded">${uploadedInfo}</td>
            <td class="doc-size">${size}</td>
          </tr>
        `;
      }).join('');

      return `
        <table class="data-table">
          <thead>
            <tr>
              <th class="data-table-checkbox">
                <input type="checkbox" aria-label="Alle Dokumente auswählen" onchange="toggleAllDocuments(this)">
              </th>
              <th class="sortable" onclick="sortDocuments('title')">
                <span>Titel</span>
                <span class="material-icons-outlined sort-icon">unfold_more</span>
              </th>
              <th class="sortable" onclick="sortDocuments('type')">
                <span>Typ</span>
                <span class="material-icons-outlined sort-icon">unfold_more</span>
              </th>
              <th>Format</th>
              <th class="sortable" onclick="sortDocuments('uploaded')">
                <span>Hochgeladen</span>
                <span class="material-icons-outlined sort-icon">unfold_more</span>
              </th>
              <th>Grösse</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    // Toggle all document checkboxes
    function toggleAllDocuments(headerCheckbox) {
      const checkboxes = document.querySelectorAll('.tab-content-dokumente .data-table tbody input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = headerCheckbox.checked;
        cb.closest('tr').classList.toggle('selected', headerCheckbox.checked);
      });
      // Update action buttons state
      const deleteBtn = document.getElementById('docDeleteBtn');
      const downloadBtn = document.getElementById('docDownloadBtn');
      if (deleteBtn) deleteBtn.classList.toggle('active', headerCheckbox.checked);
      if (downloadBtn) downloadBtn.classList.toggle('active', headerCheckbox.checked);
    }

    // Update document selection state
    function updateDocumentSelection() {
      const checkboxes = document.querySelectorAll('.tab-content-dokumente .data-table tbody input[type="checkbox"]');
      const headerCheckbox = document.querySelector('.tab-content-dokumente .data-table thead input[type="checkbox"]');
      const deleteBtn = document.getElementById('docDeleteBtn');
      const downloadBtn = document.getElementById('docDownloadBtn');

      checkboxes.forEach(cb => {
        cb.closest('tr').classList.toggle('selected', cb.checked);
      });

      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      const someChecked = Array.from(checkboxes).some(cb => cb.checked);

      if (headerCheckbox) {
        headerCheckbox.checked = allChecked;
        headerCheckbox.indeterminate = someChecked && !allChecked;
      }

      // Toggle active state on action buttons
      if (deleteBtn) deleteBtn.classList.toggle('active', someChecked);
      if (downloadBtn) downloadBtn.classList.toggle('active', someChecked);
    }

    // Filter documents by search term
    function filterDocuments(searchTerm) {
      const rows = document.querySelectorAll('.tab-content-dokumente .data-table tbody tr');
      const term = searchTerm.toLowerCase();

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    }

    // Sort documents by column
    let currentSortColumn = null;
    let currentSortDirection = 'asc';

    function sortDocuments(column) {
      const tbody = document.querySelector('.tab-content-dokumente .data-table tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));

      // Toggle direction if same column
      if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
      }

      const columnIndex = {
        'title': 1,
        'type': 2,
        'uploaded': 4
      }[column];

      rows.sort((a, b) => {
        const aVal = a.cells[columnIndex]?.textContent.trim() || '';
        const bVal = b.cells[columnIndex]?.textContent.trim() || '';

        let comparison = aVal.localeCompare(bVal, 'de');
        return currentSortDirection === 'desc' ? -comparison : comparison;
      });

      rows.forEach(row => tbody.appendChild(row));
    }

    // Delete selected documents
    function deleteSelectedDocuments() {
      const deleteBtn = document.getElementById('docDeleteBtn');
      if (!deleteBtn || !deleteBtn.classList.contains('active')) return;

      const selected = document.querySelectorAll('.tab-content-dokumente .data-table tbody input[type="checkbox"]:checked');
      if (selected.length === 0) return;

      if (confirm(`Möchten Sie ${selected.length} Dokument(e) wirklich löschen?`)) {
        selected.forEach(cb => {
          const row = cb.closest('tr');
          if (row) row.remove();
        });

        // Update header checkbox and action buttons
        const headerCheckbox = document.querySelector('.tab-content-dokumente .data-table thead input[type="checkbox"]');
        if (headerCheckbox) {
          headerCheckbox.checked = false;
          headerCheckbox.indeterminate = false;
        }
        updateDocumentSelection();
      }
    }

    // Download selected documents
    function downloadSelectedDocuments() {
      const downloadBtn = document.getElementById('docDownloadBtn');
      if (!downloadBtn || !downloadBtn.classList.contains('active')) return;

      const selected = document.querySelectorAll('.tab-content-dokumente .data-table tbody input[type="checkbox"]:checked');
      if (selected.length === 0) return;

      const docIds = Array.from(selected).map(cb => cb.closest('tr').dataset.docId);
      alert(`Download von ${docIds.length} Dokument(en) wird gestartet...\n\nIDs: ${docIds.join(', ')}`);
    }

    // Show document context menu (placeholder - could be extended)
    function showDocumentMenu(event, docId) {
      event.stopPropagation();
      // For now, just log the action - could be extended with a dropdown menu
      console.log('Document menu clicked for:', docId);
    }

    // Open upload dialog
    function openUploadDialog() {
      const overlay = document.getElementById('uploadDialogOverlay');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Reset form
      resetUploadForm();
    }

    // Close upload dialog
    function closeUploadDialog() {
      const overlay = document.getElementById('uploadDialogOverlay');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Open login dialog
    function openLoginDialog() {
      const overlay = document.getElementById('loginDialogOverlay');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Clear form
      document.getElementById('loginEmail').value = '';
      document.getElementById('loginPassword').value = '';
    }

    // Close login dialog
    function closeLoginDialog() {
      const overlay = document.getElementById('loginDialogOverlay');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Submit login (mockup - just closes dialog)
    function submitLogin() {
      closeLoginDialog();
    }

    // Reset upload form
    function resetUploadForm() {
      const fileInput = document.getElementById('uploadFileInput');
      const dropzone = document.getElementById('uploadDropzone');
      const dropzoneText = document.getElementById('uploadDropzoneText');
      const typeSelect = document.getElementById('uploadTypeSelect');
      const nameInput = document.getElementById('uploadNameInput');
      const submitBtn = document.getElementById('uploadSubmitBtn');

      if (fileInput) fileInput.value = '';
      if (dropzone) dropzone.classList.remove('has-file');
      if (dropzoneText) dropzoneText.innerHTML = '<span class="upload-dropzone-text">Datei auswählen</span>';
      if (typeSelect) typeSelect.value = '';
      if (nameInput) nameInput.value = '';
      if (submitBtn) submitBtn.disabled = true;
    }

    // Handle file selection
    function handleFileSelect(file) {
      if (!file) return;

      const dropzone = document.getElementById('uploadDropzone');
      const dropzoneText = document.getElementById('uploadDropzoneText');
      const nameInput = document.getElementById('uploadNameInput');

      dropzone.classList.add('has-file');
      dropzoneText.innerHTML = `<span class="upload-dropzone-filename">${file.name}</span>`;
      nameInput.value = file.name;

      validateUploadForm();
    }

    // Validate upload form
    function validateUploadForm() {
      const dropzone = document.getElementById('uploadDropzone');
      const typeSelect = document.getElementById('uploadTypeSelect');
      const nameInput = document.getElementById('uploadNameInput');
      const submitBtn = document.getElementById('uploadSubmitBtn');

      const hasFile = dropzone.classList.contains('has-file');
      const hasType = typeSelect.value !== '';
      const hasName = nameInput.value.trim() !== '';

      submitBtn.disabled = !(hasFile && hasType && hasName);
    }

    // Submit document upload (simulated)
    function submitDocumentUpload() {
      const typeSelect = document.getElementById('uploadTypeSelect');
      const nameInput = document.getElementById('uploadNameInput');

      if (!currentDocumentProperty) return;

      // Create new document object
      const newDoc = {
        id: 'doc-' + Date.now(),
        name: nameInput.value.trim(),
        type: typeSelect.value,
        uploadedBy: 'user@example.com',
        uploadedAt: new Date().toISOString()
      };

      // Add to property documents (in memory only - would need backend for persistence)
      if (!currentDocumentProperty.documents) {
        currentDocumentProperty.documents = [];
      }
      currentDocumentProperty.documents.push(newDoc);

      // Re-render documents table
      const documentsTableContainer = document.getElementById('documentsTableContainer');
      if (documentsTableContainer) {
        documentsTableContainer.innerHTML = renderDocumentsTable(currentDocumentProperty.documents);
      }

      // Close dialog
      closeUploadDialog();
    }

    // Initialize drag and drop for upload dropzone
    function initUploadDropzone() {
      const dropzone = document.getElementById('uploadDropzone');
      if (!dropzone) return;

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          handleFileSelect(files[0]);
        }
      });
    }

    // Initialize dropzone when DOM is ready
    document.addEventListener('DOMContentLoaded', initUploadDropzone);

    // Unified click handler (event delegation for tags, cards, rows, sidebar items)
    function handleContentClick(event) {
      // First, check if clicked on a filter tag
      const tag = event.target.closest('.priority-tag[data-filter], .year-tag[data-filter]');
      if (tag) {
        event.stopPropagation();
        event.preventDefault();

        const filterType = tag.dataset.filter;
        const filterValue = tag.dataset.value;
        const isDetailView = tag.dataset.detail === 'true';

        // Add the filter
        advancedFilters[filterType].add(filterValue);

        if (isDetailView) {
          // Close detail view and go back to main with filter applied
          closeDetailPage();
        }

        applyFilters();

        // Update filter modal if it's open
        if (document.getElementById('filterModalOverlay').classList.contains('active')) {
          renderFilterModal();
        }
        return;
      }

      // Checkbox cells: the 18px box is a small touch target, so the whole cell toggles it
      const checkboxCell = event.target.closest('.data-table-checkbox');
      if (checkboxCell && event.target.tagName !== 'INPUT') {
        const checkbox = checkboxCell.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      // Check if clicked on a detail gallery image (main or thumbnail)
      const galleryImage = event.target.closest('.detail-main-image.clickable, .detail-thumb.clickable');
      if (galleryImage) {
        const gallery = document.getElementById('detailGallery');
        if (gallery) {
          const images = JSON.parse(gallery.dataset.images);
          const imageIndex = parseInt(galleryImage.dataset.imageIndex, 10);
          openCarousel(images, imageIndex);
        }
        return;
      }

      // Check if clicked on a gallery card
      const card = event.target.closest('.card[data-id]');
      if (card) {
        openDetailPage(card.dataset.id);
        return;
      }

      // Check if clicked on a list table row
      const row = event.target.closest('#listTableBody tr[data-id]');
      if (row) {
        openDetailPage(row.dataset.id);
        return;
      }

      // Check if clicked on a map sidebar item
      const sidebarItem = event.target.closest('.map-sidebar-item[data-id]');
      if (sidebarItem) {
        flyToProperty(sidebarItem.dataset.id);
        return;
      }
    }

    // Set up unified event delegation
    document.addEventListener('click', handleContentClick);

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const id = params.get('id');

      if (view === 'api') {
        renderApiDocsView();
      } else if (view === 'sales-form') {
        const step = parseInt(params.get('step')) || 1;
        salesFormData.currentStep = step;
        renderSalesFormView();
      } else if (view === 'detail' && id) {
        closeSalesForm(true);
        const prop = properties.find(p => p.id === id);
        if (prop) {
          renderDetailPage(prop);
        }
      } else {
        document.body.classList.remove('detail-active');
        document.getElementById('detailView').classList.remove('active');
        document.body.classList.remove('api-docs-active');
        document.getElementById('apiDocsView').classList.remove('active');
        closeSalesForm(true);
        if (view && ['gallery', 'list', 'map'].includes(view)) {
          setView(view);
        }
      }
    });

    // --- Sales Form Wizard ---
    const salesFormData = {
      currentStep: 1,
      visitedSteps: new Set([1]),
      // Step 1 - Location
      location: {
        searchText: '',
        label: '',
        coords: { E: null, N: null }
      },
      // Step 2 - Identification
      propertyType: null,
      saleYear: null,
      saleReason: null,
      // Step 3 - Property details
      floors: '',
      livingArea: '',
      apartments: '',
      rooms: '',
      parkingSpaces: '',
      isHeated: null,
      hasBuildingRights: null,
      buildingRightsFee: '',
      areaGF: '',
      areaVMF: '',
      areaHNF: '',
      photos: [],
      condition: 3,
      standard: 3,
      // Step 4 - Tenant info
      residentialLeases: '',
      commercialLeases: '',
      monthlyRent: '',
      rentArrears: '',
      hasVerbalAgreements: null,
      verbalAgreementsDescription: ''
    };

    const propertyTypes = [
      { id: 'grundstueck', label: 'Grundstück', icon: 'landscape' },
      { id: 'einfamilienhaus', label: 'Einfamilienhaus', icon: 'home' },
      { id: 'mehrfamilienhaus', label: 'Mehrfamilienhaus', icon: 'apartment' },
      { id: 'wohnung', label: 'Wohnung', icon: 'door_front' },
      { id: 'buerobau', label: 'Bürobau', icon: 'business' },
      { id: 'gewerbe', label: 'Gewerbe', icon: 'store' },
      { id: 'sonderobjekt', label: 'Sonderobjekt', icon: 'account_balance' },
      { id: 'technische_anlage', label: 'Technische Anlage', icon: 'precision_manufacturing' }
    ];

    const saleYears = [2025, 2026, 2027, 2028, 2029, 2030];

    let searchDebounceTimer = null;

    function openSalesForm() {
      // Reset form data
      resetSalesFormData();

      // Update URL
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'sales-form');
      params.set('step', '1');
      window.history.pushState({ view: 'sales-form', step: 1 }, '', `?${params.toString()}`);

      renderSalesFormView();
    }

    function closeSalesForm(skipHistory = false) {
      document.body.classList.remove('sales-form-active');
      document.getElementById('salesFormView').classList.remove('active');

      if (!skipHistory) {
        // Reset form data
        resetSalesFormData();

        // Update URL back to main view
        const params = new URLSearchParams(window.location.search);
        params.delete('step');
        if (currentView !== 'gallery') {
          params.set('view', currentView);
        } else {
          params.delete('view');
        }
        const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
        window.history.pushState({ view: currentView }, '', newUrl);
      }
    }

    function resetSalesFormData() {
      salesFormData.currentStep = 1;
      salesFormData.visitedSteps = new Set([1]);
      salesFormData.location = { searchText: '', label: '', coords: { E: null, N: null } };
      salesFormData.propertyType = null;
      salesFormData.saleYear = null;
      salesFormData.saleReason = null;
      salesFormData.floors = '';
      salesFormData.livingArea = '';
      salesFormData.apartments = '';
      salesFormData.rooms = '';
      salesFormData.parkingSpaces = '';
      salesFormData.isHeated = null;
      salesFormData.hasBuildingRights = null;
      salesFormData.buildingRightsFee = '';
      // SIA 416 - Grundstücksflächen
      salesFormData.areaGSF = '';
      salesFormData.areaGGF = '';
      salesFormData.areaUF = '';
      salesFormData.areaBUF = '';
      // SIA 416 - Gebäudeflächen
      salesFormData.areaGF = '';
      salesFormData.areaNGF = '';
      salesFormData.areaNF = '';
      salesFormData.areaVMF = '';
      salesFormData.areaHNF = '';
      salesFormData.areaNNF = '';
      salesFormData.areaVF = '';
      salesFormData.areaFF = '';
      salesFormData.areaKF = '';
      salesFormData.areaAGF = '';
      // SIA 416 - Gebäudevolumen
      salesFormData.areaGV = '';
      salesFormData.sia416Expanded = false;
      salesFormData.photos = [];
      salesFormData.condition = 3;
      salesFormData.standard = 3;
      salesFormData.residentialLeases = '';
      salesFormData.commercialLeases = '';
      salesFormData.monthlyRent = '';
      salesFormData.rentArrears = '';
      salesFormData.hasVerbalAgreements = null;
      salesFormData.verbalAgreementsDescription = '';
    }

    function renderSalesFormView() {
      document.body.classList.add('sales-form-active');
      document.getElementById('salesFormView').classList.add('active');

      updateSalesFormSidebar();
      renderSalesFormStepContent();
    }

    function updateSalesFormSidebar() {
      const steps = document.querySelectorAll('.sales-form-step');
      const progressBar = document.getElementById('salesFormProgressBar');

      steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');

        if (stepNum === salesFormData.currentStep) {
          step.classList.add('active');
          step.querySelector('.sales-form-step-icon').innerHTML = stepNum;
        } else if (salesFormData.visitedSteps.has(stepNum) && stepNum < salesFormData.currentStep) {
          step.classList.add('completed');
          step.querySelector('.sales-form-step-icon').innerHTML = '<span class="material-icons-outlined">check</span>';
        } else {
          step.querySelector('.sales-form-step-icon').innerHTML = stepNum;
        }
      });

      // Update progress bar
      const progress = (salesFormData.currentStep / 4) * 100;
      progressBar.style.width = `${progress}%`;
    }

    function goToSalesFormStep(stepNum) {
      salesFormData.currentStep = stepNum;
      salesFormData.visitedSteps.add(stepNum);

      // Update URL
      const params = new URLSearchParams(window.location.search);
      params.set('step', stepNum.toString());
      window.history.pushState({ view: 'sales-form', step: stepNum }, '', `?${params.toString()}`);

      updateSalesFormSidebar();
      renderSalesFormStepContent();
    }

    function nextSalesFormStep() {
      if (salesFormData.currentStep < 4) {
        goToSalesFormStep(salesFormData.currentStep + 1);
      }
    }

    function prevSalesFormStep() {
      if (salesFormData.currentStep > 1) {
        goToSalesFormStep(salesFormData.currentStep - 1);
      }
    }

    function renderSalesFormStepContent() {
      const content = document.getElementById('salesFormContent');

      switch (salesFormData.currentStep) {
        case 1:
          content.innerHTML = renderStep1();
          setupStep1Handlers();
          break;
        case 2:
          content.innerHTML = renderStep2();
          setupStep2Handlers();
          break;
        case 3:
          content.innerHTML = renderStep3();
          setupStep3Handlers();
          break;
        case 4:
          content.innerHTML = renderStep4();
          break;
      }
    }

    // --- Step 1: Objekt erfassen (merged with Identifikation) ---
    function renderStep1() {
      const hasLocation = salesFormData.location.coords.E && salesFormData.location.coords.N;

      return `
        <div class="sales-form-step-header">
          <h2 class="sales-form-step-title">1. Objekt erfassen</h2>
          <p class="sales-form-step-description">
            Suchen Sie nach der Adresse und geben Sie die Basisinformationen zum Objekt ein.
          </p>
        </div>
        <div class="sales-form-step-content">
          <div class="sales-form-section">
            <label class="sales-form-label required">Adresse oder Standort suchen</label>
            <div class="sales-form-search-wrapper">
              <span class="material-icons-outlined sales-form-search-icon">search</span>
              <input type="text"
                     class="sales-form-search-input ${!salesFormData.location.coords.E ? 'required' : ''}"
                     id="locationSearchInput"
                     placeholder="Mit Adresse, PLZ oder Ort suchen..."
                     value="${salesFormData.location.searchText}"
                     autocomplete="off">
              <button type="button" class="sales-form-search-clear ${salesFormData.location.searchText ? 'visible' : ''}" id="searchClearBtn" onclick="clearSearchInput()" aria-label="Suche löschen">
                <span class="material-icons-outlined">close</span>
              </button>
              <div class="sales-form-search-results" id="locationSearchResults"></div>
            </div>
            ${hasLocation ? `
              <div class="sales-form-selected-location">
                <span class="material-icons-outlined">location_on</span>
                <span class="sales-form-selected-location-text">${salesFormData.location.label}</span>
                <button class="sales-form-selected-location-clear" onclick="clearSelectedLocation()" aria-label="Standort entfernen">
                  <span class="material-icons-outlined">close</span>
                </button>
              </div>
            ` : ''}
          </div>

          <div class="sales-form-section">
            <label class="sales-form-label">Verortung</label>
            <div class="sales-form-map-container" id="locationMapContainer">
              ${hasLocation ? `
                <iframe src="https://map.geo.admin.ch/embed.html?lang=de&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe&E=${salesFormData.location.coords.E}&N=${salesFormData.location.coords.N}&zoom=10&crosshair=marker"></iframe>
              ` : `
                <div class="sales-form-map-placeholder">
                  <span class="material-icons-outlined">map</span>
                  <span>Suchen Sie nach einem Standort, um die Karte anzuzeigen</span>
                </div>
              `}
            </div>
          </div>

          <div class="sales-form-section">
            <label class="sales-form-label">Das Objekt ist ein(e)...</label>
            <div class="sales-form-type-grid">
              ${propertyTypes.map(type => `
                <label class="sales-form-type-card ${salesFormData.propertyType === type.id ? 'selected' : ''}" data-type="${type.id}">
                  <input type="radio" name="propertyType" value="${type.id}" ${salesFormData.propertyType === type.id ? 'checked' : ''}>
                  <span class="material-icons-outlined sales-form-type-card-icon">${type.icon}</span>
                  <span class="sales-form-type-card-label">${type.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="sales-form-divider"></div>

          <div class="sales-form-input-grid">
            <div class="sales-form-input-group">
              <label class="sales-form-label required">In welchem Geschäftsjahr soll die Liegenschaft verkauft werden?</label>
              <select class="sales-form-select ${!salesFormData.saleYear ? 'required' : ''}" id="saleYearSelect">
                <option value="">Auswahl Verkaufsjahr</option>
                ${saleYears.map(year => `
                  <option value="${year}" ${salesFormData.saleYear === year ? 'selected' : ''}>${year}</option>
                `).join('')}
              </select>
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label required">Aus welchem Grund möchten Sie die Liegenschaft verkaufen?</label>
              <div class="sales-form-radio-group ${!salesFormData.saleReason ? 'required' : ''}">
                <label class="sales-form-radio">
                  <input type="radio" name="saleReason" value="bazg" ${salesFormData.saleReason === 'bazg' ? 'checked' : ''}>
                  Objektstrategie BAZG
                </label>
                <label class="sales-form-radio">
                  <input type="radio" name="saleReason" value="eda" ${salesFormData.saleReason === 'eda' ? 'checked' : ''}>
                  Objektstrategie EDA
                </label>
                <label class="sales-form-radio">
                  <input type="radio" name="saleReason" value="sonstiges" ${salesFormData.saleReason === 'sonstiges' ? 'checked' : ''}>
                  Sonstiges
                </label>
              </div>
            </div>
          </div>
        </div>
        <div class="sales-form-nav">
          <button class="sales-form-nav-btn next" onclick="nextSalesFormStep()">
            Weiter
            <span class="material-icons-outlined">chevron_right</span>
          </button>
        </div>
      `;
    }

    function setupStep1Handlers() {
      const searchInput = document.getElementById('locationSearchInput');
      const searchResults = document.getElementById('locationSearchResults');
      const clearBtn = document.getElementById('searchClearBtn');

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          const query = e.target.value.trim();
          salesFormData.location.searchText = query;

          // Toggle clear button visibility
          if (clearBtn) {
            if (query.length > 0) {
              clearBtn.classList.add('visible');
            } else {
              clearBtn.classList.remove('visible');
            }
          }

          if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
          }

          if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
          }

          searchDebounceTimer = setTimeout(() => {
            searchGeoAdmin(query);
          }, 300);
        });

        searchInput.addEventListener('focus', () => {
          if (searchInput.value.length >= 2) {
            searchResults.classList.add('active');
          }
        });

        // Close results when clicking outside
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.sales-form-search-wrapper')) {
            searchResults.classList.remove('active');
          }
        });
      }

      // Property type selection
      document.querySelectorAll('.sales-form-type-card').forEach(card => {
        card.addEventListener('click', () => {
          const type = card.dataset.type;
          salesFormData.propertyType = type;
          document.querySelectorAll('.sales-form-type-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        });
      });

      // Sale year
      const saleYearSelect = document.getElementById('saleYearSelect');
      if (saleYearSelect) {
        saleYearSelect.addEventListener('change', (e) => {
          salesFormData.saleYear = e.target.value ? parseInt(e.target.value) : null;
          // Toggle required class
          if (salesFormData.saleYear) {
            saleYearSelect.classList.remove('required');
          } else {
            saleYearSelect.classList.add('required');
          }
        });
      }

      // Sale reason
      document.querySelectorAll('input[name="saleReason"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          salesFormData.saleReason = e.target.value;
          // Toggle required class on radio group
          const radioGroup = e.target.closest('.sales-form-radio-group');
          if (radioGroup && salesFormData.saleReason) {
            radioGroup.classList.remove('required');
          }
        });
      });
    }

    async function searchGeoAdmin(query) {
      const searchResults = document.getElementById('locationSearchResults');
      searchResults.innerHTML = '<div class="sales-form-search-loading">Suche...</div>';
      searchResults.classList.add('active');

      try {
        const response = await fetch(`https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&limit=10`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          searchResults.innerHTML = data.results.map(result => {
            const attrs = result.attrs;
            return `
              <div class="sales-form-search-result" onclick="selectLocation('${attrs.label.replace(/'/g, "\\'")}', ${attrs.y}, ${attrs.x})">
                <div class="sales-form-search-result-title">${attrs.label}</div>
                <div class="sales-form-search-result-subtitle">${attrs.origin || ''}</div>
              </div>
            `;
          }).join('');
        } else {
          searchResults.innerHTML = '<div class="sales-form-search-empty">Keine Ergebnisse gefunden</div>';
        }
      } catch (error) {
        console.error('Error searching geo.admin.ch:', error);
        searchResults.innerHTML = '<div class="sales-form-search-empty">Fehler bei der Suche</div>';
      }
    }

    function selectLocation(label, east, north) {
      salesFormData.location.label = label;
      salesFormData.location.coords.E = east;
      salesFormData.location.coords.N = north;
      salesFormData.location.searchText = label;

      // Re-render step to show selected location and map
      renderSalesFormStepContent();
    }

    function clearSelectedLocation() {
      salesFormData.location = { searchText: '', label: '', coords: { E: null, N: null } };
      renderSalesFormStepContent();
    }

    function clearSearchInput() {
      salesFormData.location.searchText = '';
      const searchInput = document.getElementById('locationSearchInput');
      const clearBtn = document.getElementById('searchClearBtn');
      const searchResults = document.getElementById('locationSearchResults');
      if (searchInput) searchInput.value = '';
      if (clearBtn) clearBtn.classList.remove('visible');
      if (searchResults) searchResults.classList.remove('active');
    }

    // --- Step 2: Angaben zum Objekt ---
    function renderStep2() {
      const gfValue = parseFloat(salesFormData.areaGF) || 0;
      const vmfPercent = gfValue > 0 ? Math.round((parseFloat(salesFormData.areaVMF) || 0) / gfValue * 100) : 0;
      const hnfPercent = gfValue > 0 ? Math.round((parseFloat(salesFormData.areaHNF) || 0) / gfValue * 100) : 0;

      return `
        <div class="sales-form-step-header">
          <h2 class="sales-form-step-title">2. Angaben zum Objekt</h2>
          <p class="sales-form-step-description">
            Diese Informationen stammen aus internen und externen Partner-Datenbanken. Bitte korrigieren Sie eventuelle Fehler direkt im Formular.
          </p>
        </div>
        <div class="sales-form-step-content">
          <div class="sales-form-input-grid two-column">
            <div class="sales-form-input-group">
              <label class="sales-form-label required">Anzahl Geschosse</label>
              <input type="number" class="sales-form-input ${!salesFormData.floors ? 'required' : ''}" id="floorsInput"
                     placeholder="Angabe fehlt" value="${salesFormData.floors}">
            </div>
            <div class="sales-form-input-group">
              <label class="sales-form-label">Objekt ist beheizt?</label>
              <div class="sales-form-radio-group horizontal">
                <label class="sales-form-radio">
                  <input type="radio" name="isHeated" value="yes" ${salesFormData.isHeated === true ? 'checked' : ''}>
                  Ja
                </label>
                <label class="sales-form-radio">
                  <input type="radio" name="isHeated" value="no" ${salesFormData.isHeated === false ? 'checked' : ''}>
                  Nein
                </label>
              </div>
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label">Wohnfläche in m² (nur Wohnbau)</label>
              <div class="sales-form-input-with-suffix">
                <input type="number" class="sales-form-input" id="livingAreaInput"
                       placeholder="Angabe fehlt" value="${salesFormData.livingArea}">
                <span class="sales-form-input-suffix">m²</span>
              </div>
            </div>
            <div class="sales-form-input-group">
              <label class="sales-form-label">Baurecht vorhanden?</label>
              <div class="sales-form-radio-group horizontal">
                <label class="sales-form-radio">
                  <input type="radio" name="hasBuildingRights" value="yes" ${salesFormData.hasBuildingRights === true ? 'checked' : ''}>
                  Ja
                </label>
                <label class="sales-form-radio">
                  <input type="radio" name="hasBuildingRights" value="no" ${salesFormData.hasBuildingRights === false ? 'checked' : ''}>
                  Nein
                </label>
              </div>
              ${salesFormData.hasBuildingRights === true ? `
                <div class="mt-2">
                  <input type="number" class="sales-form-input" id="buildingRightsFeeInput"
                         placeholder="Baurechtszins in CHF" value="${salesFormData.buildingRightsFee}">
                </div>
              ` : ''}
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label">Anzahl Wohnungen (nur Wohnbau)</label>
              <input type="number" class="sales-form-input" id="apartmentsInput"
                     placeholder="Angabe fehlt" value="${salesFormData.apartments}">
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label">Anzahl Zimmer (nur Wohnbau)</label>
              <input type="number" class="sales-form-input" id="roomsInput"
                     placeholder="Angabe fehlt" value="${salesFormData.rooms}">
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label required">Anzahl Parkplätze</label>
              <input type="number" class="sales-form-input ${!salesFormData.parkingSpaces ? 'required' : ''}" id="parkingSpacesInput"
                     placeholder="Angabe fehlt" value="${salesFormData.parkingSpaces}">
            </div>
          </div>

          <!-- SIA 416 Widget -->
          <div class="sia-416-widget">
            <div class="sia-416-title">Bemessungen nach SIA 416</div>

            <!-- Grundstücksflächen (optional - only visible when expanded) -->
            <div class="sia-416-optional ${salesFormData.sia416Expanded ? 'visible' : ''}" id="sia416Grundstueck">
              <div class="sia-416-section">
                <div class="sia-416-section-title">Grundstücksflächen</div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">GSF</span>
                  <span class="sia-416-name">Grundstücksfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaGSFInput" placeholder="Angabe fehlt" value="${salesFormData.areaGSF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="gsfPercent">0% GSF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">GGF</span>
                  <span class="sia-416-name">Gebäudegrundfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaGGFInput" placeholder="Angabe fehlt" value="${salesFormData.areaGGF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="ggfPercent">0% GSF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">UF</span>
                  <span class="sia-416-name">Umgebungsfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaUFInput" placeholder="Angabe fehlt" value="${salesFormData.areaUF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="ufPercent">0% GSF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">BUF</span>
                  <span class="sia-416-name">Bearbeitete Umgebungsfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaBUFInput" placeholder="Angabe fehlt" value="${salesFormData.areaBUF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="bufPercent">0% GSF</span>
                </div>
              </div>
            </div>

            <!-- Gebäudeflächen - Required fields (always visible) -->
            <div class="sia-416-section">
              <div class="sia-416-section-title">Gebäudeflächen</div>
              <div class="sia-416-row">
                <span class="sia-416-abbr required">GF</span>
                <span class="sia-416-name">Geschossfläche</span>
                <div class="sia-416-input-wrapper">
                  <input type="number" class="sia-416-input ${!salesFormData.areaGF ? 'required' : ''}" id="areaGFInput" placeholder="Angabe fehlt" value="${salesFormData.areaGF}">
                  <span class="sia-416-unit">m²</span>
                </div>
                <span class="sia-416-percent">0% GF</span>
              </div>
              <!-- Optional fields in Gebäudeflächen (only visible when expanded) -->
              <div class="sia-416-optional ${salesFormData.sia416Expanded ? 'visible' : ''}" id="sia416GebaeudeFlaechenOptional">
                <div class="sia-416-row">
                  <span class="sia-416-abbr">NGF</span>
                  <span class="sia-416-name">Nettogeschossfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaNGFInput" placeholder="Angabe fehlt" value="${salesFormData.areaNGF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="ngfPercent">0% GF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">NF</span>
                  <span class="sia-416-name">Nutzfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaNFInput" placeholder="Angabe fehlt" value="${salesFormData.areaNF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="nfPercent">0% GF</span>
                </div>
              </div>
              <div class="sia-416-row">
                <span class="sia-416-abbr required">VMF</span>
                <span class="sia-416-name">Vermietbare Fläche</span>
                <div class="sia-416-input-wrapper">
                  <input type="number" class="sia-416-input ${!salesFormData.areaVMF ? 'required' : ''}" id="areaVMFInput" placeholder="Angabe fehlt" value="${salesFormData.areaVMF}">
                  <span class="sia-416-unit">m²</span>
                </div>
                <span class="sia-416-percent" id="vmfPercent">0% GF</span>
              </div>
              <!-- More optional fields in Gebäudeflächen -->
              <div class="sia-416-optional ${salesFormData.sia416Expanded ? 'visible' : ''}" id="sia416GebaeudeFlaechenOptional2">
                <div class="sia-416-row">
                  <span class="sia-416-abbr">HNF</span>
                  <span class="sia-416-name">Hauptnutzfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaHNFInput" placeholder="Angabe fehlt" value="${salesFormData.areaHNF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="hnfPercent">0% GF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">NNF</span>
                  <span class="sia-416-name">Nebennutzfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaNNFInput" placeholder="Angabe fehlt" value="${salesFormData.areaNNF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="nnfPercent">0% GF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">VF</span>
                  <span class="sia-416-name">Verkehrsfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaVFInput" placeholder="Angabe fehlt" value="${salesFormData.areaVF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="vfPercent">0% GF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">FF</span>
                  <span class="sia-416-name">Funktionsfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaFFInput" placeholder="Angabe fehlt" value="${salesFormData.areaFF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="ffPercent">0% GF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">KF</span>
                  <span class="sia-416-name">Konstruktionsfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaKFInput" placeholder="Angabe fehlt" value="${salesFormData.areaKF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="kfPercent">0% GF</span>
                </div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">AGF</span>
                  <span class="sia-416-name">Aussengeschossfläche</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaAGFInput" placeholder="Angabe fehlt" value="${salesFormData.areaAGF}">
                    <span class="sia-416-unit">m²</span>
                  </div>
                  <span class="sia-416-percent" id="agfPercent">0% GF</span>
                </div>
              </div>
            </div>

            <!-- Gebäudevolumen (optional - only visible when expanded) -->
            <div class="sia-416-optional ${salesFormData.sia416Expanded ? 'visible' : ''}" id="sia416Volumen">
              <div class="sia-416-section">
                <div class="sia-416-section-title">Gebäudevolumen</div>
                <div class="sia-416-row">
                  <span class="sia-416-abbr">GV</span>
                  <span class="sia-416-name">Gebäudevolumen</span>
                  <div class="sia-416-input-wrapper">
                    <input type="number" class="sia-416-input" id="areaGVInput" placeholder="Angabe fehlt" value="${salesFormData.areaGV}">
                    <span class="sia-416-unit">m³</span>
                  </div>
                  <span class="sia-416-percent">0% GV</span>
                </div>
              </div>
            </div>

            <!-- Toggle button -->
            <button type="button" class="sia-416-toggle ${salesFormData.sia416Expanded ? 'expanded' : ''}" id="sia416Toggle" onclick="toggleSia416()">
              <span class="material-icons-outlined">expand_more</span>
              <span id="sia416ToggleText">${salesFormData.sia416Expanded ? 'Zusätzliche Angaben ausblenden' : 'Zusätzliche Angaben einblenden'}</span>
            </button>
          </div>

          <!-- Info box (outside widget for full width) -->
          <div class="sia-416-info">
            <span class="material-icons-outlined">lightbulb</span>
            <p>Mit Stern* markierte Informationen sind Pflichtfelder. Angaben zur Grundstücksfläche werden automatisch aus der <a href="https://map.geo.admin.ch/#/map?lang=de&center=2669393.97,1204289.63&z=2&topic=ech&layers=ch.swisstopo-vd.stand-oerebkataster&bgLayer=ch.swisstopo.pixelkarte-farbe" target="_blank" rel="noopener">Amtlichen Vermessung</a> ermittelt.</p>
          </div>

          <div class="sales-form-photos-section">
            <div class="sales-form-photos-title">Fotos</div>
            <p class="sales-form-photos-description">Im folgenden Abschnitt können Objekt Fotos hochgeladen werden. Mehrere Bilder können einzeln hochgeladen werden.</p>
            <label class="sales-form-photo-upload-btn">
              <input type="file" accept="image/*" multiple style="display: none;" onchange="handlePhotoUpload(event)">
              Bild hochladen
            </label>
            <div class="sales-form-photos-grid" id="photosGrid">
              ${salesFormData.photos.map((photo, index) => `
                <div class="sales-form-photo-thumb" style="background-image: url('${photo}')">
                  <button class="sales-form-photo-remove" onclick="removePhoto(${index})" aria-label="Foto entfernen">
                    <span class="material-icons-outlined">close</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="sales-form-info-box">
            <span class="material-icons-outlined">lightbulb</span>
            <p>Für eine präzise Bewertung sind Fotos von <a href="#" class="link-accent">aussen</a> und <a href="#" class="link-accent">innen erforderlich</a>. Sollten keine Bilder verfügbar sein, lassen Sie das Feld bitte leer. Achten Sie darauf, keine urheberrechtlich geschützten Bilder hochzuladen.</p>
          </div>

          <div class="sales-form-rating-section">
            <div class="sales-form-rating">
              <div class="sales-form-rating-label">Aktueller Zustand</div>
              <div class="sales-form-rating-grid" id="conditionRating">
                <div class="sales-form-rating-track-line"></div>
                <div class="sales-form-rating-sector ${salesFormData.condition === 1 ? 'active' : ''}" data-value="1" data-target="condition">
                  <div class="sales-form-rating-sector-icon">
                    <span class="material-icons-outlined">domain_disabled</span>
                  </div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label">Sanierungsreif (1)</div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.condition === 2 ? 'active' : ''}" data-value="2" data-target="condition">
                  <div class="sales-form-rating-sector-icon"></div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label"></div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.condition === 3 ? 'active' : ''}" data-value="3" data-target="condition">
                  <div class="sales-form-rating-sector-icon">
                    <span class="material-icons-outlined">family_restroom</span>
                  </div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label">Intakt (3)</div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.condition === 4 ? 'active' : ''}" data-value="4" data-target="condition">
                  <div class="sales-form-rating-sector-icon"></div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label"></div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.condition === 5 ? 'active' : ''}" data-value="5" data-target="condition">
                  <div class="sales-form-rating-sector-icon">
                    <span class="material-icons-outlined">real_estate_agent</span>
                  </div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label">Neuwertig (5)</div>
                </div>
              </div>
              <input type="hidden" id="conditionSlider" value="${salesFormData.condition}">
            </div>

            <div class="sales-form-info-box">
              <span class="material-icons-outlined">lightbulb</span>
              <p>In der Schweiz befinden sich die meisten Immobilien in gutem Zustand. Als sanierungsbedürftig gelten solche, die erhebliche Nutzungseinschränkungen aufzeigen. Immobilien gelten als neuwertig, wenn sie nicht älter als 5 Jahre sind.</p>
            </div>

            <div class="sales-form-rating mt-8">
              <div class="sales-form-rating-label">Ausbaustandard</div>
              <div class="sales-form-rating-grid" id="standardRating">
                <div class="sales-form-rating-track-line"></div>
                <div class="sales-form-rating-sector ${salesFormData.standard === 1 ? 'active' : ''}" data-value="1" data-target="standard">
                  <div class="sales-form-rating-sector-icon">
                    <span class="material-icons-outlined">cabin</span>
                  </div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label">Einfach (1)</div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.standard === 2 ? 'active' : ''}" data-value="2" data-target="standard">
                  <div class="sales-form-rating-sector-icon"></div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label"></div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.standard === 3 ? 'active' : ''}" data-value="3" data-target="standard">
                  <div class="sales-form-rating-sector-icon">
                    <span class="material-icons-outlined">home</span>
                  </div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label">Üblich (3)</div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.standard === 4 ? 'active' : ''}" data-value="4" data-target="standard">
                  <div class="sales-form-rating-sector-icon"></div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label"></div>
                </div>
                <div class="sales-form-rating-sector ${salesFormData.standard === 5 ? 'active' : ''}" data-value="5" data-target="standard">
                  <div class="sales-form-rating-sector-icon">
                    <span class="material-icons-outlined">villa</span>
                  </div>
                  <div class="sales-form-rating-sector-dot">
                    <span class="sales-form-rating-dot"></span>
                  </div>
                  <div class="sales-form-rating-sector-label">Luxuriös (5)</div>
                </div>
              </div>
              <input type="hidden" id="standardSlider" value="${salesFormData.standard}">
            </div>

            <div class="sales-form-info-box">
              <span class="material-icons-outlined">lightbulb</span>
              <p>Die meisten Immobilien in der Schweiz besitzen eine übliche Grundausstattung.</p>
            </div>
          </div>
        </div>
        <div class="sales-form-nav">
          <button class="sales-form-nav-btn back" onclick="prevSalesFormStep()">
            <span class="material-icons-outlined">chevron_left</span>
            Zurück
          </button>
          <button class="sales-form-nav-btn next" onclick="nextSalesFormStep()">
            Weiter
            <span class="material-icons-outlined">chevron_right</span>
          </button>
        </div>
      `;
    }

    function setupStep2Handlers() {
      // Input fields
      const inputMappings = {
        'floorsInput': 'floors',
        'livingAreaInput': 'livingArea',
        'apartmentsInput': 'apartments',
        'roomsInput': 'rooms',
        'parkingSpacesInput': 'parkingSpaces',
        'buildingRightsFeeInput': 'buildingRightsFee',
        // SIA 416 - Grundstücksflächen
        'areaGSFInput': 'areaGSF',
        'areaGGFInput': 'areaGGF',
        'areaUFInput': 'areaUF',
        'areaBUFInput': 'areaBUF',
        // SIA 416 - Gebäudeflächen
        'areaGFInput': 'areaGF',
        'areaNGFInput': 'areaNGF',
        'areaNFInput': 'areaNF',
        'areaVMFInput': 'areaVMF',
        'areaHNFInput': 'areaHNF',
        'areaNNFInput': 'areaNNF',
        'areaVFInput': 'areaVF',
        'areaFFInput': 'areaFF',
        'areaKFInput': 'areaKF',
        'areaAGFInput': 'areaAGF',
        // SIA 416 - Gebäudevolumen
        'areaGVInput': 'areaGV'
      };

      // Required fields in Step 2
      const requiredStep2Fields = ['floorsInput', 'parkingSpacesInput', 'areaGFInput', 'areaVMFInput'];

      Object.entries(inputMappings).forEach(([id, field]) => {
        const input = document.getElementById(id);
        if (input) {
          input.addEventListener('input', (e) => {
            salesFormData[field] = e.target.value;
            updateAreaPercentages();
            // Toggle required class for required fields
            if (requiredStep2Fields.includes(id)) {
              if (e.target.value) {
                input.classList.remove('required');
              } else {
                input.classList.add('required');
              }
            }
          });
        }
      });

      // Radio buttons
      document.querySelectorAll('input[name="isHeated"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          salesFormData.isHeated = e.target.value === 'yes';
        });
      });

      document.querySelectorAll('input[name="hasBuildingRights"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          salesFormData.hasBuildingRights = e.target.value === 'yes';
          renderSalesFormStepContent();
        });
      });

      // Rating sectors (clickable columns)
      document.querySelectorAll('.sales-form-rating-sector').forEach(sector => {
        sector.addEventListener('click', (e) => {
          const value = parseInt(sector.dataset.value);
          const target = sector.dataset.target;

          if (target === 'condition') {
            salesFormData.condition = value;
            document.querySelectorAll('#conditionRating .sales-form-rating-sector').forEach(s => {
              s.classList.toggle('active', parseInt(s.dataset.value) === value);
            });
          } else if (target === 'standard') {
            salesFormData.standard = value;
            document.querySelectorAll('#standardRating .sales-form-rating-sector').forEach(s => {
              s.classList.toggle('active', parseInt(s.dataset.value) === value);
            });
          }
        });
      });
    }

    function updateAreaPercentages() {
      // Reference values
      const gsf = parseFloat(salesFormData.areaGSF) || 0;
      const gf = parseFloat(salesFormData.areaGF) || 0;

      // Grundstücksflächen (% of GSF)
      const gsfFields = ['ggf', 'uf', 'buf'];
      gsfFields.forEach(field => {
        const value = parseFloat(salesFormData[`area${field.toUpperCase()}`]) || 0;
        const percentEl = document.getElementById(`${field}Percent`);
        if (percentEl) {
          percentEl.textContent = gsf > 0 ? `${Math.round(value / gsf * 100)}% GSF` : '0% GSF';
        }
      });

      // Gebäudeflächen (% of GF)
      const gfFields = ['ngf', 'nf', 'vmf', 'hnf', 'nnf', 'vf', 'ff', 'kf', 'agf'];
      gfFields.forEach(field => {
        const value = parseFloat(salesFormData[`area${field.toUpperCase()}`]) || 0;
        const percentEl = document.getElementById(`${field}Percent`);
        if (percentEl) {
          percentEl.textContent = gf > 0 ? `${Math.round(value / gf * 100)}% GF` : '0% GF';
        }
      });
    }

    function toggleSia416() {
      salesFormData.sia416Expanded = !salesFormData.sia416Expanded;

      // Toggle visibility of optional sections
      const optionalSections = document.querySelectorAll('.sia-416-optional');
      optionalSections.forEach(section => {
        section.classList.toggle('visible', salesFormData.sia416Expanded);
      });

      // Update toggle button
      const toggleBtn = document.getElementById('sia416Toggle');
      const toggleText = document.getElementById('sia416ToggleText');
      if (toggleBtn) {
        toggleBtn.classList.toggle('expanded', salesFormData.sia416Expanded);
      }
      if (toggleText) {
        toggleText.textContent = salesFormData.sia416Expanded
          ? 'Zusätzliche Angaben ausblenden'
          : 'Zusätzliche Angaben einblenden';
      }
    }

    function toggleExpandable(button) {
      button.classList.toggle('expanded');
      const content = button.nextElementSibling;
      content.classList.toggle('active');
    }

    function handlePhotoUpload(event) {
      const files = event.target.files;
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          salesFormData.photos.push(e.target.result);
          renderPhotosGrid();
        };
        reader.readAsDataURL(file);
      });
    }

    function removePhoto(index) {
      salesFormData.photos.splice(index, 1);
      renderPhotosGrid();
    }

    function renderPhotosGrid() {
      const grid = document.getElementById('photosGrid');
      if (grid) {
        grid.innerHTML = salesFormData.photos.map((photo, index) => `
          <div class="sales-form-photo-thumb" style="background-image: url('${photo}')">
            <button class="sales-form-photo-remove" onclick="removePhoto(${index})" aria-label="Foto entfernen">
              <span class="material-icons-outlined">close</span>
            </button>
          </div>
        `).join('');
      }
    }

    // --- Step 3: Angaben zum Mieter ---
    function renderStep3() {
      return `
        <div class="sales-form-step-header">
          <h2 class="sales-form-step-title">3. Angaben zum Mieter</h2>
          <p class="sales-form-step-description">
            Fast geschafft. Für eine genauere Marktwertbewertung benötigen wir ein paar zusätzliche Angaben zum Mieter.
          </p>
        </div>
        <div class="sales-form-step-content">
          <div class="sales-form-input-grid">
            <div class="sales-form-input-group">
              <label class="sales-form-label required">Anzahl Wohnungsmietverträge</label>
              <input type="number" class="sales-form-input ${!salesFormData.residentialLeases && salesFormData.residentialLeases !== 0 ? 'required' : ''}" id="residentialLeasesInput"
                     placeholder="Angabe fehlt" value="${salesFormData.residentialLeases}">
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label required">Anzahl Geschäftsmietverträge</label>
              <input type="number" class="sales-form-input ${!salesFormData.commercialLeases && salesFormData.commercialLeases !== 0 ? 'required' : ''}" id="commercialLeasesInput"
                     placeholder="Angabe fehlt" value="${salesFormData.commercialLeases}">
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label required">Total Mietertrag netto pro Monat in CHF</label>
              <div class="sales-form-input-with-suffix">
                <input type="number" class="sales-form-input ${!salesFormData.monthlyRent && salesFormData.monthlyRent !== 0 ? 'required' : ''}" id="monthlyRentInput"
                       placeholder="Angabe fehlt" value="${salesFormData.monthlyRent}">
                <span class="sales-form-input-suffix">CHF</span>
              </div>
            </div>

            <div class="sales-form-input-group">
              <label class="sales-form-label required">Höhe Mietzinsausstände in CHF</label>
              <div class="sales-form-input-with-suffix">
                <input type="number" class="sales-form-input ${!salesFormData.rentArrears && salesFormData.rentArrears !== 0 ? 'required' : ''}" id="rentArrearsInput"
                       placeholder="Angabe fehlt" value="${salesFormData.rentArrears}">
                <span class="sales-form-input-suffix">CHF</span>
              </div>
            </div>

            <div class="sales-form-input-group full-width">
              <label class="sales-form-label required">Mündliche Vereinbarungen mit Mietern, Nachbarn etc.</label>
              <div class="sales-form-radio-group horizontal ${salesFormData.hasVerbalAgreements === null || salesFormData.hasVerbalAgreements === undefined ? 'required' : ''}">
                <label class="sales-form-radio">
                  <input type="radio" name="hasVerbalAgreements" value="yes" ${salesFormData.hasVerbalAgreements === true ? 'checked' : ''}>
                  Ja
                </label>
                <label class="sales-form-radio">
                  <input type="radio" name="hasVerbalAgreements" value="no" ${salesFormData.hasVerbalAgreements === false ? 'checked' : ''}>
                  Nein
                </label>
              </div>
            </div>

            ${salesFormData.hasVerbalAgreements === true ? `
              <div class="sales-form-input-group full-width">
                <label class="sales-form-label">Beschreibung Mündliche Vereinbarungen</label>
                <textarea class="sales-form-textarea" id="verbalAgreementsInput"
                          placeholder="Angabe fehlt">${salesFormData.verbalAgreementsDescription}</textarea>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="sales-form-nav">
          <button class="sales-form-nav-btn back" onclick="prevSalesFormStep()">
            <span class="material-icons-outlined">chevron_left</span>
            Zurück
          </button>
          <button class="sales-form-nav-btn next" onclick="nextSalesFormStep()">
            Weiter
            <span class="material-icons-outlined">chevron_right</span>
          </button>
        </div>
      `;
    }

    function setupStep3Handlers() {
      const inputMappings = {
        'residentialLeasesInput': 'residentialLeases',
        'commercialLeasesInput': 'commercialLeases',
        'monthlyRentInput': 'monthlyRent',
        'rentArrearsInput': 'rentArrears',
        'verbalAgreementsInput': 'verbalAgreementsDescription'
      };

      // Required fields in Step 3
      const requiredStep3Fields = ['residentialLeasesInput', 'commercialLeasesInput', 'monthlyRentInput', 'rentArrearsInput'];

      Object.entries(inputMappings).forEach(([id, field]) => {
        const input = document.getElementById(id);
        if (input) {
          input.addEventListener('input', (e) => {
            salesFormData[field] = e.target.value;
            // Toggle required class for required fields
            if (requiredStep3Fields.includes(id)) {
              if (e.target.value || e.target.value === '0') {
                input.classList.remove('required');
              } else {
                input.classList.add('required');
              }
            }
          });
        }
      });

      document.querySelectorAll('input[name="hasVerbalAgreements"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          salesFormData.hasVerbalAgreements = e.target.value === 'yes';
          renderSalesFormStepContent();
        });
      });
    }

    // --- Step 4: Zusammenfassung ---
    function renderStep4() {
      const propertyTypeLabel = propertyTypes.find(t => t.id === salesFormData.propertyType)?.label || '-';
      const saleReasonLabels = { bazg: 'Objektstrategie BAZG', eda: 'Objektstrategie EDA', sonstiges: 'Sonstiges' };
      const conditionLabels = { 1: 'Sanierungsreif', 2: 'Sanierungsbedürftig', 3: 'Intakt', 4: 'Gut', 5: 'Neuwertig' };
      const standardLabels = { 1: 'Einfach', 2: 'Einfach-Mittel', 3: 'Üblich', 4: 'Gehoben', 5: 'Luxuriös' };

      return `
        <div class="sales-form-step-header">
          <h2 class="sales-form-step-title">4. Zusammenfassung</h2>
          <p class="sales-form-step-description">
            Bitte überprüfen Sie Ihre Angaben. Sie können die einzelnen Abschnitte bearbeiten, indem Sie auf "Bearbeiten" klicken.
          </p>
        </div>
        <div class="sales-form-step-content">
          <div class="sales-form-summary">
            <!-- Step 1 Summary -->
            <div class="sales-form-summary-section">
              <div class="sales-form-summary-header">
                <span class="sales-form-summary-title">1. Objekt erfassen</span>
                <button class="sales-form-summary-edit-btn" onclick="goToSalesFormStep(1)">
                  <span class="material-icons-outlined">edit</span>
                  Bearbeiten
                </button>
              </div>
              <div class="sales-form-summary-content">
                <div class="sales-form-summary-grid">
                  <div class="sales-form-summary-item full-width">
                    <span class="sales-form-summary-label">Standort</span>
                    <span class="sales-form-summary-value ${!salesFormData.location.label ? 'empty' : ''}">
                      ${salesFormData.location.label || 'Nicht angegeben'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 1 Summary (Part 2: Identification data) -->
            <div class="sales-form-summary-section">
              <div class="sales-form-summary-header">
                <span class="sales-form-summary-title">1. Objekt erfassen</span>
                <button class="sales-form-summary-edit-btn" onclick="goToSalesFormStep(1)">
                  <span class="material-icons-outlined">edit</span>
                  Bearbeiten
                </button>
              </div>
              <div class="sales-form-summary-content">
                <div class="sales-form-summary-grid">
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Objektart</span>
                    <span class="sales-form-summary-value ${!salesFormData.propertyType ? 'empty' : ''}">
                      ${propertyTypeLabel}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Verkaufsjahr</span>
                    <span class="sales-form-summary-value ${!salesFormData.saleYear ? 'empty' : ''}">
                      ${salesFormData.saleYear || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Verkaufsgrund</span>
                    <span class="sales-form-summary-value ${!salesFormData.saleReason ? 'empty' : ''}">
                      ${saleReasonLabels[salesFormData.saleReason] || 'Nicht angegeben'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2 Summary -->
            <div class="sales-form-summary-section">
              <div class="sales-form-summary-header">
                <span class="sales-form-summary-title">2. Angaben zum Objekt</span>
                <button class="sales-form-summary-edit-btn" onclick="goToSalesFormStep(2)">
                  <span class="material-icons-outlined">edit</span>
                  Bearbeiten
                </button>
              </div>
              <div class="sales-form-summary-content">
                <div class="sales-form-summary-grid">
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Anzahl Geschosse</span>
                    <span class="sales-form-summary-value ${!salesFormData.floors ? 'empty' : ''}">
                      ${salesFormData.floors || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Beheizt</span>
                    <span class="sales-form-summary-value ${salesFormData.isHeated === null ? 'empty' : ''}">
                      ${salesFormData.isHeated === true ? 'Ja' : salesFormData.isHeated === false ? 'Nein' : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Wohnfläche</span>
                    <span class="sales-form-summary-value ${!salesFormData.livingArea ? 'empty' : ''}">
                      ${salesFormData.livingArea ? `${salesFormData.livingArea} m²` : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Baurecht</span>
                    <span class="sales-form-summary-value ${salesFormData.hasBuildingRights === null ? 'empty' : ''}">
                      ${salesFormData.hasBuildingRights === true ? 'Ja' : salesFormData.hasBuildingRights === false ? 'Nein' : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Anzahl Wohnungen</span>
                    <span class="sales-form-summary-value ${!salesFormData.apartments ? 'empty' : ''}">
                      ${salesFormData.apartments || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Anzahl Zimmer</span>
                    <span class="sales-form-summary-value ${!salesFormData.rooms ? 'empty' : ''}">
                      ${salesFormData.rooms || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Anzahl Parkplätze</span>
                    <span class="sales-form-summary-value ${!salesFormData.parkingSpaces ? 'empty' : ''}">
                      ${salesFormData.parkingSpaces || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Geschossfläche (GF)</span>
                    <span class="sales-form-summary-value ${!salesFormData.areaGF ? 'empty' : ''}">
                      ${salesFormData.areaGF ? `${salesFormData.areaGF} m²` : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Vermietbare Fläche (VMF)</span>
                    <span class="sales-form-summary-value ${!salesFormData.areaVMF ? 'empty' : ''}">
                      ${salesFormData.areaVMF ? `${salesFormData.areaVMF} m²` : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Zustand</span>
                    <span class="sales-form-summary-value">
                      ${conditionLabels[salesFormData.condition]} (${salesFormData.condition}/5)
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Ausbaustandard</span>
                    <span class="sales-form-summary-value">
                      ${standardLabels[salesFormData.standard]} (${salesFormData.standard}/5)
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Fotos</span>
                    <span class="sales-form-summary-value ${salesFormData.photos.length === 0 ? 'empty' : ''}">
                      ${salesFormData.photos.length > 0 ? `${salesFormData.photos.length} Bild(er) hochgeladen` : 'Keine Fotos'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3 Summary -->
            <div class="sales-form-summary-section">
              <div class="sales-form-summary-header">
                <span class="sales-form-summary-title">3. Angaben zum Mieter</span>
                <button class="sales-form-summary-edit-btn" onclick="goToSalesFormStep(3)">
                  <span class="material-icons-outlined">edit</span>
                  Bearbeiten
                </button>
              </div>
              <div class="sales-form-summary-content">
                <div class="sales-form-summary-grid">
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Wohnungsmietverträge</span>
                    <span class="sales-form-summary-value ${!salesFormData.residentialLeases ? 'empty' : ''}">
                      ${salesFormData.residentialLeases || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Geschäftsmietverträge</span>
                    <span class="sales-form-summary-value ${!salesFormData.commercialLeases ? 'empty' : ''}">
                      ${salesFormData.commercialLeases || 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Monatlicher Mietertrag</span>
                    <span class="sales-form-summary-value ${!salesFormData.monthlyRent ? 'empty' : ''}">
                      ${salesFormData.monthlyRent ? `CHF ${parseInt(salesFormData.monthlyRent).toLocaleString('de-CH')}` : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Mietzinsausstände</span>
                    <span class="sales-form-summary-value ${!salesFormData.rentArrears ? 'empty' : ''}">
                      ${salesFormData.rentArrears ? `CHF ${parseInt(salesFormData.rentArrears).toLocaleString('de-CH')}` : 'Nicht angegeben'}
                    </span>
                  </div>
                  <div class="sales-form-summary-item">
                    <span class="sales-form-summary-label">Mündliche Vereinbarungen</span>
                    <span class="sales-form-summary-value ${salesFormData.hasVerbalAgreements === null ? 'empty' : ''}">
                      ${salesFormData.hasVerbalAgreements === true ? 'Ja' : salesFormData.hasVerbalAgreements === false ? 'Nein' : 'Nicht angegeben'}
                    </span>
                  </div>
                  ${salesFormData.hasVerbalAgreements === true && salesFormData.verbalAgreementsDescription ? `
                    <div class="sales-form-summary-item full-width">
                      <span class="sales-form-summary-label">Beschreibung</span>
                      <span class="sales-form-summary-value">${salesFormData.verbalAgreementsDescription}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <div class="sales-form-submit-section">
            <button class="sales-form-submit-btn" onclick="submitSalesForm()">
              Auftrag erstellen
            </button>
          </div>
        </div>
        <div class="sales-form-nav">
          <button class="sales-form-nav-btn back" onclick="prevSalesFormStep()">
            <span class="material-icons-outlined">chevron_left</span>
            Zurück
          </button>
        </div>
      `;
    }

    function submitSalesForm() {
      // For demo purposes, just show an alert
      alert('Demo: Der Auftrag wurde erfolgreich erstellt!\n\nDies ist nur eine Demonstration - in der Produktion würden die Daten an den Server gesendet werden.');
      closeSalesForm();
    }

    // --- INIT ---
    // Icons come from Google Fonts. If that CDN is blocked (offline, restrictive network),
    // the ligature names would render as words; flag it so CSS can hide them.
    if (document.fonts && document.fonts.load) {
      document.fonts.load('24px "Material Icons Outlined"')
        .then(faces => { if (!faces.length) document.documentElement.classList.add('no-icon-font'); })
        .catch(() => document.documentElement.classList.add('no-icon-font'));
    }

    // Save original URL params BEFORE they get overwritten by setView() -> updateUrlParams()
    const initialParams = getUrlParams();

    setupFilterModal();
    setupSearch();
    setupViewToggle();
    loadFiltersFromUrl();
    setView(currentView);

    if (initialParams.view === 'api') {
      renderApiDocsView();
    }

    fetch('data/data.json')
      .then(res => res.json())
      .then(async data => {
        properties = data;
        filteredProperties = [...data];
        extractFilterOptions();
        applyFilters();

        // Check if detail view should be opened from URL (use saved params, not current URL)
        if (initialParams.view === 'detail' && initialParams.id) {
          const prop = properties.find(p => p.id === initialParams.id);
          if (prop) {
            await renderDetailPage(prop);
          }
        } else if (initialParams.view === 'sales-form') {
          // Check if sales form should be opened from URL
          const step = parseInt(initialParams.step) || 1;
          salesFormData.currentStep = step;
          renderSalesFormView();
        }
      })
      .catch(err => {
        console.error('Error loading data:', err);
        document.getElementById('objectGrid').innerHTML = `<div class="empty-state">Fehler beim Laden. Starte via Live Server.</div>`;
      });
