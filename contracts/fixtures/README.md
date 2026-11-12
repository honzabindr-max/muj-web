# Fixtures `ui_data_contract_v1` v1.0.1

Zdroj: `FIXTURE_MATRIX_V1` (Notion 3d10ae49…, export ověřen proti `CHECKSUMS.sha256` balíčku `claude_reconciliation_unblock_2026-10-03`).
Brány: JSON Schema (2020-12, format assertion) + `scripts/validate_fixture_semantics.py`. `scripts/run_validation.py`: 18/18 POSITIVE, 20/20 COUNTER.

## Původ souborů

| Soubor | Původ |
| --- | --- |
| `FX-EE-01`, `FX-UU-R1ONLY`, `FX-MAXLEN-ALL`, `CF-COHORT-MISMATCH`, `CF-BRIDGE-UNDETECTED-THEME`, `CF-ORDER-LEAK` | doslova z `files.zip` (autorský běh G1, 2026-09-04) |
| ostatních 15 `FX-*` | **odvozeno z řádků matice** (struktura podle scénáře, texty `[COPY_PENDING]`, žádná astrologická fakta), vzor `FX-EE-01` |
| ostatních 17 `CF-*` | **odvozeno z řádků matice**: validní fixture + právě jedno porušení; vrstva odmítnutí odpovídá sloupci „Odmítnuto vrstvou“ |

`MEZI_VAMI_REPO_CONTRACT/fixtures-index.ts` (zod, tvar `_version` / `calculation_state`) **není** instancí `ui_data_contract_v1.json` v1.0.1, proto ho nešlo převzít doslova (jiné schéma).
