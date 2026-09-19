#!/usr/bin/env node
/*
 * Functional smoke test: drives every interaction of the prototype in headless
 * Chromium (search, chips, filter dialog, views, detail tabs, selectable tables,
 * upload, carousel, wizard, API docs, deep links, browser history) and asserts
 * the observable state. Run it after every change:
 *
 *   python -m http.server 8000
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/smoke-test.js              # BASE=http://localhost:8000/ by default
 *   STUB_MAP=1 node tools/smoke-test.js   # on networks that block unpkg.com (MapLibre)
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8000/';
const ID = 'a1b2c3d4-1001-4000-8000-000000000002';
let failures = 0, passes = 0;
function check(name, cond, extra = '') { if (cond) { passes++; } else { failures++; console.log('FAIL', name, extra); } }
const MAP_STUB = () => {
  class Evt { on(ev, cb) { if (ev === 'load') setTimeout(cb, 0); return this; } }
  window.maplibregl = {
    Map: class extends Evt { constructor(o) { super(); window.__mapCalls = []; } addControl() { return this; } resize() {} flyTo(o) { window.__mapCalls.push(['flyTo', o.center]); } fitBounds() {} },
    NavigationControl: class {},
    Marker: class { constructor(o) { this.el = o.element; } setLngLat() { return this; } setPopup(p) { this.p = p; return this; } addTo() { document.getElementById('map').appendChild(this.el); return this; } remove() { this.el.remove(); } getElement() { return this.el; } getPopup() { return this.p; } togglePopup() {} },
    Popup: class { setHTML() { return this; } isOpen() { return false; } },
    LngLatBounds: class { extend() { return this; } },
  };
};
(async () => {
  for (let i = 0; i < 20; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 500)); } }
  const browser = await chromium.launch();
  for (const vp of [{ width: 1280, height: 800, mobile: false }, { width: 390, height: 844, mobile: true }]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: vp.mobile, hasTouch: vp.mobile, ignoreHTTPSErrors: true });
    if (process.env.STUB_MAP) await ctx.addInitScript(MAP_STUB);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const dialogs = []; page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    // No external images, tiles or geo.admin calls: the test only needs the app's own behaviour.
    await page.route(/images\.unsplash|cartocdn|map\.geo\.admin|api3\.geo\.admin/, r => r.abort());
    if (process.env.STUB_MAP) await page.route(/unpkg\.com/, r => r.abort());
    const T = (name) => `[${vp.width}] ${name}`;
    const count = () => page.textContent('#objectCount');
    const url = () => page.evaluate(() => location.search);

    // --- Gallery, search, pills, reset
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card');
    check(T('11 cards'), (await page.$$('.card')).length === 11);
    check(T('count 11'), (await count()) === '11');
    await page.fill('#searchInput', 'Zürich'); await page.waitForTimeout(450);
    check(T('search filters'), (await count()) === '1', await count());
    check(T('search in url'), (await url()).includes('q=Z%C3%BCrich'), await url());
    await page.click('#searchInputClear'); await page.waitForTimeout(100);
    check(T('search cleared'), (await count()) === '11');
    await page.click('.chip[data-value="2"]'); await page.waitForTimeout(100);
    check(T('pill filters'), (await count()) === '7', await count());
    check(T('pill active'), await page.$eval('.chip[data-value="2"]', e => e.classList.contains('active')));
    check(T('filter count badge'), (await page.textContent('#filterCount')) === '1');
    check(T('url priority'), (await url()).includes('priority=2'));
    await page.click('#resetFilters'); await page.waitForTimeout(100);
    check(T('reset'), (await count()) === '11');
    // tag click on a card applies filter
    await page.click('.card [data-filter="year"]'); await page.waitForTimeout(100);
    check(T('year tag filter'), (await url()).includes('year='), await url());
    check(T('year tag not opening detail'), !(await url()).includes('view=detail'));
    await page.click('#resetFilters'); await page.waitForTimeout(100);

    // --- Filter modal
    await page.click('#filterBtn'); await page.waitForTimeout(400);
    check(T('modal open'), await page.$eval('#filterModalOverlay', e => e.classList.contains('active')));
    const firstType = await page.$('#filterNutzung [data-filter="type"]');
    const typeVal = await firstType.getAttribute('data-value');
    await firstType.click(); await page.waitForTimeout(100);
    check(T('type option selected'), await page.$eval(`#filterNutzung [data-value="${typeVal}"]`, e => e.classList.contains('selected')));
    check(T('type filter applied'), parseInt(await count()) < 11);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    check(T('modal closed via esc'), !(await page.$eval('#filterModalOverlay', e => e.classList.contains('active'))));
    check(T('body overflow restored'), (await page.evaluate(() => document.body.style.overflow)) === '');
    await page.click('#filterBtn'); await page.waitForTimeout(300); await page.click('#filterResetBtn'); await page.waitForTimeout(100);
    check(T('modal reset'), (await count()) === '11');
    await page.click('#filterCloseBtn'); await page.waitForTimeout(400);

    // --- List view
    await page.click('.view-btn[data-view="list"]'); await page.waitForTimeout(200);
    check(T('list rows'), (await page.$$('#listTableBody tr')).length === 11);
    check(T('list url'), (await url()).includes('view=list'));
    check(T('stats total'), (await page.textContent('#statsTotalObjects')) === '11');
    check(T('stats high'), (await page.textContent('#statsHighPriority')) === '3');
    await page.click('#listTableBody tr:nth-child(2) td:nth-child(3)'); await page.waitForTimeout(400);
    check(T('row opens detail'), (await url()).includes(`view=detail&id=${ID}`) || (await url()).includes('view=detail'), await url());
    check(T('detail active'), await page.$eval('#detailView', e => e.classList.contains('active')));
    await page.goBack(); await page.waitForTimeout(300);
    check(T('back closes detail'), !(await page.$eval('#detailView', e => e.classList.contains('active'))));
    check(T('back keeps list'), (await page.$$('#listTableBody tr')).length === 11);

    // --- Map view
    await page.click('.view-btn[data-view="map"]'); await page.waitForTimeout(300);
    check(T('map sidebar items'), (await page.$$('.map-sidebar-item')).length === 11);
    await page.click('.map-sidebar-item:nth-child(3)'); await page.waitForTimeout(100);
    check(T('sidebar item active'), await page.$eval('.map-sidebar-item:nth-child(3)', e => e.classList.contains('active')));
    if (process.env.STUB_MAP) {
      check(T('flyTo called'), (await page.evaluate(() => (window.__mapCalls || []).length)) > 0);
      check(T('markers'), (await page.$$('.marker')).length === 11);
    }

    // --- Detail page
    await page.goto(`${BASE}?view=detail&id=${ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.tab'); await page.waitForSelector('#detailMapSvg svg'); await page.waitForTimeout(300);
    check(T('breadcrumb'), (await page.textContent('#detailBreadcrumb')).includes('3103 / WB'));
    check(T('detail title'), (await page.textContent('.detail-title-section h1')).includes('Einfamilienhaus in 8004'));
    check(T('svg map highlighted'), await page.$eval('#detailMapSvg', e => !!e.querySelector('.highlighted')));
    check(T('svg marker'), await page.$eval('#detailMapSvg', e => !!e.querySelector('#location-marker')));
    check(T('overview data items'), (await page.$$('.tab-content-uebersicht .detail-data-item, .tab-content-uebersicht .data-item, [data-tab="uebersicht"] .data-item')).length >= 20);
    await page.evaluate(() => switchTab('MEILENSTEINE'));
    check(T('milestones 7'), (await page.$$('.milestone-item')).length === 7);
    check(T('milestone completed'), (await page.$$('.milestone-status-icon.completed')).length === 4);
    await page.evaluate(() => switchTab('EREIGNISSE'));
    const evRows = (await page.$$('.event-row')).length;
    check(T('events rows'), evRows === 4, evRows);
    await page.check('.event-row:first-child input[type="checkbox"]'); await page.waitForTimeout(50);
    check(T('event download enabled'), await page.$eval('#eventDownloadBtn', b => (b.classList.contains('active') || !b.disabled) && !b.disabled));
    check(T('event header indeterminate'), await page.$eval('.tab-content-ereignisse thead input, [data-tab="ereignisse"] thead input', i => i.indeterminate));
    await page.click('#eventDownloadBtn'); await page.waitForTimeout(100);
    check(T('event csv alert'), dialogs.some(d => d.includes('CSV')));
    await page.fill('#eventSearchInput', 'Repriorisiert'); await page.keyboard.press('Space'); await page.keyboard.press('Backspace'); await page.waitForTimeout(50);
    check(T('event filter'), (await page.$$eval('.event-row', rows => rows.filter(r => r.style.display !== 'none').length)) === 1);
    await page.evaluate(() => switchTab('DOKUMENTE'));
    const docRows = (await page.$$('.doc-row')).length;
    check(T('doc rows'), docRows === 3, docRows);
    check(T('doc delete disabled'), await page.$eval('#docDeleteBtn', b => b.disabled || !b.classList.contains('active')));
    await page.click('.tab-content-dokumente thead input[type="checkbox"], [data-tab="dokumente"] thead input[type="checkbox"]'); await page.waitForTimeout(50);
    check(T('all docs selected'), (await page.$$eval('.doc-row input:checked', a => a.length)) === 3);
    check(T('doc download enabled'), await page.$eval('#docDownloadBtn', b => !b.disabled && (b.classList.contains('active') || true)));
    await page.click('#docDownloadBtn'); await page.waitForTimeout(100);
    check(T('doc download alert'), dialogs.some(d => d.includes('Download von 3')));
    // sort by title
    const before = await page.$$eval('.doc-row .doc-title', a => a.map(e => e.textContent.trim()));
    await page.click('.tab-content-dokumente th.sortable, [data-tab="dokumente"] th.sortable'); await page.waitForTimeout(50);
    const after1 = await page.$$eval('.doc-row .doc-title', a => a.map(e => e.textContent.trim()));
    check(T('sort asc'), JSON.stringify(after1) === JSON.stringify([...before].sort((a, b) => a.localeCompare(b, 'de'))), JSON.stringify(after1));
    await page.click('.tab-content-dokumente th.sortable, [data-tab="dokumente"] th.sortable'); await page.waitForTimeout(50);
    const after2 = await page.$$eval('.doc-row .doc-title', a => a.map(e => e.textContent.trim()));
    check(T('sort desc'), JSON.stringify(after2) === JSON.stringify([...after1].reverse()));
    // cell click toggles checkbox (new behaviour, present since responsive fix)
    await page.click('.doc-row:first-child td.data-table-checkbox', { position: { x: 5, y: 5 } }); await page.waitForTimeout(50);
    check(T('cell toggles checkbox'), (await page.$$eval('.doc-row input:checked', a => a.length)) === 2);
    // delete one selected → confirm
    await page.$$eval('.doc-row input', inputs => inputs.forEach((i, idx) => { i.checked = idx === 0; i.dispatchEvent(new Event('change', { bubbles: true })); }));
    await page.click('#docDeleteBtn'); await page.waitForTimeout(100);
    check(T('doc deleted'), (await page.$$('.doc-row')).length === 2, (await page.$$('.doc-row')).length);
    // upload
    await page.click('text=Hinzufügen'); await page.waitForTimeout(400);
    check(T('upload open'), await page.$eval('#uploadDialogOverlay', e => e.classList.contains('active')));
    check(T('upload submit disabled'), await page.$eval('#uploadSubmitBtn', b => b.disabled));
    await page.setInputFiles('#uploadFileInput', { name: 'plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
    await page.selectOption('#uploadTypeSelect', 'Grundrissplan');
    await page.fill('#uploadNameInput', 'Plan Test'); await page.waitForTimeout(50);
    check(T('upload submit enabled'), await page.$eval('#uploadSubmitBtn', b => !b.disabled));
    await page.click('#uploadSubmitBtn'); await page.waitForTimeout(300);
    check(T('doc added'), (await page.$$('.doc-row')).length === 3, (await page.$$('.doc-row')).length);
    check(T('upload closed'), !(await page.$eval('#uploadDialogOverlay', e => e.classList.contains('active'))));
    await page.fill('#documentSearchInput', 'Plan Test'); await page.keyboard.press('Space'); await page.keyboard.press('Backspace'); await page.waitForTimeout(50);
    check(T('doc filter'), (await page.$$eval('.doc-row', rows => rows.filter(r => r.style.display !== 'none').length)) === 1);
    // carousel
    await page.click('.detail-main-image'); await page.waitForTimeout(400);
    check(T('carousel open'), await page.$eval('#carouselOverlay', e => e.classList.contains('active')));
    check(T('carousel counter'), (await page.textContent('#carouselCounter')).trim() === '1 / 5');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(50);
    check(T('carousel next'), (await page.textContent('#carouselCounter')).trim() === '2 / 5');
    await page.click('.carousel-thumb:nth-child(5)'); await page.waitForTimeout(50);
    check(T('carousel thumb'), (await page.textContent('#carouselCounter')).trim() === '5 / 5');
    check(T('next disabled at end'), await page.$eval('.carousel-nav-btn.next', b => b.disabled));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    check(T('carousel closed'), !(await page.$eval('#carouselOverlay', e => e.classList.contains('active'))));
    // tag in detail applies filter and returns to overview
    await page.click('.detail-main-image [data-filter="priority"]'); await page.waitForTimeout(300);
    check(T('detail tag closes detail'), !(await page.$eval('#detailView', e => e.classList.contains('active'))));
    check(T('detail tag filters'), (await url()).includes('priority=2'), await url());
    await page.click('#resetFilters'); await page.waitForTimeout(100);
    // back button in detail
    await page.click('.card'); await page.waitForTimeout(400);
    await page.click('.detail-back-btn'); await page.waitForTimeout(200);
    check(T('back btn'), !(await page.$eval('#detailView', e => e.classList.contains('active'))) && !(await url()).includes('view=detail'));
    // Escape closes detail
    await page.click('.card'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check(T('esc closes detail'), !(await page.$eval('#detailView', e => e.classList.contains('active'))));

    // --- Login dialog
    await page.click('text=Login'); await page.waitForTimeout(300);
    check(T('login open'), await page.$eval('#loginDialogOverlay', e => e.classList.contains('active')));
    await page.click('#loginDialogOverlay', { position: { x: 5, y: 5 } }); await page.waitForTimeout(300);
    check(T('login backdrop close'), !(await page.$eval('#loginDialogOverlay', e => e.classList.contains('active'))));

    // --- Wizard
    await page.click('text=Auftrag erstellen'); await page.waitForTimeout(300);
    check(T('wizard open'), await page.$eval('#salesFormView', e => e.classList.contains('active')));
    check(T('wizard url'), (await url()).includes('view=sales-form') && (await url()).includes('step=1'), await url());
    check(T('main hidden'), (await page.$eval('#main', e => getComputedStyle(e).display)) === 'none');
    await page.click('.sales-form-type-card[data-type="wohnung"]');
    await page.selectOption('#saleYearSelect', '2027');
    await page.check('input[name="saleReason"][value="eda"]');
    check(T('type selected'), await page.$eval('.sales-form-type-card[data-type="wohnung"]', e => e.classList.contains('selected')));
    check(T('year not required'), !(await page.$eval('#saleYearSelect', e => e.classList.contains('required'))));
    await page.fill('#locationSearchInput', 'Be'); await page.waitForTimeout(400);
    check(T('geo search error shown'), (await page.textContent('#locationSearchResults')).includes('Fehler') || (await page.textContent('#locationSearchResults')).includes('Suche'));
    await page.click('#searchClearBtn');
    check(T('location search cleared'), (await page.inputValue('#locationSearchInput')) === '');
    await page.click('.sales-form-nav-btn.next, .sales-form-nav .btn-primary'); await page.waitForTimeout(200);
    check(T('step 2'), (await url()).includes('step=2'));
    check(T('step 2 active in stepper'), await page.$eval('.sales-form-step[data-step="2"]', e => e.classList.contains('active')));
    check(T('step 1 completed'), await page.$eval('.sales-form-step[data-step="1"]', e => e.classList.contains('completed')));
    await page.fill('#floorsInput', '3'); await page.fill('#parkingSpacesInput', '2');
    await page.fill('#areaGFInput', '200'); await page.fill('#areaVMFInput', '150'); await page.waitForTimeout(50);
    check(T('vmf percent'), (await page.textContent('#vmfPercent')).trim() === '75% GF', await page.textContent('#vmfPercent'));
    check(T('required cleared'), !(await page.$eval('#floorsInput', e => e.classList.contains('required'))));
    await page.click('#sia416Toggle'); await page.waitForTimeout(50);
    check(T('sia expanded'), await page.$eval('#sia416Grundstueck', e => e.classList.contains('visible')));
    await page.fill('#areaGSFInput', '1000'); await page.fill('#areaGGFInput', '250'); await page.waitForTimeout(50);
    check(T('ggf percent'), (await page.textContent('#ggfPercent')).trim() === '25% GSF');
    await page.check('input[name="hasBuildingRights"][value="yes"]'); await page.waitForTimeout(100);
    check(T('building rights fee input appears'), !!(await page.$('#buildingRightsFeeInput')));
    check(T('state kept after rerender'), (await page.inputValue('#floorsInput')) === '3');
    check(T('sia stays expanded after rerender'), await page.$eval('#sia416Grundstueck', e => e.classList.contains('visible')));
    await page.click('#conditionRating .sales-form-rating-sector[data-value="5"]');
    await page.click('#standardRating .sales-form-rating-sector[data-value="1"]');
    check(T('condition 5 active'), await page.$eval('#conditionRating .sales-form-rating-sector[data-value="5"]', e => e.classList.contains('active')));
    check(T('condition 3 inactive'), !(await page.$eval('#conditionRating .sales-form-rating-sector[data-value="3"]', e => e.classList.contains('active'))));
    await page.click('.sales-form-nav-btn.next, .sales-form-nav .btn-primary'); await page.waitForTimeout(200);
    check(T('step 3'), (await url()).includes('step=3'));
    await page.fill('#monthlyRentInput', '2500');
    await page.check('input[name="hasVerbalAgreements"][value="yes"]'); await page.waitForTimeout(100);
    check(T('verbal textarea'), !!(await page.$('#verbalAgreementsInput')));
    await page.fill('#verbalAgreementsInput', 'Gartennutzung');
    await page.click('.sales-form-nav-btn.next, .sales-form-nav .btn-primary'); await page.waitForTimeout(200);
    check(T('step 4'), (await url()).includes('step=4'));
    const summary = await page.textContent('#salesFormContent');
    check(T('summary type'), summary.includes('Wohnung'));
    check(T('summary year'), summary.includes('2027'));
    check(T('summary reason'), summary.includes('Objektstrategie EDA'));
    check(T('summary floors'), summary.includes('3'));
    check(T('summary GF'), summary.includes('200 m²'));
    check(T('summary condition'), summary.includes('Neuwertig (5/5)'));
    check(T('summary standard'), summary.includes('Einfach (1/5)'));
    check(T('summary rent'), summary.replace(/’|'/g, "'").includes("2'500") || summary.includes('2’500') || summary.includes('2500'), summary.match(/Mietertrag[\s\S]{0,60}/)?.[0]);
    check(T('summary verbal'), summary.includes('Gartennutzung'));
    await page.click('.sales-form-summary-edit-btn >> nth=2'); await page.waitForTimeout(200);
    check(T('edit goes to step 2'), (await url()).includes('step=2'));
    check(T('step 2 values kept'), (await page.inputValue('#areaGFInput')) === '200');
    await page.goBack(); await page.waitForTimeout(200);
    check(T('popstate step 4'), (await url()).includes('step=4') && (await page.textContent('#salesFormContent')).includes('Zusammenfassung'));
    await page.click('.sales-form-submit-btn, .sales-form-submit-section .btn'); await page.waitForTimeout(200);
    check(T('submit alert'), dialogs.some(d => d.includes('erfolgreich')));
    check(T('wizard closed after submit'), !(await page.$eval('#salesFormView', e => e.classList.contains('active'))));
    await page.click('text=Auftrag erstellen'); await page.waitForTimeout(200);
    await page.click('text=Abbrechen'); await page.waitForTimeout(200);
    check(T('cancel closes wizard'), !(await page.$eval('#salesFormView', e => e.classList.contains('active'))) && !(await url()).includes('sales-form'));

    // --- API docs
    await page.click('.footer-link:has-text("API")'); await page.waitForTimeout(200);
    check(T('api open'), await page.$eval('#apiDocsView', e => e.classList.contains('active')) && (await url()).includes('view=api'));
    await page.click('.api-endpoint >> nth=0'); await page.waitForTimeout(50);
    check(T('endpoint toggles'), await page.$eval('.api-endpoint', e => e.classList.contains('open')));
    await page.click('#apiDocsView .detail-back-btn, #apiDocsView .btn'); await page.waitForTimeout(200);
    check(T('api closed'), !(await page.$eval('#apiDocsView', e => e.classList.contains('active'))));
    // deep links
    await page.goto(`${BASE}?view=api`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
    check(T('deep link api'), await page.$eval('#apiDocsView', e => e.classList.contains('active')));
    await page.goto(`${BASE}?view=sales-form&step=3`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#salesFormContent h2'); await page.waitForTimeout(300);
    check(T('deep link wizard keeps url'), (await url()).includes('view=sales-form'), await url());
    check(T('deep link wizard step 3'), (await page.textContent('#salesFormContent')).includes('3. Angaben zum Mieter'));
    await page.goto(`${BASE}?view=list&priority=0&year=2024`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
    check(T('deep link filters'), (await count()) === '3' && (await page.$$('#listTableBody tr')).length === 3, await count());
    check(T('no page errors'), errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exitCode = failures ? 1 : 0;
})();
