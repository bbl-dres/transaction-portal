/* ==========================================================================
   Utilities: DOM shortcuts, formatters and shared markup fragments.
   ========================================================================== */
const $ = id => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const MISSING = '–';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function debounce(fn, wait) {
  let timer = null;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
}
function isBlank(value) { return value === null || value === undefined || value === ''; }
function valueOrDash(value) { return isBlank(value) ? MISSING : value; }

// --- Number / text formatting (Swiss German conventions) ---
function formatNumber(value) { return isBlank(value) ? '0' : Number(value).toLocaleString('de-CH'); }
function formatCHF(value) { return value ? `CHF ${formatNumber(value)}` : 'CHF 0'; }
function formatPriceRange(min, max) { return (!min && !max) ? 'CHF 0 - CHF 0' : `${formatCHF(min)} - ${formatCHF(max)}`; }
function pricePerSqm(price, area) { return (!price || !area) ? 0 : Math.round(price / area); }
function formatArea(value, unit = 'm²') { return value ? `${formatNumber(value)} ${unit}` : MISSING; }
function formatYesNo(value) { return isBlank(value) ? MISSING : (value ? 'Ja' : 'Nein'); }
function formatFileSize(bytes) {
  if (!bytes) return MISSING;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function formatCoord(value, dir) {
  if (!value) return MISSING;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}°${min}'${sec}"${dir}`;
}
function formatDate(isoDate, { withTime = false } = {}) {
  const date = new Date(isoDate);
  const pad = n => String(n).padStart(2, '0');
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  return withTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

// --- Domain helpers ---
function priorityKey(priority) { return isBlank(priority) ? 'null' : String(priority); }
function getPriorityClass(priority) { return `priority-${priorityKey(priority)}`; }
function getPriorityLabel(prop) { return PRIORITY_LABELS[priorityKey(prop.priority)] || prop.priorityLabel || PRIORITY_LABELS.null; }
function countByPriority(list) {
  const counts = Object.fromEntries(PRIORITIES.map(p => [p.value, 0]));
  list.forEach(prop => { counts[priorityKey(prop.priority)] = (counts[priorityKey(prop.priority)] || 0) + 1; });
  return counts;
}
function milestoneKey(prop) { return prop.milestone ? `${prop.milestone.current}/${prop.milestone.total}` : ''; }
function milestoneText(prop) { return prop.milestone ? `${milestoneKey(prop)} ${prop.milestone.label}` : MISSING; }
function findProperty(id) { return state.properties.find(p => p.id === id); }
function getPlaceholderImage(id) {
  const hash = String(id).split('').reduce((a, c) => { a = ((a << 5) - a) + c.charCodeAt(0); return a & a; }, 0);
  return `${PLACEHOLDER_IMAGES[Math.abs(hash) % PLACEHOLDER_IMAGES.length]}?w=400&h=300&fit=crop`;
}
function setObjectCount(count) { $('objectCount').textContent = count; }

// --- Shared markup ---
function renderTags(prop, { detail = false } = {}) {
  const detailAttr = detail ? ' data-detail="true"' : '';
  return `<div class="image-tags">
    <span class="tag" data-filter="year" data-value="${prop.year}"${detailAttr}>${prop.year}</span>
    <span class="tag ${getPriorityClass(prop.priority)}" data-filter="priority" data-value="${priorityKey(prop.priority)}"${detailAttr}>${getPriorityLabel(prop)}</span>
  </div>`;
}
function renderMedia(prop, className, { image = getPlaceholderImage(prop.id), tags = true, attrs = '' } = {}) {
  return `<div class="media ${className}" style="background-image: url('${image}')" ${attrs}>${tags ? renderTags(prop, { detail: attrs.includes('data-image-index') }) : ''}</div>`;
}
function renderDataItem(label, value, { compact = false, full = false, empty = false } = {}) {
  const classes = ['data-item', compact ? 'data-item-compact' : '', full ? 'data-item-full' : ''].filter(Boolean).join(' ');
  return `<div class="${classes}"><span class="data-item-label">${label}</span><span class="data-item-value ${empty ? 'empty' : ''}">${value}</span></div>`;
}
function renderEmptyState(icon, text, { small = false } = {}) {
  return `<div class="empty-state ${small ? 'empty-state-sm' : ''}">${icon ? `<span class="material-icons-outlined">${icon}</span>` : ''}<p>${text}</p></div>`;
}
function renderSearchField({ id, placeholder, oninput = '', extra = '' }) {
  return `<div class="search-field">
    <span class="material-icons-outlined search-field-icon">search</span>
    <input type="search" class="input" id="${id}" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off" ${oninput ? `oninput="${oninput}"` : ''}>
    ${extra}
  </div>`;
}
