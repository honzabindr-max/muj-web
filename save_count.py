import os, sys
import psycopg

_ALLOWED_FIELDS = {"count_before", "count_after"}

dsn   = os.environ.get("HETZNER_WRITE_DATABASE_URL", "")
table = sys.argv[1] if len(sys.argv) > 1 else "crawl_state"
field = sys.argv[2] if len(sys.argv) > 2 else "count_before"
value = int(sys.argv[3]) if len(sys.argv) > 3 else 0

if field not in _ALLOWED_FIELDS:
    print("save_count: unknown field " + repr(field))
    sys.exit(1)
if not dsn:
    print("save_count: HETZNER_WRITE_DATABASE_URL not set")
    sys.exit(0)
try:
    with psycopg.connect(dsn, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE crawl_state SET {field} = %s WHERE id = 1", (value,))
    print("Saved " + field + "=" + str(value) + " to " + table)
except Exception as e:
    print("save_count error: " + str(e))
