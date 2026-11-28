#!/usr/bin/env bash
# Backs up and restores the Cloudflare D1 database that holds synced designs, the catalog, uploads, statistics and settings.
#
#   scripts/backup-d1.sh                  export everything to backups/<name>-<UTC time>.sql (git-ignored) and keep the newest 20
#   scripts/backup-d1.sh list             list the files in backups/
#   scripts/backup-d1.sh restore FILE --yes   write a backup file back (takes a fresh backup of the current data first)
#   scripts/backup-d1.sh timetravel       show the point-in-time bookmark Cloudflare keeps (restore with wrangler d1 time-travel restore)
#
# Needs `npx wrangler login` once. See docs/decisions/0066-d1-backup-and-restore.md.
set -euo pipefail

DB_NAME="${CF_DB_NAME:-rhinestone-sync}"
KEEP="${BACKUP_KEEP:-20}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/backups"
WRANGLER=(npx --yes wrangler@latest)
CMD="${1:-backup}"

backup() {
  mkdir -p "$DIR"
  local stamp file
  stamp="$(python3 -c "import datetime; print(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))")"
  file="$DIR/$DB_NAME-$stamp.sql"
  "${WRANGLER[@]}" d1 export "$DB_NAME" --remote --output "$file" >&2
  # An empty or schema-less export is a failed backup: do not keep it and do not count it.
  if ! grep -q 'CREATE TABLE' "$file"; then
    rm -f "$file"
    echo "The export had no tables: nothing was saved." >&2
    exit 1
  fi
  echo "Saved $file ($(wc -c < "$file" | tr -d ' ') bytes, $(grep -c '^INSERT INTO' "$file" || true) rows)" >&2
  # Keep the newest $KEEP files.
  ls -1t "$DIR"/"$DB_NAME"-*.sql 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f "$old"; done
  echo "$file"
}

case "$CMD" in
  backup)
    backup >/dev/null
    ;;
  list)
    ls -lh "$DIR"/"$DB_NAME"-*.sql 2>/dev/null || echo "No backups yet: run scripts/backup-d1.sh"
    ;;
  timetravel)
    "${WRANGLER[@]}" d1 time-travel info "$DB_NAME"
    ;;
  restore)
    FILE="${2:-}"
    [ -n "$FILE" ] && [ -f "$FILE" ] || { echo "Usage: scripts/backup-d1.sh restore FILE --yes" >&2; exit 1; }
    [ "${3:-}" = "--yes" ] || { echo "Restoring replaces the data in '$DB_NAME' with $FILE. Run again with --yes to do it." >&2; exit 1; }
    grep -q 'CREATE TABLE' "$FILE" || { echo "$FILE has no tables: refusing to restore it." >&2; exit 1; }
    if [ -z "${LOCAL_DIR:-}" ]; then
      echo "Taking a safety backup of the current data first..." >&2
      backup >/dev/null
    fi
    # An export only creates tables and writes text chunks too long for one statement: make it restorable (see d1-restore-sql.mjs).
    RESTORE_SQL="$(mktemp)"
    trap 'rm -f "$RESTORE_SQL"' EXIT
    node "$ROOT/scripts/d1-restore-sql.mjs" "$FILE" > "$RESTORE_SQL"
    if [ "${LOCAL_DIR:-}" != "" ]; then
      # For testing the routine against a local copy: LOCAL_DIR=<folder with a wrangler.jsonc and a state folder>
      (cd "$LOCAL_DIR" && "${WRANGLER[@]}" d1 execute "$DB_NAME" --local --persist-to .state --yes --file "$RESTORE_SQL")
    else
      "${WRANGLER[@]}" d1 execute "$DB_NAME" --remote --yes --file "$RESTORE_SQL"
    fi
    ;;
  *)
    echo "Unknown command: $CMD (backup | list | restore FILE --yes | timetravel)" >&2
    exit 1
    ;;
esac
