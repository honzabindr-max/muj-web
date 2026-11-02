# Konzilium (workflow `/konzilium`, DR-029 krok 3)

Konzilium je krok před tím, než výstup uvidí vlastník (TARS-ORCH-001 §2e, DR-024). Dřív to byl vlastní kód `tars/orch/konzilium.ts` v PR #82 (nesloučený). Teď je to uložený workflow Claude Code `.claude/workflows/konzilium.js` (formát: https://code.claude.com/docs/en/workflows). Role, prompty a pravidla jsou převzaté z PR #82, karty rolí leží v této složce.

## Spuštění

V sezení Claude Code v kořeni repa `muj-web`:

```text
/konzilium out_dir=/abs/cesta/k/zakazce draft=draft-v1.md creator_family=gpt creator_model="codex exec (gpt-…)" brief={…}
```

Claude předá parametry jako `args` (objekt):

| Pole | Povinné | Význam |
| --- | --- | --- |
| `out_dir` | ano | Absolutní cesta ke složce zakázky. Sem jde `decision.json`, mezivýstupy do `konzilium/`. Každý běh potřebuje prázdnou `konzilium/` (výstupy jiného běhu se nikdy nepoužijí). |
| `draft` | ano | Draft k posouzení, relativně k `out_dir` nebo absolutně. |
| `creator_family` | ano | `claude` nebo `gpt`. Bez toho (nebo při nesouladu s `creator_model`) je výsledek `NELZE_OVERIT`. |
| `creator_model` | ano | Popis modelu tvůrce s názvem modelu, např. `codex exec (gpt-6.1-sol)` nebo `claude -p --model opus`. Musí patřit do `creator_family`. Samotný název CLI (`codex exec`, `codex-default`) rodinu neprokazuje. |
| `brief` | ano | Zadání: `title`, `department`, `milestone`, `why`, `goal`, `inputs[]`, `acceptance[]`, `owner_decisions[]`. |
| `sources` | ne | `[{key, path}]` lokální soubory zdrojů (`handoff`, `funnel`, `cte06`, `ui_build_brief`). Chybějící zdroj = UNKNOWN. |
| `kind` | ne | `copy` (výchozí) nebo `prep`. |
| `order`, `creator_role`, `creator_card`, `draft_url`, `mission` | ne | ID zakázky, název role tvůrce, karta tvůrce (výchozí `.claude/agents/gpt/copy-studio.md`), odkaz na draft v Notionu, mise. |
| `panel`, `panel_title`, `archive_parent` | ne | `panel: false` = jen `decision.json`. `panel_title` = název řádku. `archive_parent` = Notion stránka, pod kterou vznikne archiv balíčku (jeho odkaz jde do „Odkaz na výstup“). |

V `claude -p` workflow nikdy nežádá o souhlas, spuštění musí povolit pravidlo (`--allowedTools Workflow` nebo `Workflow(konzilium)`). Agenti potřebují `Read`, `Write` a `Bash(npx tsx tars/orch/konzilium-bridge.ts:*)`. Složka repa musí být důvěryhodná (workspace trust), jinak Claude Code přeskočí hooky subagentů.

## Průběh

1. **Příprava** – most (`tars/orch/konzilium-bridge.ts prep`) ověří vstupy, rodiny a karty, secret-scanem projde draft, zadání, kartu tvůrce i zdroje (nález = konec, nic nejde žádnému modelu) a zapíše `konzilium/run.json` (s identitou běhu `run_id`) a `konzilium/brief.md`.
2. **Advokát a rada** (paralelně) – Advokát prvního principu (otázky „proč“, plus povinné otázky receptu) a pět odborníků: prodejní psycholog, brand stratég a etický strážce jako Claude subagenti (`konzilium-*`, Opus, nástroje jen Read a Write), UX/UI a hlas zákazníka jako GPT přes `codex exec --output-schema`. Most pak zkontroluje verdikty (`council`): aspoň 3 z 5 čitelné a čitelné verdikty obou rodin.
3. **Zapracování** – tvůrce (stejná rodina jako původní tvůrce) zapracuje verdikty v jednom průchodu. Kontrolor jiné rodiny než tvůrce vrátí strukturovaný verdikt kroku 1 (`PASS|FIX|BLOCK` + findings). Co není PASS, se zahodí a balíček stojí na původním draftu. Claude varianty obou rolí běží jako subagenti `konzilium-tvurce` a `konzilium-kontrolor` (nástroje jen Read a Write); obecný subagent by zdědil Bash a MCP, proto ho workflow pro Claude roli nikdy nespustí.
4. **Soudce** – vždy jiná rodina než tvůrce (tvůrce GPT → `konzilium-soudce`, tvůrce Claude → GPT přes codex). Kód ověří strukturu, doslovné citace celých řádků draftu a řádky ceny. Jedna oprava, pak `NELZE_OVERIT`.
5. **Výstup** – most sestaví `decision.json` ve schématu běhu 3 (verze 1). Pak vytvoří archiv v Notionu (když je `archive_parent`) a jeden řádek v panelu „TARS — Zakázky“: `Stav` WAITING_OWNER, `Fronta` „1 · Čeká na vlastníka“, „Čeká na vlastníka“ = ano, „Poslední krok“ = jedna věta doporučení, „Odkaz na výstup“. Transport je stejný jako `panel.ts`/`notion.ts` (`claude -p --model sonnet` s jediným Notion MCP nástrojem a kontrolou přeneseného payloadu, REST jen s `NOTION_TOKEN`). Databáze se nikdy nedotazuje (žádné SQL ani `rows`).

Výsledek workflow: `{status, order, decision, panel_row, link, sentence, reason, steps}`. `status` je `WAITING_OWNER`, `NELZE_OVERIT`, `FAILED` nebo `LIMIT`.

## Pravidlo jiné rodiny a „Nelze ověřit“

- Rada je mix rodin (karty: 3× Claude, 2× GPT). Most odmítne karty, které mix nedrží.
- Kontrolor zapracování a soudce jsou jiné rodiny než tvůrce.
- Rodina se pozná jen z **modelu**, nikdy z názvu CLI. Model je hodnota `--model`/`-m`, jinak text v závorce, jinak celý popis. Platí `claude -p --model opus` → Claude a `codex exec (gpt-6.1-sol)` → GPT. Popisy `claude -p --model llama3`, `sonnet (llama3)`, `codex exec` a `codex-default` znamenají `NELZE_OVERIT`.
- Výstup se započte jen s kladným záznamem o původu `<soubor>.meta.json`. Záznam píše jen most a je vázaný na běh (`run_id`) a na přesný obsah (kontrolní součet). Je podepsaný HMAC-SHA256 tajným klíčem běhu: `prep` ho vytvoří v `~/.tars/konzilium-keys/<run_id>.key` (mimo repo i mimo `out_dir`, práva 0600).
  - GPT: záznam zapíše `gpt` po volání `codex exec`, a jen když codex nahlásil model OpenAI (`gpt-…`, `o…`, `codex-mini…`).
  - Claude: záznam zapíše `attest` poté, co workflow dostalo od svého Claude subagenta potvrzení o dokončení. Záznam se nikdy nepřepisuje.
  - Bez záznamu, s jiným během, se změněným obsahem, s neplatným podpisem nebo s jinou rodinou je výsledek `Nelze ověřit`, nikdy PASS.
- Zápisy agentů hlídá hook `.claude/hooks/konzilium-guard.py`, který je ve frontmatteru každého subagenta `konzilium-*` jako `PreToolUse`:
  - každá role smí nástrojem Write zapsat jen svůj jediný výstup v `konzilium/`; tvůrce tedy nemůže zapsat soubor kontroly a nikdo nemůže zapsat záznam o původu;
  - transport (`konzilium-transport`, nástroje Bash a Write) smí zapsat jen `konzilium/.in-<8 hex>.txt` a spustit jen `npx tsx tars/orch/konzilium-bridge.ts …` bez `;`, `|`, `&`, `$`, backticků a přesměrování;
  - nikdo z nich nesmí číst ani psát `konzilium-keys` a `*.meta.json`.
  Rozhodnutí hooku se zapisují do `~/.tars/konzilium-guard.log`. Most odmítne karty bez hooku se správným profilem.
- Prompty pro GPT a args zapisuje transport nástrojem Write do `konzilium/.in-<součet>.txt` (Bash odmítá heredoc se složenými závorkami a uvozovkami). Most soubor přijme jen jako přesně tuto cestu (8 hexadecimálních znaků, žádný symlink) se shodným kontrolním součtem FNV-1a od skriptu a smaže ho až po shodě. Kontrolní součet chrání jen proti přepsání nebo zkrácení. Podpis původu dělá až most klíčem běhu, protože skript workflow nemá kam uložit tajemství.
- Secret-scan se dělá:
  - při přípravě na celé args (všechna pole) a vstupní soubory;
  - na každý rozbalený prompt před odesláním GPT;
  - na každý výstup role (Claude i GPT) před dalším použitím;
  - na archiv a řádek pro Notion před zápisem.
  Každý nález běh zastaví (`FAILED`), nic nepostoupí další roli, modelu ani do Notionu.
- Notion: před zápisem řádku most atomicky založí `konzilium/panel.creating`. Když zápis skončí nejasně, další pokus řádek znovu nezaloží a hlásí ruční kontrolu panelu (databáze se nedotazuje).

### Zbytkové riziko (poctivě)

- Ochrana zápisů stojí na frontmatter hoocích. Claude Code je spouští jen ve složce, které uživatel důvěřuje (workspace trust). Kdyby hooky neběžely, agent s nástrojem Read by mohl přečíst klíč běhu a záznam o původu podepsat. Bez hooků proto zůstává jen detekce náhodných a neúmyslných podvrhů (chybějící nebo neplatný podpis, změněný obsah, jiný běh).
- Hlavní sezení Claude Code, které workflow spouští, ani jiný proces téhož uživatele omezené nejsou. Klíč je v souboru uživatele, ne v Klíčence.
- Původ Claude výstupu prokazuje workflow (subagent skončil a hned nato `attest`), ne samotný model. GPT prokazuje model, který nahlásil codex.

## Soubory

| Soubor | Role | Rodina |
| --- | --- | --- |
| `advokat.md` | Advokát prvního principu | Claude (`konzilium-advokat`) |
| `prodejni-psycholog.md` | Prodejní psycholog | Claude (`konzilium-prodejni-psycholog`) |
| `brand-strateg.md` | Brand stratég | Claude (`konzilium-brand-strateg`) |
| `eticky-strazce.md` | Etický strážce | Claude (`konzilium-eticky-strazce`) |
| `ux-ui.md` | UX/UI odborník | GPT (není subagent, nemá `name`) |
| `hlas-zakaznika.md` | Hlas zákazníka | GPT (není subagent, nemá `name`) |
| `soudce.md` | Soudce konzilia | jiná než tvůrce (`konzilium-soudce` pro Claude, stejné tělo pro GPT) |
| `tvurce.md` | Zapracování tvůrcem, když je tvůrce Claude | Claude (`konzilium-tvurce`); GPT tvůrce jde přes codex s kartou tvůrce oddělení |
| `kontrolor.md` | Kontrola zapracování, když je tvůrce GPT | Claude (`konzilium-kontrolor`); GPT kontrolor jde přes codex |
| `transport.md` | Transport: vstupní soubor + jeden příkaz mostu | Claude Sonnet (`konzilium-transport`), nic nehodnotí |

## Co workflow nedělá (oproti PR #82)

- Nezakládá zakázky „Příprava rozhodnutí“ z otázek advokáta (`prep_orders` je prázdné, otázky jsou v balíčku i s `prep_title`). Zakládá je supervizor nebo vlastník.
- Nekreslí lokální vizuální kartu ani neprovádí rozhodnutí vlastníka (owner gate, merge politika). Vlastník rozhoduje v řádku panelu.
- Mezivýstupy jsou JSON (`*.json`), ne Markdown jako v běhu 3.
