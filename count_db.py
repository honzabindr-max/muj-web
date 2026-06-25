import os, sys
import psycopg

dsn = os.environ.get("HETZNER_WRITE_DATABASE_URL", "")
if not dsn:
    print(0)
    sys.exit(0)
try:
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM suggestions")
            row = cur.fetchone()
            print(row[0] if row else 0)
except Exception:
    print(0)
