/* ── Cross-browser extension API layer ─────────────────────────
   Chrome exposes `chrome.*` with methods that return promises when no
   callback is passed. Firefox exposes the same methods twice: `browser.*`
   returns promises, while its `chrome.*` alias is callback-only and returns
   undefined — so `chrome.storage.local.set(obj).then(...)` throws there.

   This file defines `seApi`, a single namespace the rest of the extension
   uses instead of `chrome`. On Chrome it is `chrome` itself, unchanged. On
   Firefox it is a thin wrapper over `browser` whose methods accept EITHER a
   trailing callback or no callback (returning a promise), so one source
   tree runs on both engines.

   Safari needs no wrapper — its `chrome` alias is promise-based and
   complete — so it takes the same path as Chrome. See the scheme check
   below for why that is not detected the obvious way.

   Loaded first: as content_scripts[0].js, as the first popup script, and
   via importScripts (Chrome, Safari) or background.scripts[0] (Firefox).
   Content scripts of the same extension share one sandbox global, so the
   `var` below is visible to content.js. */
var seApi = (function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : self;

  // Detect the engine by its extension URL scheme. The obvious test —
  // "does a live `browser` namespace exist?" — does NOT work: Safari
  // ships `browser` alongside `chrome` and populates browser.runtime.id
  // exactly like Firefox does, so that test sends Safari down the wrapper
  // path even though its `chrome` alias is already promise-based and
  // complete. The scheme is unambiguous:
  //   chrome-extension://          Chrome, Edge, and the other Chromium forks
  //   safari-web-extension://      Safari (macOS, iOS, iPadOS)
  //   moz-extension://             Firefox — the one engine that needs wrapping
  // getURL is synchronous and available in every context this file loads
  // into (content script, popup, background), so this costs nothing.
  const scheme = (() => {
    try { return g.chrome.runtime.getURL(''); } catch (e) { return ''; }
  })();

  const gecko = scheme.startsWith('moz-extension://');

  if (!gecko) return g.chrome;

  const b = g.browser;

  // Accepts a trailing callback (Chrome style) or none (promise style).
  // A rejection is reported to the console and surfaces to the callback as
  // undefined, matching Chrome, which sets runtime.lastError and still runs
  // the callback rather than throwing.
  function dual(fn, ctx) {
    return function (...args) {
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      let out;
      try {
        out = fn.apply(ctx, args);
      } catch (err) {
        if (!cb) return Promise.reject(err);
        console.error('[EarnDark] extension API call failed:', err);
        cb(undefined);
        return undefined;
      }
      if (!cb) return out;
      Promise.resolve(out).then(
        res => cb(res),
        err => { console.error('[EarnDark] extension API call failed:', err); cb(undefined); }
      );
      return undefined;
    };
  }

  const storageArea = area => ({
    get:    dual(area.get, area),
    set:    dual(area.set, area),
    remove: dual(area.remove, area),
    clear:  dual(area.clear, area),
  });

  return {
    runtime: {
      // Synchronous in both engines — must not be promise-wrapped.
      getURL: path => b.runtime.getURL(path),
      get id() { return b.runtime.id; },
      get lastError() { return b.runtime.lastError; },
      onInstalled: b.runtime.onInstalled,
      onMessage: b.runtime.onMessage,
      onStartup: b.runtime.onStartup,
      sendMessage: dual(b.runtime.sendMessage, b.runtime),
    },
    storage: {
      local: storageArea(b.storage.local),
      sync: b.storage.sync ? storageArea(b.storage.sync) : undefined,
      session: b.storage.session ? storageArea(b.storage.session) : undefined,
      onChanged: b.storage.onChanged,
    },
    // tabs and alarms are absent from the content-script sandbox, so they
    // are only wrapped where the engine actually exposes them.
    tabs: b.tabs ? {
      query: dual(b.tabs.query, b.tabs),
      reload: dual(b.tabs.reload, b.tabs),
      sendMessage: dual(b.tabs.sendMessage, b.tabs),
      create: dual(b.tabs.create, b.tabs),
    } : undefined,
    alarms: b.alarms ? {
      create: (...a) => b.alarms.create(...a),  // void, sync in both
      get: dual(b.alarms.get, b.alarms),
      clear: dual(b.alarms.clear, b.alarms),
      onAlarm: b.alarms.onAlarm,
    } : undefined,
  };
})();
