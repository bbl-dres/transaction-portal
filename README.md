# Transaction Immo

<p align="center">
  <img src="assets/Social1.jpg" width="100%" alt="Transaction Immo"/>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/status-prototype-orange.svg" alt="Status: Prototype"/>
  <img src="https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3"/>
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript ES6+"/>
  <img src="https://img.shields.io/badge/MapLibre%20GL-396CB2?logo=maplibre&logoColor=white" alt="MapLibre GL JS"/>
  <img src="https://img.shields.io/badge/dependencies-none-success.svg" alt="Zero Dependencies"/>
  <a href="https://bbl-dres.github.io/transaction-immo/"><img src="https://img.shields.io/badge/demo-live-brightgreen.svg" alt="Live Demo"/></a>
</p>

> [!CAUTION]
> **This is an unofficial mockup for demonstration purposes only.**
> All data is fictional. Not all features are fully functional. This project serves as a visual and conceptual prototype — it is not intended for production use.

A prototype for web-based real estate transaction management platform. This platform enables visualization, filtering, and management of federal government properties available for sale across Switzerland.

## Preview

**Live Demo:** https://bbl-dres.github.io/transaction-immo/

<p align="center">
  <img src="assets/images/Preview1.jpg" width="90%"/>
</p>

<p align="center">
  <img src="assets/images/Preview2.jpg" width="45%" style="vertical-align: top;"/>
  <img src="assets/images/Preview3.jpg" width="45%" style="vertical-align: top;"/>
</p>

## Features

- **Three View Modes**: Gallery grid, sortable list table, and interactive map
- **Advanced Filtering**: Multi-criteria filtering by priority, canton, property type, year, condition, and more
- **Property Details**: Comprehensive information including specifications, pricing, location ratings, milestone tracking, and document management
- **Real-time Search**: Instant text search across property titles and addresses
- **URL State Persistence**: Shareable filtered views via URL parameters
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: MapLibre GL JS with Carto Positron basemap
- **Icons**: Material Design Icons
- **Data**: JSON

Zero dependencies - no build process required.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/bbl-dres/transaction-immo.git
   cd transaction-immo
   ```

2. Serve the files using any static file server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js (npx)
   npx serve
   ```

3. Open `http://localhost:8000` in your browser

## Project Structure

```
transaction-immo/
├── index.html            # Main HTML structure
├── css/
│   ├── tokens.css        # Design tokens (CSS custom properties)
│   └── styles.css        # Component styles
├── js/
│   └── main.js           # Application JavaScript
├── assets/
│   ├── switzerland.svg   # Map background asset
│   └── images/           # Image assets
├── data/
│   └── data.json         # Property data
└── README.md
```

## License

Licensed under [MIT](https://opensource.org/licenses/MIT)

---

> [!CAUTION]
> **This is an unofficial mockup for demonstration purposes only.**
> All data is fictional. Not all features are fully functional. This project serves as a visual and conceptual prototype — it is not intended for production use.
