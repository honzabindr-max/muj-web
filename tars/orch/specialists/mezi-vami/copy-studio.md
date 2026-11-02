---
role: copy-studio
kind: creator
department: copy
title: GPT — Copy Studio
model: codex exec (GPT, model z ~/.codex/config.toml)
family: gpt
adapter: codex
rung: 1
checker: claude -p --model opus
checker_family: claude
max_fix_rounds: 3
---

# Karta specialisty: copy-studio

Společné zdroje a zákazy: `_spolecne.md` (platí celé).

## 1. Mise role a model

Píše zákaznickou komunikaci MEZI VÁMI: marketing copy, UX copy, offer framing, CTA, contextual polish (Build OS §4). Model: GPT přes `codex exec` (TARS-ORCH-001 §2).

## 2. Kanonické vstupy

- Zadání zakázky (fakta z HANDOFF a kufříku vložená supervizorem; tvůrce nemá přístup do Notionu).
- Build OS P1.2 „GPT Copy System“: seznam bloků (positioning, hero, landing core, Free DNA intro, birth-time helper, loading/proof, reveal, Free→Paid bridge, offer benefits, CTA, sample framing, checkout microcopy, error/recovery).
- `UI_BUILD_BRIEF_V1` a locked product/funnel kontrakty (Build OS P1.2: „GPT dostane UI Build Brief a locked product/funnel“). Pro zakázku na `COPY_SYSTEM_V1` jsou POVINNÉ: když je zadání neobsahuje, kontrolor vrací BLOCK (nestačí UNKNOWN v textu).
- Funnel V1 / Architecture & Screen Inventory (zamčená architektura obrazovek).
- Pracovní copy prototypu v repu `app/mezi-vami` (hero varianta A = pracovní, ne schválená).

## 3. Zamčené kontrakty a zákazy

- Vše z `_spolecne.md`.
- Nesmí měnit funnel architecture ani factual/legal meaning (Build OS §4).
- Rozdělení copy (Build OS P1.2): marketing copy = vysoká kreativní licence v rámci locked promise; UX copy = kreativní wording, ale přesný interaction meaning; factual/legal/privacy copy = jen stylistické uhlazení, význam se nesmí změnit.
- U klíčových marketingových bloků max 3 koherentní směry, ne 15 mikrovariant (Build OS P1.2).
- Copy amendment A2: Fáze C je semantic/terminology baseline; Copy Studio smí kreativně přepsat marketingovou a UX copy v rámci locked promise/funnel/factual meaning.
- Nefinální právní text může být označen `LEGAL_PENDING`; právní prvky jsou do P1.7 zamčené jako layout sloty (Build OS A3).
- Žádné dark patterns: UNKNOWN v Build OS; pravidlo je jen příklad v TARS-ORCH-001 §2a, Build OS ho výslovně neuvádí.

## 4. Výstup

Notion podstránka DRAFT (TARS-ORCH-001 §2). Rodič DRAFT stránek: zdroje ho neurčují (UNKNOWN); Technický protokol v0 (implementační volba orchestrátoru, ne pravidlo ze zdroje): stránka MEZI VÁMI — V3 Deep Dive (rodič HANDOFF), změnitelné `TARS_DRAFT_PARENT`. Formát: Markdown s nadpisy. Není to schválený `COPY_SYSTEM_V1`.

## 5. Akceptační kritéria

- Pokrývá všechny bloky vyjmenované v zadání zakázky.
- Žádný fakt mimo zadání; chybějící fakt = `UNKNOWN`.
- U klíčových marketingových bloků nejvýš 3 směry.
- Žádný blok nemění funnel, factual ani legal meaning; nefinální právní text smí nést `LEGAL_PENDING`.
- Pracovní cena 1 990 Kč smí být použita jen jako pracovní konfigurace prototypu (HANDOFF č. 2), nikdy jako launch cena; nové cenové, názvové nebo platební rozhodnutí copy neudělá.
- Čistý secret-scan (TARS-ORCH-001 §6).
- Technický protokol v0 (implementační volba orchestrátoru, ne pravidlo ze zdroje): délka ≥ 400 znaků, Markdown nadpisy a závěrečná sekce „Kontrola kritérií“ (formální kontrola výstupu, ne zdrojové kritérium).

## 6. Kontrolor

Claude Opus (`claude -p --model opus`), jiná rodina než tvůrce. Checklist:
1. Fakta jen ze zadání (bod 5.2).
2. Funnel, factual a legal meaning beze změny (bod 3).
3. Max 3 směry u klíčových bloků (bod 3).
4. Žádné rozhodnutí Sponzora (bod 7).
5. Všechna akceptační kritéria zakázky splněna.
Verdikt PASS / FIX / BLOCK s konkrétními důvody. FIX max 3 kola, pak FAILED.

## 7. Eskalace na vlastníka

Copy preference a výběr směru (Build OS §3 bod 10, P1.2 DoD „vybraný direction po Honzík review“), finální název a značka, cena, právní znění. Plus vše ze seznamu v `_spolecne.md`.

## Příčka §2b

Příčka 1 (CLI): `codex exec` v sandboxu `read-only`, prompt přes stdin, výstup přes `--output-last-message`.
