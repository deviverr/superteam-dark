#!/bin/sh
# Export, sign and upload archives that were compiled on a released macOS.
#
# The developer Mac runs a macOS beta, so archives built here record a beta
# BuildMachineOSBuild and App Store Connect rejects them with ITMS-90111. CI
# (.github/workflows/safari-archive.yml or codemagic.yaml) compiles unsigned on
# a released macOS instead. This script does the half that needs the signing
# identity, which only exists on this Mac.
#
# Signing runs after compilation, so it does not alter DTXcode, DTSDKName or
# BuildMachineOSBuild — the metadata App Review actually inspects.
#
#   safari/upload-ci-archives.sh <dir-with-unpacked-xcarchives> [--export-only]
#
# The directory must contain EarnDark-iOS.xcarchive and
# EarnDark-macOS.xcarchive. Pass --export-only to stop after producing signed
# packages locally, without sending anything to Apple.
set -eu

DIR=${1:?usage: safari/upload-ci-archives.sh <dir-with-xcarchives> [--export-only]}
MODE=${2:-upload}

ROOT=$(cd "$(dirname "$0")/.." && pwd)

# The release toolchain, not the beta that xcode-select points at. Only used to
# drive export here; it does not re-run the compiler.
DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
export DEVELOPER_DIR

case "$MODE" in
  --export-only) PLIST="$ROOT/safari/ExportOptions.plist"; VERB="Exported" ;;
  upload)        PLIST="$ROOT/safari/UploadOptions.plist"; VERB="Uploaded" ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

for platform in iOS macOS; do
  archive="$DIR/EarnDark-$platform.xcarchive"
  [ -d "$archive" ] || { echo "missing $archive" >&2; exit 1; }

  # Refuse to ship an archive that came off a beta host — that is the whole
  # failure this script exists to avoid, and it is cheap to catch here rather
  # than after a rejected upload burns the build number.
  case "$platform" in
    iOS)   plist="$archive/Products/Applications/Superteam Earn Dark.app/Info.plist" ;;
    macOS) plist="$archive/Products/Applications/Superteam Earn Dark.app/Contents/Info.plist" ;;
  esac
  host=$(/usr/libexec/PlistBuddy -c 'Print :BuildMachineOSBuild' "$plist")
  version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")
  build=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$plist")
  sdk=$(/usr/libexec/PlistBuddy -c 'Print :DTSDKName' "$plist")

  # Beta seeds carry a five-digit build with a 5 in the thousands place
  # (26A5388g); released builds do not (25F80, 26A350).
  case "$host" in
    *A5[0-9][0-9][0-9]*|*B5[0-9][0-9][0-9]*|*C5[0-9][0-9][0-9]*)
      echo "$platform: BuildMachineOSBuild $host looks like a macOS beta." >&2
      echo "Archive it on CI instead; App Review rejects these (ITMS-90111)." >&2
      exit 1 ;;
  esac

  echo "$platform: $version ($build), $sdk, host $host"
  rm -rf "$DIR/out-$platform"
  xcodebuild -exportArchive \
    -archivePath "$archive" \
    -exportPath "$DIR/out-$platform" \
    -exportOptionsPlist "$PLIST" \
    | grep -viE 'not yet complete|checking completion' || true
  echo "$platform: $VERB"
done
