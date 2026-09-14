# HANDOFF pro korfu2026-05

- Předchozí run-id: `korfu2026-03` (ukončen prokazatelně kvůli limitu Claude session, ne kvůli chybě práce).
  Pokus `korfu2026-04` selhal na prázdné cestě k zadání a jeho ID se znovu nepoužívá.
- Git commit SHA: `ca325f778f03423a23069a91e440883ede2cbb48` na branchi `feat/korfu2026`
- Stav pracovního stromu: ČISTÝ
- Poslední přijatý checkpoint: CHECKPOINT-2 (`.korfu/CHECKPOINT-2.md`)
- Hotovo v commitech: datový model a 13 must-see karet, geokódované mapové body,
  UI vrstva s katalogem A–T a filtry, Leaflet mapa přes next/dynamic, `scripts/korfu2026-check.sh`.
- Cílová veřejná URL: https://www.good-inventions.work/korfu2026/
- Zdroj pravdy: `.korfu/SOURCE_PACK.md` (478 řádků, nezměněno od checkpointu 1)
- Coverage matrix: `.korfu/COVERAGE.md` (833 řádků), citace `SP:NNN` dál platí

## Nevyřešené položky auditora z korfu2026-03
- Kolo 7 hlásilo `Integrity: suspect` — příčinou byl dashboard zapisující log do workspace.
  To je odstraněno, dashboard píše mimo workspace. Pokud se `suspect` objeví znovu, zjisti skutečnou příčinu.
- Většina karet nemá vyplněný `sources`. Doplň zdroj u faktických tvrzení, nebo výjimku zdůvodni v kartě.
- Chybí `CHECKPOINT-3.md`, `CHECKPOINT-4.md` a `AUDIT.md`.

## Poslední build a testy
Poslední zelený `npm run build` proběhl v kole 10 běhu korfu2026-03. `scripts/korfu2026-check.sh`
existuje, ale jeho výsledek zatím nebyl zapsán do checkpointu.

---

# ÚKOL korfu2026-02 — pokračování od checkpointu 2 až do nasazení

Základní kontrakt: `.korfu/TASK.md` (přečti ho celý, platí beze změny, kromě bodů níže).
Zdroj pravdy pro obsah: `.korfu/SOURCE_PACK.md`, řádky 1–478, nezměněno od checkpointu 1
(`wc -l` = 478). Citace `SP:NNN` z `.korfu/COVERAGE.md` dál platí.

## 0. Stav, na který navazuješ — NEDĚLEJ ZNOVU
Běh `korfu2026-01` doběhl 4 kola a zastavil se na `needs_human_input`. Hotové a přijaté:
- `.korfu/COVERAGE.md` (833 ř.) — coverage matrix částí A–Q, ověřena supervizorem;
- `.korfu/CHECKPOINT-1.md`, `.korfu/CHECKPOINT-2.md`;
- commit `577ada5` — datový model, typy, 13 must-see karet, minimální route;
- commit `f59aabd` — ověřené mapové body (`app/korfu2026/_data/coords.generated.ts`).
Tyto výstupy se NEPŘEPISUJÍ od nuly. Navazuješ na ně.

## 1. Rozhodnutí vlastníka — provenience (řeší bod 4 auditu z korfu2026-01)
V běhu `korfu2026-01` se uprostřed práce objevila v SOURCE_PACKu sekce 26 „SUPERVISOR
DIRECTIVE 01". Auditor správně odmítl pokračovat, protože nešlo ověřit její původ.
Vysvětlení: tu sekci připsal Outer Project Supervisor, ne executor. Byla to chyba v METODĚ
(zásah do zdroje pravdy za běhu), ne ve věci. Sekce 26 byla ze SOURCE_PACKu odstraněna,
soubor je zpět na 478 řádcích a její obsah je nyní zde, se jmenovaným původem:

**D01-A — souřadnice.** Vlastník (Honzík) schválil výjimku ze zákazu síťového ověřování
VÝHRADNĚ pro geokódování: lat/lng se smí dohledat přes veřejné OpenStreetMap Nominatim API
bez klíče, jednorázově skriptem, výsledek uložen staticky v repu. U každého bodu povinně
`coordsSource: 'osm-nominatim'`, `coordsQuery`, `coordsCheckedAt`. Co se nedohledá jednoznačně,
zůstane `coords: null`, bez pinu, s Google Maps search deep-linkem. Souřadnice se NIKDY
nevymýšlejí zpaměti. Commit `f59aabd` a `scripts/korfu2026-geocode.mjs` jsou tímto
autorizované — NEREVERTOVAT.
**D01-B — rozsah.** Výjimka platí jen pro geokódování. Ceny, otevírací doby, sezonní provoz,
dostupnost a program akcí se NEOVĚŘUJÍ; zůstávají se štítkem „ověřit aktuálně" a odkazem
na zdroj, přesně podle částí 3, 10, 11, 12 a 13 SOURCE_PACKu.
**D01-C — cíl deploymentu.** App Router route `app/korfu2026/` v repu muj-web → Vercel →
https://www.good-inventions.work/korfu2026/. Implementační vzor `app/soci/` a
`app/cesky-raj-2026/`. `app/lefkada-2026/` je jen route handler pro statické HTML, není vzor.

## 2. Otevřené body z auditu korfu2026-01 — dořeš je
- **bod 5:** u každé karty musí být jednoznačně čitelné, zda souřadnice pochází z Nominatimu,
  nebo chybí. Žádný stav „tiše null".
- **bod 6:** `.korfu/CHECKPOINT-2.md` obsahuje vnitřní rozpor (počty souborů / stav inventáře).
  Oprav ho tak, aby seděl na skutečný stav repa, a rozdíl vysvětli.
- Auditorovy body 1–3 (git baseline, `tsconfig.tsbuildinfo`, inventář) jsou uzavřené, neřeš je.

## 3. Zbývající práce do konce
**Checkpoint 3 — plná funkční verze + lokální QA.** Zapiš `.korfu/CHECKPOINT-3.md`.
- všechny povinné sekce podle části 19 SOURCE_PACKu, celý katalog podle COVERAGE.md
  (pláže, památky, koně, lodě, aktivity, Roda, jídlo a večer, události, doprava, praktické,
  zdroje a aktuálnost);
- Leaflet mapa přes `next/dynamic` (`ssr: false`), OSM dlaždice, bez API klíče, s filtry;
- „Můj výběr" v localStorage pod klíčem `korfu2026:selection:v1`, v `try/catch`;
- filtry podle kategorie, oblasti, náročnosti, dopravy, počasí a priority;
- tlačítka Navigovat / Volat / Kopírovat číslo / Otevřít zdroj;
- spodní mobilní navigace Přehled – Možnosti – Mapa – Můj výběr – Praktické;
- přístupnost: klávesnice, focus states, kontrast, alt texty;
- `scripts/korfu2026-check.sh` (nahrazuje `check-no-itinerary.sh`): grep na denní itinerář
  („den 1", „1. den", názvy dnů v týdnu v programovém kontextu), na Albánii a Ksamil, na
  citlivé údaje podle části 5, plus kontrola přítomnosti všech 13 must-see id. Nenulový exit
  při jakémkoli nálezu.
- `npm install` && `npm run build` zelené, `npm run lint` bez chyb.
**Checkpoint 4 — předdeploymentní.** `.korfu/CHECKPOINT-4.md`: seznam změněných souborů,
výsledky QA, rollback poznámka. Plus `.korfu/AUDIT.md` od nezávislého auditora s konkrétními
důkazy (soubor:řádek + citace).

## 4. Autonomie — kdy se PTÁT a kdy NE
Tento běh má doběhnout bez zásahu vlastníka. Rozhodnutí v bodě 1 jsou definitivní; neotvírej je
znovu. Nežádej potvrzení formátu, názvů, struktury, pořadí sekcí, designu ani rozsahu — o tom
rozhoduješ ty podle SOURCE_PACKu. Manager volí `Next: ask` POUZE tehdy, když je nutný
nevratný nebo destruktivní krok mimo tento workspace, nebo když si dvě LOCKED pravidla
SOURCE_PACKu přímo odporují. Vše ostatní řeš dalším CLI kolem nebo bounded repair.

## 5. Hranice (beze změny)
Pracuj jen v `/Users/janbindr/Projects/korfu2026-build`, jen na branchi `feat/korfu2026`.
NEPUSHUJ, NEDEPLOYUJ, neměň `main`, nesahej na `/Users/janbindr/Projects/muj-web`.
Deployment provede supervizor po checkpointu 4 a přijatém auditu.
Žádné GUI, žádný prohlížeč, žádný computer-use. Síť jen pro `npm` a pro geokódování dle D01-A.
Executor NESMÍ prohlásit PASS; auditor pracuje nezávisle proti SOURCE_PACKu.

