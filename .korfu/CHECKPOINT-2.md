# CHECKPOINT 2 — první funkční lokální verze route `/korfu2026/`

Datum: 2026-09-13
Workspace: `/Users/janbindr/Projects/korfu2026-build`
Branch: `feat/korfu2026`
Rozsah kola: datový model + 13 ručních must-see + minimální renderovatelná route + zelený build.
BEZ mapy, BEZ localStorage, BEZ počasí — ty patří do dalších kol.

---

## 1. Co vzniklo (seznam souborů)

| Soubor | Řádků | Účel |
|---|---|---|
| `app/korfu2026/_data/types.ts` | 178 | Typovaný datový model karty podle části 19 SOURCE_PACKu (ř. 395–399) + pravidlo R-NAV |
| `app/korfu2026/_data/places.ts` | 419 | Katalog karet; zatím 13 ručních must-see z části 6 (ř. 55–72) |
| `app/korfu2026/_components/PlaceCard.tsx` | 125 | Render jedné karty; `null` pole se nevykreslují |
| `app/korfu2026/page.tsx` | 53 | App Router stránka `/korfu2026`, česky, mobile-first, Tailwind |

Žádný jiný soubor v repozitáři nebyl vytvořen ani změněn (`git diff --stat HEAD` = prázdný,
viz oddíl 7).

## 2. Prostředí

`npm install` v tomto prostředí NEINSTALOVAL devDependencies, protože shell má `NODE_ENV=production`
(npm pak implicitně `omit=dev`). Důsledek: chyběl `@tailwindcss/postcss` a build padal na
`Error: Cannot find module '@tailwindcss/postcss'`. Řešeno jednorázově příkazem:

```
NODE_ENV=development npm install --include=dev
```

→ `added 106 packages, and audited 203 packages`. `package.json` ani `package-lock.json` se
tím nezměnily (viz `git status` v oddílu 7). Toto je vlastnost prostředí, ne repozitáře.

## 3. Datový model (část 19 SOURCE_PACKu, ř. 395–399)

Model 1:1 pokrývá výčet ze zdroje. Mapování pole → citace:

| Pole `types.ts` | SOURCE_PACK | Stav u 13 must-see |
|---|---|---|
| `canonicalName` | ř. 395 „canonical name" | vyplněno u všech 13 |
| `czName` | ř. 395 „český název" | **13× `null`** — zdroj české názvy neuvádí |
| `category` / `subcategory` | ř. 395 „kategorie a podkategorie" | `category` 13×; `subcategory` jen kde má zdroj doslovný popisek |
| `tier` | ř. 395–396 „must-see / doporučení / další možnost" | 13× `'must-see'` |
| `area` | ř. 396 „oblast ostrova" | podle členění části 7 (ř. 74–94) |
| `why` | ř. 396 „krátké ‚proč sem'" | složeno z doslovných formulací zdroje |
| `wow` | ř. 396 „WOW faktor 1–5" | **13× `null`** — viz mezera G2 |
| `userPriority` | část 6, ř. 58 / ř. 65 | doslovné poznámky „označena srdcem" / „hvězdičkou" |
| `visitDuration` | ř. 396 „doporučená délka" | **13× `null`** — zdroj neuvádí |
| `bestPartOfDay` | ř. 397 (povoleno ř. 433–435) | **13× `null`** — zdroj neuvádí |
| `weather` | ř. 397 (povoleno ř. 433–435) | 2× vyplněno (Porto Timoni, Myrtiotissa — ř. 353) |
| `transport` | ř. 397 „doprava" | 3× neprázdné, jinak `[]` |
| `accessDifficulty` | ř. 397 „náročnost přístupu" | 1× vyplněno (Porto Timoni, ř. 83) |
| `parking` | ř. 397 „parkování" | **13× `null`** — viz mezera G3 |
| `combinesWith` | ř. 397, balíčky části 9 (ř. 113–125) | 13× doslovný balíček |
| `warnings` | ř. 397–398 „rizika / upozornění" | 3× neprázdné |
| `timeFromHotel` | ř. 398 „orientační čas z Silver Beach Hotelu" | **13× `null`** — viz mezera G4 |
| `coords` + `coordsStatus` + `coordsNote` | ř. 398 „ověřené souřadnice" | **13× `null` / `'chybi-ve-zdroji'`** — viz mezera G1 |
| `mapsQuery` + `mapsUrl()` | ř. 398 „navigační odkaz" | 13×, pravidlo R-NAV |
| `sources` | ř. 398–399 „oficiální nebo ověřovací zdroj" | 13× `[]` — zdroj u pláží žádné URL neuvádí |
| `verify` | ř. 399 „aktuálnost" | 4 položky celkem (viz oddíl 5) |
| „oblíbené / navštíveno v localStorage" | ř. 399 | NENÍ ve statických datech — runtime stav, klíč `korfu2026:selection:v1`, implementace v dalším kole |

## 4. Mezery ve zdroji (kontrakt bod 16 — pole ponechaná prázdná, NE doplněná odhadem)

- **G1 — souřadnice.** SOURCE_PACK neobsahuje ani jednu číselnou souřadnici. Ověřeno:
  `grep -nE '[0-9]{1,2}\.[0-9]{4,}|°|souřadnic' .korfu/SOURCE_PACK.md` → jediné zásahy jsou
  ř. 349 (teploty 27–28 °C / 17–19 °C) a ř. 398 + ř. 454, což jsou POŽADAVKY na souřadnice,
  ne hodnoty. Část 6 (ř. 55) sice žádá „ověřený mapový bod", ale hodnoty v dokumentu nejsou.
  → všech 13 karet má `coords: null`, `coordsStatus: 'chybi-ve-zdroji'` a viditelnou poznámku
  v UI. Doplnění z paměti modelu je zakázáno.
- **G2 — WOW faktor 1–5.** Zdroj žádné číslo neuvádí → `wow: null` u všech 13.
  Informaci o prioritě zdroj naopak dává slovně (ř. 56–58, 65) → uložena beze změny významu
  do `userPriority`.
- **G3 — parkování.** Zdroj parkování u konkrétních míst neuvádí; jediná zmínka je požadavek
  ověřit parkování u Myrtiotissy (ř. 87–88), zapsaný jako `verify`, ne jako hodnota.
- **G4 — orientační čas z hotelu.** Zdroj žádnou hodnotu neuvádí (ř. 126 a ř. 398 jsou jen
  požadavky na pole) → `timeFromHotel: null` u všech 13.
- **G5 — doporučená délka, nejlepší část dne, český název** — zdroj neuvádí → `null`.

### Deterministické pravidlo R-NAV (jediná odvozená hodnota v tomto kole)
`mapsQuery` = první varianta názvu z části 6 + `", Korfu"`.
`mapsUrl()` staví `https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(mapsQuery)>`,
tj. **vyhledávání podle názvu**, nikoli bod na souřadnicích. Pravidlo neobsahuje žádnou
polohovou informaci mimo název, který je doslova ve SOURCE_PACKu. Až budou souřadnice doložené,
`mapsUrl()` automaticky přepne na `query=<lat>,<lon>` (větev v `types.ts`).

## 5. Mapování 13 must-see → id karty → řádek SOURCE_PACKu

| # (část 6) | Název ve zdroji | `id` | `places.ts` ř. | Citace SOURCE_PACKu |
|---|---|---|---|---|
| 1 | Canal d'Amour u Sidari | `canal-damour` | 26 | SP:57, SP:80, SP:116, SP:413 |
| 2 | Porto Timoni | `porto-timoni` | 54 | SP:58, SP:82–83, SP:117, SP:200, SP:353, SP:414 |
| 3 | Paleokastritsa / Palaiokastritsa | `paleokastritsa` | 85 | SP:59, SP:84–85, SP:101, SP:118, SP:183–185, SP:221, SP:417 |
| 4 | Kassiopi Beach | `kassiopi-beach` | 119 | SP:61–62, SP:89, SP:98, SP:119, SP:416 |
| 5 | Rovinia Beach | `rovinia-beach` | 153 | SP:63, SP:84–85, SP:118, SP:184 |
| 6 | Agios Gordios | `agios-gordios` | 181 | SP:64, SP:88, SP:102, SP:122 |
| 7 | Issos Beach | `issos-beach` | 209 | SP:65, SP:92–93, SP:123 |
| 8 | Avlaki Beach | `avlaki-beach` | 237 | SP:66, SP:89, SP:119, SP:413 |
| 9 | Marathias Beach | `marathias-beach` | 265 | SP:67, SP:92, SP:124 |
| 10 | Nissaki Beach | `nissaki-beach` | 293 | SP:68, SP:91, SP:120, SP:194–198, SP:221–222 |
| 11 | Chalikounas / Halikounas Beach | `chalikounas-beach` | 327 | SP:69, SP:92–93, SP:123 |
| 12 | Myrtiotissa Beach | `myrtiotissa-beach` | 355 | SP:70, SP:87–88, SP:122, SP:353 |
| 13 | Barbati Beach | `barbati-beach` | 389 | SP:71, SP:91, SP:120, SP:210 |

Pořadí v `places.ts` = pořadí číslovaného seznamu v části 6.

Položky `verify` („ověřit aktuálně"), celkem 4:
- Paleokastritsa — orientační cena bezlicenční lodi cca od 100 €, často bez paliva (SP:220–221)
- Kassiopi Beach — ověřit, zda odpovídá Bataria, Kanoni nebo jiné pláži (SP:61–62, SP:89)
- Nissaki Beach — cena od 16. 9. cca 80–170 € podle lodi, často bez paliva (SP:220–223)
- Myrtiotissa Beach — ověřit přístup, parkování, sestup a aktuální charakter pláže (SP:87–88)

## 6. Kontroly zákazů (raw výstup)

```
=== 1a) 'den 1..9' / 'day N' / '1. den' ===        0 zásahů
=== 1b) dny v týdnu ===                             0 zásahů (pondělí…neděli, víkend)
=== 1c) 'doporučený týden' / 'program po dnech' / 'itinerář' / 'plán dne' / 'rozvrh' ===
                                                    0 zásahů
=== 2) Albánie / Ksamil ===                         0 zásahů
=== 3) Paxos / Antipaxos ===                        0 zásahů (lodní sekce zatím neexistuje)
=== 4) 'Silver Beach' v kontextu koní ===           0 zásahů
=== 5) smlouva/rezervace/VS/IBAN/heslo/token/key === 0 zásahů
=== 6) telefonní čísla a e-maily ===                0 zásahů
```

Poznámka: první průchod kontroly 1c našel jediný zásah — větu „Katalog možností, ne itinerář."
v `page.tsx`. Šlo o zápor, ne o itinerář, ale aby automatická kontrola v checkpointu 3 mohla
být tvrdá a bez výjimek, věta byla přeformulována na „Katalog možností, ne hotový plán."
Po úpravě je 1c čistá.

Kontrola prázdnosti neodvoditelných polí:
```
wow: null           → 13×, žádná ne-null hodnota
timeFromHotel: null → 13×, žádná ne-null hodnota
parking: null       → 13×, žádná ne-null hodnota
coords: null        → 13×, žádná ne-null hodnota
coordsStatus: 'chybi-ve-zdroji' → 13×
tier: 'must-see'    → 13×
czName / visitDuration / bestPartOfDay ne-null → 0 zásahů
accessDifficulty ne-null → 1× (ř. 71, Porto Timoni, doloženo SP:83)
```

## 7. Build — raw výstup `npm run build`

```
> muj-web-next@0.1.0 build
> next build

▲ Next.js 16.2.1 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 1423ms
  Running TypeScript ...
  Finished TypeScript in 1840ms ...
  Collecting page data using 14 workers ...
  Generating static pages using 14 workers (0/16) ...
  Generating static pages using 14 workers (4/16) 
  Generating static pages using 14 workers (8/16) 
  Generating static pages using 14 workers (12/16) 
✓ Generating static pages using 14 workers (16/16) in 141ms
  Finalizing page optimization ...

Route (app)                         Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/h2/health
├ ƒ /api/h2/telegram/webhook
├ ƒ /api/h2/web/messages
├ ƒ /api/h2/web/responses
├ ƒ /api/internal/queue-wakeup
├ ƒ /api/suggest/dashboard-rows
├ ƒ /api/suggest/dashboard-state
├ ƒ /api/suggest/new-phrases-24h
├ ƒ /api/suggest/new-phrases-today
├ ƒ /api/suggest/seznam-status
├ ○ /cesky-raj-2026
├ ○ /dovolena-072026
├ ○ /honzik2/o-projektu
├ ƒ /honzik2/reauth
├ ○ /korfu2026
├ ○ /lefkada-2026
├ ○ /robots.txt
├ ○ /soci
├ ○ /suggest
├ ○ /suggest2
├ ○ /suggest3
├ ○ /tisnov                                10m      1y
└ ○ /zlutak


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

`/korfu2026` je v seznamu jako `○ (Static)` — route se prerenderuje.

## 8. Důkaz, že se route skutečně vykreslí

Spuštění `next start` bylo v tomto běhu zamítnuto oprávněním sandboxu. Protože je route
staticky prerenderovaná, render byl ověřen přímo na artefaktu buildu
`.next/server/app/korfu2026.html` (71 182 B):

```
<title>Korfu 2026 — katalog možností</title>
<h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Korfu 2026</h1>
id="place-agios-gordios-title"      id="place-marathias-beach-title"
id="place-avlaki-beach-title"       id="place-myrtiotissa-beach-title"
id="place-barbati-beach-title"      id="place-nissaki-beach-title"
id="place-canal-damour-title"       id="place-paleokastritsa-title"
id="place-chalikounas-beach-title"  id="place-porto-timoni-title"
id="place-issos-beach-title"        id="place-rovinia-beach-title"
id="place-kassiopi-beach-title"
počet karet v HTML: 13
```

Všech 13 tlačítek Navigovat je v HTML jako
`https://www.google.com/maps/search/?api=1&query=<název>%2C%20Korfu` — žádné souřadnice.

## 9. Hranice běhu

- `git diff --stat HEAD` = prázdný → žádný dosud trackovaný soubor nebyl změněn.
- `git diff --stat HEAD -- app/lefkada-2026 app/cesky-raj-2026 public/` = prázdný.
- Nové soubory pouze pod `app/korfu2026/` a `.korfu/`.
- Žádný `git push`, žádná změna `main`, žádný deploy, žádný blokující `npm run dev`.
- Nic mimo `/Users/janbindr/Projects/korfu2026-build` nebylo čteno ani měněno.

## 10. Co zbývá (další kola)

Mapa Leaflet+OSM přes `next/dynamic` (`ssr:false`) s fallbackem; localStorage
`korfu2026:selection:v1`; volitelné počasí bez klíče; zbytek katalogu (části 7, 8, 10–18),
`_data/combos.ts`, `_data/practical.ts`; filtry; sekce koní; `.korfu/check-no-itinerary.sh`;
CHECKPOINT-3/4; nezávislý `.korfu/AUDIT.md`.

**Otevřená otázka pro manažera:** souřadnice pro mapu nejsou ve SOURCE_PACKu (mezera G1).
Bez nich bude mapa umět vykreslit jen základnu, nebo žádný bod. Potřebné rozhodnutí:
buď (a) doložený zdroj souřadnic dodat jako vstup, nebo (b) potvrdit, že mapa zobrazí pouze
body, které vzniknou z budoucího doloženého zdroje, a do té doby zůstane s prázdnou vrstvou
a vysvětlujícím textem. Executor tuto hodnotu sám nedoplní.
