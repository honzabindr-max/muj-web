# TARS-SELF-BUILD-001 — technický kontrakt M0-02 (návrh v0.1)

**Projektová autorita:** [TARS-SELF-BUILD-001 v Notionu](https://app.notion.com/p/4100ae49f50781e792c1c8cf4e79b743)  
**Stav:** DRAFT pro nezávislé review; tento dokument není GO, PASS ani merge permit.  
**Rozsah PR:** pouze tento kontrakt, seznam zdrojů, lokální read-only generátor a jeho testy; žádná změna `tars/orch`, `dispatch.json`, hooků, CI workflow, databáze či deploye.

## Smysl

Tento malý kontrakt chrání kontinuitu projektu při změně vlákna nebo modelové rodiny. Neřeší sám vlastní autonomní vývoj TARSe a nezavádí nový orchestrátor. **Vždy odděluje lokálně pozorovaný fakt od neověřeného stavu vzdálených systémů.**

## Rozdělení autority

| Oblast | Primární autorita | Povinnost nového vykonavatele |
| --- | --- | --- |
| Cíl, milník, backlog, rizika | [projekt v Notionu](https://app.notion.com/p/4100ae49f50781e792c1c8cf4e79b743) | Načíst aktuálně, historický snapshot není současný stav |
| Schválení / GO / REJECT | Platná pravidla vlastníka a konkrétní ověřitelný owner receipt | Nikdy nevytvořit GO; nepovažovat chat ani kapsli za souhlas |
| Kód / testy / PR / CI | GitHub konkrétní SHA a CI run | Ověřit přímým čtením GitHubu |
| Zakázky, efekty, lease, runtime | TARS journal a povolené read-only diagnostiky | Při nepřístupu `UNKNOWN`, nikdy domnělý PASS |
| Platné změny pravidel | [Decision Register](https://app.notion.com/p/4070ae49f50781369315e8ebf4c5457e) + [Pravidla vlastníka](https://app.notion.com/p/40d0ae49f507818f971ad41e7688c3f9) | Při rozporu HOLD a eskalace |

## Read-only kapsle (nejmenší možný začátek)

Spusť z checkoutu tohoto repozitáře:

```sh
node scripts/tars-self-build-context.mjs
```

Skript bez přihlášení, sítě, modelu a bez zápisu do souborů (včetně Git indexu; používá `--no-optional-locks`) přečte pouze `SOURCES.json` a lokální metadata Gitu. Vypíše JSON s časem čtení, lokálním SHA větve, příznakem změněných sledovaných souborů a odkazy na autoritativní zdroje. **Neověřuje Notion, GitHub remote ani běžícího TARSe.** Všechny vzdálené stavy a autorizace proto explicitně označí `UNKNOWN` / `NOT_GRANTED`. Při chybných datech či nedostupném Gitu skončí kódem 2 bez validní kapsle; na stderr vypíše pouze bezpečný pevný chybový kód (`INVALID_SOURCES`, `INVALID_GIT_HEAD`, `GIT_UNAVAILABLE`, nebo `READ_FAILURE`). Všech pět adres Notion musí mít explicitní správný tvar.

Tento výstup není plnohodnotná kontextová autorita. Nová instance musí *po kapsli* načíst aktuální Notion stav, DR, pravidla a příslušné čerstvé technické důkazy. Nikdy nesmí použít statické odkazy jako náhradu lidského schválení.

## Protokol převzetí bez paměti chatu

1. Nová instance dostane pouze Notion URL projektu a žádost o režim **READ-ONLY**.
2. Nejdřív přečte autoritativní projektovou stránku, DR a platná pravidla. Pro technická tvrzení získá čerstvý GitHub SHA a stav relevantních PR/CI; při dostupném lokálním checkoutu si může nechat předložit kapsli ze skriptu.
3. Sepíše krátký záznam: `project_id`, `checked_at`, `source_refs`, `verified_head`, `current_milestone`, `gate_evidence`, `blockers`, `unknowns`, `one_next_safe_action`.
4. Pokud aktuální stav neodpovídá podkladům, označí konflikt a HOLD. Žádný merge, run, owner GO ani produkční efekt.
5. Až nezávislý hodnotitel potvrdí shodu s primárními zdroji, smí se M0 cold-start test označit PASS.

## Testy a gate

```sh
npx vitest run tars/self-build/context.test.ts
```

Součástí testů je i negativní cesta neplatných vstupních URL / JSON a kontrola, že čtení nepřepíše lokální Git index.

Pro přijetí M0-02 je nutné: zelené `test` + `janitor` CI pro přesné PR SHA, nezávislé review podle platných pravidel, kontrola rozsahu diffu a samostatné rozhodnutí o merge. Samotné autorovo spuštění testu není nezávislé review. Vytvoření tohoto návrhu neopravňuje merge.

**M0 cold-start oracle:** Úplně nový chat bez historie dostane jen [Notion projekt](https://app.notion.com/p/4100ae49f50781e792c1c8cf4e79b743). PASS pouze když prokáže skutečný aktuální milník, hranici rozhodnutí vlastníka, nejméně dva aktuální zdroje, doložené blokace a jediný bezpečný další krok, aniž by cokoli změnil. Jinak FAIL / UNKNOWN. Kapsle sama o sobě pro tento test nestačí.

## Evidence a omezení

Původní [Astra audit 3. 11.](https://app.notion.com/p/40d0ae49f50781d3be12da44a7fbf25c) je historická evidence, nikoli aktuální výčet vad. [Dokumentace vrstev 6. 11.](https://app.notion.com/p/4100ae49f507818693dad0956d56eadd) popisuje pozorovaný snapshot, nikoli trvalé ověření běhu. M0-02 nemění žádný runtime stav a neřeší samotnou automatickou obnovu zakázek — ta patří do pozdějších milníků.

## Bezpečnostní mantinely

- [P20 — Pravidla vlastníka](https://app.notion.com/p/40d0ae49f507818f971ad41e7688c3f9): žádný agent nesmí zadat GO/REJECT za vlastníka, ani přes `cli owner`, ani zápisem do pole „Rozhodnutí vlastníka“.
- Neprovádět `cli.ts owner`, `tick`, `dispatch run`, merge ani externí produkční účinek kvůli tomuto PR.
- Zdrojové odkazy a návrhový stav nejsou důkaz; všechny neověřené komponenty se označují `UNKNOWN`.
- Nepřidávat tokeny, osobní údaje, celý obsah konverzací, pracovní artefakty `runs/` ani `.env`.
- Nezávislé review skutečné modelové rodiny a cílené CI před jakýmkoli merge.
