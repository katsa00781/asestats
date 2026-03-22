#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/run-sql.sh <sql-file> [psql-args...]

Examples:
  ./scripts/run-sql.sh fix-duplicate-players-parameterized.sql
  ./scripts/run-sql.sh check-duplicate-players-cross-team.sql -v season=2025/2026

Environment:
  - DATABASE_URL (preferred)
  - SUPABASE_DB_URL (fallback)

Notes:
  - If .env.local exists, the script will source it automatically.
  - Uses: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <sql-file>
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

SQL_FILE="$1"
shift || true

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Error: SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "Error: DATABASE_URL is not set (or SUPABASE_DB_URL)." >&2
  echo "Set DATABASE_URL in your environment or in .env.local." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is not installed or not in PATH." >&2
  echo "Install PostgreSQL client tools first (e.g. brew install libpq)." >&2
  exit 1
fi

echo "Running: $SQL_FILE"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE" "$@"

echo "Done."
