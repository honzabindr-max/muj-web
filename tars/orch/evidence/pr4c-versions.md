# PR 4c — verze CLI a ověření názvů proměnných watchdogu

Zjištěno 5. 11. 2026 na Macu stavitele (worktree `muj-web-e4pr4c`, větev `tars/etapa4-4c`). Kvóta se nečerpala:
nic z níže uvedeného nespouští model.

## Verze

| Příkaz | Výstup |
| --- | --- |
| `claude --version` | `2.1.317 (Claude Code)` |
| `codex --version` | `codex-cli 0.166.0` |
| `readlink -f "$(command -v claude)"` | `/Users/janbindr/.local/share/claude/versions/2.1.317` |

Ověřená verze pro watchdog a pro fixture tvarů hlášek: **2.1.317** (`WATCHDOG_VERIFIED_CLAUDE_VERSIONS` v
`tars/orch/watchdog.ts`). Jiná verze = watchdog se nezapne, čas resetu „nedoloženo“ → `PAUSED` s `pauseMinutes`.
Codex watchdog nemá; jeho čas resetu je od PR 1 vždy „nedoloženo“ (beze změny).

## Názvy proměnných (binárka 2.1.317)

`strings <binárka> | grep -oE "CLAUDE_CODE_RETRY_WATCHDOG[A-Z_]*" | sort | uniq -c`:

```
   7 CLAUDE_CODE_RETRY_WATCHDOG
   4 CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS
   4 CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS
   3 CLAUDE_CODE_RETRY_WATCHDOG_SCOPE
   4 CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS
```

Všechny tři názvy ze zadání jsou doložené: `CLAUDE_CODE_RETRY_WATCHDOG`, `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS`,
`CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS`. `…_SCOPE` a `…_USAGE_LIMIT_RECHECK_MS` TARS nenastavuje.

## Typy hodnot (schéma prostředí v binárce 2.1.317)

`LC_ALL=C grep -a -o -E ",(dN|FN|fN|KN)=L\.[a-z]+\([^)]{0,80}\)" <binárka>` a `",mN=L.bool()"`:

```
CLAUDE_CODE_RETRY_WATCHDOG                         mN = L.bool()
CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS             FN = L.int({min:1,digitsOnly:!0})
CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS dN = L.int({min:1,digitsOnly:!0})
CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS  fN = L.int({min:60000,max:10800000,digitsOnly:!0})
CLAUDE_CODE_RETRY_WATCHDOG_SCOPE                   KN = L.enum(["capacity"])
```

(mapování jmen na proměnné: export `CLAUDE_CODE_RETRY_WATCHDOG:()=>mN, …_MAX_USAGE_LIMIT_WAIT_MS:()=>dN,
…_MAX_WAIT_MS:()=>FN, …_SCOPE:()=>KN, …_USAGE_LIMIT_RECHECK_MS:()=>fN`.) Hodnota `0` je pro oba stropy neplatná
(`min: 1`), proto TARS dává nejmenší platnou hodnotu `1` ms pro strop limitu předplatného.

## Význam stropů (úryvky z binárky 2.1.317)

- 429/529: `let xr=(i.CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS??1/0)-ke.spentMs;if(xr<=0)throw …"api_request_capacity_wait_exhausted"` —
  bez stropu čeká neomezeně, se stropem skončí chybou po vyčerpání.
- limit předplatného: `let Wi=(i.CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS??1/0)-ke.usageLimitSpentMs;if(Ls>Wi){… if(Wi<=0||…)throw …"api_request_usage_limit_wait_too_long",new ef(hn,b)` —
  reset dál, než zbývá ze stropu, ukončí požadavek původní chybou limitu (CLI vrátí běžnou hlášku limitu).
- `system/api_retry` ve stream-json: `subtype:"api_retry",attempt:…,max_retries:…,retry_delay_ms:…,error_status:429,error:"rate_limit"`;
  mapování `error`: 529 → `overloaded`, 429 → `rate_limit`. Pole s časem resetu kvóty nemá (DR-027 §8.2).

## Changelog (cache `~/.claude/cache/changelog.md`, nejnovější záznam 2.1.316)

| Verze | Záznam |
| --- | --- |
| 2.1.186 | „Changed `CLAUDE_CODE_MAX_RETRIES` to cap at 15; for unattended sessions, use `CLAUDE_CODE_RETRY_WATCHDOG` instead“ |
| 2.1.295 | „Added `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` to limit how long unattended retry mode (`CLAUDE_CODE_RETRY_WATCHDOG`) waits out 429 and 529 errors“ |
| 2.1.301 | „Added `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS` so unattended retry mode (`CLAUDE_CODE_RETRY_WATCHDOG`) ends a request at a usage limit that resets too far away instead of waiting“ |
| 2.1.305 | „Added `CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS` …“ |
| 2.1.311 | „Fixed Claude Code retrying requests the API marked not to retry, which could hold a turn for minutes or, in unattended retry mode (`CLAUDE_CODE_RETRY_WATCHDOG`), indefinitely“ |

## Co TARS nastaví (jen ověřená verze, jen dítě `claude -p` v `ClaudeCli`)

| Proměnná | Hodnota | Proč |
| --- | --- | --- |
| `CLAUDE_CODE_RETRY_WATCHDOG` | `1` | dodatek v6.1 #2 |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` | `min(300000, ½ tvrdého limitu)` | kratší než tvrdý limit procesu (výchozí 20 min) |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS` | `1` | dítě nečeká na reset kvóty s drženým lease |

Zděděné proměnné `CLAUDE_CODE_RETRY_WATCHDOG*` z prostředí orchestrátoru `childEnv()` vždy odstraní (žádné dítě je
nedědí bez stropů, ani Codex, ani AI Chain).
