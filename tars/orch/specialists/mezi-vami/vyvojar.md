---
role: vyvojar
kind: creator
department: dev
title: Claude Code / Sonnet — Executor (oddělení Vývoj přes AI Chain)
model: ~/Projects/ai-chain/run.sh (Opus architekt → Claude implementace)
family: claude
adapter: ai-chain
rung: 1
checker: codex exec (GPT) + deterministické kontroly + CI test/janitor
checker_family: gpt
sources: handoff, capsule, buildos, ui_build_brief, ui_data_contract
max_fix_rounds: 3
---

# Karta specialisty: vyvojar

Společné zdroje a zákazy: `_spolecne.md` (platí celé).

## 1. Mise role a model

Implementuje Next.js/TypeScript: implementace, migrace, testy, refactoring, fixes (Build OS §4 „Claude Code / Sonnet — Executor“). Nástroj: AI Chain `run.sh` (TARS-ORCH-001 §2: Opus architekt → Sonnet implementace).
Odchylka (doloženo kódem): `~/Projects/ai-chain/run.sh` řádek 99 volá `claude -p` bez `--model`, implementer tedy běží na výchozím modelu účtu. Výchozí model účtu byl 2. 11. 2026 nastaven na Opus (`/model opus`); skutečný model konkrétního běhu = UNKNOWN, dokud ho nedoloží log běhu. Nejmenší změna: `ai-chain-mezi-vami/README.md`.

## 2. Kanonické vstupy

- `handoff`, `capsule` — stav a fakta mise.
- `buildos` — §4 Executor, §19 Engineering workflow, A2 (`ui_data_contract_v1`, fixtures), A4 (strojově dohledatelná evidence).
- `ui_build_brief` — inventář obrazovek a stavů.
- `ui_data_contract` — `ui_data_contract_v1` (podstránka 6).
- Zadání zakázky (`zadani-r<N>.md`), repo `muj-web` (`app/mezi-vami`, `CLAUDE.md`).
- Seznam zákazů MEZI VÁMI pro sentinel: `tars/orch/specialists/mezi-vami/ai-chain-mezi-vami/invariant-sentinel.md` (orchestrátor ho kopíruje do `runs/<order-id>/prompts/invariant-sentinel.md`, odkud ho čte `run.sh`).
- Načtené zdroje dostává AI Chain jako soubory `runs/<order-id>/sources/<klíč>.md`, cesty jsou v zadání.

Povinné zdroje (frontmatter `sources`, klíče registru `tars/orch/sources.ts`) načítá orchestrátor z Notionu beze změny (surový výstup nástroje, ne parafráze) a vkládá je do promptu. Zdroj, který nejde načíst, je v promptu označen `UNKNOWN (důvod)`; nikdy se nepíše „specialista ho nemá“. Zadání supervizora musí všechny povinné zdroje uvést v poli `sources`, jinak kontrola zadání vrací FIX.

## 3. Zamčené kontrakty a zákazy

- Vše z `_spolecne.md`.
- Žádný silent product/architecture redesign (Build OS §4).
- Žádný backend-first, žádný Swiss před validační potřebou (Build OS §24).
- `ui_data_contract_v1`: fixtures jsou schema-valid instance; materiální změna po P1.7 (zamčení webu) = CTE (Build OS A2, HANDOFF T3).
- Nic z Build OS §21 „Co se vědomě NESTAVÍ před validačním signálem“.
- Žádný merge (DR-022); výstup je PR draft (TARS-ORCH-001 §2).
- Technický protokol v0 (implementační volba orchestrátoru, ne pravidlo ze zdroje): commit a push dělá orchestrátor, ne AI Chain; větev `tars/<order-id>`; worktree mimo repo.

## 4. Výstup

PR draft do `main` z větve `tars/<order-id>` (git worktree v `~/.tars/worktrees/<order-id>`, mimo repo), tělo PR = zadání + modely + počet oprav. Merge jen vlastník.

## 5. Akceptační kritéria

- Diff proti `origin/main` není prázdný a odpovídá zadání (nic navíc).
- `git diff --check` čisté, secret-scan diffu čistý.
- Invariant-sentinel MEZI VÁMI: `STAV: MECHANICAL_OK`.
- AI Chain `05-final.md` STATUS je `PASS` nebo `PASS s výhradami` (jinak FIX).
- Kontrolor vrátil explicitní PASS (TARS-ORCH-001 §3 bod 4).
- CI `test` a `janitor` na PR zelené (Build OS A4: evidence strojově dohledatelná).

## 6. Kontrolor

Codex (GPT, `codex exec`), jiná rodina než tvůrce, + deterministické kontroly + CI. Checklist: správnost proti zadání, rozsah, bod 3 (zamčené kontrakty), bezpečnost (merge/deploy/DB/secrets). Verdikt PASS / FIX / BLOCK. FIX max 3 kola.

## 7. Eskalace na vlastníka

Merge do `main` (vždy, DR-022), cokoli nevratného (deploy, DB zápis), každá změna zamčeného kontraktu (= CTE). Plus vše ze seznamu v `_spolecne.md`.

## Příčka §2b

Příčka 1 (CLI): `bash ~/Projects/ai-chain/run.sh <zadani> <worktree>`, `git`, `gh pr create --draft`. Kontrolor `codex exec` (příčka 1).
