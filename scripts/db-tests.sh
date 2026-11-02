#!/usr/bin/env bash
# VOPILA veritabanı güvenlik testleri.
# Kullanım:  SUPABASE_DB_URL='postgresql://...' bash scripts/db-tests.sh
# Her dosya tek bir işlemde çalışır ve sonunda geri alınır (rollback): veritabanında iz kalmaz.
# Bağlantı adresi gizlidir; dosyaya yazılmaz, yalnızca ortam değişkeni / GitHub "secret" olarak verilir.
set -uo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL tanımlı değil; veritabanı testleri atlandı."
  exit 0
fi

dir="$(cd "$(dirname "$0")/../supabase/tests" && pwd)"
failed=0

for f in "$dir"/[0-9]*.sql; do
  name="$(basename "$f")"
  if out=$( { echo 'begin;'; cat "$dir/_helpers.sql" "$f"; echo 'rollback;'; } \
            | psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 2>&1 ); then
    echo "✓ $name"
  else
    echo "✗ $name"
    echo "$out" | grep -E 'FAIL|ERROR' | head -5 | sed 's/^/    /'
    failed=1
  fi
done

exit $failed
