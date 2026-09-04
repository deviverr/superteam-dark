#!/usr/bin/env sh
# Build and launch the Firefox package in a scratch profile.
#
# Run this from your OWN terminal, not from a tool or CI shell: Firefox needs
# macOS GUI entitlements that a sandboxed/background shell does not have, and
# fails there with "sandbox_extension_issue_file_to_process failed ...
# Operation not permitted" and a debugger port that never opens.
#
# If a normal Firefox is already running, macOS hands the launch off to it and
# web-ext's instance never starts — MOZ_NO_REMOTE forces a separate one.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)

python3 "$ROOT/store/build.py" firefox

MOZ_NO_REMOTE=1 npx --yes web-ext@latest run \
  --source-dir "$ROOT/dist/firefox/unpacked" \
  --start-url "https://superteam.fun/earn" \
  --browser-console \
  "$@"
