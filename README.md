# superteam-dark

Superteam Earn Dark — a full customization system for
[superteam.fun/earn](https://superteam.fun/earn): dark mode, 8 presets, named
custom themes, per-element colors, wallpaper, font size, and section hiding.

## Browsers

One source tree, three packages. The code is identical; only the manifest and
a small API shim differ.

| Browser | Manifest | Background | Package | Status |
|---|---|---|---|---|
| Chrome / Edge / Brave | `manifest.json` | MV3 service worker | zip | published, v1.7 |
| Firefox (desktop 140+) | `manifest.firefox.json` | MV3 event page | zip | ready to submit |
| Firefox for Android (142+) | `manifest.firefox.json` | MV3 event page | zip | ready to submit |
| Safari (macOS 13.3+) | `manifest.safari.json` | MV3 service worker | Xcode app | ready to submit |
| Safari (iOS/iPadOS 16.4+) | `manifest.safari.json` | MV3 service worker | Xcode app | ready to submit |

Safari is the one target Apple does not take as a zip — it ships as a native
app wrapping the extension, built from `safari/`. Both Apple platforms come
out of a single universal Xcode project.

## Layout

```
manifest.json           Chrome manifest
manifest.firefox.json   Firefox manifest (zipped as manifest.json)
manifest.safari.json    Safari manifest (copied in as manifest.json)
shared/                 browser-compat.js — the `seApi` namespace every engine uses
background/             non-persistent background: defaults, time-based alarm
content/                content.js + dark.css — the theming itself
popup/                  the customization panel
assets/ icons/          shipped resources
safari/                 build.py, container-app landing page, generated Xcode project
store/                  build script, listings, privacy policy, screenshots
```

## Build

```sh
python store/build.py            # both zips into dist/
python store/build.py firefox
python store/build.py chrome

python3 safari/build.py          # stage + generate/sync the Xcode project
```

The zip build refuses to run if the manifests disagree on `version` — all
three are checked, Safari's included, even though it is not itself a zip
target.

## Docs

- `store/FIREFOX.md` — how the Firefox port works, and how to test it on
  desktop and Android
- `store/SAFARI.md` — how the Safari port works, and how to test it on macOS
  and iOS
- `store/STORE_LISTING.md` — Chrome Web Store copy
- `store/AMO_LISTING.md` — addons.mozilla.org copy and reviewer notes
- `store/APPSTORE_LISTING.md` — App Store Connect copy and reviewer notes
- `store/PRIVACY.md` — privacy policy (no data is collected or transmitted)
