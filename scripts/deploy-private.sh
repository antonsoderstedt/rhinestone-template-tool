#!/usr/bin/env bash
# Builds the app as a static site and uploads it to Cloudflare (Workers static assets), optionally with your private libraries.
#
#   scripts/deploy-private.sh              the app only (nothing licensed, safe to publish)
#   scripts/deploy-private.sh --with-libs  the app plus public/design-library and public/font-library
#
# The build happens in a temporary copy, so your working folder is left alone. Log in once first: npx wrangler login
# Protect the site with Cloudflare Access BEFORE using --with-libs (see docs/decisions/0034-private-deployment.md).
set -euo pipefail

WITH_LIBS=0
[ "${1:-}" = "--with-libs" ] && WITH_LIBS=1
NAME="${CF_WORKER_NAME:-rhinestone-studio}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Copying the project to a temporary folder..."
rsync -a --exclude .git --exclude .next --exclude node_modules --exclude 'public/fonts' --exclude 'public/design-library' \
  --exclude 'public/font-library' --exclude .claude --exclude out --exclude output --exclude '*.zip' "$ROOT"/ "$WORK"/
cp -Rc "$ROOT/node_modules" "$WORK/node_modules" 2>/dev/null || cp -R "$ROOT/node_modules" "$WORK/node_modules"

cd "$WORK"
node scripts/prepare-pages-build.mjs
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH= npx next build

if [ "$WITH_LIBS" = "1" ]; then
  for lib in design-library font-library; do
    if [ -d "$ROOT/public/$lib" ]; then
      cp -R "$ROOT/public/$lib" "out/$lib"
      echo "Included $lib ($(find "out/$lib" -type f | wc -l | tr -d ' ') files)"
    else
      echo "No public/$lib here: skipped (run npm run import:designs / npm run build:fonts first)"
    fi
  done
fi

cat > wrangler.jsonc <<JSON
{
  "name": "$NAME",
  "compatibility_date": "$(date +%Y-%m-%d)",
  "assets": { "directory": "./out", "not_found_handling": "404-page" }
}
JSON

echo "Uploading to Cloudflare as '$NAME'..."
npx --yes wrangler@latest deploy
