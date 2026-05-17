// dashboard.js – TabSaver Dashboard

// ── State ──────────────────────────────────────────────────────────────────
let allSessions  = [];
let filterMode   = 'all';
let searchQuery  = '';
let pendingAction = {};

const GROUP_COLORS = {
  grey:'#9aa0a6', blue:'#4285f4', red:'#ea4335', yellow:'#fbbc04',
  green:'#34a853', pink:'#ff63a5', purple:'#a142f4', cyan:'#24c1e0', orange:'#fa903e',
};

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  await loadAndRender();
  await loadSettings();
  setupNav();
  setupSessions();
  setupAutomation();
  setupPreferences();
  setupDataCenter();
  setupModals();
})();

// ── Data ───────────────────────────────────────────────────────────────────
async function loadAndRender() {
  const { tabsaver_sessions = [] } = await chrome.storage.local.get('tabsaver_sessions');
  allSessions = tabsaver_sessions;
  updateStats();
  renderSessions();
}

function updateStats() {
  const totalTabs = allSessions.reduce((n, s) => n + s.tabs.length, 0);
  document.getElementById('statSessions').textContent = allSessions.length;
  document.getElementById('statTabs').textContent     = totalTabs;
}

// ── Settings load ──────────────────────────────────────────────────────────
async function loadSettings() {
  const { tabsaver_settings = {} } = await chrome.storage.local.get('tabsaver_settings');
  const s = tabsaver_settings;

  // Auto-save
  document.getElementById('toggleAutoSave').checked = !!s.autoSaveEnabled;
  setAutoSaveBodyEnabled(!!s.autoSaveEnabled);

  const interval = s.autoSaveInterval || 30;
  document.querySelectorAll('[data-interval]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.interval) === interval);
    btn.classList.toggle('text-[#C84028]', parseInt(btn.dataset.interval) === interval);
  });

  const keepCount = s.autoSaveKeepCount || 10;
  document.getElementById('keepCount').value = keepCount;
  document.getElementById('keepCountLabel').textContent = `${keepCount} saves`;

  // Domain filter
  const domainMode = s.domainFilterMode || 'none';
  document.getElementById('domainFilterMode').value = domainMode;
  renderDomainTags(s.domainFilterList || []);

  // Preferences
  document.getElementById('setCloseAfterSave').checked = !!s.closeAfterSave;
}

async function saveSetting(key, val) {
  const { tabsaver_settings = {} } = await chrome.storage.local.get('tabsaver_settings');
  tabsaver_settings[key] = val;
  await chrome.storage.local.set({ tabsaver_settings });
}

// ── Render sessions ────────────────────────────────────────────────────────
function renderSessions() {
  const grid       = document.getElementById('cardsGrid');
  const loading    = document.getElementById('loadingState');
  const globalEmpty= document.getElementById('globalEmpty');
  const noResults  = document.getElementById('noResults');

  loading.classList.add('hidden');
  grid.innerHTML = '';

  let filtered = allSessions.filter(s => {
    if (filterMode === 'manual' && s.type !== 'manual') return false;
    if (filterMode === 'auto'   && s.type !== 'auto')   return false;
    return true;
  });

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.tabs.some(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
    );
  }

  if (!allSessions.length) {
    globalEmpty.classList.remove('hidden');
    noResults.classList.add('hidden');
    return;
  }
  globalEmpty.classList.add('hidden');

  if (!filtered.length) {
    noResults.classList.remove('hidden');
    return;
  }
  noResults.classList.add('hidden');

  filtered.forEach(s => grid.appendChild(buildSessionCard(s)));
}

// ── Session card ───────────────────────────────────────────────────────────
function buildSessionCard(session) {
  const card = document.createElement('div');
  card.className = 'glass-card rounded-2xl p-5 group flex flex-col h-full relative overflow-hidden';
  card.dataset.id = session.id;

  const count      = session.tabs.length;
  const previewTabs = session.tabs.slice(0, 2);
  const moreCount  = count - previewTabs.length;
  const typeLabel  = session.type === 'auto' ? 'Auto' : 'Manual';

  // Unique groups with metadata
  const groupMap = new Map();
  session.tabs.forEach(t => {
    if (t.groupId !== null && t.groupId !== undefined && !groupMap.has(t.groupId)) {
      groupMap.set(t.groupId, { title: t.groupTitle || '', color: t.groupColor || 'grey' });
    }
  });
  const groups = [...groupMap.values()];

  const tabPreviewHtml = previewTabs.map(t => {
    const domain = (() => { try { return new URL(t.url).hostname; } catch { return ''; } })();
    const favicon = t.favIconUrl
      ? `<img src="${escHtml(t.favIconUrl)}" class="favicon-err w-4 h-4 rounded grayscale group-hover:grayscale-0 transition-all flex-shrink-0" alt="">`
      : `<div class="w-4 h-4 rounded bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[8px] text-slate-400 flex-shrink-0">${(domain.charAt(0) || '?').toUpperCase()}</div>`;
    return `<div class="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
      ${favicon}<span class="truncate">${escHtml(t.title)}</span></div>`;
  }).join('');

  const moreHtml = moreCount > 0
    ? `<div class="flex items-center gap-3 text-sm text-slate-500 italic">
        <i class="ph ph-dots-three"></i><span>+ ${moreCount} more tab${moreCount > 1 ? 's' : ''}</span></div>`
    : '';

  const groupBadgesHtml = groups.length
    ? `<div class="flex flex-wrap gap-1.5 mb-3">
        ${groups.slice(0, 4).map(g => {
          const hex = GROUP_COLORS[g.color] || '#9aa0a6';
          return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border mono"
            style="color:${hex};border-color:${hex}40;background:${hex}15">${escHtml(g.title || 'Group')}</span>`;
        }).join('')}
       </div>`
    : '';

  card.innerHTML = `
    <div class="absolute top-0 right-0 w-24 h-24 bg-[#C84028]/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-300"></div>
    <div class="flex justify-between items-start mb-4">
      <div class="flex-1 min-w-0 mr-3">
        <h3 class="font-bold text-lg mb-1 group-hover:text-[#C84028] transition-colors truncate">${escHtml(session.name)}</h3>
        <div class="flex items-center gap-2 text-xs text-slate-500 mono flex-wrap">
          <i class="ph ph-clock"></i><span>${timeAgo(session.savedAt)}</span>
          <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
          <span>${typeLabel}</span>
        </div>
      </div>
      <div class="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 shrink-0">
        ${count} Tab${count !== 1 ? 's' : ''}
      </div>
    </div>

    ${groupBadgesHtml}

    <div class="flex-1 space-y-2 mb-5 min-h-0">
      ${tabPreviewHtml}${moreHtml}
    </div>

    <div class="flex gap-2 mt-auto pt-4 border-t border-slate-100 dark:border-white/5">
      <button class="flex-1 btn-secondary py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 restore-btn">
        <i class="ph-bold ph-arrow-square-out"></i> Restore
      </button>
      <div class="relative">
        <button class="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#C84028] hover:bg-[#C84028]/10 transition-colors border border-transparent hover:border-[#C84028]/30 menu-btn">
          <i class="ph-fill ph-dots-three-vertical text-lg"></i>
        </button>
        <div class="dropdown hidden absolute right-0 bottom-12 bg-white dark:bg-[#0d0d18] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-40 min-w-[150px] overflow-hidden py-1">
          <button class="view-tabs-btn w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 text-slate-700 dark:text-slate-300 transition-colors">
            <i class="ph ph-list-bullets text-slate-400"></i> View Tabs
          </button>
          <button class="rename-btn w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 text-slate-700 dark:text-slate-300 transition-colors">
            <i class="ph ph-pencil text-slate-400"></i> Rename
          </button>
          <div class="border-t border-slate-100 dark:border-white/5 my-1"></div>
          <button class="delete-btn w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors">
            <i class="ph ph-trash text-red-400"></i> Delete
          </button>
        </div>
      </div>
    </div>
  `;

  card.querySelectorAll('.favicon-err').forEach(img =>
    img.addEventListener('error', () => { img.style.display = 'none'; }));
  card.querySelector('.restore-btn').addEventListener('click', () => openRestoreModal(session));
  card.querySelector('.menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    const dd = card.querySelector('.dropdown');
    document.querySelectorAll('.dropdown:not(.hidden)').forEach(d => { if (d !== dd) d.classList.add('hidden'); });
    dd.classList.toggle('hidden');
  });
  card.querySelector('.view-tabs-btn').addEventListener('click', () => {
    card.querySelector('.dropdown').classList.add('hidden');
    openViewTabsModal(session);
  });
  card.querySelector('.rename-btn').addEventListener('click', () => {
    card.querySelector('.dropdown').classList.add('hidden');
    openRenameModal(session);
  });
  card.querySelector('.delete-btn').addEventListener('click', () => {
    card.querySelector('.dropdown').classList.add('hidden');
    openDeleteModal(session);
  });

  return card;
}

// Close dropdowns on outside click
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown:not(.hidden)').forEach(d => d.classList.add('hidden'));
});

// ── View tabs modal ────────────────────────────────────────────────────────
function openViewTabsModal(session) {
  document.getElementById('viewTabsTitle').textContent    = session.name;
  document.getElementById('viewTabsSubtitle').textContent = `${session.tabs.length} saved tab${session.tabs.length !== 1 ? 's' : ''}`;
  const content = document.getElementById('viewTabsContent');
  content.innerHTML = buildTabItems(session.tabs);
  bindTabOpenButtons(content);
  content.querySelectorAll('.favicon-err').forEach(img =>
    img.addEventListener('error', () => { img.style.display = 'none'; }));
  document.getElementById('viewTabsModal').classList.remove('hidden');
}

// Build tab list HTML with group headers
function buildTabItems(tabs) {
  if (!tabs.length) return '<p class="text-sm text-slate-400 text-center py-8">No tabs.</p>';

  const buckets = [];
  const seenKeys = new Map();

  for (const tab of tabs) {
    const key = tab.groupId !== null && tab.groupId !== undefined ? String(tab.groupId) : '__none__';
    if (!seenKeys.has(key)) {
      seenKeys.set(key, buckets.length);
      buckets.push({ key, title: tab.groupTitle || '', color: tab.groupColor || 'grey', tabs: [] });
    }
    buckets[seenKeys.get(key)].tabs.push(tab);
  }

  return buckets.map(bucket => {
    const groupHeader = bucket.key !== '__none__'
      ? (() => {
          const hex = GROUP_COLORS[bucket.color] || '#9aa0a6';
          return `<div class="flex items-center gap-2 px-3 py-2 rounded-lg mb-1 mt-2" style="background:${hex}15;border:1px solid ${hex}30">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${hex}"></span>
            <span class="text-xs font-bold" style="color:${hex}">${escHtml(bucket.title || 'Unnamed Group')}</span>
            <span class="text-[10px] text-slate-400 ml-auto">${bucket.tabs.length} tab${bucket.tabs.length !== 1 ? 's' : ''}</span>
          </div>`;
        })()
      : '';

    const tabRows = bucket.tabs.map(t => {
      const domain = (() => { try { return new URL(t.url).hostname; } catch { return ''; } })();
      const indent = bucket.key !== '__none__' ? 'pl-8' : '';
      const favicon = t.favIconUrl
        ? `<img src="${escHtml(t.favIconUrl)}" class="favicon-err w-4 h-4 rounded shrink-0" alt="">`
        : `<div class="w-4 h-4 rounded bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[8px] shrink-0">${(domain.charAt(0) || '?').toUpperCase()}</div>`;
      const savedAt = t.savedAt
        ? `<span class="text-[10px] text-slate-400 mono shrink-0 ml-2">${new Date(t.savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`
        : '';
      return `
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group ${indent}">
          ${favicon}
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate text-slate-700 dark:text-slate-300">${escHtml(t.title)}</div>
            <div class="text-[11px] text-slate-400 truncate mono">${escHtml(t.url)}</div>
          </div>
          ${savedAt}
          <button class="tab-open shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-bold text-[#C84028] border border-[#C84028]/30 rounded-md px-2 py-1 hover:bg-[#C84028] hover:text-white transition-colors" data-url="${escHtml(t.url)}">Open</button>
        </div>`;
    }).join('');

    return groupHeader + tabRows;
  }).join('');
}

function bindTabOpenButtons(container) {
  container.querySelectorAll('.tab-open').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'restoreTab', url: btn.dataset.url, inNewWindow: false });
      showToast('Tab opened!', 'success');
    });
  });
}

// ── Persist ────────────────────────────────────────────────────────────────
async function persistSessions() {
  await chrome.storage.local.set({ tabsaver_sessions: allSessions });
  updateStats();
  renderSessions();
}

// ── Modals ─────────────────────────────────────────────────────────────────
function setupModals() {
  // View tabs close
  document.getElementById('btnViewTabsClose').addEventListener('click', () => {
    document.getElementById('viewTabsModal').classList.add('hidden');
  });

  // Rename
  document.getElementById('btnRenameCancel').addEventListener('click', () =>
    document.getElementById('renameModal').classList.add('hidden'));
  document.getElementById('btnRenameSave').addEventListener('click', async () => {
    const name = document.getElementById('renameInput').value.trim();
    if (!name) return;
    const idx = allSessions.findIndex(s => s.id === pendingAction.sessionId);
    if (idx !== -1) { allSessions[idx].name = name; await persistSessions(); showToast('Session renamed!'); }
    document.getElementById('renameModal').classList.add('hidden');
  });
  document.getElementById('renameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnRenameSave').click();
  });

  // Delete
  document.getElementById('btnDeleteCancel').addEventListener('click', () =>
    document.getElementById('deleteModal').classList.add('hidden'));
  document.getElementById('btnDeleteConfirm').addEventListener('click', async () => {
    if (pendingAction.type === 'deleteAll') {
      allSessions = [];
    } else {
      allSessions = allSessions.filter(s => s.id !== pendingAction.sessionId);
    }
    await persistSessions();
    showToast('Deleted.');
    document.getElementById('deleteModal').classList.add('hidden');
  });

  // Restore
  const hideRestoreModal = () => document.getElementById('restoreModal').classList.add('hidden');
  document.getElementById('btnRestoreClose').addEventListener('click', hideRestoreModal);
  document.getElementById('btnRestoreCancel').addEventListener('click', hideRestoreModal);
  document.getElementById('btnRestoreCurrent').addEventListener('click', () => doRestore(false));
  document.getElementById('btnRestoreNew').addEventListener('click',     () => doRestore(true));

  // Quick save
  document.getElementById('btnQuickSaveCancel').addEventListener('click', () =>
    document.getElementById('quickSaveModal').classList.add('hidden'));
  document.getElementById('btnQuickSaveConfirm').addEventListener('click', async () => {
    const name  = document.getElementById('quickSaveInput').value.trim();
    const close = document.getElementById('quickSaveClose').checked;
    document.getElementById('quickSaveModal').classList.add('hidden');
    const result = await chrome.runtime.sendMessage({ action: 'saveActiveTab', name });
    if (!result?.ok) { showToast(result?.error || 'Save failed.', 'error'); return; }
    showToast(`Saved: "${result.session.name}"`, 'success');
    if (close && result.session.tabIds?.length) {
      await chrome.runtime.sendMessage({ action: 'closeTabs', tabIds: result.session.tabIds });
    }
    await loadAndRender();
  });
  document.getElementById('quickSaveInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btnQuickSaveConfirm').click();
  });
}

function openRenameModal(session) {
  pendingAction = { type: 'rename', sessionId: session.id };
  const input = document.getElementById('renameInput');
  input.value = session.name;
  document.getElementById('renameModal').classList.remove('hidden');
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

function openDeleteModal(session) {
  pendingAction = { type: 'delete', sessionId: session.id };
  document.getElementById('deleteModalTitle').textContent = `Delete "${session.name}"?`;
  document.getElementById('deleteModalBody').textContent  =
    `This will permanently remove this session and its ${session.tabs.length} saved tab${session.tabs.length !== 1 ? 's' : ''}.`;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function openRestoreModal(session) {
  pendingAction = { type: 'restore', sessionId: session.id };
  document.getElementById('restoreModalBody').textContent =
    `Restore ${session.tabs.length} tab${session.tabs.length !== 1 ? 's' : ''} from "${session.name}".`;
  document.getElementById('restoreModal').classList.remove('hidden');
}

async function doRestore(inNewWindow) {
  document.getElementById('restoreModal').classList.add('hidden');
  const result = await chrome.runtime.sendMessage({
    action: 'restoreSession', sessionId: pendingAction.sessionId, inNewWindow
  });
  showToast(result?.ok ? 'Session restored!' : (result?.error || 'Restore failed.'),
            result?.ok ? 'success' : 'error');
}

// ── Nav setup ──────────────────────────────────────────────────────────────
function setupNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels   = document.querySelectorAll('.tab-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => {
        n.classList.remove('bg-slate-100','dark:bg-white/5','text-[#C84028]','border-slate-200','dark:border-white/10','shadow-sm');
        n.classList.add('border-transparent','text-slate-500');
      });
      item.classList.add('bg-slate-100','dark:bg-white/5','text-[#C84028]','border-slate-200','dark:border-white/10','shadow-sm');
      item.classList.remove('border-transparent','text-slate-500');

      const targetId = item.dataset.target;
      panels.forEach(p => {
        const show = p.id === targetId;
        p.classList.toggle('opacity-100', show);
        p.classList.toggle('z-10', show);
        p.classList.toggle('opacity-0', !show);
        p.classList.toggle('pointer-events-none', !show);
        p.classList.toggle('z-0', !show);
      });
    });
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light');
  });
}

// ── Sessions panel setup ───────────────────────────────────────────────────
function setupSessions() {
  // Filter pills
  document.querySelectorAll('[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterMode = pill.dataset.filter;
      renderSessions();
    });
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  const clearBtn    = document.getElementById('btnClearSearch');
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    clearBtn.classList.toggle('hidden', !searchQuery);
    renderSessions();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.classList.add('hidden');
    renderSessions();
  });

  // React to storage changes from background (e.g. auto-save)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.tabsaver_sessions) {
      allSessions = changes.tabsaver_sessions.newValue || [];
      updateStats();
      renderSessions();
    }
  });
}

// ── Automation panel setup ─────────────────────────────────────────────────
function setupAutomation() {
  // Auto-save toggle
  document.getElementById('toggleAutoSave').addEventListener('change', async e => {
    const enabled  = e.target.checked;
    const interval = getSelectedInterval();
    setAutoSaveBodyEnabled(enabled);
    await saveSetting('autoSaveEnabled', enabled);
    await saveSetting('autoSaveInterval', interval);
    chrome.runtime.sendMessage({ action: 'updateAutoSave', enabled, interval });
  });

  // Interval buttons
  document.querySelectorAll('[data-interval]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-interval]').forEach(b => {
        b.classList.remove('active','text-[#C84028]');
        b.classList.add('text-slate-600','dark:text-slate-400');
      });
      btn.classList.add('active','text-[#C84028]');
      btn.classList.remove('text-slate-600','dark:text-slate-400');
      const interval = parseInt(btn.dataset.interval);
      await saveSetting('autoSaveInterval', interval);
      const enabled = document.getElementById('toggleAutoSave').checked;
      if (enabled) chrome.runtime.sendMessage({ action: 'updateAutoSave', enabled: true, interval });
    });
  });

  // Keep count slider
  document.getElementById('keepCount').addEventListener('input', async e => {
    const val = parseInt(e.target.value);
    document.getElementById('keepCountLabel').textContent = `${val} saves`;
    await saveSetting('autoSaveKeepCount', val);
  });

  // Domain filter mode
  document.getElementById('domainFilterMode').addEventListener('change', async e => {
    await saveSetting('domainFilterMode', e.target.value);
  });

  // Add domain
  document.getElementById('btnAddDomain').addEventListener('click', () => addDomainFromInput());
  document.getElementById('domainInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addDomainFromInput();
  });
}

function setAutoSaveBodyEnabled(enabled) {
  const body = document.getElementById('autoSaveBody');
  body.style.opacity        = enabled ? '1' : '0.4';
  body.style.pointerEvents  = enabled ? '' : 'none';
}

function getSelectedInterval() {
  const active = document.querySelector('[data-interval].active');
  return active ? parseInt(active.dataset.interval) : 30;
}

async function addDomainFromInput() {
  const raw    = document.getElementById('domainInput').value.trim();
  const domain = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  if (!domain || !domain.includes('.')) return;

  const { tabsaver_settings = {} } = await chrome.storage.local.get('tabsaver_settings');
  const list = tabsaver_settings.domainFilterList || [];
  if (list.includes(domain)) return;
  list.push(domain);
  tabsaver_settings.domainFilterList = list;
  await chrome.storage.local.set({ tabsaver_settings });

  document.getElementById('domainInput').value = '';
  renderDomainTags(list);
}

function renderDomainTags(list) {
  const container  = document.getElementById('domainTagList');
  const emptyMsg   = document.getElementById('domainEmptyMsg');
  container.innerHTML = '';
  emptyMsg.classList.toggle('hidden', list.length > 0);

  list.forEach((domain, i) => {
    const tag = document.createElement('span');
    tag.className = 'inline-flex items-center gap-1.5 bg-[#C84028]/10 border border-[#C84028]/20 text-[#C84028] px-2.5 py-1 rounded-lg text-xs font-bold';
    tag.innerHTML = `${escHtml(domain)}<button class="hover:text-red-500 transition-colors font-bold text-sm leading-none" title="Remove">×</button>`;
    tag.querySelector('button').addEventListener('click', async () => {
      const { tabsaver_settings = {} } = await chrome.storage.local.get('tabsaver_settings');
      const l2 = (tabsaver_settings.domainFilterList || []).filter((_, j) => j !== i);
      tabsaver_settings.domainFilterList = l2;
      await chrome.storage.local.set({ tabsaver_settings });
      renderDomainTags(l2);
    });
    container.appendChild(tag);
  });
}

// ── Preferences panel ──────────────────────────────────────────────────────
function setupPreferences() {
  document.getElementById('setCloseAfterSave').addEventListener('change', async e => {
    await saveSetting('closeAfterSave', e.target.checked);
  });
}

// ── Data center panel ──────────────────────────────────────────────────────
function setupDataCenter() {
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessions: allSessions }, null, 2);
    const blob  = new Blob([data], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = Object.assign(document.createElement('a'), {
      href: url, download: `tabsaver-backup-${new Date().toISOString().slice(0, 10)}.json`
    });
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported!', 'success');
  });

  document.getElementById('btnImport').addEventListener('click', () =>
    document.getElementById('importFile').click());

  document.getElementById('importFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text     = await file.text();
      const data     = JSON.parse(text);
      const imported = Array.isArray(data.sessions) ? data.sessions : (Array.isArray(data) ? data : []);
      if (!imported.length) throw new Error('No sessions found in file.');
      const existing = new Set(allSessions.map(s => s.id));
      const toAdd    = imported.filter(s => !existing.has(s.id));
      allSessions    = [...toAdd, ...allSessions];
      await persistSessions();
      showToast(`Imported ${toAdd.length} session${toAdd.length !== 1 ? 's' : ''}!`, 'success');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  document.getElementById('btnDeleteAll').addEventListener('click', () => {
    pendingAction = { type: 'deleteAll' };
    document.getElementById('deleteModalTitle').textContent = 'Delete All Sessions?';
    document.getElementById('deleteModalBody').textContent  =
      `This will permanently remove all ${allSessions.length} sessions. Cannot be undone.`;
    document.getElementById('deleteModal').classList.remove('hidden');
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800)return 'Yesterday';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escHtml(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg, type = 'success') {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon= document.getElementById('toastIcon');
  toastMsg.textContent = msg;
  toastIcon.className  = type === 'error'
    ? 'ph-fill ph-warning-circle text-red-400'
    : 'ph-fill ph-check-circle text-[#C84028]';
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}
