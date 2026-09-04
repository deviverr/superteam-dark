# App Store listing — Superteam Earn Dark (Safari)

Fields for App Store Connect. The product copy is deliberately identical to
`STORE_LISTING.md` — same extension, same features — so only the fields Apple
asks for differently are spelled out here.

One record covers both platforms: the generated project is a universal app
with macOS and iOS/iPadOS targets.

---

## App Name (≤ 30 chars)
Superteam Earn Dark

## Subtitle (≤ 30 chars)
Dark mode & themes for Earn

## Promotional text (≤ 170 chars)
Dark mode for Superteam Earn, plus 8 presets, saved custom themes, per-element
colors, wallpapers, font scaling and section hiding. Nothing leaves your device.

## Category
- Primary: **Developer Tools**
- Secondary: **Utilities**

## Keywords (≤ 100 chars, comma-separated, no spaces)
dark,darkmode,theme,superteam,earn,solana,web3,bounty,safari,extension

## Support URL
https://github.com/deviverr/superteam-dark/issues

## Marketing URL
https://github.com/deviverr/superteam-dark

## Copyright
See the repository.

---

## Description
Use the "Detailed description" body from `STORE_LISTING.md` verbatim, with one
addition at the end:

> Works in Safari on Mac, iPhone and iPad. On Mac, the customization panel
> opens from the toolbar button; on iPhone and iPad, tap the extensions button
> in the address bar and choose Superteam Earn Dark. The in-page theme button
> also sits in Earn's own top bar on every page.

Apple requires the description to state that the app installs a Safari
extension, so open with:

> Superteam Earn Dark is a Safari extension. After installing, turn it on in
> Safari's settings — the app walks you through it — and it applies to
> superteam.fun/earn only.

---

## App Privacy
Answer: **Data Not Collected** — every category, both platforms.

This must match `store/PRIVACY.md`. The extension has no network code and no
analytics; every setting lives in `storage.local` on the device. The only
remote resource that can ever load is a wallpaper image whose URL the user
typed into the popup themselves, and Safari fetches that directly.

There is no account, no sign-in, and no tracking, so **App Tracking
Transparency does not apply.**

---

## Age rating
4+. No user-generated content, no web browsing of its own, no ads.

---

## Notes for reviewers
Paste this into "Notes" in App Store Connect. It answers what a reviewer will
otherwise have to ask about.

> **How to see it working.** The extension only affects superteam.fun/earn.
>
> macOS: launch the app, click "Quit and Open Safari Settings", enable
> Superteam Earn Dark, then open https://superteam.fun/earn and allow the
> extension on that site. The page turns dark immediately, and a theme button
> appears in Earn's top bar. The toolbar popup holds the full customization
> panel.
>
> iOS/iPadOS: launch the app for the steps, or go to Settings › Apps › Safari ›
> Extensions › Superteam Earn Dark and switch it on, setting superteam.fun to
> Allow. Then open https://superteam.fun/earn in Safari and tap the
> **extensions** button in the address bar — the puzzle-piece icon, to the
> right of the URL, not the **AA** page settings menu. Choose Superteam Earn
> Dark, then "Always Allow" → "Always Allow on This Website". The page turns
> dark immediately and the panel opens from that same button.
>
> On iOS 16 and 17 the extensions list sits inside the **AA** menu instead;
> from iOS/iPadOS 18 it is its own button, and the **AA** menu no longer lists
> extensions at all.
>
> No account or test credentials are needed — Superteam Earn is a public site
> and none of the extension's features require signing in.
>
> **The app's own UI is instructions only.** That is the intended design for a
> Safari extension container app: the functionality is the extension, which
> Apple requires be delivered inside an app. The app screen explains what the
> extension does and how to enable it on the platform the user is on.
>
> **No data collection.** No network requests are made by the extension. All
> settings are stored with storage.local. Host access is restricted to
> `superteam.fun/earn*`, which is visible in the manifest.
>
> **Source is shipped as-is** — no bundler, minifier, or transpiler — so the
> files in the bundle are the complete, readable source.

---

## Platform minimums
| Target | Minimum |
|---|---|
| macOS | 13.3 (Safari 16.4) |
| iOS / iPadOS | 16.4 |

Set by `browser_specific_settings.safari.strict_min_version` in
`manifest.safari.json`. Safari 16.4 is the first release on either platform
with Manifest V3 support, which the extension requires.

---

## Screenshots
App Store Connect wants screenshots per platform — these are different assets
from the ones in `store/screenshots/`, which are sized for the Chrome Web
Store.

- **macOS:** 2880×1800. Reuse the framing of the existing captures (home dark,
  theme menu, customization popup, a preset applied, wallpaper).
- **iPhone:** 6.9" (1320×2868) required. Capture the sheet-width popup, not
  the 320px desktop popover.
- **iPad:** 13" (2064×2752) required if the iOS target ships to iPad, which it
  does by default.

At least one screenshot per platform must show the extension running on
superteam.fun/earn rather than the container app alone.
