# Chrome Web Store listing — Superteam Earn Dark

Copy/paste these fields into the Chrome Web Store Developer Dashboard.

---

## Name (≤ 45 chars)
Superteam Earn Dark

## Summary / short description (≤ 132 chars)
Full customization for Superteam Earn — dark mode, named themes, per-element colors, wallpaper, fonts, section hiding.

## Category
Productivity (alt: Accessibility)

## Language
English

## Support URL
https://github.com/deviverr/superteam-dark/issues

---

## Detailed description

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

★ PRIVATE BY DESIGN
No accounts, no tracking, no analytics, no network calls. Every setting is stored
locally on your device. The extension runs only on Superteam Earn pages.

Built with care for the Superteam community.

---

## Permission justifications (for the review form)

- **storage** — Persist the user's theme and customization settings locally.
- **alarms** — Periodically re-evaluate time-based (scheduled) dark mode.
- **Host permission (`*://superteam.fun/earn*`)** — Inject the dark theme CSS and
  the navbar toggle on Superteam Earn pages. The extension does not run on any
  other site.

> Note: this build intentionally does **not** request the broad `tabs`
> permission. Theme changes propagate to open Earn tabs via `storage.onChanged`
> and host-scoped messaging, so no browsing-history access is needed.

## Single purpose (required statement)
The single purpose of this extension is to let users customize the visual
appearance — theme colors, dark mode, wallpaper, font size, and layout —
of the Superteam Earn website (superteam.fun/earn).

## Data usage disclosures (Privacy practices tab)
- Does the item collect or use personal/sensitive user data? **No.**
- Remote code? **No** — all code is bundled in the package.
- Privacy policy URL: https://github.com/deviverr/superteam-dark/blob/main/store/PRIVACY.md
  (repo is public; GitHub renders this file directly — paste this URL as-is into the dashboard field.)

---

## Required graphics checklist
- [x] **Store icon** — 128×128 PNG → `icons/icon128.png`
- [x] **Screenshots** — 1280×800 PNG, in `store/screenshots/`, upload in this order:
  1. `01-home-dark.png` — Earn home in dark mode, navbar toggle visible
  2. `02-theme-menu.png` — theme menu open showing the 8 preset swatches
  3. `03-popup-customize.png` — popup Customize tab over a dimmed page
  4. `04-listing-dracula.png` — a bounty listing under the Dracula preset
  5. `05-wallpaper.png` — grants page with a wallpaper applied
- [ ] **Small promo tile** — 440×280 PNG (optional but recommended)
- [ ] **Marquee promo** — 1400×560 PNG (optional)

## Pre-submission checklist
- [x] Automated pass on Chrome 152 against the live site — 89 assertions, 0 failures:
      7 pages in dark mode, all 8 presets, light-mode non-interference, 390px
      mobile, SPA per-page overrides, popup dialogs and theme CRUD, wallpaper
      rendering and URL probing, toolbar interactions
- [x] Package verified byte-identical to source; 12 files, no dev assets included
- [ ] Load `dist/chrome/unpacked/` via chrome://extensions → "Load unpacked"
      and smoke-test on superteam.fun/earn
- [ ] Push the repo so the privacy-policy URL serves the current file
- [ ] Upload zip, fill fields above, attach the 5 screenshots, submit for review

## Resolved in 1.7 (was the 1.6 known issue)
The intermittent low-contrast reading on the "Become a Sponsor" hero slide is
fixed. Root cause: the logged-out home hero is a shadcn carousel whose slides
supply their own artwork and foreground palette (a light `#00CCFE → #A6EDFF`
gradient with black text, and a photographic banner with white text). The
global token rules were recolouring those foregrounds while leaving the slide
backgrounds untouched. Slides are now excluded from the token, generic-button
and arbitrary-hex rules, so they render as the site draws them.
