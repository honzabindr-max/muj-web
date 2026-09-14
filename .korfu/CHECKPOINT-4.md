# CHECKPOINT 4 — předdeploymentní předání

Snapshot aktualizován: `2026-09-14` (navazující bounded oprava dokumentace a renderu dynamických údajů). Historické záznamy kol korfu2026-08 až korfu2026-10 zůstávají níže jako kontext, nikoli jako identifikace aktuálního kandidáta.

## Aktuální Git stav

- Branch: `feat/korfu2026`
- HEAD: `20c691931d2e72557b9779f803686826197e20b1` (auditovaný výchozí kandidát pro tento bounded opravný krok)
- Staged změny: žádné (`git diff --cached --quiet` skončil s exit kódem 0).
- V tomto kroku nevznikl commit; změny níže čekají na samostatnou GO bránu pro případný commit.

Historický git stav po commitu `eb84077` (zaznamenáno v kole korfu2026-09). Commit obsahoval přesně 14 souborů (viz `git show --stat eb84077`); žádná cesta pod `.next/`, `node_modules/` ani `.lh-harness/`. Po tomto historickém commitu byly v pracovním stromu pouze tři untracked soubory:

### Untracked soubory po commitu eb84077

- `.korfu/DIAGNOSTIKA-korfu2026-04.txt`
- `.korfu/HANDOFF-korfu2026-05.md`
- `.korfu/TASK-02.md`

Dispozice viz sekce níže.

---

## Dispozice untracked artefaktů

Kolo korfu2026-09 uzavírá dispozici tří zbývajících untracked souborů v `.korfu/`:

| Soubor | Dispozice | Důvod |
|---|---|---|
| `.korfu/TASK-02.md` | **Zacommitovat** | Smluvní vstup běhu — task kontrakt. Patří do repa jako reference; bez něj není auditovatelné, co bylo zadáno. |
| `.korfu/HANDOFF-korfu2026-05.md` | **Zacommitovat** | Předávací dokument z kola korfu2026-07/08. Patří do repa pro sledovatelnost mezi koly. |
| `.korfu/DIAGNOSTIKA-korfu2026-04.txt` | **Mimo git** | Pracovní diagnostika interního harness kola (`round_004`). Jde o provozní záznam dohledové vrstvy, nikoli o deliverable projektu. Záměrně ponecháno untracked; nepatří do repa. |

## Důvěryhodné lokální QA — čerstvý běh korfu2026-08

Všechny příkazy proběhly v běhu korfu2026-08 (opravné kolo 2026-09-13) po úpravách CHECKPOINT-2.md a CHECKPOINT-3.md. Každý skončil exit kódem 0:

| Příkaz | Exit | Výsledek |
| --- | ---: | --- |
| `npm install --include=dev` | 0 | Závislosti jsou aktuální. |
| `scripts/korfu2026-check.sh` | 0 | Bez nálezů: itinerář, Albánie/Ksamil, citlivé údaje, všech 13 must-see ID přítomno. |
| `npm run lint` | 0 | Skutečný `eslint .`; 0 chyb, 9 dříve existujících varování mimo Korfu route. |
| `npm run build` | 0 | Next.js 16.2.1 build uspěl; `/korfu2026` je statická route. |

Původní QA běh v CHECKPOINT-3 proběhl `2026-09-13T17:57:53+02:00` a výsledky se shodují s výše uvedeným čerstvým během.

### Změny provedené v opravném kole korfu2026-08

| Soubor | Typ změny |
|---|---|
| `.korfu/CHECKPOINT-2.md` | Oprava sekce 1c: KorfuApp.tsx řádky (1156→1151), součty, seznam modifikovaných a untracked souborů; přidána sekce 12 s vysvětlením (N1–N3 dle auditora round_002) |
| `.korfu/CHECKPOINT-3.md` | Přidáno 11 pojmenovaných katalogových sekcí (N4 dle auditora round_002): Pláže, Památky, Koně, Lodě, Aktivity, Roda, Jídlo a večer, Události, Doprava, Praktické, Zdroje a aktuálnost |
| `.korfu/CHECKPOINT-4.md` | Aktualizován timestamp, seznam untracked souborů (přidán AUDIT.md), QA výsledky |
| `.korfu/AUDIT.md` | Aktualizovány sekce §4 (N1–N3 opraveny), §5 (N4 opraveno), §0/§1/§2 čerstvé raw výstupy |

### Změny provedené v opravném kole korfu2026-10 (constraint 12)

| Soubor | Typ změny |
|---|---|
| `app/korfu2026/_data/places.ts` | Přidány zdrojové URL ke 3 cenovým položkám: `:153` (Paleokastritsa, rentaboatcorfu.gr, SP:188), `:381` (Nissaki, nissakiboatrental.com, SP:196–197), `:2484–2490` (Paxos/Antipaxos, corfutouristservices.gr, SP:290) |
| `.korfu/evidence/build-output.txt` | Přegenerováno po opravě; EXIT_CODE=0, `/korfu2026` static |
| `.korfu/evidence/lint-output.txt` | Přegenerováno po opravě; EXIT_CODE=0, 0 errors |
| `.korfu/evidence/check-output.txt` | Přegenerováno po opravě; EXIT_CODE=0, "Bez nálezů" |
| `.korfu/AUDIT.md` | Aktualizována sekce §7: nová čísla řádků a evidence zdrojových URL |
| `.korfu/CHECKPOINT-4.md` | Tento dokument — přidána sekce korfu2026-10 |

### Změny provedené v kole korfu2026-18 (type predicate + dokumentace)

Kolo korfu2026-18 navázalo na commit `20c691931d2e72557b9779f803686826197e20b1` a commitovalo 5 souborů, které předchozí kolo (korfu2026-17, klasifikace INIT) upravilo ale nezacommitovalo.

| Soubor | Typ změny |
|---|---|
| `app/korfu2026/_data/types.ts` | `isRenderableFact` — return type upraven na type predicate `fact is DynamicFact & { source: SourceRef }` umožňující TypeScript narrowing v OperatorCard |
| `app/korfu2026/_components/OperatorCard.tsx` | Zjednodušeno: offers.filter(isRenderableFact) před renderem; branch pro `offer.source === null` odstraněna (garatuje ji type predicate); 153→140 řádků |
| `.korfu/CHECKPOINT-2.md` | Aktualizovány počty řádků (OperatorCard 153→140; places.ts 2448→2519; celkové součty) a datum inventáře 2026-09-14 |
| `.korfu/CHECKPOINT-3.md` | Opraveny 3 odstavce: popis isRenderableFact, source field a badge v sekcích Koně, Jídlo a večer, Zdroje |
| `.korfu/CHECKPOINT-4.md` | Tento dokument — přidána sekce korfu2026-18 a rollback SHA |

QA běh korfu2026-18 (2026-09-14, proběhl PŘED commitem, build jako finální krok):

| Příkaz | Exit | Výsledek |
| --- | ---: | --- |
| `scripts/korfu2026-check.sh` | 0 | Bez nálezů: itinerář, Albánie/Ksamil, citlivé údaje, všech 13 must-see ID přítomno. |
| `npm run lint` | 0 | 0 errors, 9 varování mimo korfu route (identická sada jako korfu2026-08). |
| `npm run build` | 0 | Next.js 16.2.1 Turbopack; `/korfu2026` statická route ○ přítomna. `.next/` je v `.gitignore`, nešpiní commit. |

## Deploymentní hranice

V tomto QA kroku neproběhl push, deployment, GitHub Actions, změna DB, secrets ani produkční konfigurace. Commit v kole korfu2026-18 je lokální na `feat/korfu2026`. Nasazení provede supervizor po přijatém auditu.

## Rollback poznámka

Rollback nebyl proveden. Po commitu korfu2026-18 je HEAD `d38382e7...`; při schváleném rollbacku zpět na `20c691931d2e72557b9779f803686826197e20b1` platí:

```
git reset --hard 20c691931d2e72557b9779f803686826197e20b1
```

Tento příkaz je destruktivní a nesmí se spouštět bez samostatného GO. `git clean` by odstranil untracked dokumenty — aplikovat jen cíleně po schválení.
