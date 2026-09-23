"""Read-only status report (the VPS has no sqlite3 CLI). Never prints item text.

    /opt/h2-inbox-watcher/.venv/bin/python -m h2iw.status
"""

from __future__ import annotations

import sqlite3
import sys

from . import config


def main() -> int:
    conn = sqlite3.connect(f"file:{config.db_path()}?mode=ro", uri=True)
    print("items by status:")
    for status, n in conn.execute("select status, count(*) from items group by 1 order by 1"):
        print(f"  {status:<16} {n}")
    print("notes by subtype:")
    for sub, n in conn.execute("select subtype, count(*) from notes group by 1 order by 1"):
        print(f"  {sub:<16} {n}")
    print("last 10 items (id, status, type, updated_at):")
    for tid, status, cls, upd in conn.execute(
        "select task_id, status, json_extract(classification_json,'$.type'), updated_at "
        "from items order by updated_at desc limit 10"
    ):
        print(f"  {tid}  {status:<16} {cls or '-':<8} {upd}")
    print("LLM calls per day (last 14): calls, input, cache write, cache read, output, USD")
    cols = {r[1] for r in conn.execute("pragma table_info(llm_calls)")}
    cw_col = "sum(cache_write_tokens)" if "cache_write_tokens" in cols else "0"
    cr_col = "sum(cache_read_tokens)" if "cache_read_tokens" in cols else "0"
    for d, calls, i, cw, cr, o, usd in conn.execute(
        f"select date(at), count(*), sum(in_tokens), {cw_col}, {cr_col}, sum(out_tokens), "
        "round(sum(cost_usd), 4) from llm_calls group by 1 order by 1 desc limit 14"
    ):
        print(f"  {d}  {calls:>4}  in {i}  cw {cw}  cr {cr}  out {o}  {usd:.4f} USD")
    for key, value in conn.execute("select key, value from meta order by key"):
        print(f"meta {key} = {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
