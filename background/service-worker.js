const DEFAULTS = {
  mode: 'manual',
  darkEnabled: false,
  timeStart: '21:00',
  timeEnd: '07:00',
  'custom.bgColor': null,
  'custom.bg2Color': null,
  'custom.bg3Color': null,
  'custom.borderColor': null,
  'custom.textColor': null,
  'custom.mutedColor': null,
  'custom.accentColor': null,
  'custom.fontSize': 16,
  'custom.hideSections.nav': false,
  'custom.hideSections.sidebar': false,
  'custom.hideSections.banner': false,
  'custom.hideSections.footer': false,
  'custom.wallpaperUrl': null,
  'custom.wallpaperOpacity': 0.15,
  'custom.pageOverrides': {},
  'custom.savedThemes': [],
};

// On install: set defaults only for keys that don't exist yet
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULTS), existing => {
    const toSet = {};
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (existing[k] === undefined) toSet[k] = v;
    }
    if (Object.keys(toSet).length) chrome.storage.local.set(toSet);
  });

  chrome.alarms.create('se-time-check', { periodInMinutes: 1 });
});

// Re-create alarm on service worker startup (survives browser restarts)
chrome.alarms.get('se-time-check', alarm => {
  if (!alarm) chrome.alarms.create('se-time-check', { periodInMinutes: 1 });
});

// Alarm: notify tabs to re-evaluate time-based dark mode
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'se-time-check') return;
  chrome.storage.local.get(['mode'], stored => {
    if (stored.mode !== 'time') return;
    notifyAllTabs();
  });
});

// NOTE: Storage changes are handled directly by the content script's
// own chrome.storage.onChanged listener (50ms debounce). The service
// worker does NOT re-broadcast them to avoid double re-application.

function notifyAllTabs() {
  chrome.tabs.query({}, tabs => {
    for (const tab of tabs) {
      if (tab.url && tab.url.includes('superteam.fun')) {
        chrome.tabs.sendMessage(tab.id, { type: 'SE_APPLY' }).catch(() => {});
      }
    }
  });
}
