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
| `out_dir` | ano | Absolutní cesta ke složce zakázky. Sem jde `decision.json`, mezivýstupy do `konzilium/`. |
| `draft` | ano | Draft k posouzení, relativně k `out_dir` nebo absolutně. |
| `creator_family` | ano | `claude` nebo `gpt`. Bez toho (nebo při nesouladu s `creator_model`) je výsledek `NELZE_OVERIT`. |
| `creator_model` | ano | Popis modelu tvůrce, např. `codex exec (gpt-6.1-sol)`. Musí patřit do `creator_family`. |
| `brief` | ano | Zadání: `title`, `department`, `milestone`, `why`, `goal`, `inputs[]`, `acceptance[]`, `owner_decisions[]`. |
| `sources` | ne | `[{key, path}]` lokální soubory zdrojů (`handoff`, `funnel`, `cte06`, `ui_build_brief`). Chybějící zdroj = UNKNOWN. |
| `kind` | ne | `copy` (výchozí) nebo `prep`. |
| `order`, `creator_role`, `creator_card`, `draft_url`, `mission` | ne | ID zakázky, název role tvůrce, karta tvůrce (výchozí `.claude/agents/gpt/copy-studio.md`), odkaz na draft v Notionu, mise. |
| `panel`, `panel_title`, `archive_parent` | ne | `panel: false` = jen `decision.json`. `panel_title` = název řádku. `archive_parent` = Notion stránka, pod kterou vznikne archiv balíčku (jeho odkaz jde do „Odkaz na výstup“). |

V `claude -p` workflow nikdy nežádá o souhlas, spuštění musí povolit pravidlo (`--allowedTools Workflow` nebo `Workflow(konzilium)`). Agenti potřebují `Read`, `Write` a `Bash(npx tsx tars/orch/konzilium-bridge.ts:*)`.

## Průběh

1. **Příprava** – most (`tars/orch/konzilium-bridge.ts prep`) ověří vstupy, rodiny a karty a zapíše `konzilium/run.json` a `konzilium/brief.md`.
2. **Advokát a rada** (paralelně) – Advokát prvního principu (otázky „proč“, plus povinné otázky receptu) a pět odborníků: prodejní psycholog, brand stratég a etický strážce jako Claude subagenti (`konzilium-*`, Opus, nástroje jen Read a Write), UX/UI a hlas zákazníka jako GPT přes `codex exec --output-schema`. Most pak zkontroluje verdikty (`council`): aspoň 3 z 5 čitelné a čitelné verdikty obou rodin.
3. **Zapracování** – tvůrce (stejná rodina jako původní tvůrce) zapracuje verdikty v jednom průchodu. Kontrolor jiné rodiny než tvůrce vrátí strukturovaný verdikt kroku 1 (`PASS|FIX|BLOCK` + findings). Co není PASS, se zahodí a balíček stojí na původním draftu.
4. **Soudce** – vždy jiná rodina než tvůrce (tvůrce GPT → `konzilium-soudce`, tvůrce Claude → GPT přes codex). Kód ověří strukturu, doslovné citace celých řádků draftu a řádky ceny. Jedna oprava, pak `NELZE_OVERIT`.
5. **Výstup** – most sestaví `decision.json` ve schématu běhu 3 (verze 1). Pak vytvoří archiv v Notionu (když je `archive_parent`) a jeden řádek v panelu „TARS — Zakázky“: `Stav` WAITING_OWNER, `Fronta` „1 · Čeká na vlastníka“, „Čeká na vlastníka“ = ano, „Poslední krok“ = jedna věta doporučení, „Odkaz na výstup“. Transport je stejný jako `panel.ts`/`notion.ts` (`claude -p --model sonnet` s jediným Notion MCP nástrojem a kontrolou přeneseného payloadu, REST jen s `NOTION_TOKEN`). Databáze se nikdy nedotazuje (žádné SQL ani `rows`).

Výsledek workflow: `{status, order, decision, panel_row, link, sentence, reason, steps}`. `status` je `WAITING_OWNER`, `NELZE_OVERIT`, `FAILED` nebo `LIMIT`.

## Pravidlo jiné rodiny a „Nelze ověřit“

- Rada je mix rodin (karty: 3× Claude, 2× GPT). Most odmítne karty, které mix nedrží.
- Kontrolor zapracování a soudce jsou jiné rodiny než tvůrce.
- GPT je prokázaný jen tehdy, když `codex exec` nahlásil model OpenAI (`gpt-…`, `o…`). Most k výstupu zapíše `<soubor>.meta.json`. Claude role zapisuje výstup sama (bez meta souboru). Jiný model nebo chybějící důkaz znamená `Nelze ověřit`, nikdy PASS.
- Prompty pro GPT a args přenáší transportní agent do příkazu. Most je přijme jen se shodným kontrolním součtem FNV-1a, který spočítal skript (ochrana proti přepsání nebo zkrácení, ne kryptografický podpis).

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

## Co workflow nedělá (oproti PR #82)

- Nezakládá zakázky „Příprava rozhodnutí“ z otázek advokáta (`prep_orders` je prázdné, otázky jsou v balíčku i s `prep_title`). Zakládá je supervizor nebo vlastník.
- Nekreslí lokální vizuální kartu ani neprovádí rozhodnutí vlastníka (owner gate, merge politika). Vlastník rozhoduje v řádku panelu.
- Mezivýstupy jsou JSON (`*.json`), ne Markdown jako v běhu 3.
