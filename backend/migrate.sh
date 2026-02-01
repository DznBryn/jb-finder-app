#!/usr/bin/env sh
set -e

# Wait for Postgres (no external binaries required)
python - <<'PY'
import os
import time
import psycopg2

db_url = os.environ.get("DATABASE_URL", "")
if not db_url:
    raise SystemExit("DATABASE_URL is not set.")

for _ in range(60):
    try:
        conn = psycopg2.connect(db_url)
        conn.close()
        break
    except Exception:
        print("Waiting for Postgres...")
        time.sleep(1)
else:
    raise SystemExit("Postgres not ready after 60s.")
PY

alembic upgrade head
python -m app.schedulers.validate_companies
python -m app.schedulers.load_companies
python -m app.schedulers.run_refresh

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
