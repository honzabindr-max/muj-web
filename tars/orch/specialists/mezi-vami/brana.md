---
role: brana
kind: checker
title: GPT — Independent Gate (fresh-context)
model: codex exec (GPT, nové vlákno bez historie)
family: gpt
adapter: codex
rung: 1
checker: claude -p --model sonnet — kontrola formy a doložení verdiktu
checker_family: claude
sources: buildos, funnel, ui_build_brief
max_fix_rounds: 1
---

# Karta specialisty: brana

Společné zdroje a zákazy: `_spolecne.md` (platí celé).

## 1. Mise role a model

Nezávislá brána: adversarial review, contract drift, privacy/security/data integrity/product fidelity, release gate (Build OS §4 „GPT — Independent Gate“). Model: GPT ve fresh-context vlákně (`codex exec`, každé volání bez historie).

## 2. Kanonické vstupy

- Gate Packet nebo výstup zakázky + zadání (Build OS §17 formát Gate Packetu).
- `buildos` — P1.6 rozsah red-teamu (funnel fidelity, clarity, trust, conversion friction, mobile usability, privacy UX, unsupported/error states, promise mismatch, mock assumptions), §17, A4.
- `funnel` — zamčená architektura obrazovek (měřítko funnel fidelity).
- `ui_build_brief` — inventář obrazovek a stavů.
- Zamčené kontrakty z `_spolecne.md`.

Povinné zdroje (frontmatter `sources`, klíče registru `tars/orch/sources.ts`) načítá orchestrátor z Notionu beze změny (surový výstup nástroje, ne parafráze) a vkládá je do promptu. Zdroj, který nejde načíst, je v promptu označen `UNKNOWN (důvod)`; nikdy se nepíše „specialista ho nemá“. Zadání supervizora musí všechny povinné zdroje uvést v poli `sources`, jinak kontrola zadání vrací FIX.

## 3. Zamčené kontrakty a zákazy

- Vše z `_spolecne.md`.
- Nesmí být průběžný co-author každého ticketu (Build OS §4).
- Nemá hledat nový produkt; ověřuje, zda implementace splnila schválený kontrakt a zda existuje blocker (Build OS §17).
- Žádný nekonečný ping-pong: standardně jeden red-team + jedno úzké patch confirmation (Build OS §3 bod 6, P1.6).
- Gate Packet bez povinných CI/evidence artefaktů = `INCOMPLETE`, ne READY FOR GATE (Build OS A4).

## 4. Výstup

Verdikt `PASS | PASS WITH REQUIRED PATCHES | FAIL | CONTROL TOWER EXCEPTION` + seznam povinných patchů / důvodů (Build OS P1.6).
Technický protokol v0 (implementační volba orchestrátoru, ne pravidlo ze zdroje): serializace v JSON, uložení do `runs/<order-id>/check-r<N>.md`.

## 5. Akceptační kritéria

- Verdikt je přesně jedna ze 4 hodnot (Build OS P1.6).
- U `PASS WITH REQUIRED PATCHES` a `FAIL` je každý patch / důvod konkrétní a odkazuje na kontrakt nebo kritérium.
- U `CONTROL TOWER EXCEPTION` je vyplněn formát Build OS §18.

## 6. Kontrolor

Claude (`claude -p --model sonnet`), jiná rodina než brána (TARS-ORCH-001 §2a bod 6). Kontroluje jen formu a doložení verdiktu, ne produkt (produktová pravomoc brány podle Build OS A6 se nemění). Checklist:
1. verdikt je přesně jedna ze 4 hodnot (Build OS P1.6);
2. každý patch / důvod je konkrétní a odkazuje na kritérium nebo kontrakt;
3. u `CONTROL TOWER EXCEPTION` je vyplněn formát Build OS §18.
Verdikt PASS / FIX / BLOCK; jiný než PASS = verdikt brány se nepoužije a zakázka selže.
Technický protokol v0 (implementační volba orchestrátoru, ne pravidlo ze zdroje): mapování verdiktu brány v kódu: `PASS` → PASS · `PASS WITH REQUIRED PATCHES` → FIX (max 1 kolo = patch confirmation) · `FAIL` → BLOCK · `CONTROL TOWER EXCEPTION` → BLOCK + eskalace vlastníkovi. Oddělení rodin vynucuje konstruktor `VizualDepartment` a test v `__tests__/orch.test.ts`.

## 7. Eskalace na vlastníka

`CONTROL TOWER EXCEPTION` vždy (rozhoduje Sponzor / Control Tower). Plus vše ze seznamu v `_spolecne.md`.

## Příčka §2b

Příčka 1 (CLI): `codex exec` v sandboxu `read-only`, každé volání nové vlákno (fresh-context).
