/* ==========================================================================
   API documentation page (static description of the intended REST API).
   ========================================================================== */
      const API_ENDPOINTS = [
        {
          group: 'Verkaufsobjekte',
          items: [
            { method: 'get', path: '/api/v1/properties', desc: 'Alle Verkaufsobjekte abrufen',
              params: [
                { name: 'type', type: 'string', req: false, desc: 'Objekttyp filtern (z.B. Bürogebäude, Wohnliegenschaft)' },
                { name: 'priority', type: 'integer', req: false, desc: 'Priorität filtern (0=Hoch, 1=Normal, 2=Gering, 3=Keine)' },
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

function openApiDocsPage() {
  navigate({ ...filterParams(), view: 'api' });
  renderApiDocsView();
}
function closeApiDocsPage() { leavePage(); }

function renderApiDocsView() {
  showPage('apiDocsView');
  $('apiDocsContent').innerHTML = `
    <div class="api-intro">
      <h2>Verkaufsplattform API</h2>
      <p>Version 1.0.0 &middot; Base URL: <code>https://api.verkaufsplattform.admin.ch</code></p>
      <p>REST API für den Zugriff auf Verkaufsobjekte des Bundesamts für Bauten und Logistik. Authentifizierung via API-Key im Header <code>X-API-Key</code>.</p>
    </div>
    ${API_ENDPOINTS.map(group => `
      <div class="api-endpoint-group">
        <h2 class="section-title">${group.group}</h2>
        ${group.items.map(renderApiEndpoint).join('')}
      </div>`).join('')}`;
}
function renderApiEndpoint(ep) {
  const params = ep.params.length
    ? `<div class="api-section-label">Parameter</div>
       <table class="data-table api-param-table">
         <thead><tr><th>Name</th><th>Typ</th><th>Pflicht</th><th>Beschreibung</th></tr></thead>
         <tbody>${ep.params.map(p => `<tr>
           <td><code>${p.name}</code></td><td><code>${p.type}</code></td>
           <td><span class="api-badge ${p.req ? 'required' : 'optional'}">${p.req ? 'Pflicht' : 'Optional'}</span></td>
           <td>${p.desc}</td></tr>`).join('')}</tbody>
       </table>`
    : '<p class="text-muted">Keine Parameter erforderlich.</p>';
  return `
    <div class="api-endpoint">
      <div class="api-endpoint-header" role="button" tabindex="0">
        <span class="api-method ${ep.method}">${ep.method}</span>
        <span class="api-endpoint-path">${ep.path}</span>
        <span class="api-endpoint-desc">${ep.desc}</span>
      </div>
      <div class="api-endpoint-body">
        ${params}
        <div class="api-section-label">Antwort-Beispiel</div>
        <div class="api-response-example">${ep.response}</div>
      </div>
    </div>`;
}
