# tars/guard — PreToolUse hooky

| Hook | Matcher | Co hlídá |
| --- | --- | --- |
| `bash-preflight.sh` → `bash-preflight.py` | `Bash` | P04 (DR-036): řetězení, heredoc, přesměrování do souboru, `tee`, `sed -i`, `perl -i`. DR-039: `cli.ts owner`. |
| `notion-owner-decision.py` | `mcp__.*[Nn]otion.*` | DR-039: zápis vlastnosti „Rozhodnutí vlastníka“. |

## Fail-closed (Radar 2026-11-03 #4)

Do 4. 11. 2026 byly oba hooky **fail-open**: chyba hooku skončila exit 1 a volání prošlo. Nově platí:

- V `.claude/settings.json` mají oba hooky `"onFailure": "block"` a `"timeout": 30` (sekundy). Klíč `onFailure` patří k jednotlivému hooku, vedle `timeout` (Claude Code 2.1.295 a novější). Volání se zablokuje, když hook nejde spustit (chybí `python3`, `bash` nebo skript), překročí timeout nebo skončí neočekávaným exit kódem.
- Skripty samy končí při chybě **exit 2**: chybí `python3`, chybí `bash-preflight.py`, vstup není platný JSON, výjimka ve skriptu. Exit 2 blokuje vždy, i bez `onFailure`. Je to druhá vrstva pro případ, že by `onFailure` někde chybělo (jiný worktree, starší Claude Code).
- Hláška na stderr nenese obsah příkazu ani vstupu, jen typ chyby.

## Nejistý rozbor (P20)

Když parser `bash-preflight` příkaz bezpečně nerozebere (nedovřená uvozovka, nedovřené `$(` apod.):

- příkaz obsahuje `cli.ts` (také `cli.js`, `.mjs`, `.cjs`) nebo `tars/orch/cli` → **deny** (`UNSURE_DENY_CLI`). U takového příkazu nejde vyloučit podpříkaz `owner`. Allowlist tento deny nepřebije.
- jiný nejistý příkaz → **allow** (`UNSURE_ALLOW`, jen záznam v logu). Shell takový příkaz stejně většinou odmítne jako syntaktickou chybu. Plošný deny by zbytečně blokoval běžnou práci (např. `grep` s apostrofem v textu).

## Hranice zápisu

`permissions.blockWritesOutsideWorkingDirectories: true`: Claude Code odmítne **Write, Edit a NotebookEdit** mimo pracovní adresáře, a to v každém režimu oprávnění. Pracovní adresář je adresář session plus adresáře přidané přes `/add-dir` nebo `permissions.additionalDirectories`.

Nastavení se **nevztahuje** na Bash, MCP nástroje ani na programy hooků; ty mají vlastní hranice. Bash tedy dál může zapisovat kamkoli, kam smí jeho proces. Bash sandbox je mimo rozsah této změny.

Důsledky:

- Agent spuštěný ve worktree (`~/Projects/muj-web-<x>`) nemůže nástrojem Write/Edit zapsat do jiného worktree ani do `~/.tars/...`. Takový výstup patří do worktree, nebo je nutné spustit session s `--add-dir`.
- Při zapnutém nastavení Claude Code odmítá i zápis do svých souborů nastavení (`.claude/settings*.json`), protože soubor nastavení by blok mohl zrušit. Změnu `.claude/settings.json` proto dělá vlastník nebo orchestrátor mimo Claude Code (patch, `git apply`).

## Launchd copy tick

Tick (`tars/orch/launchd/work.good-inventions.tars-orch.plist`) spouští `zsh -lc … npx tsx tars/orch/cli.ts tick` přímo, ne přes Claude Code. Na tick samotný se hooky ani `permissions` nevztahují. Když hook dopadne na vnořené volání `claude -p` z ticku, s `python3` na `/usr/bin` propustí běžná volání stejně jako dřív (test `fail-closed.test.ts`, prostředí `PATH=/usr/bin:/bin`).

## Testy

`tars/guard/__tests__/`: `bash-preflight.test.ts`, `notion-owner-decision.test.ts`, `fail-closed.test.ts` (selhání = blok, P20, platnost `settings.json`, launchd).
