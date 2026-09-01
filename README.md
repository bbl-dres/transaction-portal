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
  <img src="assets/images/preview-1.jpg" alt="Transaction Portal property gallery" width="49%"/>
  <img src="assets/images/preview-2.jpg" alt="Transaction Portal property map" width="49%"/>
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

## License

Licensed under the [MIT License](LICENSE).

Third-party libraries and assets retain their respective upstream terms.
