# Firefox port — how it works, how to test it, how to ship it

The Firefox build is the **same code** as the Chrome build. There is one
source tree; the two targets differ only in their manifest and in a small
compatibility shim.

---

## What differs between the two targets

| | Chrome | Firefox |
|---|---|---|
| Manifest file | `manifest.json` | `manifest.firefox.json` (zipped **as** `manifest.json`) |
| Background | `background.service_worker` | `background.scripts` (event page) |
| Add-on identity | assigned by the store | `browser_specific_settings.gecko.id` |
| Data disclosure | store form only | also `gecko.data_collection_permissions` |
| Everything else | identical | identical |

Firefox has no service-worker background — and on Android no background
service worker exists at all — so it uses a non-persistent event page.
`background/service-worker.js` is written to work as either: every listener is
registered synchronously at top level, and nothing in it is service-worker
specific.

### The compatibility shim

`shared/browser-compat.js` defines `seApi`, which the rest of the extension
uses in place of `chrome`.

The problem it solves: Chrome's `chrome.*` methods return a promise when no
callback is passed. Firefox exposes the same methods twice — `browser.*`
returns promises, but its `chrome.*` alias is **callback-only and returns
undefined**. This code base uses both styles (`storage.local.get(keys, cb)` in
the content script, `storage.local.set(obj).then(...)` in the popup), so on
Firefox the promise-style calls would throw `TypeError: ... .then is not a
function`.

`seApi` wraps `browser.*` in methods that accept either style. On Chrome — and
on Safari — it is literally `chrome`, unchanged.

The shim identifies the engine by its extension URL scheme
(`chrome.runtime.getURL('')` → `moz-extension://` only on Firefox). The
tempting shortcut — "does a live `browser.runtime.id` exist?" — is **wrong**:
Safari ships `browser` alongside `chrome` and populates `runtime.id` exactly
like Firefox, so that test would push Safari down the wrapper path even though
its `chrome` alias is already promise-based and complete.

It is loaded first in all three contexts: `content_scripts[0].js`, the first
`<script>` in `popup.html`, and `background.scripts[0]` (Firefox) or via
`importScripts` (Chrome — the service worker loads only one file, so it pulls
the shim in itself).

### Mobile

Two changes, both in CSS, both engine-agnostic:

- `popup.css` — the popup is a fixed 320px column on desktop. Firefox for
  Android presents it at device width instead, so a `min-width: 360px` query
  fills the viewport, raises hit targets to 44px, and lets the tab panel run
  to the bottom instead of stopping at its desktop 480px cap.
- `dark.css` — a `pointer: coarse` query grows the in-page toolbar buttons to
  40px, scales the theme menu to fit a narrow viewport, and keeps the
  hover-dependent affordances visible.

`pointer: coarse` rather than a width breakpoint, so a narrow desktop window
keeps the compact toolbar it was designed for.

---

## Building

```sh
python store/build.py            # both targets
python store/build.py firefox    # just the Firefox zip
python store/build.py chrome     # just the Chrome zip
```

Output — one folder per target, so the two stores' packages can never be
mixed up, plus an unpacked copy of each for loading directly:

```
dist/chrome/superteam-earn-dark-<version>.zip           → Chrome Web Store
dist/chrome/unpacked/                                   → chrome://extensions
dist/firefox/superteam-earn-dark-firefox-<version>.zip  → addons.mozilla.org
dist/firefox/unpacked/                                  → about:debugging
```

The unpacked folders exist because `about:debugging` and `web-ext run` both
need a directory holding a file literally named `manifest.json`, which the
repo root only has for Chrome. They are rewritten from scratch on every build.

The build fails if the two manifests disagree on `version` — bump both.

## Linting

Mozilla's own validator; this must be clean before every AMO upload.

```sh
npx web-ext lint --source-dir dist/firefox/unpacked
```

Currently: **0 errors, 0 warnings, 0 notices.**

---

## Testing on desktop

Temporary install (survives until the browser closes, no signing needed):

1. `python store/build.py firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…**
4. Pick `dist/firefox/unpacked/manifest.json`
5. Visit `https://superteam.fun/earn`

The add-on stays loaded until the browser closes. After a code change, rebuild
and hit **Reload** on its entry in `about:debugging`.

Or, in a scratch profile driven from the CLI:

```sh
store/run-firefox.sh
```

Run that from a normal interactive terminal. Firefox needs macOS GUI
entitlements that a sandboxed or background shell does not have — there it
starts, never initializes its profile, and never opens the debugger port
(`ECONNREFUSED`, alongside `sandbox_extension_issue_file_to_process failed:
Operation not permitted`). The script also sets `MOZ_NO_REMOTE`, without which
macOS hands the launch to an already-running Firefox and web-ext's own
instance silently never appears.

### What to check
- Dark mode applies at `document_start` with no flash of the light page
- The theme button appears in Earn's top bar; the menu lists 8 presets
- Switching presets restains the page and the button's own gradient icon
- The popup's every tab works, and a color change previews live on the page
- Saved themes: create, rename, delete, and apply from both popup and toolbar
- The Solana badge image loads (it is a `moz-extension://` URL applied to the
  page through content-script CSS — the one thing whose CSP treatment differs
  most between engines; if it silently stays light, that is the cause)
- Scheduled (time-based) dark mode still flips at the boundary, which is what
  proves the event page is waking on its alarm
- Per-page overrides follow SPA navigation between Earn's routes

## Testing on Android

Firefox for Android installs extensions **only from AMO**, so a local zip
cannot be side-loaded into release Firefox. Two routes:

**A — after the add-on is listed (simplest).** Install it from its AMO page
in Firefox for Android. Use an unlisted/beta channel upload if you want to
test before the public listing goes live.

**B — before listing, via Firefox for Android Nightly.** Nightly can install
a custom AMO collection:

1. AMO → **Collections** → create one → add the add-on (needs at least one
   uploaded version, listed or unlisted).
2. Nightly → **Settings → About Firefox** → tap the logo 5× to enable the
   debug menu.
3. **Settings → Install add-on from file** is *not* the path — use
   **Settings → Custom Add-on collection**, entering your AMO user ID and the
   collection name.
4. The add-on then appears in **⋮ → Extensions**.

Alternatively `web-ext run -t firefox-android` drives a USB-connected device
with Nightly and ADB, which is the fastest loop for iterating.

### What to check on Android
- The popup opens as a full page and fills the screen — no 320px column
  stranded on the left, no clipped right edge
- Every tab in the popup scrolls to its end
- The in-page theme button is reachable in Earn's mobile top bar and its menu
  does not overflow the screen
- With "Hide nav" on, the floating fallback toolbar clears the URL bar
- Tapping a preset, a swatch, and the opacity slider all land on first touch

---

## Signing and submitting

```sh
npx web-ext sign --source-dir dist/firefox/unpacked \
  --api-key  "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET" \
  --channel listed
```

API credentials come from https://addons.mozilla.org/developers/addon/api/key/.
`--channel unlisted` produces a self-distributable signed `.xpi` instead, which
is also what you want for pre-listing Android testing.

Listing copy lives in `store/AMO_LISTING.md`; the privacy policy AMO links to
is `store/PRIVACY.md`.

The `gecko.id` (`superteam-earn-dark@dedpul3000a.dev`) is the add-on's
permanent identity — once a version is uploaded under it, it can never change
without becoming a different add-on to every installed user.
