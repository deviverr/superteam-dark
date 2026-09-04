/* ── Background ────────────────────────────────────────────────
   Runs as an MV3 service worker on Chrome and as an MV3 event page on
   Firefox (which has no service-worker background, and none at all on
   Android). Both are non-persistent, so every listener below is
   registered synchronously at top level.

   `seApi` comes from shared/browser-compat.js: Firefox lists it as
   background.scripts[0], which puts it in this same global; Chrome loads
   only this file, so it is pulled in here instead. */
if (typeof seApi === 'undefined') importScripts('/shared/browser-compat.js');

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
seApi.runtime.onInstalled.addListener(() => {
  seApi.storage.local.get(Object.keys(DEFAULTS), existing => {
    const toSet = {};
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (existing[k] === undefined) toSet[k] = v;
    }
    if (Object.keys(toSet).length) seApi.storage.local.set(toSet);
  });

  seApi.alarms.create('se-time-check', { periodInMinutes: 1 });
});

// Re-create alarm on service worker startup (survives browser restarts)
seApi.alarms.get('se-time-check', alarm => {
  if (!alarm) seApi.alarms.create('se-time-check', { periodInMinutes: 1 });
});

// Alarm: notify tabs to re-evaluate time-based dark mode
seApi.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'se-time-check') return;
  seApi.storage.local.get(['mode'], stored => {
    if (stored.mode !== 'time') return;
    notifyAllTabs();
  });
});

// NOTE: Storage changes are handled directly by the content script's
// own seApi.storage.onChanged listener (50ms debounce). The service
// worker does NOT re-broadcast them to avoid double re-application.

// Scoped by URL, with exactly the patterns from host_permissions.
//
// Safari only exposes `tab.url` for tabs the extension holds host
// permission for, so the older shape — query({}) for everything, then
// filter the results on `tab.url.includes(...)` — matched nothing there:
// the urls it tested had been stripped out. Filtering in the query itself
// behaves the same on every engine.
//
// The patterns have to MATCH the granted permission, not just be present:
// a filter broader than host_permissions is silently narrowed back down to
// what was granted. These are the tabs the content script runs in anyway,
// which are the only ones with a listener for the message.
const EARN_TABS = { url: ['*://superteam.fun/earn*', '*://*.superteam.fun/earn*'] };

function notifyAllTabs() {
  seApi.tabs.query(EARN_TABS, tabs => {
    for (const tab of tabs) {
      seApi.tabs.sendMessage(tab.id, { type: 'SE_APPLY' }).catch(() => {});
    }
  });
}
