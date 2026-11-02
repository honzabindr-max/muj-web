# AI Chain pro MEZI VÁMI — konfigurace bez přepisu run.sh

## Jak se pravidla předávají (bez změny run.sh)

`run.sh` čte specifikace subagentů z `$ROOT_DIR/prompts/`, kde `ROOT_DIR = $(pwd)` v okamžiku spuštění
(`run.sh` řádky 162, 207, 278). Orchestrátor spouští `run.sh` s pracovním adresářem `runs/<order-id>/`
a před spuštěním tam připraví složku `prompts/`:

| Soubor v `runs/<order-id>/prompts/` | Zdroj |
| --- | --- |
| `invariant-sentinel.md` | tento adresář — seznam zákazů MEZI VÁMI (nahrazuje pravidla suggest-db) |
| `repo-recon.md` | kopie z `~/Projects/ai-chain/prompts/` (beze změny) |
| `evidence-collector.md` | kopie z `~/Projects/ai-chain/prompts/` (beze změny) |

Výsledek: sentinel kontroluje diff proti zamčeným kontraktům MEZI VÁMI, ne proti `crawler.py` / `jobid=2`.
`run.sh` zůstává nedotčený.

## Co konfigurací nejde: model implementera

`run_claude_step` volá `claude -p` bez `--model` (řádek 99). Implementer proto běží na výchozím modelu účtu
(od 2. 11. 2026 Opus), ne na Sonnetu, jak říká TARS-ORCH-001 §2 a Build OS §4 („Claude Code / Sonnet — Executor“).
Proměnná `ANTHROPIC_MODEL` by přepnula i architekta a finální krok, proto ji orchestrátor nepoužívá.

**Návrh nejmenší změny run.sh (NEPROVEDENO, čeká na GO vlastníka):**

```diff
-  ( cd "$cwd" && claude -p ) < "$prompt_file" > "$tmp" 2> "$stderr_file"
+  ( cd "$cwd" && claude -p ${CLAUDE_STEP_MODEL:+--model "$CLAUDE_STEP_MODEL"} ) < "$prompt_file" > "$tmp" 2> "$stderr_file"
```

a před krokem 03 `CLAUDE_STEP_MODEL=sonnet`, po něm `unset CLAUDE_STEP_MODEL`. Bez proměnné se chování nemění.
