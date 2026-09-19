# Transaction Immo

<p align="center">
  <img src="assets/social-preview.jpg" width="100%" alt="Transaction Immo"/>
</p>

[![Demo](https://img.shields.io/badge/demo-GitHub%20Pages-2ea44f?logo=github&logoColor=white)](https://bbl-dres.github.io/transaction-portal/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!CAUTION]
> This is an unofficial mockup for demonstration purposes only. All records are fictional, not every function is implemented, and it is not intended for production use.

A browser-based prototype for exploring and managing federal properties offered for sale across Switzerland.

## Demo

**Live demo:** https://bbl-dres.github.io/transaction-portal/

<p align="center">
  <img src="assets/images/preview-1.jpg" alt="Transaction Portal property gallery" width="49%" align="top"/>
  <img src="assets/images/preview-2.jpg" alt="Transaction Portal property map" width="49%" align="top"/>
</p>

## Features

- Compare properties in gallery, sortable list, and interactive map views.
- Search titles and addresses in real time.
- Filter by priority, canton, property type, year, condition, and other criteria.
- Review specifications, pricing, location ratings, milestones, and documents.
- Share filtered views through URL parameters.
- Use the responsive interface on desktop, tablet, or mobile.
- Explore the static demo without an account or backend service.

## Run locally

The app loads its static JSON data over HTTP:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Project structure

No build step: plain HTML, CSS and JavaScript loaded directly by `index.html`.

```
css/tokens.css       design tokens (colours, type, spacing, radius, shadows, z-index, motion)
css/base.css         reset, typography, focus styles, utilities
css/components.css   reusable components: buttons, inputs, tags, chips, panels, data items,
                     tables, tabs, dialogs
css/layout.css       app shell (header, search bar, footer, page views) + shell breakpoints
css/views.css        gallery, list, map, filter dialog, carousel, upload, API docs
css/detail.css       property detail page
css/sales-form.css   "Auftrag erstellen" wizard
css/print.css        print layout for "Als PDF exportieren"

js/config.js         labels, scales and field definitions (priorities, milestones, SIA 416, …)
js/state.js          the mutable application state
js/utils.js          formatters, DOM shortcuts, shared markup fragments
js/router.js         URL ↔ state, page views, browser history
js/ui.js             overlays, tabs, selectable tables, carousel, keyboard shortcuts
js/filters.js        search, chips, filter dialog
js/views.js          gallery / list / map rendering
js/detail.js         detail page incl. documents and upload
js/sales-form.js     wizard steps
js/api-docs.js       API documentation page
js/main.js           event delegation and start-up

data/data.json       fictional sample data
tools/               Playwright scripts: responsive-audit.js (screenshots + overflow report),
                     smoke-test.js (functional regression test)
docs/                design reviews
```

Conventions: every colour, size, radius, shadow and duration in the stylesheets comes from
`css/tokens.css`; page-specific files only combine the components. Scripts are classic
(non-module) scripts sharing the global scope so that inline `onclick` handlers keep working;
they are loaded in the order listed above. Run `node tools/smoke-test.js` after changes.

## License

Licensed under the [MIT License](LICENSE).

Third-party libraries and assets retain their respective upstream terms.
