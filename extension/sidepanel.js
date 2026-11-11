const listEl = document.getElementById('list');
const panelEl = document.querySelector('.dp-panel');
const syncBtn = document.getElementById('syncBtn');
const settingsBtn = document.getElementById('settingsBtn');
const searchInput = document.getElementById('searchInput');
const totalCountEl = document.getElementById('totalCount');
const syncStatusEl = document.getElementById('syncStatus');
const syncStatusTextEl = document.getElementById('syncStatusText');
const filterTabsEl = document.getElementById('filterTabs');
const countAllEl = document.getElementById('countAll');
const countTodayEl = document.getElementById('countToday');
const countTomorrowEl = document.getElementById('countTomorrow');
const toastEl = document.getElementById('toast');
const toastTextEl = document.getElementById('toastText');

let allTasks = [];
let syncedAt = null;
let unseenNumbers = [];
let favoriteKeys = new Set();
let searchQuery = '';
let activeFilter = 'all';
let toastTimer = null;

const STALE_AFTER_MS = 15 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ICON_COPY =
  '<svg class="dp-copy__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5"></rect><path d="M5 15V6a3 3 0 0 1 3-3h9"></path></svg>' +
  '<svg class="dp-copy__ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M20 6 9 17l-5-5"></path></svg>';
const ICON_ROUTE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8-8-2z"></path></svg>';
const ICON_PIN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
const ICON_HEART =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.05 3 5.5l7 7Z"></path></svg>';

init();

function init() {
  applyTheme();
  wireEvents();
  loadAndRender();
  placeTabIndicator();
  setInterval(updateSyncStatus, 30000);
}

function applyTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const set = () => {
    document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light';
  };
  set();
  mq.addEventListener('change', set);
}

function wireEvents() {
  syncBtn.addEventListener('click', sync);
  settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderList();
  });

  filterTabsEl.addEventListener('click', (e) => {
    const tabEl = e.target.closest('.dp-tab');
    if (!tabEl) return;
    activeFilter = tabEl.dataset.filter;
    filterTabsEl.querySelectorAll('.dp-tab').forEach((b) => {
      b.setAttribute('aria-selected', String(b === tabEl));
    });
    placeTabIndicator();
    renderList();
  });

  window.addEventListener('resize', placeTabIndicator);

  document.addEventListener('animationend', (e) => {
    if (e.target.classList && e.target.classList.contains('dp-card--enter')) {
      e.target.classList.remove('dp-card--enter');
    }
  });

  listEl.addEventListener('click', (e) => {
    const copyEl = e.target.closest('.dp-copy');
    if (copyEl) {
      e.stopPropagation();
      handleCopyClick(copyEl);
      return;
    }
    const pinEl = e.target.closest('.dp-pin-btn');
    if (pinEl) {
      e.stopPropagation();
      chrome.tabs.create({ url: pinEl.dataset.mapsUrl });
      return;
    }
    const favEl = e.target.closest('.dp-fav-btn');
    if (favEl) {
      e.stopPropagation();
      toggleFavorite(favEl);
      return;
    }
    const routeEl = e.target.closest('.dp-btn--route');
    if (routeEl) {
      e.stopPropagation();
      chrome.tabs.create({ url: routeEl.dataset.mapsUrl });
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/') return;
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isTyping) return;
    e.preventDefault();
    searchInput.focus();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchQuery = '';
      renderList();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.tasks || changes.syncedAt || changes.unseenNumbers)) {
      loadAndRender(true);
    }
  });
}

async function loadAndRender(animateSync) {
  const { tasks, syncedAt: sAt, unseenNumbers: un, favoriteLocations } = await chrome.storage.local.get([
    'tasks',
    'syncedAt',
    'unseenNumbers',
    'favoriteLocations',
  ]);
  allTasks = tasks || [];
  syncedAt = sAt || null;
  unseenNumbers = un || [];
  favoriteKeys = new Set(favoriteLocations || []);
  renderList();
  updateSyncStatus(!!animateSync);
  if (animateSync) {
    syncStatusEl.classList.remove('dp-sync--pulse');
    void syncStatusEl.offsetWidth;
    syncStatusEl.classList.add('dp-sync--pulse');
  }
}

async function sync() {
  syncBtn.disabled = true;
  syncBtn.setAttribute('aria-busy', 'true');
  panelEl.classList.add('dp-panel--busy');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'Failed to get data from the page');
    }
    await loadAndRender(true);
  } catch (e) {
    showToast('Error: ' + e.message);
  } finally {
    syncBtn.disabled = false;
    syncBtn.removeAttribute('aria-busy');
    panelEl.classList.remove('dp-panel--busy');
  }
}

async function toggleFavorite(btn) {
  const key = btn.dataset.favKey;
  if (!key) return;
  const willBeActive = !favoriteKeys.has(key);
  if (willBeActive) favoriteKeys.add(key);
  else favoriteKeys.delete(key);

  btn.classList.toggle('dp-fav-btn--active', willBeActive);
  btn.setAttribute('aria-pressed', String(willBeActive));
  const label = willBeActive ? 'Remove from favourites' : 'Add to favourites';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);

  await chrome.storage.local.set({ favoriteLocations: [...favoriteKeys] });
  showToast(willBeActive ? 'Added to favourites' : 'Removed from favourites');
}

function placeTabIndicator() {
  const ind = filterTabsEl.querySelector('.dp-tabs__ind');
  const sel = filterTabsEl.querySelector('.dp-tab[aria-selected="true"]');
  if (!ind || !sel) return;
  ind.style.width = sel.offsetWidth + 'px';
  ind.style.transform = `translateX(${sel.offsetLeft}px)`;
  filterTabsEl.classList.add('dp-tabs--live');
}

async function ackTask(number, cardEl) {
  cardEl.classList.remove('dp-card--new');
  const badge = cardEl.querySelector('.dp-badge-new');
  if (badge) badge.remove();
  unseenNumbers = unseenNumbers.filter((n) => n !== number);
  try {
    await chrome.runtime.sendMessage({ type: 'ACK_TASK', number });
  } catch (_e) {
    // storage.onChanged / the next sync will reconcile the badge regardless
  }
}

async function handleCopyClick(btn) {
  const value = btn.dataset.copy || '';
  const label = btn.dataset.label || 'Value';
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch (_e) {
    return;
  }
  const row = btn.closest('.dp-copy-row');
  clearTimeout(btn._copyTimer);
  btn.classList.remove('dp-copy--done');
  void btn.offsetWidth;
  btn.classList.add('dp-copy--done');
  if (row) {
    row.classList.remove('dp-copy-row--flash', 'dp-copy-row--done');
    void row.offsetWidth;
    row.classList.add('dp-copy-row--flash', 'dp-copy-row--done');
  }
  showToast(capitalize(label) + ' copied');
  btn._copyTimer = setTimeout(() => {
    btn.classList.remove('dp-copy--done');
    if (row) row.classList.remove('dp-copy-row--done', 'dp-copy-row--flash');
  }, 1500);
}

function showToast(text) {
  toastTextEl.textContent = text;
  toastEl.classList.remove('is-visible');
  void toastEl.offsetWidth;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1600);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Always dd.mm.yyyy for absolute dates.
function formatAbsDate(d) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Scraped as "DD-MM-YYYY HH:MM" by content.js.
function parseDMY(raw) {
  const parts = (raw || '').split(/\s+/).filter(Boolean);
  const datePart = parts[0] || '';
  const timePart = parts[1] || '';
  const m = datePart.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return { date: null, time: timePart };
  const [, dd, mm, yyyy] = m;
  return { date: new Date(Number(yyyy), Number(mm) - 1, Number(dd)), time: timePart || '' };
}

function dayDiff(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / 86400000);
}

function toSortableTime(dateObj, timeStr) {
  if (!dateObj) return Number.POSITIVE_INFINITY;
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hh || 0, mm || 0).getTime();
}

function renderStopDateHtml(dateObj) {
  if (!dateObj) return '';
  const diff = dayDiff(dateObj, new Date());
  if (diff === 0) return `<strong>Today</strong> · ${formatAbsDate(dateObj)}`;
  if (diff === -1) return `<strong>Yesterday</strong> · ${formatAbsDate(dateObj)}`;
  if (diff === 1) return `<strong>Tomorrow</strong> · ${formatAbsDate(dateObj)}`;
  return `${WEEKDAYS[dateObj.getDay()]} ${formatAbsDate(dateObj)}`;
}

function parseLocation(raw) {
  const lines = (raw || '').split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    name: lines[0] || '',
    street: lines[1] || '',
    countryCity: lines[2] || '',
  };
}

function splitCountry(countryCity) {
  const m = (countryCity || '').match(/^([A-Z]{2})\s+(.+)$/);
  if (m) return { cc: m[1], rest: m[2] };
  return { cc: null, rest: countryCity || '' };
}

function buildMapsUrl(loadLoc, unloadLoc) {
  const origin = [loadLoc.name, loadLoc.street, loadLoc.countryCity].filter(Boolean).join(', ');
  const destination = [unloadLoc.name, unloadLoc.street, unloadLoc.countryCity].filter(Boolean).join(', ');
  if (!origin || !destination) return null;
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildSingleMapsUrl(loc) {
  const q = [loc.name, loc.street, loc.countryCity].filter(Boolean).join(', ');
  if (!q) return null;
  const params = new URLSearchParams({ api: '1', query: q });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function locationKey(loc) {
  return [loc.name, loc.street, loc.countryCity].join('|').toLowerCase();
}

function copyBtn(value, label) {
  return `<button type="button" class="dp-copy" data-copy="${escapeHtml(value)}" data-label="${escapeHtml(label)}" aria-label="Copy ${escapeHtml(label)}" title="Copy ${escapeHtml(label)}">${ICON_COPY}</button>`;
}

function pinBtn(url) {
  return `<button type="button" class="dp-row-btn dp-pin-btn" data-maps-url="${escapeHtml(url)}" aria-label="Open in Google Maps" title="Open in Google Maps">${ICON_PIN}</button>`;
}

function favBtn(loc) {
  const key = locationKey(loc);
  const active = favoriteKeys.has(key);
  const label = active ? 'Remove from favourites' : 'Add to favourites';
  return `<button type="button" class="dp-row-btn dp-fav-btn${active ? ' dp-fav-btn--active' : ''}" data-fav-key="${escapeHtml(key)}" aria-pressed="${active}" aria-label="${label}" title="${label}">${ICON_HEART}</button>`;
}

function renderStop(kind, loc, dateObj, timeStr) {
  const { cc, rest } = splitCountry(loc.countryCity);
  const address = [loc.street, loc.countryCity].filter(Boolean).join(', ');
  const pinUrl = buildSingleMapsUrl(loc);
  return `
    <div class="dp-stop dp-stop--${kind}">
      <div class="dp-stop__rail"><span class="dp-stop__mark"></span></div>
      <div class="dp-stop__body">
        <div class="dp-stop__head">
          <span class="dp-chip">${kind === 'load' ? 'Load' : 'Unload'}</span>
          <span class="dp-stop__date">${renderStopDateHtml(dateObj)}</span>
          <span class="dp-stop__time">${escapeHtml(timeStr || '')}</span>
        </div>
        <div class="dp-stop__info">
          <div class="dp-copy-row">
            <div class="dp-stop__company">${escapeHtml(loc.name)}</div>
            ${loc.name ? copyBtn(loc.name, 'company name') : ''}
          </div>
          <div class="dp-copy-row">
            <div>
              <div class="dp-stop__line">${escapeHtml(loc.street)}</div>
              <div class="dp-stop__city">${cc ? `<span class="dp-cc">${escapeHtml(cc)}</span>` : ''}${escapeHtml(rest)}</div>
            </div>
            <div class="dp-row-actions">
              ${pinUrl ? pinBtn(pinUrl) : ''}
              ${favBtn(loc)}
              ${address ? copyBtn(address, 'address') : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderCard(t) {
  const card = document.createElement('article');
  card.className = 'dp-card' + (t.isNew ? ' dp-card--new' : '');
  card.setAttribute('aria-label', `Truck ${t.truck}`);
  const mapsUrl = buildMapsUrl(t.loadLoc, t.unloadLoc);
  card.innerHTML = `
    <header class="dp-card__head">
      <span class="dp-plate">${escapeHtml(t.truck)}</span>
      ${t.isNew ? '<span class="dp-badge-new">New</span>' : ''}
      <span class="dp-ref">${escapeHtml(t.number)}${t.number ? copyBtn(t.number, 'order number') : ''}</span>
    </header>
    <div class="dp-card__body">
      ${renderStop('load', t.loadLoc, t.load.date, t.load.time)}
      ${renderStop('unload', t.unloadLoc, t.unload.date, t.unload.time)}
    </div>
    ${
      mapsUrl
        ? `<footer class="dp-card__foot"><button type="button" class="dp-btn dp-btn--route" data-maps-url="${escapeHtml(mapsUrl)}">${ICON_ROUTE}Open route in Google Maps</button></footer>`
        : ''
    }
  `;
  if (t.isNew) {
    card.addEventListener('mouseenter', () => ackTask(t.number, card));
  }
  return card;
}

function renderList() {
  totalCountEl.textContent = String(allTasks.length);

  if (allTasks.length === 0) {
    countAllEl.textContent = '0';
    countTodayEl.textContent = '0';
    countTomorrowEl.textContent = '0';
    listEl.innerHTML = '<p class="dp-empty">No data yet. Click Sync to load tasks.</p>';
    return;
  }

  const unseenSet = new Set(unseenNumbers || []);
  const q = searchQuery.trim().toLowerCase();
  const searched = q ? allTasks.filter((t) => (t.truck || '').toLowerCase().includes(q)) : allTasks;

  const now = new Date();
  const enriched = searched.map((t) => ({
    ...t,
    load: parseDMY(t.loadingDateTime),
    unload: parseDMY(t.unloadingDateTime),
    loadLoc: parseLocation(t.loadingLocation),
    unloadLoc: parseLocation(t.unloadingLocation),
    isNew: unseenSet.has(t.number),
  }));

  const isToday = (d) => d && dayDiff(d, now) === 0;
  const isTomorrow = (d) => d && dayDiff(d, now) === 1;
  const todayMatches = (t) => isToday(t.load.date) || isToday(t.unload.date);
  const tomorrowMatches = (t) => isTomorrow(t.load.date) || isTomorrow(t.unload.date);

  countAllEl.textContent = String(enriched.length);
  countTodayEl.textContent = String(enriched.filter(todayMatches).length);
  countTomorrowEl.textContent = String(enriched.filter(tomorrowMatches).length);

  let filtered = enriched;
  if (activeFilter === 'today') filtered = enriched.filter(todayMatches);
  if (activeFilter === 'tomorrow') filtered = enriched.filter(tomorrowMatches);

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<p class="dp-empty">No tasks match.</p>';
    return;
  }

  filtered
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      return toSortableTime(a.load.date, a.load.time) - toSortableTime(b.load.date, b.load.time);
    })
    .forEach((t, i) => {
      const card = renderCard(t);
      card.style.setProperty('--i', i);
      card.classList.add('dp-card--enter');
      listEl.appendChild(card);
    });
}

function updateSyncStatus(animate) {
  if (!syncedAt) {
    syncStatusEl.classList.remove('dp-sync--stale');
    syncStatusTextEl.textContent = 'Click Sync to load tasks';
    return;
  }
  const elapsedMs = Date.now() - syncedAt;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const stale = elapsedMs > STALE_AFTER_MS;
  const t = new Date(syncedAt);
  const timeStr = `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  const agoText = elapsedMin < 1 ? 'just now' : `${elapsedMin} min ago`;

  syncStatusEl.classList.toggle('dp-sync--stale', stale);
  syncStatusTextEl.innerHTML = stale
    ? `<b>Out of date</b> · ${timeStr}`
    : `<b>Synced</b> ${agoText} · ${timeStr}`;

  if (animate) {
    syncStatusTextEl.classList.remove('dp-swap');
    void syncStatusTextEl.offsetWidth;
    syncStatusTextEl.classList.add('dp-swap');
  }
}
