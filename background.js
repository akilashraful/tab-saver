// background.js – TabSaver Service Worker (Manifest V3)

const TAB_GROUP_NONE = -1;

const DEFAULT_SETTINGS = {
  autoSaveEnabled:    false,
  autoSaveInterval:   30,
  closeAfterSave:     false,
  autoSaveKeepCount:  10,
  domainFilterMode:   'none',   // 'none' | 'exclude' | 'include'
  domainFilterList:   []
};

// ── Install ───────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const { tabsaver_settings } = await chrome.storage.local.get('tabsaver_settings');
  if (!tabsaver_settings) {
    await chrome.storage.local.set({ tabsaver_settings: DEFAULT_SETTINGS });
  }
  const s = tabsaver_settings || DEFAULT_SETTINGS;
  if (s.autoSaveEnabled) scheduleAutoSave(s.autoSaveInterval);
});

// ── Alarm ─────────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tabsaver_autosave') autoSaveTabs();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async command => {
  if (command === 'save-current-tab') {
    await saveActiveTab('');
  } else if (command === 'open-dashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});

// ── Messages ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.action) {
      case 'updateAutoSave':
        if (msg.enabled) scheduleAutoSave(msg.interval);
        else chrome.alarms.clear('tabsaver_autosave');
        sendResponse({ ok: true });
        break;
      case 'saveActiveTab':
        sendResponse(await saveActiveTab(msg.name));
        break;
      case 'saveAllTabs':
        sendResponse(await saveAllTabs(msg.name));
        break;
      case 'closeTabs':
        await closeTabs(msg.tabIds);
        sendResponse({ ok: true });
        break;
      case 'restoreSession':
        sendResponse(await restoreSession(msg.sessionId, msg.inNewWindow));
        break;
      case 'restoreTab':
        sendResponse(await restoreSingleTab(msg.url, msg.inNewWindow));
        break;
      default:
        sendResponse({ ok: false, error: 'Unknown action' });
    }
  })();
  return true;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function scheduleAutoSave(mins) {
  chrome.alarms.create('tabsaver_autosave', { periodInMinutes: mins });
}

function generateName(prefix = 'Session') {
  const now = new Date();
  return `${prefix} – ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function isSaveable(t) {
  return t.url &&
    !t.url.startsWith('chrome://') &&
    !t.url.startsWith('chrome-extension://') &&
    !t.url.startsWith('about:');
}

function toTabShape(t) {
  return {
    tabId:      t.id,
    windowId:   t.windowId,
    title:      t.title      || 'Untitled',
    url:        t.url,
    favIconUrl: t.favIconUrl || '',
    savedAt:    new Date().toISOString(),   // ← per-tab save timestamp
    groupId:    (typeof t.groupId === 'number' && t.groupId !== TAB_GROUP_NONE) ? t.groupId : null
  };
}

// Extract the registrable domain (e.g. "sub.example.com" → "example.com")
function getDomain(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

// Returns true if `domain` matches or is a subdomain of `entry`
function domainMatches(domain, entry) {
  entry = entry.toLowerCase().trim();
  return domain === entry || domain.endsWith('.' + entry);
}

// Apply the user's domain filter to a list of tab shapes.
// mode 'exclude': drop tabs whose domain is in the list
// mode 'include': keep only tabs whose domain is in the list
// mode 'none'   : return all tabs unchanged
function applyDomainFilter(tabs, settings) {
  const mode = settings.domainFilterMode || 'none';
  const list = settings.domainFilterList || [];
  if (mode === 'none' || !list.length) return tabs;
  return tabs.filter(t => {
    const d   = getDomain(t.url);
    const hit = list.some(entry => domainMatches(d, entry));
    return mode === 'exclude' ? !hit : hit;
  });
}

async function getSettings() {
  const { tabsaver_settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('tabsaver_settings');
  return { ...DEFAULT_SETTINGS, ...tabsaver_settings };
}

// Resolve Chrome tab group metadata for all unique groupIds in the tab list
async function resolveGroups(tabs) {
  const ids = [...new Set(tabs.map(t => t.groupId).filter(id => id !== null))];
  const map = {};
  for (const gid of ids) {
    try {
      const g = await chrome.tabGroups.get(gid);
      map[gid] = { title: g.title || '', color: g.color || 'grey' };
    } catch (_) {
      map[gid] = { title: '', color: 'grey' };
    }
  }
  return map;
}

// Build storable tab records, embedding group metadata
function buildTabRecords(tabs, groupMap) {
  return tabs.map(t => ({
    title:      t.title,
    url:        t.url,
    favIconUrl: t.favIconUrl,
    savedAt:    t.savedAt,
    groupId:    t.groupId,
    groupTitle: (t.groupId !== null && groupMap[t.groupId]) ? groupMap[t.groupId].title : null,
    groupColor: (t.groupId !== null && groupMap[t.groupId]) ? groupMap[t.groupId].color : null,
  }));
}

async function persistSession(session) {
  const { tabsaver_sessions = [] } = await chrome.storage.local.get('tabsaver_sessions');
  tabsaver_sessions.unshift(session);
  const s    = await getSettings();
  const keep = s.autoSaveKeepCount || 10;
  const manual = tabsaver_sessions.filter(x => x.type === 'manual');
  let   auto   = tabsaver_sessions.filter(x => x.type === 'auto');
  if (auto.length > keep) auto = auto.slice(0, keep);
  await chrome.storage.local.set({ tabsaver_sessions: [...manual, ...auto] });
  return session;
}

// ── Save: single active tab ───────────────────────────────────────────────────
async function saveActiveTab(name = '') {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (!active || !isSaveable(active)) {
    return { ok: false, error: 'This tab cannot be saved (it may be a browser page).' };
  }

  const settings = await getSettings();
  const tab      = toTabShape(active);

  // Apply domain filter even to a single tab
  const filtered = applyDomainFilter([tab], settings);
  if (!filtered.length) {
    const mode = settings.domainFilterMode;
    const msg  = mode === 'exclude'
      ? `${getDomain(tab.url)} is on your exclude list.`
      : `${getDomain(tab.url)} is not on your include list.`;
    return { ok: false, error: `Tab not saved — ${msg}` };
  }

  const groupMap = await resolveGroups([tab]);

  const session = {
    id:      `ses_${Date.now()}`,
    // Use the page title as session name (trimmed to 80 chars), fallback to input or timestamp
    name:    name.trim() || (active.title ? active.title.slice(0, 80) : generateName('Tab')),
    savedAt: tab.savedAt,   // same as the tab's per-tab timestamp
    type:    'manual',
    tags:    [],
    tabIds:  [tab.tabId],
    tabs:    buildTabRecords([tab], groupMap)
  };

  await persistSession(session);
  return { ok: true, session };
}

// ── Save: all tabs across every open window ───────────────────────────────────
async function saveAllTabs(name = '') {
  const settings     = await getSettings();
  const allChromeTabs = await chrome.tabs.query({});
  const raw          = allChromeTabs.filter(isSaveable).map(toTabShape);
  const tabs         = applyDomainFilter(raw, settings);

  if (!tabs.length) {
    if (raw.length && settings.domainFilterMode !== 'none') {
      return { ok: false, error: 'All tabs were filtered out by your domain filter.' };
    }
    return { ok: false, error: 'No saveable tabs found.' };
  }

  const groupMap = await resolveGroups(tabs);

  const session = {
    id:      `ses_${Date.now()}`,
    name:    name.trim() || generateName('All Tabs'),
    savedAt: new Date().toISOString(),
    type:    'manual',
    tags:    [],
    tabIds:  tabs.map(t => t.tabId),
    tabs:    buildTabRecords(tabs, groupMap)
  };

  await persistSession(session);
  return { ok: true, session };
}

// ── Auto-save ─────────────────────────────────────────────────────────────────
async function autoSaveTabs() {
  const settings      = await getSettings();
  const allChromeTabs = await chrome.tabs.query({});
  const raw           = allChromeTabs.filter(isSaveable).map(toTabShape);
  const tabs          = applyDomainFilter(raw, settings);
  if (!tabs.length) return;
  const groupMap = await resolveGroups(tabs);
  const session = {
    id:      `ses_auto_${Date.now()}`,
    name:    generateName('Auto-Save'),
    savedAt: new Date().toISOString(),
    type:    'auto',
    tags:    [],
    tabIds:  tabs.map(t => t.tabId),
    tabs:    buildTabRecords(tabs, groupMap)
  };
  await persistSession(session);
}

// ── Close / Restore ───────────────────────────────────────────────────────────
async function closeTabs(tabIds) {
  if (!tabIds?.length) return;
  try { await chrome.tabs.remove(tabIds); } catch (_) {}
}

async function restoreSession(sessionId, inNewWindow = false) {
  const { tabsaver_sessions = [] } = await chrome.storage.local.get('tabsaver_sessions');
  const session = tabsaver_sessions.find(s => s.id === sessionId);
  if (!session) return { ok: false, error: 'Session not found.' };
  const urls = session.tabs.map(t => t.url).filter(Boolean);
  if (!urls.length) return { ok: false, error: 'No URLs to restore.' };
  if (inNewWindow) {
    await chrome.windows.create({ url: urls });
  } else {
    const current = await chrome.windows.getCurrent();
    for (const url of urls) await chrome.tabs.create({ windowId: current.id, url });
  }
  return { ok: true };
}

async function restoreSingleTab(url, inNewWindow = false) {
  if (inNewWindow) {
    await chrome.windows.create({ url });
  } else {
    const current = await chrome.windows.getCurrent();
    await chrome.tabs.create({ windowId: current.id, url });
  }
  return { ok: true };
}
