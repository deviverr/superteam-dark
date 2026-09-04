#!/usr/bin/env python3
"""Package Superteam Earn Dark into store-ready zips.

Includes ONLY the extension runtime files — excludes the saved site example,
brand-asset sources, store docs, dev scripts, and editor config.

The two targets ship the same code and differ only in their manifest:

  chrome   manifest.json          MV3 service-worker background
  firefox  manifest.firefox.json  MV3 event-page background, gecko id;
                                  written into the zip AS manifest.json,
                                  since that is the only name a browser
                                  will load.

Each target gets its own output folder, so the zip a store dashboard is
waiting for can never be confused with the other engine's.

Usage:  python store/build.py [chrome|firefox|all]   (default: all)
Output: dist/chrome/superteam-earn-dark-<version>.zip
        dist/firefox/superteam-earn-dark-firefox-<version>.zip
"""
import json, os, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Everything except the manifest — identical across both stores.
SHARED = [
    "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png",
    "assets/solana-dark-logo.svg",
    "shared/browser-compat.js",
    "background/service-worker.js",
    "content/content.js", "content/dark.css",
    "popup/popup.html", "popup/popup.css", "popup/popup.js",
]

TARGETS = {
    # target:  (source manifest, output subfolder, output name template)
    "chrome":  ("manifest.json",         "chrome",  "superteam-earn-dark-{v}.zip"),
    "firefox": ("manifest.firefox.json", "firefox", "superteam-earn-dark-firefox-{v}.zip"),
}


# Safari ships as a native app built by safari/build.py, not as a zip, so it
# is not a target here — but its manifest still has to carry the same version
# as the other two, so it takes part in the check below.
EXTRA_MANIFESTS = {"safari": "manifest.safari.json"}


def check_versions():
    """A mismatch here ships one store a stale version number, which cannot be
    corrected without a whole new upload — so fail the build instead."""
    versions = {}
    for target, (src, _, _name) in TARGETS.items():
        with open(os.path.join(ROOT, src)) as f:
            versions[target] = json.load(f)["version"]
    for target, src in EXTRA_MANIFESTS.items():
        path = os.path.join(ROOT, src)
        if os.path.exists(path):
            with open(path) as f:
                versions[target] = json.load(f)["version"]
    if len(set(versions.values())) > 1:
        raise SystemExit(f"Version mismatch between manifests: {versions}")
    return next(iter(versions.values()))


def build(target, version, dist):
    src_manifest, folder, name = TARGETS[target]
    files = [(src_manifest, "manifest.json")] + [(f, f) for f in SHARED]

    missing = [s for s, _ in files if not os.path.exists(os.path.join(ROOT, s))]
    if missing:
        raise SystemExit("Missing required files: " + ", ".join(missing))

    outdir = os.path.join(dist, folder)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, name.format(v=version))
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for src, arc in files:
            z.write(os.path.join(ROOT, src), arc)

    print(f"Built {out}")
    print(f"  {len(files)} files, {os.path.getsize(out)/1024:.1f} KB")

    # An unpacked copy beside the zip. about:debugging's "Load Temporary
    # Add-on" and `web-ext run` both want a directory containing a file
    # literally named manifest.json — which the repo root does not have for
    # any target but Chrome — so lay one out rather than making every
    # debugging session unzip by hand.
    unpacked = os.path.join(outdir, "unpacked")
    if os.path.isdir(unpacked):
        shutil.rmtree(unpacked)
    for src, arc in files:
        dest = os.path.join(unpacked, arc)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, src), dest)
    print(f"  unpacked -> {unpacked}")


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which not in TARGETS and which != "all":
        raise SystemExit(f"Unknown target {which!r}; expected one of "
                         + ", ".join(list(TARGETS) + ["all"]))

    version = check_versions()
    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)

    for target in (TARGETS if which == "all" else [which]):
        build(target, version, dist)


if __name__ == "__main__":
    main()
