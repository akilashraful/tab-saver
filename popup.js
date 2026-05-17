// popup.js – TabSaver Popup (wired to new dark UI)

// ── DOM refs ───────────────────────────────────────────────────────────────
const btnSaveCurrent   = document.getElementById('btnSaveCurrentTab');
const btnSaveAll       = document.getElementById('btnSaveAllTabs');
const chkClose         = document.getElementById('chkCloseAfterSave');
const sessionsList     = document.getElementById('sessionsList');
const emptyState       = document.getElementById('emptyState');
const tabCountLabel    = document.getElementById('tabCountLabel');
const filterBadge      = document.getElementById('filterBadge');
const filterBadgeText  = document.getElementById('filterBadgeText');
const btnViewAll       = document.getElementById('btnViewAll');
const btnOpenDashboard = document.getElementById('btnOpenDashboard');
const toast            = document.getElementById('toast');
const toastMessage     = document.getElementById('toastMessage');
const toastIcon        = document.getElementById('toastIcon');

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  await loadSettings();
  await refreshTabInfo();
  await renderRecentSessions();
})();

// ── Settings ───────────────────────────────────────────────────────────────
async function loadSettings() {
  const { tabsaver_settings = {} } = await chrome.storage.local.get('tabsaver_settings');
  chkClose.checked = !!tabsaver_settings.closeAfterSave;

  const mode = tabsaver_settings.domainFilterMode || 'none';
  const list = tabsaver_settings.domainFilterList  || [];
  if (mode !== 'none' && list.length) {
    filterBadgeText.textContent = mode === 'exclude'
      ? `Excluding ${list.length} domain${list.length > 1 ? 's' : ''}`
      : `Only: ${list.join(', ').slice(0, 40)}`;
    filterBadge.classList.remove('hidden');
  } else {
    filterBadge.classList.add('hidden');
  }
}

async function saveClosePreference(val) {
  const { tabsaver_settings = {} } = await chrome.storage.local.get('tabsaver_settings');
  tabsaver_settings.closeAfterSave = val;
  await chrome.storage.local.set({ tabsaver_settings });
}

// ── Tab info ───────────────────────────────────────────────────────────────
async function refreshTabInfo() {
  const all = await chrome.tabs.query({});
  tabCountLabel.textContent = `${all.length} tabs're killing a large amount of your memory`;
}

// ── Session cards ──────────────────────────────────────────────────────────
async function renderRecentSessions() {
  const { tabsaver_sessions = [] } = await chrome.storage.local.get('tabsaver_sessions');
  const recent = tabsaver_sessions.slice(0, 4);

  [...sessionsList.children].forEach(c => { if (c !== emptyState) c.remove(); });

  if (!recent.length) { emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');
  recent.forEach(s => sessionsList.insertBefore(buildCard(s), emptyState));
}

function buildCard(session) {
  const div   = document.createElement('div');
  div.className = 'glass-card rounded-xl px-3.5 py-3 flex items-center gap-3 group';

  const date    = new Date(session.savedAt);
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const count   = session.tabs.length;
  const first   = session.tabs[0];
  const isSingle = count === 1;
  const favicon  = isSingle && first?.favIconUrl ? first.favIconUrl : '';
  const iconEl   = session.type === 'auto'
    ? '<i class="ph-fill ph-clock-clockwise text-base text-amber-400"></i>'
    : '<i class="ph-fill ph-browsers text-base text-[#C84028]"></i>';

  const iconHtml = favicon
    ? `<img src="${escHtml(favicon)}" class="favicon-err w-5 h-5 rounded object-contain" alt="">
       <span style="display:none" class="flex items-center justify-center">${iconEl}</span>`
    : iconEl;

  const typeBadge = session.type === 'auto'
    ? `<span class="ml-1 text-[8px] mono uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded align-middle">Auto</span>`
    : '';

  // Show group indicators if any
  const groups = [...new Map(session.tabs.filter(t => t.groupId !== null)
    .map(t => [t.groupId, { title: t.groupTitle, color: t.groupColor }])).values()];

  const groupDots = groups.length
    ? `<span class="flex items-center gap-0.5 ml-1">` +
      groups.slice(0, 3).map(g => {
        const c = GROUP_COLORS[g.color] || '#9aa0a6';
        return `<span style="background:${c}" class="w-1.5 h-1.5 rounded-full inline-block" title="${g.title || 'Group'}"></span>`;
      }).join('') + `</span>`
    : '';

  div.innerHTML = `
    <div class="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-[#C84028]/40 transition-colors">
      ${iconHtml}
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-[12.5px] font-semibold text-white/90 truncate flex items-center">
        <span class="truncate">${escHtml(session.name)}</span>${typeBadge}${groupDots}
      </div>
      <div class="text-[10px] text-slate-500 mono mt-0.5">
        ${count} tab${count !== 1 ? 's' : ''} · ${dateStr} ${timeStr}
      </div>
    </div>
    <button class="restore-btn shrink-0 text-[10px] font-bold text-[#C84028] border border-[#C84028]/30 rounded-lg px-2.5 py-1.5 hover:bg-[#C84028] hover:text-white transition-colors mono uppercase tracking-wide">
      Open
    </button>
  `;

  const faviconImg = div.querySelector('.favicon-err');
  if (faviconImg) {
    faviconImg.addEventListener('error', () => {
      faviconImg.style.display = 'none';
      faviconImg.nextElementSibling.style.display = 'flex';
    });
  }

  div.querySelector('.restore-btn').addEventListener('click', e => {
    e.stopPropagation();
    restoreSession(session.id);
  });

  return div;
}

const GROUP_COLORS = {
  grey:'#9aa0a6', blue:'#4285f4', red:'#ea4335', yellow:'#fbbc04',
  green:'#34a853', pink:'#ff63a5', purple:'#a142f4', cyan:'#24c1e0', orange:'#fa903e',
};

// ── Listeners ──────────────────────────────────────────────────────────────
btnSaveCurrent.addEventListener('click', () => saveSession('current'));
btnSaveAll.addEventListener('click',     () => saveSession('all'));
chkClose.addEventListener('change',      () => saveClosePreference(chkClose.checked));
btnViewAll.addEventListener('click',     openDashboard);
btnOpenDashboard.addEventListener('click', openDashboard);

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
}

// ── Save flow ──────────────────────────────────────────────────────────────
async function saveSession(mode) {
  const name = '';
  const btn  = mode === 'current' ? btnSaveCurrent : btnSaveAll;
  setLoading(btn, true, mode === 'current' ? 'Save Current Tab' : 'Save All Tabs');

  const result = mode === 'current'
    ? await sendMsg({ action: 'saveActiveTab', name })
    : await sendMsg({ action: 'saveAllTabs',   name });

  setLoading(btn, false, mode === 'current' ? 'Save Current Tab' : 'Save All Tabs');

  if (!result?.ok) { showToast(result?.error || 'Could not save.', 'error'); return; }

  showToast(`Saved: "${result.session.name}"`, 'success');
  await renderRecentSessions();
  await refreshTabInfo();

  if (chkClose.checked && result.session.tabIds?.length) {
    await sendMsg({ action: 'closeTabs', tabIds: result.session.tabIds });
    await refreshTabInfo();
  }
}

async function restoreSession(sessionId) {
  const result = await sendMsg({ action: 'restoreSession', sessionId, inNewWindow: false });
  showToast(result?.ok ? 'Session restored!' : (result?.error || 'Restore failed.'),
            result?.ok ? 'success' : 'error');
}

// ── Helpers ────────────────────────────────────────────────────────────────
const sendMsg = msg => chrome.runtime.sendMessage(msg);

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  const span = btn.querySelector('span');
  if (span) span.textContent = loading ? 'Saving…' : label;
}

let toastTimer;
function showToast(msg, type = '') {
  toastMessage.textContent = msg;
  toastIcon.className = type === 'error'
    ? 'ph-fill ph-warning-circle text-red-400'
    : 'ph-fill ph-check-circle text-[#C84028]';
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function escHtml(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

