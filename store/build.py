#!/usr/bin/env python3
"""Package Superteam Earn Dark into a Chrome Web Store-ready zip.

Includes ONLY the extension runtime files — excludes the saved site example,
brand-asset sources, store docs, dev scripts, and editor config.

Usage:  python store/build.py
Output: dist/superteam-earn-dark-<version>.zip
"""
import json, os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Exact files / dirs that make up the shippable extension.
INCLUDE = [
    "manifest.json",
    "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png",
    "assets/earn-logo-dark.png", "assets/by_dev.png",
    "background/service-worker.js",
    "content/content.js", "content/dark.css",
    "popup/popup.html", "popup/popup.css", "popup/popup.js",
]

def main():
    version = json.load(open(os.path.join(ROOT, "manifest.json")))["version"]
    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)
    out = os.path.join(dist, f"superteam-earn-dark-{version}.zip")

    missing = [f for f in INCLUDE if not os.path.exists(os.path.join(ROOT, f))]
    if missing:
        raise SystemExit("Missing required files: " + ", ".join(missing))

    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in INCLUDE:
            z.write(os.path.join(ROOT, rel), rel)

    size = os.path.getsize(out)
    print(f"Built {out}")
    print(f"  {len(INCLUDE)} files, {size/1024:.1f} KB")

if __name__ == "__main__":
    main()
