#!/usr/bin/env node
/*
 * Responsive audit: screenshots every view of the prototype at phone, tablet,
 * laptop and desktop widths and reports horizontal overflow, elements that
 * stick out of the viewport and interactive elements smaller than 32px.
 *
 * Usage:
 *   python -m http.server 8000            # serve the app
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/responsive-audit.js        # writes ./audit-shots/*.png + metrics.json
 *
 * Options (env): BASE=http://localhost:8000/  OUT=./audit-shots  ONLY=phone-390,desktop-1440
 *   STUB_MAP=1  stubs MapLibre so the map view's layout renders on networks that block unpkg.com
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8000/';
const OUT = process.env.OUT || path.join(process.cwd(), 'audit-shots');
const ID = 'a1b2c3d4-1001-4000-8000-000000000002'; // property used for detail-page states
const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'tablet-1024', width: 1024, height: 768, mobile: false },
  { name: 'laptop-1280', width: 1280, height: 800, mobile: false },
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'desktop-1920', width: 1920, height: 1080, mobile: false },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const STATES = [
  { name: 'gallery', url: '' },
  { name: 'list', url: '?view=list' },
  { name: 'map', url: '?view=map' },
  { name: 'filter-modal', url: '', after: p => p.click('#filterBtn') },
  { name: 'login', url: '', after: p => p.evaluate(() => openLoginDialog()) },
  { name: 'detail', url: `?view=detail&id=${ID}` },
  { name: 'detail-milestones', url: `?view=detail&id=${ID}`, after: p => p.evaluate(() => switchTab('MEILENSTEINE')) },
  { name: 'detail-events', url: `?view=detail&id=${ID}`, after: p => p.evaluate(() => switchTab('EREIGNISSE')) },
  { name: 'detail-docs', url: `?view=detail&id=${ID}`, after: p => p.evaluate(() => switchTab('DOKUMENTE')) },
  { name: 'upload', url: `?view=detail&id=${ID}`, after: p => p.evaluate(() => { switchTab('DOKUMENTE'); openUploadDialog(); }) },
  { name: 'carousel', url: `?view=detail&id=${ID}`, after: p => p.evaluate(() => openCarousel(JSON.parse(document.getElementById('detailGallery').dataset.images), 0)) },
  { name: 'form-1', url: '', after: p => p.evaluate(() => openSalesForm()) },
  { name: 'form-2', url: '', after: p => p.evaluate(() => { openSalesForm(); goToSalesFormStep(2); }) },
  { name: 'form-3', url: '', after: p => p.evaluate(() => { openSalesForm(); goToSalesFormStep(3); }) },
  { name: 'form-4', url: '', after: p => p.evaluate(() => { openSalesForm(); goToSalesFormStep(4); }) },
  { name: 'api', url: '?view=api' },
];
const VIEWPORT_ONLY_SHOTS = ['map', 'carousel', 'filter-modal', 'login', 'upload'];

// Runs inside the page.
const METRICS = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const visible = el => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
  const cls = el => (typeof el.className === 'string' ? el.className : '').slice(0, 60);
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) wide.push({ tag: el.tagName.toLowerCase(), cls: cls(el), left: Math.round(r.left), right: Math.round(r.right) });
    if (wide.length > 12) break;
  }
  const small = [];
  for (const el of document.querySelectorAll('button, a[href], a[onclick], input:not([type=hidden]), select, textarea, [onclick], [role=button]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.top > window.innerHeight * 3) continue;
    if (r.height < 32 || r.width < 32) small.push({ tag: el.tagName.toLowerCase(), cls: cls(el), id: el.id, w: Math.round(r.width), h: Math.round(r.height) });
    if (small.length > 40) break;
  }
  return { vw, overflowX: de.scrollWidth - vw, docH: de.scrollHeight, wide, smallTargets: small };
};

const MAP_STUB = () => {
  class Evt { on(ev, cb) { if (ev === 'load') setTimeout(cb, 0); return this; } }
  window.maplibregl = {
    Map: class extends Evt { constructor(o) { super(); const c = document.getElementById(o.container); if (c) c.style.background = '#e2e8f0'; } addControl() { return this; } resize() {} flyTo() {} fitBounds() {} },
    NavigationControl: class {},
    Marker: class { constructor(o) { this.el = o.element; } setLngLat() { return this; } setPopup(p) { this.p = p; return this; } addTo() { return this; } remove() {} getElement() { return this.el; } getPopup() { return this.p; } togglePopup() {} },
    Popup: class { setHTML() { return this; } isOpen() { return false; } },
    LngLatBounds: class { extend() { return this; } },
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  await Promise.all(VIEWPORTS.filter(vp => !ONLY || ONLY.includes(vp.name)).map(async vp => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1, locale: 'de-CH' });
    if (process.env.STUB_MAP) await ctx.addInitScript(MAP_STUB);
    const page = await ctx.newPage();
    for (const st of STATES) {
      try {
        await page.goto(BASE + st.url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelectorAll('.card, .list-table tbody tr, .map-sidebar-item, .detail-content *').length > 0, null, { timeout: 4000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        if (st.after) { await st.after(page); await page.waitForTimeout(400); }
        const m = await page.evaluate(METRICS);
        await page.screenshot({ path: path.join(OUT, `${st.name}__${vp.name}.png`), fullPage: !VIEWPORT_ONLY_SHOTS.includes(st.name) });
        results.push({ state: st.name, viewport: vp.name, ...m });
        console.log(`${st.name.padEnd(18)} ${vp.name.padEnd(13)} overflowX=${m.overflowX} wide=${m.wide.length} smallTargets=${m.smallTargets.length}`);
      } catch (e) {
        results.push({ state: st.name, viewport: vp.name, error: e.message });
        console.log(`${st.name} ${vp.name} ERROR ${e.message.split('\n')[0]}`);
      }
    }
    await ctx.close();
  }));
  results.sort((a, b) => a.state.localeCompare(b.state) || a.viewport.localeCompare(b.viewport));
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 1));
  await browser.close();
  const bad = results.filter(r => r.overflowX > 0);
  console.log(bad.length ? `\n${bad.length} state/viewport combinations overflow horizontally.` : '\nNo horizontal overflow in any state/viewport.');
  process.exitCode = bad.length ? 1 : 0;
})();
