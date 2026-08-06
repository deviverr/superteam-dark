# Chrome Web Store listing — Superteam Earn Dark

Copy/paste these fields into the Chrome Web Store Developer Dashboard.

---

## Name (≤ 45 chars)
Superteam Earn Dark

## Summary / short description (≤ 132 chars)
True dark mode for Superteam Earn — quick navbar toggle, 8 themes, custom colors, wallpaper, and per-page controls.

## Category
Productivity (alt: Accessibility)

## Language
English

---

## Detailed description

Make Superteam Earn easy on the eyes. Superteam Earn Dark adds a proper,
fully-themed dark mode to superteam.fun/earn — bounties, projects, grants,
profiles, leaderboards and everything in between.

★ ONE-CLICK TOGGLE, RIGHT IN THE NAVBAR
A sun/moon button is added to the Earn top bar so you can flip dark mode on or
off instantly — plus a palette button to switch themes without opening the popup.

★ 8 BEAUTIFUL PRESET THEMES
GitHub Dark, AMOLED (true black for OLED screens), Nord, Dracula, Catppuccin,
Tokyo Night, Gruvbox, and One Dark. Pick one and the whole site adopts its full
palette — backgrounds, borders, text, and accent.

★ FULL CUSTOMIZATION
- Custom background, text, and accent colors with live preview
- Adjustable font size
- Custom wallpaper (URL or upload) with opacity control
- Swap in your own logo

★ SMART SWITCHING
- Manual toggle
- Follow your system light/dark setting
- Schedule dark mode by time of day

★ DECLUTTER
Hide the nav bar, sidebar, banners, or footer — globally or per page type
(bounties, grants, profiles, and more). A built-in Reading mode widens content
and improves line spacing for long listings.

★ PRIVATE BY DESIGN
No accounts, no tracking, no analytics, no network calls. Every setting is stored
locally on your device. The extension runs only on Superteam Earn pages.

Built with care for the Superteam community. Tips: https://ko-fi.com/deviver

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
The single purpose of this extension is to apply a customizable dark theme to the
Superteam Earn website (superteam.fun/earn).

## Data usage disclosures (Privacy practices tab)
- Does the item collect or use personal/sensitive user data? **No.**
- Remote code? **No** — all code is bundled in the package.
- Privacy policy URL: host `store/PRIVACY.md` publicly (e.g. GitHub) and paste the URL.

---

## Required graphics checklist
- [ ] **Store icon** — 128×128 PNG → use `icons/icon128.png` ✅ (already present)
- [ ] **Screenshots** — 1280×800 or 640×400 PNG/JPEG, 1–5 images. Suggested set:
  1. Earn home in dark mode with the navbar sun/moon toggle visible
  2. Theme menu open showing the 8 preset swatches
  3. Popup → Customize tab (colors + presets)
  4. A bounty listing in dark mode (reading mode on)
  5. Wallpaper applied
- [ ] **Small promo tile** — 440×280 PNG (optional but recommended)
- [ ] **Marquee promo** — 1400×560 PNG (optional)

## Pre-submission checklist
- [ ] Load `dist/superteam-earn-dark-1.2.0.zip` via chrome://extensions →
      "Load unpacked" (unzip first) and smoke-test on superteam.fun/earn
- [ ] Confirm navbar toggle + theme menu appear and persist across navigation
- [ ] Confirm all 8 presets fully recolor the page
- [ ] Upload zip, fill fields above, set visibility, submit for review
