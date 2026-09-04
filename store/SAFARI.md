# Safari port — how it works, how to test it, how to ship it

The Safari build is the **same code** as the Chrome and Firefox builds. There
is one source tree; Safari differs only in its manifest and in how it is
packaged — Apple does not take a zip, it takes a native app that wraps the
web extension.

One project produces **both** platforms: macOS and iOS/iPadOS.

---

## What differs between the targets

| | Chrome | Firefox | Safari |
|---|---|---|---|
| Manifest file | `manifest.json` | `manifest.firefox.json` | `manifest.safari.json` |
| Background | `service_worker` | `scripts` (event page) | `service_worker` |
| Compat shim loaded via | `importScripts` | `background.scripts[0]` | `importScripts` |
| Minimum version | — | `gecko.strict_min_version` 128 | `safari.strict_min_version` 16.4 |
| Package | `.zip` | `.zip` | Xcode app (macOS + iOS) |
| Everything else | identical | identical | identical |

Safari 16.4 is the floor because it is the first release — on macOS **and**
iOS — that supports Manifest V3 at all.

### The compatibility shim

Safari needs no wrapper. Its `chrome.*` namespace is promise-based and
complete, so `shared/browser-compat.js` returns it untouched, exactly as on
Chrome. See `store/FIREFOX.md` for why the shim's engine detection reads the
extension URL scheme rather than sniffing for a `browser` namespace — getting
that wrong silently sends Safari down the Firefox wrapper path.

### Safari-specific code paths

Two things in the shared source exist because of Safari:

- **`tabs.query` is scoped by URL.** Safari only fills in `tab.url` for tabs
  the extension holds host permission for, and only when the query itself is
  URL-filtered. An unfiltered `query({})` comes back with the urls stripped,
  so the old "query everything, then filter on `tab.url.includes(...)`" shape
  matched nothing. Both `popup.js` and `service-worker.js` now pass the same
  match patterns as `host_permissions`. This behaves identically on Chrome and
  Firefox.

- **Time mode re-checks itself in the content script.** Time-based dark mode
  is driven by a `chrome.alarms` tick in the background. That is fine on
  desktop, but on iOS the background context is suspended whenever Safari is
  not in the foreground, so the alarm that should flip the theme at 21:00 never
  fires while the phone is locked. `content.js` therefore also re-evaluates
  once a minute while the page is visible, and immediately on every return to
  the foreground — the case the alarm actually misses. Both are no-ops outside
  time mode.

### Mobile

The popup is the same HTML on both platforms, but iOS presents it as a sheet
at device width rather than sizing the window to the page. `popup.css` has an
`@media (min-width: 360px)` block that fills the sheet, raises hit targets to
Apple's 44pt minimum, and bumps input font size to 16px so iOS does not zoom
the sheet on focus. That query cannot match on macOS, where the popover is
exactly the 320px the stylesheet declares.

### The container app

Apple requires the extension to ship inside an app. `safari/app-shell/` holds
our landing page for it — icon, what the extension does, and step-by-step
instructions for switching it on, which differ per platform. It replaces the
placeholder page the converter generates.

It lives in `safari/app-shell/` rather than only inside the generated project
so that `--regenerate` cannot lose it; `safari/build.py` copies it in on every
run.

---

## Building

```sh
python3 safari/build.py
```

This stages the shared runtime plus `manifest.safari.json` into
`safari/extension/`, then either generates the Xcode project (first run) or
syncs the staged files into the existing one.

The Xcode project at `safari/xcode/` is **generated once and then kept**.
Later runs only re-copy resources, so the bundle identifier, signing settings
and any hand-edits to the app targets survive a rebuild.

```sh
python3 safari/build.py --stage       # stage only; load this in Safari unpacked
python3 safari/build.py --regenerate  # discard and recreate the Xcode project
```

Use `--regenerate` only when the manifest gains something structural (a
different background form, another platform) that the project has to be
rebuilt around. It re-runs `xcrun safari-web-extension-converter` and **will**
discard signing settings.

The runtime file list is imported from `store/build.py`, so a file added to the
Chrome/Firefox zips reaches Safari without a second edit. Version numbers are
checked across all three manifests by `store/build.py`; a mismatch fails the
build.

### Submission settings

`safari/build.py` rewrites the generated project after every run, because the
converter's defaults are all wrong for a submission and `--regenerate` would
otherwise silently revert hand-edits made in Xcode:

| Setting | Converter default | Set to | Why |
|---|---|---|---|
| `MARKETING_VERSION` | `1.0` | manifest `version` | Store version must track the extension |
| `CURRENT_PROJECT_VERSION` | `1` | `BUILD_NUMBER` | Must be unique per upload within a version |
| `MACOSX_DEPLOYMENT_TARGET` | `12.0` | `13.3` | macOS 12 has no MV3 support |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.0` | `16.4` | iOS 15 has no MV3 support |
| `DEVELOPMENT_TEAM` | first team Xcode lists | `VSUKBA84LT` | Converter picks arbitrarily |
| `INFOPLIST_KEY_LSApplicationCategoryType` | absent | developer-tools | Upload is rejected without it |

The deployment targets matter more than they look. Left at the defaults, the
app installs happily on macOS 12 / iOS 15, where Safari cannot run an MV3
extension at all — the user sees an app that does nothing, with no explanation
and nothing to toggle. They are derived from the manifest's
`strict_min_version` through `MIN_OS_FOR_SAFARI`, so raising the Safari
minimum later cannot leave them behind.

`fix_marketing_icon()` also strips the alpha channel from
`universal-icon-1024@1x.png`. The converter derives it from `icons/icon128.png`
as RGBA; App Store validation rejects an iOS icon that *has* an alpha channel
even when every pixel is opaque, which this one's are. `safari/pngutil.py`
refuses to run if any pixel is genuinely translucent, so it can never silently
change how the icon looks.

To bump the build number for a re-upload, edit `BUILD_NUMBER` in
`safari/build.py` and re-run it — not the manifest, which carries the
marketing version.

---

## Testing on macOS

1. Build and run the **Superteam Earn Dark (macOS)** scheme in Xcode.
2. Safari → Settings → Advanced → tick **Show features for web developers**.
3. Safari → Develop → tick **Allow Unsigned Extensions**. This resets every
   time Safari quits — expect to re-tick it.
4. Safari → Settings → Extensions → enable **Superteam Earn Dark**.
5. Open `superteam.fun/earn` and grant the extension access to the site.

### What to check

- The page is dark on first paint, with no flash of light — `run_at:
  document_start` plus the `sessionStorage` cache.
- The toolbar popup opens at 320px and every control works.
- All 8 presets apply; a saved custom theme survives a Safari restart.
- The "Powered by Solana" badge renders dark. It is loaded through
  `runtime.getURL`, so this is the check that `web_accessible_resources`
  resolved on the `safari-web-extension://` scheme.
- Live colour preview updates the page as you drag, before saving.
- Client-side navigation between Earn's sections keeps the theme and honours
  per-page section hiding.
- Set the mode to **Time**, with a range that starts a minute out, and confirm
  the switch happens without touching the popup.

---

## Testing on iOS

Simulator is enough for the container app and most of the extension:

```sh
xcrun simctl boot 'iPhone 17 Pro'
# build and run the "Superteam Earn Dark (iOS)" scheme in Xcode
```

On the simulator or a device: Settings → Apps → Safari → Extensions →
**Superteam Earn Dark** → on, then allow it on superteam.fun. Or, from Safari,
the **AA** button in the address bar → Manage Extensions.

### Where the extension actually lives on iOS 18+

The control is the **extensions button** in the address bar — the puzzle-piece
icon to the right of the URL — not the **AA** page settings menu. On iPadOS 26
the AA menu holds only "Hide Distracting Items" and "Translate Website"; it
lists no extensions at all. iOS 16 and 17 did put them under AA, which is where
the old instructions came from.

This matters more than it reads. `safari/app-shell/Main.html` and the reviewer
notes in `store/APPSTORE_LISTING.md` both told the user to tap **AA** →
Manage Extensions. A reviewer following that sees an unrelated two-item menu,
concludes the extension does nothing, and rejects. Both are now corrected to
name the extensions button, with the AA route kept as the iOS 16/17 fallback.

The first-run flow from that button is: tap it, tap **Superteam Earn Dark**
(it carries a ⚠️ until permission is granted), then **Always Allow…** →
**Always Allow on This Website**. Enabling the extension in Settings › Apps ›
Safari › Extensions is not enough on its own — the page stays light until the
site permission is granted.

### What to check on iOS

- The container app's instructions render, and the iOS wording shows — not the
  macOS "toolbar button" copy.
- The popup's tab row reads **Theme | Customize | Settings** as three separate
  labels. Safari's popover on iPad is narrower than the 320px the stylesheet
  asks for, and without `min-width: 0` plus horizontal padding on `.tab-btn`
  the three run together as "ThemeCustomizeSettings".
- The popup fills the sheet rather than sitting in a 320px column.
- Tapping a colour swatch or a text field does not zoom the sheet.
- Theme survives backgrounding Safari and returning.
- **Time mode across a lock/unlock.** Set a range that begins while the phone
  is locked, lock it, and unlock past the boundary. The theme must be correct
  on return — this is the case the background alarm cannot cover and the
  content-script watcher exists for.

---

## Signing and submitting

The extension itself needs no entitlements, network access, or capabilities.

Team is **VSUKBA84LT**, set by `safari/build.py`.

### State of signing on this machine

Distribution is set up. Automatic signing resolves a **Cloud Managed Apple
Distribution** certificate (in the keychain, valid to 2027-09-02) plus three
App Store provisioning profiles installed in
`~/Library/Developer/Xcode/UserData/Provisioning Profiles/`:

```
Mac Team Store Provisioning Profile: com.nekudev.earndark
iOS Team Store Provisioning Profile: com.nekudev.earndark
iOS Team Store Provisioning Profile: com.nekudev.earndark.Extension
```

Both platforms archive, export and upload without `-allowProvisioningUpdates`.
The keychain also holds development identities and a *Developer ID
Application* certificate; the latter signs notarized direct distribution and is
**not** used for the App Store.

### Build with release Xcode, not the beta

`xcode-select -p` on this machine points at `/Applications/Xcode-beta.app`.
Apple rejects uploads built with a beta toolchain, and only at the very last
step — after archive, export and a full package analysis all succeed:

```
error: exportArchive This bundle is invalid. Apple is not currently accepting
applications built with this version of Xcode.
```

Override per command rather than changing the global selection, which the beta
is presumably pointed at deliberately:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

The archive must be **rebuilt** under the release toolchain — re-exporting an
existing beta-built archive fails the same way, because the Xcode version is
baked into the archived binary.

### The identifier

```
com.nekudev.earndark             the app
com.nekudev.earndark.Extension   the Safari extension inside it
```

Reverse-DNS of nekudev.com, a domain the developer owns. Deliberately not
`fun.superteam.*`: this is an unofficial extension, and an identifier under
Superteam's domain would imply an affiliation that does not exist — the kind
of thing App Review asks about.

Set once, in `BUNDLE_ID` in `safari/build.py`, then `--regenerate`. **It cannot
be changed after the app ships** — the identifier is the app's permanent
identity on the App Store.

---

## Publishing walkthrough

Each step depends on the one before it. Step 1 can invalidate everything after
it, so do it first.

### 1. Confirm the team can actually ship

developer.apple.com/account → **Membership details**.

Look for an active **Apple Developer Program** membership on team VSUKBA84LT
(Khabib Bairamov), $99/year. If it says *Personal Team*, or there is no
membership, stop — a free team signs apps for local development, which is
exactly what the certificates on this machine already do, but cannot submit to
the App Store at all. Everything below assumes a paid membership.

### 2. Register the two App IDs

developer.apple.com/account → **Identifiers** → **+**

Register **both**, as type *App IDs* → *App*:

| Description | Bundle ID (explicit) |
|---|---|
| Superteam Earn Dark | `com.nekudev.earndark` |
| Superteam Earn Dark Extension | `com.nekudev.earndark.Extension` |

Choose **Explicit**, not wildcard. Leave every capability off — the extension
needs none.

You can skip this step and step 3 by letting Xcode do them; see "Letting Xcode
do steps 2–4" below.

### 3. Create an Apple Distribution certificate

developer.apple.com/account → **Certificates** → **+** → **Apple
Distribution**. One certificate covers macOS and iOS.

You will be asked for a Certificate Signing Request. Keychain Access →
menu **Keychain Access** › *Certificate Assistant* › *Request a Certificate
From a Certificate Authority*, saved to disk. Upload it, download the
resulting `.cer`, and double-click to install it.

Note the existing *Developer ID Application* certificate is **not** this. That
one signs apps for notarized distribution outside the App Store.

### 4. Create two App Store provisioning profiles

developer.apple.com/account → **Profiles** → **+** → **App Store Connect**,
once per App ID from step 2, each tied to the distribution certificate from
step 3. Download both and double-click to install.

### Letting Xcode do steps 2–4

Xcode → Settings → **Accounts** → add the Apple ID for team VSUKBA84LT. The
account needs the **Admin** or **Account Holder** role.

With automatic signing on — which is how the project is configured — archiving
then registers the App IDs and creates the certificate and profiles for you.
On the command line the equivalent is adding `-allowProvisioningUpdates`.

Either way this writes to the real Apple Developer account, so run it when you
mean to, not to get past an error message.

### 5. Create the app record in App Store Connect

appstoreconnect.apple.com → **Apps** → **+** → **New App**.

- **Platforms:** tick **macOS** *and* **iOS** — one record serves both, which
  is what the universal project produces.
- **Name:** Superteam Earn Dark
- **Primary language:** English (U.S.)
- **Bundle ID:** `com.nekudev.earndark` (appears once step 2 is done)
- **SKU:** any private string, e.g. `earndark-safari`
- **User Access:** Full Access

Nothing can be uploaded until this record exists — a build has nothing to
attach to.

### 6. Archive both platforms

Both steps below assume the release toolchain — see "Build with release Xcode,
not the beta" above. From the command line that is one export, reusable for
both platforms:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

In Xcode, open `safari/xcode/Superteam Earn Dark/Superteam Earn Dark.xcodeproj`.

1. Scheme **Superteam Earn Dark (macOS)**, destination **Any Mac** →
   Product › **Archive**.
2. Scheme **Superteam Earn Dark (iOS)**, destination **Any iOS Device
   (arm64)** → Product › **Archive**.

A simulator destination produces no archive — the Archive menu item stays
greyed out. Both archives land in the Organizer.

Xcode archives with whatever `xcode-select` points at, so launch the release
Xcode itself rather than the beta. The equivalent from a shell, per platform:

```sh
xcodebuild -project "safari/xcode/Superteam Earn Dark/Superteam Earn Dark.xcodeproj" \
  -scheme "Superteam Earn Dark (macOS)" -destination "generic/platform=macOS" \
  -archivePath /tmp/EarnDark-macOS.xcarchive archive
```

Use `-destination "generic/platform=iOS"` and the iOS scheme for the other.

### 7. Upload

Organizer (Window › Organizer) → select an archive → **Distribute App** →
**App Store Connect** → **Upload**. Repeat for the other platform.

From a shell, `safari/UploadOptions.plist` does the same thing — it is
`ExportOptions.plist` with `destination` set to `upload` instead of `export`:

```sh
xcodebuild -exportArchive -archivePath /tmp/EarnDark-macOS.xcarchive \
  -exportPath /tmp/upload-macos -exportOptionsPlist safari/UploadOptions.plist
```

Validation runs first and is where a bad icon, a missing category, or a
duplicate build number surfaces. All three are already handled by
`safari/build.py`; if validation objects to something else, fix it and
re-archive rather than forcing the upload through.

Note that a beta-Xcode bundle passes local export and fails only here, after
the package has been analyzed by App Store Connect. `** EXPORT SUCCEEDED **`
with `ExportOptions.plist` therefore proves nothing about the toolchain — only
the `upload` variant reaches that check.

Processing on Apple's side takes 10–60 minutes before the build appears in
App Store Connect.

### 8. Fill in the listing

App Store Connect → your app. Copy from `store/APPSTORE_LISTING.md`: name,
subtitle, promotional text, description, keywords, support URL, category.

Then, per platform:

- **Screenshots.** Required, and they must show the extension running on
  superteam.fun/earn — not just the container app. Sizes are listed in
  `store/APPSTORE_LISTING.md`. These cannot be captured until the extension is
  enabled in Safari, so do the testing walk above first and screenshot as you
  go.
- **App Privacy.** Answer **Data Not Collected** for every category, both
  platforms. This must agree with `store/PRIVACY.md`.
- **Age rating.** 4+.
- **Build.** Select the processed build from step 7.
- **Review notes.** Paste the block from `store/APPSTORE_LISTING.md` — it
  pre-empts the two questions a reviewer will otherwise come back with: how to
  see the extension working, and why the app's own UI is only instructions.

### 9. Submit

**Add for Review** → **Submit to App Review**.

First review typically takes 24–48 hours. A Safari extension whose container
app is instructions-only is normal and expected, but it is the most likely
thing to draw a 4.2 "minimum functionality" question — which is why
`safari/app-shell/` is a real page with real per-platform steps rather than
the converter's one-line placeholder.

Set **Version Release** to *Manually release this version* if you want to
control the moment it goes live.

---

## Shipping an update

Two numbers move, and they move in different files:

- **Marketing version** (`1.7.1`) — bump it in **all three** manifests
  together. `store/build.py` refuses to build on a mismatch, and the Safari
  project reads its own from `manifest.safari.json`.
- **Build number** — `BUILD_NUMBER` in `safari/build.py`. Apple requires it to
  be unique within a marketing version, so raise it for every upload,
  including a re-upload after a rejected build. It never appears in the
  manifests.

Then `python3 safari/build.py`, re-archive both platforms, and upload. Steps
1–5 of the walkthrough are one-time setup; updates start at step 6.

---

## What a reviewer will ask about

All three are already answered in the review notes in
`store/APPSTORE_LISTING.md` — this is why those notes say what they say.

- **The app's own UI is only instructions.** Expected for a Safari extension
  container app, and why `safari/app-shell/` is a real page with real
  per-platform steps rather than the converter's one-line placeholder. A bare
  "turn this on in Settings" screen is the usual 4.2 rejection here.
- **No data leaves the device.** Every setting lives in `storage.local`; there
  is no network code and no analytics. App Privacy must say **Data Not
  Collected**, matching `store/PRIVACY.md`.
- **Host access is limited** to `superteam.fun/earn*`, which a reviewer can
  verify in the manifest.
