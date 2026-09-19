/* ==========================================================================
   Static configuration: labels, scales and field definitions shared by all
   modules. Change wording and options here, not inside render functions.
   ========================================================================== */

// Priority scale used by data.json (`priority`), tags, chips, filters and markers.
const PRIORITIES = [
  { value: '0', label: 'Hohe Priorität' },
  { value: '1', label: 'Normale Priorität' },
  { value: '2', label: 'Geringe Priorität' },
  { value: '3', label: 'Keine Priorität' },
  { value: 'null', label: 'Keine Angabe' },
];
const PRIORITY_LABELS = Object.fromEntries(PRIORITIES.map(p => [p.value, p.label]));

// Overview views (value → toggle label) and full-page views that replace the overview.
const VIEWS = { gallery: 'Galerie', list: 'Liste', map: 'Karte' };
const PAGE_VIEWS = ['detail', 'sales-form', 'api'];

const MILESTONE_DEFINITIONS = [
  { num: 1, label: 'Neuer Auftrag', responsibility: 'BBL Portfolio Management' },
  { num: 2, label: 'Auftrag geprüft', responsibility: 'BBL Portfolio Management' },
  { num: 3, label: 'Repriorisiert', responsibility: 'BBL Portfolio Management' },
  { num: 4, label: 'Zum Verkauf freigegeben', responsibility: 'BBL Portfolio Management' },
  { num: 5, label: 'Vermarktung gestartet', responsibility: 'Externer Makler' },
  { num: 6, label: 'Bieterverfahren beendet', responsibility: 'Externer Makler' },
  { num: 7, label: 'Objekt verkauft', responsibility: 'BBL Portfolio Management' },
];
const MILESTONE_COUNT = MILESTONE_DEFINITIONS.length;

const DOCUMENT_TYPES = [
  '3D-Modelldaten', 'Ansichtsplan', 'Auszug ÖREB-Kataster', 'Akte zu Unterhalt', 'Grundrissplan',
  'Indikative Marktwertbewertung', 'Kauf- Dienstbarkeitsvertrag', 'Mieterdossier', 'Mietvertrag',
  'Schliessplan / Sicherungsschein', 'Serviceverträge', 'Sonstiges',
];

// Location rating dimensions shown on the detail page (data key → label).
const LOCATION_RATINGS = [
  { key: 'sunExposure', label: 'Besonnung' },
  { key: 'view', label: 'Sicht' },
  { key: 'neighborhoodImage', label: 'Image des Quartiers' },
  { key: 'services', label: 'Dienstleistungen' },
  { key: 'leisureRecreation', label: 'Freizeit & Erholung' },
  { key: 'publicTransport', label: 'Öffentlicher Verkehr' },
  { key: 'roadConnection', label: 'Strassenanbindung' },
  { key: 'noisePollution', label: 'Lärmbelastung' },
];

// --- Wizard ("Auftrag erstellen") ---
const PROPERTY_TYPES = [
  { id: 'grundstueck', label: 'Grundstück', icon: 'landscape' },
  { id: 'einfamilienhaus', label: 'Einfamilienhaus', icon: 'home' },
  { id: 'mehrfamilienhaus', label: 'Mehrfamilienhaus', icon: 'apartment' },
  { id: 'wohnung', label: 'Wohnung', icon: 'door_front' },
  { id: 'buerobau', label: 'Bürobau', icon: 'business' },
  { id: 'gewerbe', label: 'Gewerbe', icon: 'store' },
  { id: 'sonderobjekt', label: 'Sonderobjekt', icon: 'account_balance' },
  { id: 'technische_anlage', label: 'Technische Anlage', icon: 'precision_manufacturing' },
];
const SALE_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
const SALE_REASONS = [
  { value: 'bazg', label: 'Objektstrategie BAZG' },
  { value: 'eda', label: 'Objektstrategie EDA' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

// SIA 416 areas. `reference` is the row the percentages relate to; `optional`
// rows/sections are hidden until "Zusätzliche Angaben einblenden".
const SIA_416_SECTIONS = [
  { id: 'Grundstueck', title: 'Grundstücksflächen', reference: 'GSF', optional: true, rows: [
    { key: 'GSF', name: 'Grundstücksfläche' },
    { key: 'GGF', name: 'Gebäudegrundfläche' },
    { key: 'UF', name: 'Umgebungsfläche' },
    { key: 'BUF', name: 'Bearbeitete Umgebungsfläche' },
  ] },
  { id: 'Gebaeude', title: 'Gebäudeflächen', reference: 'GF', rows: [
    { key: 'GF', name: 'Geschossfläche', required: true },
    { key: 'NGF', name: 'Nettogeschossfläche', optional: true },
    { key: 'NF', name: 'Nutzfläche', optional: true },
    { key: 'VMF', name: 'Vermietbare Fläche', required: true },
    { key: 'HNF', name: 'Hauptnutzfläche', optional: true },
    { key: 'NNF', name: 'Nebennutzfläche', optional: true },
    { key: 'VF', name: 'Verkehrsfläche', optional: true },
    { key: 'FF', name: 'Funktionsfläche', optional: true },
    { key: 'KF', name: 'Konstruktionsfläche', optional: true },
    { key: 'AGF', name: 'Aussengeschossfläche', optional: true },
  ] },
  { id: 'Volumen', title: 'Gebäudevolumen', reference: 'GV', optional: true, unit: 'm³', rows: [
    { key: 'GV', name: 'Gebäudevolumen' },
  ] },
];
const SIA_416_ROWS = SIA_416_SECTIONS.flatMap(section => section.rows);

// Five-step rating scales. Sectors without icon/label are the unlabelled in-between values.
const RATING_SCALES = {
  condition: {
    label: 'Aktueller Zustand',
    info: 'In der Schweiz befinden sich die meisten Immobilien in gutem Zustand. Als sanierungsbedürftig gelten solche, die erhebliche Nutzungseinschränkungen aufzeigen. Immobilien gelten als neuwertig, wenn sie nicht älter als 5 Jahre sind.',
    sectors: [
      { value: 1, icon: 'domain_disabled', label: 'Sanierungsreif (1)', summary: 'Sanierungsreif' },
      { value: 2, summary: 'Sanierungsbedürftig' },
      { value: 3, icon: 'family_restroom', label: 'Intakt (3)', summary: 'Intakt' },
      { value: 4, summary: 'Gut' },
      { value: 5, icon: 'real_estate_agent', label: 'Neuwertig (5)', summary: 'Neuwertig' },
    ],
  },
  standard: {
    label: 'Ausbaustandard',
    info: 'Die meisten Immobilien in der Schweiz besitzen eine übliche Grundausstattung.',
    sectors: [
      { value: 1, icon: 'cabin', label: 'Einfach (1)', summary: 'Einfach' },
      { value: 2, summary: 'Einfach-Mittel' },
      { value: 3, icon: 'home', label: 'Üblich (3)', summary: 'Üblich' },
      { value: 4, summary: 'Gehoben' },
      { value: 5, icon: 'villa', label: 'Luxuriös (5)', summary: 'Luxuriös' },
    ],
  },
};

// --- External services and assets ---
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12',
];
const MAP_CONFIG = {
  styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [8.2275, 46.8182], zoom: 7, fitPadding: 80, fitMaxZoom: 10, flyZoom: 13,
};
// Bounding box and viewBox of assets/switzerland.svg, used to place the location marker.
const SWISS_SVG = { minLat: 45.82, maxLat: 47.81, minLng: 5.95, maxLng: 10.49, width: 1052.361, height: 744.094 };
const GEO_ADMIN_SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
