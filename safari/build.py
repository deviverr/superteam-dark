#!/usr/bin/env python3
"""Build the Safari (macOS + iOS) port of Superteam Earn Dark.

Safari is the one target that is not a zip: the App Store takes a native
app that wraps the extension, so this script stages the shared runtime
plus manifest.safari.json and hands the result to Xcode's
safari-web-extension-converter.

    python3 safari/build.py              # stage, then generate or sync the Xcode project
    python3 safari/build.py --stage      # stage only, no Xcode (also: load unpacked in Safari)
    python3 safari/build.py --regenerate # discard and recreate the Xcode project

The Xcode project is generated once and then kept. Later runs only re-copy
the staged resources into it, so the bundle identifier, signing settings
and any hand-edits to the app shells survive a rebuild. Use --regenerate
only when the manifest gains something structural (a new background form,
another platform) that the generated project has to be rebuilt around.

The runtime file list is imported from store/build.py, so a file added to
the Chrome/Firefox zips reaches Safari too without a second edit.
"""
import argparse, importlib.util, json, os, re, shutil, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pngutil

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAFARI  = os.path.join(ROOT, "safari")
STAGE   = os.path.join(SAFARI, "extension")   # staged, loadable web extension
PROJECT = os.path.join(SAFARI, "xcode")       # generated Xcode project
SHELL   = os.path.join(SAFARI, "app-shell")   # our container-app landing page

# The converter writes its own placeholder landing page ("you can turn this
# on in Settings") into the generated project. Ours replaces it, and lives
# here rather than only in safari/xcode so that --regenerate cannot lose it.
# Filenames must match what the generated project references: Main.html is
# inside Base.lproj, the other two sit beside it in Resources/.
SHELL_FILES = {
    "Main.html": os.path.join("Base.lproj", "Main.html"),
    "Style.css": "Style.css",
    "Script.js": "Script.js",
}

APP_NAME  = "Superteam Earn Dark"

# Apple Developer team the four targets are signed with.
DEVELOPMENT_TEAM = "VSUKBA84LT"

# Bumped for every build uploaded to App Store Connect. The marketing version
# comes from the manifest, but Apple additionally requires the build number to
# be unique within a marketing version — re-uploading 1.7 after a rejection
# means raising this, not the manifest.
BUILD_NUMBER = "5"

# App Store category. Required for macOS submissions; App Store Connect
# rejects the upload outright when it is missing.
APP_CATEGORY = "public.app-category.developer-tools"

# The OS releases that first shipped the Safari version in the manifest's
# strict_min_version. The generated project defaults to macOS 12 / iOS 15,
# which would let the app install where Safari cannot run an MV3 extension at
# all — the extension would be permanently invisible with no explanation.
MIN_OS_FOR_SAFARI = {
    "16.4": {"macos": "13.3", "ios": "16.4"},
}
# Reverse-DNS of a domain the developer owns (nekudev.com). Deliberately NOT
# fun.superteam.* — this is an unofficial third-party extension, and an
# identifier under Superteam's domain would imply an affiliation that does not
# exist, which is the kind of thing App Review asks about.
#
# The converter derives the extension's identifier from this by appending
# ".Extension", so BOTH App IDs have to be registered:
#   com.nekudev.earndark
#   com.nekudev.earndark.Extension
#
# Changing this after the app is on the App Store is not possible — the
# identifier is the app's permanent identity there. Re-run with --regenerate
# after editing.
BUNDLE_ID = "com.nekudev.earndark"

MANIFEST = "manifest.safari.json"


def shared_files():
    """The runtime file list, straight from the store build (minus manifests)."""
    spec = importlib.util.spec_from_file_location(
        "store_build", os.path.join(ROOT, "store", "build.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return list(mod.SHARED)


def stage():
    files = shared_files()

    missing = [f for f in files + [MANIFEST] if not os.path.exists(os.path.join(ROOT, f))]
    if missing:
        raise SystemExit("Missing required files: " + ", ".join(missing))

    manifest = json.load(open(os.path.join(ROOT, MANIFEST), encoding="utf-8"))
    chrome_version = json.load(open(os.path.join(ROOT, "manifest.json"), encoding="utf-8"))["version"]
    if manifest["version"] != chrome_version:
        raise SystemExit(
            f"Version mismatch: manifest.json is {chrome_version}, "
            f"{MANIFEST} is {manifest['version']}")

    if os.path.exists(STAGE):
        shutil.rmtree(STAGE)
    os.makedirs(STAGE)

    for rel in files:
        dst = os.path.join(STAGE, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, rel), dst)

    # Safari, like every engine, only loads a file literally named manifest.json.
    shutil.copy2(os.path.join(ROOT, MANIFEST), os.path.join(STAGE, "manifest.json"))

    print(f"Staged {len(files) + 1} files -> {os.path.relpath(STAGE, ROOT)}")
    return manifest["version"]


def install_app_shell():
    """Overwrite the generated container-app page with the one in safari/app-shell."""
    root = os.path.join(PROJECT, APP_NAME, "Shared (App)", "Resources")
    if not os.path.isdir(root):
        print(f"! container app Resources not found at {os.path.relpath(root, ROOT)} "
              f"— leaving the generated landing page in place")
        return
    for name, rel in SHELL_FILES.items():
        src = os.path.join(SHELL, name)
        dst = os.path.join(root, rel)
        if not os.path.exists(src):
            raise SystemExit(f"Missing app-shell file: {os.path.relpath(src, ROOT)}")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
    print(f"App shell -> {os.path.relpath(root, ROOT)}")


def configure_project(version):
    """Apply submission settings to the generated Xcode project.

    safari-web-extension-converter writes a generic project: version 1.0, the
    lowest deployment targets it supports, whichever team Xcode happened to
    list first, and no App Store category. Every one of those is wrong for a
    submission, so they are set here rather than by hand in Xcode — otherwise
    --regenerate silently reverts them.
    """
    pbx = os.path.join(PROJECT, APP_NAME, f"{APP_NAME}.xcodeproj", "project.pbxproj")
    if not os.path.exists(pbx):
        raise SystemExit(f"Xcode project not found at {os.path.relpath(pbx, ROOT)}")

    manifest = json.load(open(os.path.join(ROOT, MANIFEST), encoding="utf-8"))
    safari_min = manifest["browser_specific_settings"]["safari"]["strict_min_version"]
    if safari_min not in MIN_OS_FOR_SAFARI:
        raise SystemExit(
            f"No macOS/iOS minimum recorded for Safari {safari_min}. Add it to "
            f"MIN_OS_FOR_SAFARI so the deployment targets cannot drift from the manifest.")
    mins = MIN_OS_FOR_SAFARI[safari_min]

    src = open(pbx, encoding="utf-8").read()

    # Each target/configuration pair is one `buildSettings = { ... };` block.
    # Settings lines are indented deeper than the closing brace, so the
    # non-greedy match below cannot run past the end of its own block.
    block_re = re.compile(r"(buildSettings = \{\n)(.*?)(\n\t\t\t\};)", re.S)

    def apply(match):
        head, body, tail = match.groups()

        is_extension = "PRODUCT_BUNDLE_IDENTIFIER = " in body and ".Extension;" in body
        is_ios   = "SDKROOT = iphoneos;" in body
        is_macos = "SDKROOT = macosx;" in body

        settings = {
            "MARKETING_VERSION": version,
            "CURRENT_PROJECT_VERSION": BUILD_NUMBER,
            "DEVELOPMENT_TEAM": DEVELOPMENT_TEAM,
        }
        if is_ios:
            settings["IPHONEOS_DEPLOYMENT_TARGET"] = mins["ios"]
        if is_macos:
            settings["MACOSX_DEPLOYMENT_TARGET"] = mins["macos"]
        # Only the app carries a category; an appex has no App Store presence.
        if (is_ios or is_macos) and not is_extension:
            settings["INFOPLIST_KEY_LSApplicationCategoryType"] = f'"{APP_CATEGORY}"'
            # The app and extension use only Apple's built-in HTTPS stack and
            # don't ship their own cryptography. Declaring this here keeps
            # export-compliance metadata reproducible across regenerations.
            settings["INFOPLIST_KEY_ITSAppUsesNonExemptEncryption"] = "NO"

        for key, value in settings.items():
            line = f"\t\t\t\t{key} = {value};"
            existing = re.compile(rf"^\t\t\t\t{re.escape(key)} = [^;]*;$", re.M)
            if existing.search(body):
                body = existing.sub(line.replace("\\", "\\\\"), body)
            else:
                # Keep the block sorted the way Xcode writes it, so a later
                # open-and-save in Xcode produces no spurious diff.
                lines = body.split("\n")
                at = next((i for i, l in enumerate(lines)
                           if l.strip().split(" = ")[0] > key), len(lines))
                lines.insert(at, line)
                body = "\n".join(lines)

        return head + body + tail

    out = block_re.sub(apply, src)

    if out != src:
        open(pbx, "w", encoding="utf-8").write(out)
    print(f"Project settings: version {version} ({BUILD_NUMBER}), team {DEVELOPMENT_TEAM}, "
          f"macOS {mins['macos']}, iOS {mins['ios']}")


# The App Store icon shared by both platforms. The converter derives it from
# icons/icon128.png as RGBA; iOS submissions are rejected for having an alpha
# channel at all, even a fully opaque one.
MARKETING_ICON = os.path.join(
    "Shared (App)", "Assets.xcassets", "AppIcon.appiconset", "universal-icon-1024@1x.png")


def fix_marketing_icon():
    path = os.path.join(PROJECT, APP_NAME, MARKETING_ICON)
    if not os.path.exists(path):
        print(f"! marketing icon not found at {MARKETING_ICON} — skipping alpha check")
        return
    if pngutil.strip_alpha(path):
        print(f"Marketing icon: dropped unused alpha channel")


def resource_dirs():
    """The generated project's per-platform Resources directories."""
    hits = []
    for dirpath, dirnames, filenames in os.walk(PROJECT):
        dirnames[:] = [d for d in dirnames if d not in ("build", "DerivedData", ".git")]
        if os.path.basename(dirpath) == "Resources" and "manifest.json" in filenames:
            hits.append(dirpath)
    return hits


def generate():
    os.makedirs(PROJECT, exist_ok=True)
    cmd = [
        "xcrun", "safari-web-extension-converter", STAGE,
        "--project-location", PROJECT,
        "--app-name", APP_NAME,
        "--bundle-identifier", BUNDLE_ID,
        "--swift", "--copy-resources",
        "--no-open", "--no-prompt", "--force",
    ]
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, check=True)


def sync():
    """Re-copy staged resources into an already-generated project."""
    dirs = resource_dirs()
    if not dirs:
        return False
    for d in dirs:
        for name in os.listdir(d):
            # Xcode owns these; only the web-extension payload is ours to replace.
            if name == "Info.plist" or name.endswith(".entitlements"):
                continue
            p = os.path.join(d, name)
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
        for name in os.listdir(STAGE):
            src, dst = os.path.join(STAGE, name), os.path.join(d, name)
            shutil.copytree(src, dst) if os.path.isdir(src) else shutil.copy2(src, dst)
        print(f"Synced -> {os.path.relpath(d, ROOT)}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", action="store_true", help="stage only, skip Xcode")
    ap.add_argument("--regenerate", action="store_true", help="recreate the Xcode project")
    args = ap.parse_args()

    version = stage()
    if args.stage:
        return

    if args.regenerate and os.path.exists(PROJECT):
        shutil.rmtree(PROJECT)

    if os.path.exists(PROJECT) and resource_dirs():
        sync()
    else:
        generate()

    install_app_shell()
    configure_project(version)
    fix_marketing_icon()

    print(f"\nSuperteam Earn Dark {version} — Safari project at "
          f"{os.path.relpath(PROJECT, ROOT)}")


if __name__ == "__main__":
    main()
