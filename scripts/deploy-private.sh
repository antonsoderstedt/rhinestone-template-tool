#!/usr/bin/env bash
# Builds the app as a static site and uploads it to Cloudflare (Workers static assets + the sync Worker + a D1 database),
# optionally with your private libraries.
#
#   scripts/deploy-private.sh              the app only (nothing licensed)
#   scripts/deploy-private.sh --with-libs  the app plus public/design-library and public/font-library
#   scripts/deploy-private.sh --dev        build and run locally on http://localhost:8787 (no login, local database)
#
# The build happens in a temporary copy, so your working folder is left alone. Log in once first: npx wrangler login
# Protect the site with Cloudflare Access BEFORE using --with-libs (see docs/decisions/0034-private-deployment-on-cloudflare.md).
#
# For sync, create .env.cloudflare (git-ignored) with:
#   CF_TEAM_DOMAIN=https://<your-team>.cloudflareaccess.com
#   CF_POLICY_AUD=<the Access application's Audience (AUD) tag>
set -euo pipefail

MODE=deploy
WITH_LIBS=0
for arg in "$@"; do
  case "$arg" in
    --with-libs) WITH_LIBS=1 ;;
    --dev) MODE=dev ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done
NAME="${CF_WORKER_NAME:-rhinestone-studio}"
DB_NAME="${CF_DB_NAME:-rhinestone-sync}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.env.cloudflare" ] && set -a && . "$ROOT/.env.cloudflare" && set +a
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Copying the project to a temporary folder..."
rsync -a --exclude .git --exclude .next --exclude node_modules --exclude 'public/fonts' --exclude 'public/design-library' \
  --exclude 'public/font-library' --exclude .claude --exclude out --exclude output --exclude '*.zip' "$ROOT"/ "$WORK"/
cp -Rc "$ROOT/node_modules" "$WORK/node_modules" 2>/dev/null || cp -R "$ROOT/node_modules" "$WORK/node_modules"

cd "$WORK"
node scripts/prepare-pages-build.mjs
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_SYNC_ENABLED=1 npx next build

if [ "$WITH_LIBS" = "1" ] || [ "$MODE" = "dev" ]; then
  for lib in design-library font-library; do
    if [ -d "$ROOT/public/$lib" ]; then
      cp -R "$ROOT/public/$lib" "out/$lib"
      echo "Included $lib ($(find "out/$lib" -type f | wc -l | tr -d ' ') files)"
    else
      echo "No public/$lib here: skipped (run npm run import:designs / npm run build:fonts first)"
    fi
  done
fi

if [ "$MODE" = "dev" ]; then
  DB_ID="00000000-0000-0000-0000-000000000000"
  VARS='"vars": { "ALLOW_UNAUTHENTICATED": "true" }'
else
  : "${CF_TEAM_DOMAIN:?Set CF_TEAM_DOMAIN in .env.cloudflare}"
  : "${CF_POLICY_AUD:?Set CF_POLICY_AUD in .env.cloudflare}"
  # The database that holds the synced designs: found by name, created the first time.
  DB_ID="$(npx --yes wrangler@latest d1 list --json 2>/dev/null | python3 -c "import json,sys; print(next((d['uuid'] for d in json.load(sys.stdin) if d['name']=='$DB_NAME'), ''))")"
  if [ -z "$DB_ID" ]; then
    echo "Creating the database '$DB_NAME'..."
    npx --yes wrangler@latest d1 create "$DB_NAME" >/dev/null
    DB_ID="$(npx --yes wrangler@latest d1 list --json | python3 -c "import json,sys; print(next(d['uuid'] for d in json.load(sys.stdin) if d['name']=='$DB_NAME'))")"
  fi
  VARS="\"vars\": { \"TEAM_DOMAIN\": \"$CF_TEAM_DOMAIN\", \"POLICY_AUD\": \"$CF_POLICY_AUD\" }"
fi

# Cloudflare refuses a date in the future and counts in UTC, which is behind local time for some hours after midnight: use today in UTC.
COMPAT_DATE="$(python3 -c "import datetime; print(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d'))")"

cat > wrangler.jsonc <<JSON
{
  "name": "$NAME",
  "compatibility_date": "$COMPAT_DATE",
  "main": "worker/index.ts",
  "workers_dev": true,
  "preview_urls": false,
  "assets": { "directory": "./out", "not_found_handling": "404-page", "run_worker_first": ["/api/sync/*", "/api/catalog/*", "/api/track/*", "/api/site/*", "/api/admin/*"] },
  "d1_databases": [{ "binding": "DB", "database_name": "$DB_NAME", "database_id": "$DB_ID" }],
  $VARS
}
JSON

if [ "$MODE" = "dev" ]; then
  echo "Running locally: http://localhost:8787 (no login; open it also as http://127.0.0.1:8787 to act as a second device)"
  npx --yes wrangler@latest dev --local --port 8787 --persist-to "$WORK/.state"
else
  echo "Uploading to Cloudflare as '$NAME'..."
  npx --yes wrangler@latest deploy
fi
