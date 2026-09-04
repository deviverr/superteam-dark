# addons.mozilla.org submission pack — Superteam Earn Dark

Everything needed to publish on AMO, ready to paste. Submit at
https://addons.mozilla.org/developers/addon/submit/distribution

Package: `dist/firefox/superteam-earn-dark-firefox-1.7.1.zip`
Validator: `npx web-ext lint --source-dir dist/firefox/unpacked` — **0 errors,
0 warnings, 0 notices**.

---

## 1. Distribution

**On this site** (listed on AMO). Choose "On your own" only for pre-release
Android testing, which produces a signed `.xpi` you install by hand.

## 2. Name (≤ 50 chars)
```
Superteam Earn Dark
```

## 3. Add-on URL slug
```
superteam-earn-dark
```

## 4. Summary (≤ 250 chars)
```
Full customization for Superteam Earn — dark mode, 8 presets, named custom themes, per-element colors, wallpaper, font size, and section hiding. Works on Firefox for desktop and Android.
```

## 5. Description

Paste as-is. AMO's editor accepts plain text with blank lines between
paragraphs; the ★ headings survive fine.

```
Superteam Earn Dark is a full customization system for superteam.fun/earn —
bounties, projects, grants, profiles, leaderboards and everything in between.
Dark mode is the foundation; on top of it you get complete control over color,
wallpaper, layout, and what's visible on the page.

★ FULL CUSTOMIZATION, EVERY SURFACE
- Per-element color control — background, borders, text, muted text, accent,
  and links — applied consistently across the whole site, with live preview
- Create your own named custom themes, keep as many as you like, and switch
  between them alongside the 8 built-in presets
- Custom wallpaper with opacity control — upload your own image, or point
  it at a URL (Earn's security policy only permits some remote images, so
  uploading is the reliable route and the extension tells you if a URL is
  refused)
- Adjustable font size
- One-click reset back to factory defaults whenever you want a clean slate

★ 8 BEAUTIFUL PRESET THEMES TO START FROM
GitHub Dark, AMOLED (true black for OLED screens), Nord, Dracula, Catppuccin,
Tokyo Night, Gruvbox, and One Dark. Pick one as-is, or use it as a starting
point for your own custom theme.

★ DARK MODE, DONE RIGHT
A sun/moon button is added to the Earn top bar so you can flip dark mode on or
off instantly — plus a theme-menu button to switch presets and your saved
themes without opening the popup.

★ SMART SWITCHING
- Manual toggle
- Follow your system light/dark setting
- Schedule dark mode by time of day

★ DECLUTTER, PAGE BY PAGE
Hide the nav bar, sidebar, banners, or footer — globally, or with per-page-type
overrides (bounties, grants, profiles, and more).

★ WORKS ON YOUR PHONE
Runs on Firefox for Android as well as desktop. The customization panel opens
full-screen with touch-sized controls, and the in-page theme button sits in
Earn's own mobile top bar. On Android, reach the panel from ⋮ → Extensions.

★ PRIVATE BY DESIGN
No accounts, no tracking, no analytics, no network calls. Every setting is
stored locally on your device. The extension runs only on Superteam Earn pages.

Built with care for the Superteam community.
```

## 6. Categories
- **Firefox:** Appearance
- **Android:** Appearance

## 7. Tags (up to 5)
```
dark mode, dark theme, superteam, solana, customization
```

## 8. URLs
| Field | Value |
|---|---|
| Homepage | https://github.com/deviverr/superteam-dark |
| Support site | https://github.com/deviverr/superteam-dark/issues |
| Privacy policy | https://github.com/deviverr/superteam-dark/blob/main/store/PRIVACY.md |

The privacy-policy URL only resolves once the repo is pushed public — do that
before submitting, or AMO reviewers hit a 404. AMO also accepts the policy
pasted into a text field instead; the body of `store/PRIVACY.md` is fine as-is.

## 9. Screenshots

`store/screenshots/`, upload in this order. Captions are optional on AMO but
help; suggested text below.

| # | File | Caption |
|---|---|---|
| 1 | `01-home-dark.png` | Earn's home page in dark mode, with the theme buttons in the top bar |
| 2 | `02-theme-menu.png` | Switch presets from the page itself — 8 built in, plus your saved themes |
| 3 | `03-popup-customize.png` | Per-element color control with live preview |
| 4 | `04-listing-dracula.png` | A bounty listing under the Dracula preset |
| 5 | `05-wallpaper.png` | Your own wallpaper, with adjustable opacity |

These are desktop captures at 1280×800. AMO has no size requirement and does
not require Android-specific shots, but adding one or two phone captures is
worth it once you have the add-on installed on a device.

## 10. Icon
`icons/icon128.png` (128×128) is read from the package — nothing to upload.

---

## Data collection disclosure

Asked in **both** the submission form and the manifest, and review bounces if
they disagree.

- **Form:** "Does this add-on collect data?" → **No**
- **Manifest** (already set in `manifest.firefox.json`):
  ```json
  "data_collection_permissions": { "required": ["none"] }
  ```

Mandatory for all new add-ons since 3 November 2025.

## Permission justifications

AMO asks about anything beyond the ordinary. Answers:

| Permission | Why |
|---|---|
| `storage` | Persist the user's theme and customization settings locally. |
| `alarms` | Re-evaluate the clock for time-based (scheduled) dark mode. |
| `host_permissions: *://superteam.fun/earn*` | Inject the theme CSS and the top-bar toggle. The add-on runs on no other site. |

The build deliberately does **not** request `tabs`. Theme changes reach open Earn
tabs through `storage.onChanged` and host-scoped messaging, so no
browsing-history access is needed.

---

## Notes for reviewers

Paste into "Notes to reviewer". This answers what a human reviewer would
otherwise have to write in and ask.

```
Source is shipped as-is — no bundler, minifier, or transpiler. The files in the
uploaded package are the complete, readable source; there is no build step to
reproduce. (store/build.py only copies these files into a zip.)

The add-on makes no network requests of its own. Every setting is stored via
storage.local and never leaves the device. The only remote resource that can
ever load is a wallpaper image whose URL the user typed into the popup
themselves, which the browser fetches directly.

shared/browser-compat.js exists so one source tree runs on Firefox and Chrome.
Firefox's chrome.* alias is callback-only, while this code — shared with the
Chrome build — also calls the same methods promise-style. The file wraps
browser.* so both call styles work, and is a no-op passthrough on Chrome.

There are no innerHTML assignments with dynamic input. The toolbar's SVG icons
are parsed with DOMParser from string literals defined in the same file, and
user-supplied values (saved theme names) are set with textContent only.

assets/solana-dark-logo.svg is declared web-accessible because it is swapped in
for the site's own "Powered by Solana" badge through CSS on the page. It is a
static image with no script content.
```

---

## Version compatibility

| Target | Minimum | Why |
|---|---|---|
| Firefox desktop | 140.0 | `data_collection_permissions` landed in 140 |
| Firefox for Android | 142.0 | the same key landed on Android in 142 |

Nothing else needs a version that recent — MV3 with an event-page background
and the `web_accessible_resources` match-pattern form are both supported well
below it. If Mozilla ever makes the key optional, both can drop to 128.0.

---

## Submission checklist

- [x] `python store/build.py firefox` → `dist/firefox/superteam-earn-dark-firefox-1.7.1.zip`
- [x] `npx web-ext lint --source-dir dist/firefox/unpacked` → 0 / 0 / 0
- [x] Manifest version matches across all manifests (the build enforces it)
- [x] Data collection declared as `none` in the manifest
- [x] Tested on Firefox desktop via about:debugging on the live site
- [ ] Push the repo public so the privacy-policy URL resolves
- [ ] Upload the zip, fill in every field above, attach the 5 screenshots
- [ ] Answer the data-collection question as **No**
- [ ] Paste the reviewer notes
- [ ] Submit — first review of a new add-on typically takes a few days
- [ ] After approval: install on Android from the AMO page and re-check the
      touch layout (see `store/FIREFOX.md`)

## After it is listed

The `gecko.id` — `superteam-earn-dark@dedpul3000a.dev` — is the add-on's
permanent identity. Once a version is uploaded under it, changing it makes a
different add-on that no existing user is upgraded to. Never change it.

Later versions can be pushed from the CLI instead of the web form:

```sh
npx web-ext sign --source-dir dist/firefox/unpacked \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET" \
  --channel listed
```

Credentials: https://addons.mozilla.org/developers/addon/api/key/
