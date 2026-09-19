# Design review, part 2: complexity, maintainability and design consistency

**Scope:** the whole front end (`index.html`, `css/`, `js/`), reviewed for duplicated code and styles, hardcoded values that belong in design tokens, dead code, and inconsistencies between screens. Everything listed under "Implemented" is in this branch; behaviour was guarded by a functional test written before the refactor (`tools/smoke-test.js`, 228 checks at 1280 px and 390 px) and by the responsive audit from part 1 (`tools/responsive-audit.js`, 112 view/viewport combinations, still zero overflow).

**Verdict:** the prototype had grown as one 3,600-line script and one 3,100-line stylesheet in which the same patterns were re-implemented per screen: eight input styles, seven button styles, three priority label maps, two copies of the events/documents table logic, six hand-written open/close/URL functions, ~30 hand-written label/value blocks, 15 SIA rows, 10 rating sectors and 22 summary items. The code is now split into 11 small modules and 8 stylesheets built from one component layer and one token file. Line count roughly halved without removing a feature; six functional bugs surfaced along the way and are fixed.

---

## 1. Findings

### 1.1 Duplicated JavaScript

| # | Finding | Where (before) | Resolution |
|---|---------|----------------|------------|
| J1 | Events and documents tables had two copies of select-all, selection state, text filter and "download selected" (8 functions, ~120 lines). | `toggleAllEvents/Documents`, `updateEvent/DocumentSelection`, `filterEvents/Documents`, `downloadSelected*` | One generic set in `js/ui.js`: `toggleAllRows`, `updateRowSelection`, `filterTableRows`, `selectedRowIds`. Buttons declare `data-requires-selection` and are enabled/disabled via the native `disabled` attribute instead of an `.active` class plus guard clauses. |
| J2 | Six open/close functions each rebuilt the URL by hand (`openDetailPage`, `closeDetailPage`, `openApiDocsPage`, `closeApiDocsPage`, `openSalesForm`, `closeSalesForm`), and the start-up code and the `popstate` handler re-implemented the same routing a third time. | 7 `pushState` sites | `js/router.js`: `filterParams()`, `navigate()`, `showPage()/leavePage()` and a single `applyRoute()` used both at start-up and on back/forward. |
| J3 | Priority labels were hardcoded in three places (`renderPriorityPills`, `renderFilterModal`, the KPI boxes compared label strings) and disagreed with the data (see B3). | 3 literal maps | `PRIORITIES` in `js/config.js` is the only definition; tags, chips, filter dialog, KPI counts and API docs derive from it. |
| J4 | The `image-tags` block (year + priority tag) was written out three times, the `detail-data-item` block 29 times, the location-rating row 9 times. | `renderCards`, `renderListView`, `renderMapView`, `renderDetailPage` | `renderTags()`, `renderMedia()`, `renderDataItem()`, `renderEmptyState()`, `renderSearchField()` in `js/utils.js`; the detail page's overview is rendered from two field lists (`IDENTIFICATION_FIELDS`, `OBJECT_FIELDS`) and `LOCATION_RATINGS`. |
| J5 | Wizard step 2 wrote 15 near-identical SIA 416 rows and 10 rating sectors by hand; step 4 wrote 22 summary items; each step re-implemented input binding and "required" toggling. | `renderStep2` (400 lines), `renderStep4` (220 lines), `setupStep*Handlers` | `SIA_416_SECTIONS`, `RATING_SCALES`, `SUMMARY_SECTIONS` and `STEP_FIELDS` definitions; `renderSiaSection`, `renderRatingScale`, `renderNumberField`, `renderRadioField`, `bindTextInputs`, `bindRadios`. Adding a field is now one line of configuration. |
| J6 | `resetSalesFormData` re-listed all 40 fields of `salesFormData`. | 45 lines | `createSalesFormData()` factory; reset is `Object.assign(salesFormData, createSalesFormData())`. |
| J7 | Five overlays each toggled `document.body.style.overflow` themselves (8 sites); closing one while another was open restored scrolling too early. | dialogs, filter modal, carousel | `openOverlay/closeOverlay` in `js/ui.js` keep a set of open overlays. Escape now also closes the login and upload dialogs. |
| J8 | Filter chips and options re-attached click listeners on every render; step 1 added a new `document` click listener on every re-render (leak). | `renderPriorityPills`, `renderFilterModal`, `setupStep1Handlers` | One delegated click handler in `js/main.js` for tags, chips, filter options, tabs, cards, rows, sidebar items, carousel thumbs, search results and endpoint headers. |
| J9 | `switchTab` compared the tabs' upper-case text content with the argument, and four panel classes were hardcoded. | `switchTab`, `.tab-content-*` | Tabs and panels carry `data-tab`; `switchTab(name)` is generic and reusable. |
| J10 | Dead code: `documentTypes` (duplicate of the 12 `<option>`s in the HTML), `showDocumentMenu`, `toggleExpandable`, `formatDocumentDate` (with time), `cantonCodeMap` (an identity map), `getPriorityValue`. | ~60 lines | Removed; the upload type options are rendered from `DOCUMENT_TYPES` so the list exists once. |
| J11 | User-entered strings (document names, wizard text, geo.admin labels) were inserted into HTML unescaped. | templates | `escapeHtml()` applied where user or remote text is rendered. |

### 1.2 Duplicated and inconsistent styles

| # | Finding | Resolution |
|---|---------|------------|
| S1 | Eight input styles with three different focus treatments and two different paddings (`.search-input`, `.form-input`, `.upload-select`, `.sales-form-input`, `.sales-form-select`, `.sales-form-textarea`, `.sales-form-search-input`, `.sia-416-input`, `.tab-search input`). | One `.input` (+ `.input-select`, `.input-textarea`, `.input-with-suffix`, `.search-field`) with a single focus ring and a single error state (`.required`). |
| S2 | Seven button styles (`.btn`, `.milestone-btn*`, `.sales-form-nav-btn*`, `.sales-form-submit-btn`, `.table-action-btn`, `.table-btn-outline`, `.sales-form-photo-upload-btn`, `.popup-link`) and six icon-button styles (filter reset/close, dialog close, carousel close/nav, search clear, photo remove). | `.btn` with `-primary/-secondary/-outline/-ghost/-link` and `-sm/-lg/-block`; `.icon-btn` with `-filled/-inverse/-sm/-lg`. |
| S3 | Three label/value patterns (`.detail-area`, `.detail-price-card`, `.detail-data-item` – all `column-reverse` tricks – plus `.sales-form-summary-item`). | `.data-item` / `.data-item-label` / `.data-item-value` (+ `-compact`, `-full`, `.data-item-row`, `.data-grid`); markup is label-then-value, no `column-reverse`. |
| S4 | Three overlays and three dialog panels with their own fixed-inset, transition, header and action styles. | `.overlay` (+ `-top`, `-dark`) and `.dialog` (+ `-sm/-md/-lg`, `.dialog-header/-title/-body/-actions/-links`). |
| S5 | Three progress bars (`.milestone-bar`, `.sales-form-progress`, `.detail-location-bar`), two info boxes (`.sales-form-info-box`, `.sia-416-info`), three empty states (`.tab-empty`, `.empty-state`, `.map-fallback`), three table styles (`.list-table`, `.data-table`, `.api-param-table`), three full-page view classes with identical show/hide rules, four `.tab-content-*` visibility pairs. | `.progress`, `.info-box`, `.empty-state`, `.data-table`, `.page-view`, `.tab-panel`. |
| S6 | Priority colours were mapped twice (`.priority-N` for tags, `.marker-N` for map markers). | `.priority-N` sets `--priority-bg/-text/-marker` custom properties; `.tag` and `.marker` read them. |
| S7 | 11 component-level `:focus-visible` rules duplicating the global one (with three different colours). | One global rule; the dark header overrides the colour. |
| S8 | Dead CSS: `.sales-form-areas-*` (55 lines, class no longer in the markup – the cause of the SIA overflow found in part 1), `.priority-medium-*` tokens, `--spacing-*` aliases, `--state-active-bg`, `--state-disabled`, `--priority-standard-*`. | Removed. |
| S9 | Section headings styled five different ways (`.section-title`, `.detail-value-section h2`, `.tab-title`, `.api-endpoint-group-title`, `.sia-416-title`). | `.section-title` and `.subsection-title`. |

### 1.3 Hardcoded values that belong in tokens

| Category | Before | After |
|----------|--------|-------|
| Colours outside `tokens.css` | 26 distinct literals (`#fff`, `white`, `#e0e0e0`, four API method colours, `rgba(...)` overlays, error rings, marker shadows) | 0 – new tokens: semantic status colours (`--color-success/info/warning/danger` reuse the priority scale), `--overlay-bg-dark`, `--overlay-control-bg(-hover)`, `--accent-overlay-bg(-hover)`, `--state-error-border/-ring/-bg`, `--shadow-marker(-selected)`, `--color-star-empty` (existed but was unused) |
| Transition durations | 38 literal `0.15s/0.2s/0.3s` (the tokens existed, two of them unused) | 0 – `--transition-fast/normal/slow` everywhere |
| z-index | `100, 1000, 2000, 9999` scattered | `--z-dropdown/-modal/-dialog/-skip-link`, `--z-raised` |
| Font families | inline stack in `body`, `monospace` literal | `--font-family-base`, `--font-family-mono` |
| Font sizes | `22px` one-off | snapped to the scale (`--font-size-3xl`) |
| Layout sizes | `1440px` ×4, `320px`, `280px`, `68px`, image heights | `--page-max-width`, `--map-sidebar-width`, `--wizard-sidebar-width`, `--header-height`, `--media-height-*`, `--control-size` |
| Spacing | 95 px literals in declarations (`10px 12px`, `8px 14px`, `14px 16px` …) | 1 – everything on the 4 px scale (`--space-*`) |

Rule going forward: **component and page stylesheets contain no literal colours, durations, z-indexes or font families.** `grep -E "#[0-9a-f]{3,6}|rgba?\(|[0-9]s\b" css/*.css` should only hit `tokens.css`.

### 1.4 Bugs found while refactoring (all fixed)

| # | Bug | Cause | Fix |
|---|-----|-------|-----|
| B1 | Deleting documents removed the table rows only; the next upload re-rendered the table from the data and the "deleted" documents came back. | `row.remove()` without touching `documents`. | Delete filters `state.currentProperty.documents` and re-renders; sorting is also done on the data instead of reordering DOM rows, and selection survives re-renders. |
| B2 | Deep links to the wizard (`?view=sales-form&step=3`) opened step 1 and the URL was rewritten to the gallery URL during start-up. | `getUrlParams()` did not read `step`; `setView()` rewrote the address bar before the page was rendered. | Router reads all parameters; `updateUrlParams()` preserves page-view parameters. |
| B3 | Priority chips showed "Hohe Priorität (0)" while the KPI box said 3, and "Hohe Priorität" tags were green. | The three objects labelled "Hohe Priorität" carry `priority: 1` in `data.json`, but code, tokens and API docs define 0 = high, 1 = normal. | Data corrected to `priority: 0` (the label in the file already said "Hohe"); one definition in `config.js`; labels derived from the value. The API docs text now matches (`1=Normal, 2=Gering`). |
| B4 | Detail page showed the literal strings "Null" and "CHF Null" for missing values, "-" elsewhere. | Per-field ternaries. | Shared `valueOrDash()`, `formatArea()`, `formatYesNo()` render "–" consistently. |
| B5 | Missing location ratings rendered as "Null" with a 10 % bar. | Hardcoded fallback. | "–" and an empty bar. |
| B6 | Upload dialog's type list started with the English "Choose an option..."; the uploaded document's size was never recorded. | – | "Bitte wählen…", size taken from the selected file. |

### 1.5 Accessibility and robustness improvements made on the way

- Native `disabled` on action buttons (screen readers announce it; no click guards needed).
- `role`/`tabindex`/`aria-*` on clickable non-button elements (cards, filter options, rating sectors, endpoint headers, search results) and Enter/Space activation for them.
- Labels are associated with their inputs (`for`/`id`), the rating scales expose `role="radio"`/`aria-checked`, sort icons show the current direction.
- `escapeHtml()` for user and remote text (see J11).

---

## 2. Resulting structure

```
css/tokens.css      ← every colour, size, radius, shadow, z-index, duration
css/base.css        ← reset, typography, focus, utilities
css/components.css  ← .btn .icon-btn .input .form-field .radio .search-field .tag .chip .media
                       .panel .data-item .data-grid .progress .info-box .empty-state
                       .data-table .table-toolbar .tabs .tab-panel .overlay .dialog .toggle-btn
css/layout.css      ← header, search bar, footer, .page-view/.page-header/.page-content, shell breakpoints
css/views.css       ← gallery, list, map, filter dialog, carousel, upload, API docs
css/detail.css      ← detail page
css/sales-form.css  ← wizard
css/print.css       ← print layout (loaded with media="print")

js/config.js        ← PRIORITIES, MILESTONE_DEFINITIONS, DOCUMENT_TYPES, PROPERTY_TYPES, SALE_YEARS,
                       SALE_REASONS, SIA_416_SECTIONS, RATING_SCALES, LOCATION_RATINGS, MAP_CONFIG …
js/state.js         ← state (properties, filters, current view/property)
js/utils.js         ← $, $$, escapeHtml, debounce, format*, priority helpers, render* fragments
js/router.js        ← getRouteParams, filterParams, navigate, updateUrlParams, showPage, leavePage, applyRoute
js/ui.js            ← openOverlay/closeOverlay, switchTab, toggleAllRows/updateRowSelection/filterTableRows,
                       carousel, keyboard shortcuts, login dialog
js/filters.js       ← extractFilterOptions, matchesFilters, toggleFilter/addFilter/resetAllFilters,
                       applyFilters, renderPriorityChips, renderFilterModal, setupSearch
js/views.js         ← renderCards, renderListView, renderMapView, map/markers, setView
js/detail.js        ← renderDetailPage (field lists), milestones, events, documents, upload
js/sales-form.js    ← wizard: createSalesFormData, renderStep1–4, bindings, SIA/rating renderers, summary
js/api-docs.js      ← API_ENDPOINTS + render
js/main.js          ← delegated click/keyboard handling, init()
```

| Metric | Before | After |
|--------|--------|-------|
| Stylesheet lines (excl. tokens) | 3,099 | 936 |
| Script lines | 3,588 | 1,948 |
| CSS selectors | 730 | 599 |
| Functions | 107 (avg. 33 lines) | 152 (avg. 13 lines) |
| Files | 1 CSS + 1 tokens, 1 JS | 7 CSS + 1 tokens, 11 JS |
| Distinct hardcoded colours outside tokens | 26 | 0 |
| Hardcoded transition durations | 38 | 0 |
| Hand-written repeated template blocks (data items, SIA rows, rating sectors, summary items, tag blocks) | 85 | 0 (configuration-driven) |

The scripts stay classic (non-module) scripts loaded in order, sharing the global scope. That keeps the inline `onclick` handlers in the markup working and needs no build step. The load order is documented in `js/main.js` and the README.

---

## 3. Verification

- `tools/smoke-test.js` (written against the original code first): 220 of 228 checks passed on the original code; the 8 failures were bugs B1–B3 above. After the refactor all 228 pass at 1280 px and 390 px.
- `tools/responsive-audit.js`: 112 view/viewport combinations, no horizontal overflow, no page errors, no layout height changes above 15 % compared to the part-1 result.
- Manual screenshot comparison at 1440 px, 1280 px and 390 px for gallery, list, map, filter dialog, detail (all tabs), carousel, upload, wizard steps 1–4 and API docs.

---

## 4. Recommendations not implemented

1. **ES modules and a bundler.** The next step in maintainability is `type="module"` scripts with explicit imports/exports, which requires replacing the remaining inline `onclick` handlers (about 40) with `addEventListener` or `data-action` attributes. Keeping classic scripts was a deliberate choice to keep the diff reviewable and the no-build workflow intact.
2. **Run the two Playwright scripts in CI** (GitHub Actions on pull requests). Both exit non-zero on failure; together they take about five minutes.
3. **Self-host the icon font and MapLibre** (see part 1); with `config.js` in place the URLs are now in one spot.
4. **Localise strings.** Labels live in `config.js` and templates; if a French/Italian version is planned, moving them into a single `strings` object now is cheap.
5. **Remove the remaining inline `style` attributes** in `index.html`/templates (progress widths and background images are the only ones left; they are data-driven and acceptable).
6. **Naming.** Class names follow a flat `block-element` scheme (`.sales-form-step-icon`); components use `-modifier` suffixes (`.btn-primary`). Documenting this in CONTRIBUTING would keep future additions consistent.
