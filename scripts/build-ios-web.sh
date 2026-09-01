#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
WEB_APP="$REPOSITORY_ROOT/app"
LFS_PROBE="$WEB_APP/public/policies/BEST_alpha_stand.onnx"

if /usr/bin/head -n 1 "$LFS_PROBE" | /usr/bin/grep -q "git-lfs.github.com/spec"; then
  echo "error: Git LFS assets are pointers. Run 'git lfs install && git lfs pull' before building Microduck." >&2
  exit 1
fi

if command -v npm >/dev/null 2>&1; then
  NPM=$(command -v npm)
elif [ -x /opt/homebrew/bin/npm ]; then
  NPM=/opt/homebrew/bin/npm
elif [ -x /usr/local/bin/npm ]; then
  NPM=/usr/local/bin/npm
else
  echo "error: npm is required to build the bundled simulator." >&2
  exit 1
fi

cd "$WEB_APP"
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  "$NPM" ci --prefer-offline --no-audit --fund=false
fi
"$NPM" run build

WEB_DIST="$WEB_APP/dist"
if [ ! -f "$WEB_DIST/index.html" ] || ! find "$WEB_DIST/bundle" -name '*.wasm' -type f | /usr/bin/grep -q .; then
  echo "error: Vite did not produce the offline HTML and WASM runtime." >&2
  exit 1
fi

if [ -z "${TARGET_BUILD_DIR:-}" ] || [ -z "${UNLOCALIZED_RESOURCES_FOLDER_PATH:-}" ]; then
  echo "error: This script must run from an Xcode target build phase." >&2
  exit 1
fi

WEB_DESTINATION="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/Web"
case "$WEB_DESTINATION" in
  "$TARGET_BUILD_DIR"/*/Web) ;;
  *) echo "error: Refusing to replace an unexpected Web destination." >&2; exit 1 ;;
esac

/bin/rm -rf "$WEB_DESTINATION"
/usr/bin/ditto "$WEB_DIST" "$WEB_DESTINATION"
