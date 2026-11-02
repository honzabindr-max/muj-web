# Specialisté TARS (mise MEZI VÁMI) jako definice subagentů

Jediný zdroj pravdy pro specialisty orchestrátoru `tars/orch` (DR-029, krok 2). Karty z `tars/orch/specialists/` zanikly, orchestrátor je načítá odtud (`tars/orch/cards.ts`). Formát subagentů ověřen v oficiální dokumentaci: https://code.claude.com/docs/en/sub-agents (povinné jen `name` a `description`, `tools` jako seznam oddělený čárkami, `model` = `opus`/`sonnet`/`haiku`/`inherit`, neznámá pole Claude Code mlčky ignoruje, soubor bez `name` bere jako dokumentaci).

## Role

| Role | Rodina | Kde běží | Soubor |
| --- | --- | --- | --- |
| supervizor | Claude (opus) | subagent Claude Code | `supervizor.md` |
| vyvojar | Claude (sonnet) | subagent Claude Code | `vyvojar.md` |
| vizual | Claude (sonnet) | subagent Claude Code; skutečný výkon: Claude Design přes prohlížeč (příčka 3) | `vizual.md` |
| invariant-sentinel | Claude (sonnet) | subagent Claude Code; v AI Chain se předává bez frontmatteru | `invariant-sentinel.md` |
| copy-studio | GPT | GPT přes codex (krok 1) | `gpt/copy-studio.md` |
| brana | GPT | GPT přes codex (krok 1) | `gpt/brana.md` |

Konzilium (advokát, rada odborníků, soudce) má vlastní karty ve složce `konzilium/`. Spouští je jen uložený workflow `/konzilium` (`.claude/workflows/konzilium.js`, krok 3), viz `konzilium/README.md`. Orchestrátor `tars/orch` je jako specialisty oddělení nepoužívá.

Každá definice obsahuje: frontmatter (`name`, `description` = kdy roli použít, `model`, `tools`, plus pole TARS: `kind`, `department`, `title`, `executor`, `family`, `adapter`, `rung`, `checker`, `checker_family`, `sources`, `max_fix_rounds`) a tělo se sedmi sekcemi karty (role a model, povinné zdroje, zákazy, výstup, kritéria přijetí, kontrolor, eskalace, příčka) a sekcí „Společné podklady“ (dřívější `_spolecne.md`, ve všech definicích shodná).

## GPT přes codex (krok 1)

Role, které podle karty dělá GPT, nejsou Claude subagenty. Jejich soubory v `gpt/` záměrně nemají pole `name` (místo něj `role`), takže je Claude Code načte jen jako dokumentaci a Claude je nikdy nespustí. Čte je pouze orchestrátor, který je vkládá do promptu pro `codex exec` (read-only sandbox, od kroku 1 s `--output-schema` a JSON verdiktem `{verdict, findings[]}`).

- copy-studio: tvůrce oddělení Copy, `codex exec` s promptem přes stdin. Kontroluje ho Claude Opus.
- brana: nezávislá brána (fresh-context), `codex exec` v `read-only`. Verdikt brány kontroluje formou Claude Sonnet.
- Kontroloři Claude subagentů jsou GPT přes `codex exec`: kontrola zadání supervizora, review vývojáře (plus deterministické kontroly a CI) a brána pro vizuál.

## Pravidlo „tvůrce a kontrolor z různých rodin“

Platí dál a hlídá se na třech místech: `validateCardText` (`tars/orch/cards.ts`, `checker_family` ≠ `family`, role GPT nesmí mít `name`, role Claude musí), `assertFamilies` a `preflight` v `tars/orch/orchestrator.ts` (karta musí odpovídat zapojeným adaptérům) a test „recepty“ v `tars/orch/__tests__/orch.test.ts` (každé oddělení a supervizor mají tvůrce a kontrolora z různých rodin).

## Nativní spuštění mimo orchestrátor

Pravidlo „tvůrce a kontrolor z různých rodin“ vynucuje orchestrátor (zakázky přes `tars/orch`). Když se Claude subagent z této složky spustí přímo v sezení Claude Code, orchestrátor v tom neběží a `checker_family` se tam jen eviduje. Kontrolu GPT pak zajišťuje review gate pluginu codex-plugin-cc z kroku 1 (Stop hook, zapíná se per workspace příkazem `/codex:setup --enable-review-gate`, viz plán převodu), ne tento krok. Nový vynucovací mechanismus (hook) tento krok nepřidává.

## Odchylky od původních karet

- `supervizor`: karta říkala „bez nástrojů“ (volání `claude -p --model opus`). To se nemění, orchestrátor dál volá `claude -p` bez nástrojů. Definice subagenta má `tools: Read, Grep, Glob` (jen čtení), protože prázdné `tools` dokumentace neuvádí a při vynechání pole subagent dědí všechny nástroje.
- `vizual`: karta nemá model Claude Code (Claude Design je webová aplikace). `model: sonnet` je řídicí role, původní text je v poli `executor`; skutečný výkon zůstává v prohlížeči.
- `invariant-sentinel`: karta neměla model, zvolen `sonnet` (mechanický scan).
- `vyvojar`: `model: sonnet` podle karty a Build OS §4; skutečný model běhu AI Chain je UNKNOWN (viz sekce AI Chain).

## AI Chain (run.sh)


### Jak se pravidla předávají (bez změny run.sh)

`run.sh` čte specifikace subagentů z `$ROOT_DIR/prompts/`, kde `ROOT_DIR = $(pwd)` v okamžiku spuštění
(`run.sh` řádky 162, 207, 278). Orchestrátor spouští `run.sh` s pracovním adresářem `runs/<order-id>/`
a před spuštěním tam připraví složku `prompts/`:

| Soubor v `runs/<order-id>/prompts/` | Zdroj |
| --- | --- |
| `invariant-sentinel.md` | `.claude/agents/invariant-sentinel.md` (bez frontmatteru) — seznam zákazů MEZI VÁMI (nahrazuje pravidla suggest-db) |
| `repo-recon.md` | kopie z `~/Projects/ai-chain/prompts/` (beze změny) |
| `evidence-collector.md` | kopie z `~/Projects/ai-chain/prompts/` (beze změny) |

Výsledek: sentinel kontroluje diff proti zamčeným kontraktům MEZI VÁMI, ne proti `crawler.py` / `jobid=2`.
`run.sh` zůstává nedotčený.

### Co konfigurací nejde: model implementera

`run_claude_step` volá `claude -p` bez `--model` (řádek 99). Implementer proto běží na výchozím modelu účtu
(od 2. 11. 2026 Opus), ne na Sonnetu, jak říká TARS-ORCH-001 §2 a Build OS §4 („Claude Code / Sonnet — Executor“).
Proměnná `ANTHROPIC_MODEL` by přepnula i architekta a finální krok, proto ji orchestrátor nepoužívá.

**Návrh nejmenší změny run.sh (NEPROVEDENO, čeká na GO vlastníka):**

```diff
-  ( cd "$cwd" && claude -p ) < "$prompt_file" > "$tmp" 2> "$stderr_file"
+  ( cd "$cwd" && claude -p ${CLAUDE_STEP_MODEL:+--model "$CLAUDE_STEP_MODEL"} ) < "$prompt_file" > "$tmp" 2> "$stderr_file"
```

a před krokem 03 `CLAUDE_STEP_MODEL=sonnet`, po něm `unset CLAUDE_STEP_MODEL`. Bez proměnné se chování nemění.
