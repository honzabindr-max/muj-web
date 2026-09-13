# CHECKPOINT 2 — první funkční lokální verze route `/korfu2026/`

Datum: 2026-09-13
Workspace: `/Users/janbindr/Projects/korfu2026-build`
Branch: `feat/korfu2026`
Rozsah kola: datový model + 13 ručních must-see + minimální renderovatelná route + zelený build.
BEZ mapy, BEZ localStorage, BEZ počasí — ty patří do dalších kol.

---

## 1. Co vzniklo (seznam souborů)

> **OPRAVENO 2026-09-13 (běh korfu2026-02, kolo 1).** Původní tabulka popisovala stav ke commitu
> `577ada5` a nebyla aktualizována poté, co DODATEK (commit `f59aabd`) přidal geokódování.
> Vysvětlení rozporu je v oddílu 11.

### 1a. Stav po commitu `577ada5` (první vrstva checkpointu 2 — historický)

| Soubor | Řádků v `577ada5` | Účel |
|---|---|---|
| `app/korfu2026/_data/types.ts` | 178 | Typovaný datový model karty podle části 19 SOURCE_PACKu (ř. 395–399) + pravidlo R-NAV |
| `app/korfu2026/_data/places.ts` | 419 | Katalog karet; zatím 13 ručních must-see z části 6 (ř. 55–72) |
| `app/korfu2026/_components/PlaceCard.tsx` | 125 | Render jedné karty; `null` pole se nevykreslují |
| `app/korfu2026/page.tsx` | 53 | App Router stránka `/korfu2026`, česky, mobile-first, Tailwind |

Doklad: `git show --stat 577ada5` → `PlaceCard.tsx | 125`, `places.ts | 419`, `types.ts | 178`,
`page.tsx | 53`.

### 1b. KONEČNÝ stav checkpointu 2 = commit `f59aabd` (platná čísla)

| Soubor | Řádků | Účel |
|---|---|---|
| `app/korfu2026/_data/types.ts` | 201 | Model karty + `CoordsStatus`, `CoordsSource`, `coordsQuery`, `coordsCheckedAt` |
| `app/korfu2026/_data/places.ts` | 427 | 13 ručních must-see jako `PlaceSeed[]` + `withGeocode()` |
| `app/korfu2026/_components/PlaceCard.tsx` | 143 | Render karty včetně souřadnic, atribuce OSM a data ověření |
| `app/korfu2026/page.tsx` | 53 | App Router stránka `/korfu2026`, česky, mobile-first, Tailwind |
| `app/korfu2026/_data/coords.generated.ts` | 121 | Statický výsledek geokódování (13 bodů), generovaný — needitovat |
| `scripts/korfu2026-geocode.mjs` | 143 | Jednorázový geokódovací skript podle D01-A |

`app/korfu2026/` = **5 souborů, 945 řádků** celkem (`find app/korfu2026 -type f | xargs wc -l`
→ `945 total`), plus 1 soubor pod `scripts/`. Doklad: `git show --stat f59aabd`.

Mimo `app/korfu2026/`, `scripts/korfu2026-geocode.mjs` a `.korfu/` nebyl v obou commitech
vytvořen ani změněn žádný soubor (viz oddíl 9).

## 2. Prostředí

`npm install` v tomto prostředí NEINSTALOVAL devDependencies, protože shell má `NODE_ENV=production`
(npm pak implicitně `omit=dev`). Důsledek: chyběl `@tailwindcss/postcss` a build padal na
`Error: Cannot find module '@tailwindcss/postcss'`. Řešeno jednorázově příkazem:

```
NODE_ENV=development npm install --include=dev
```

→ `added 106 packages, and audited 203 packages`. `package.json` ani `package-lock.json` se
tím nezměnily (doklad `git status`, oddíl 9 — oddíl 7 je build, nikoli `git status`; opraveno
v kole korfu2026-02). Toto je vlastnost prostředí, ne repozitáře.

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
| `coords` + `coordsStatus` + `coordsNote` + `coordsSource` + `coordsQuery` + `coordsCheckedAt` | ř. 398 „ověřené souřadnice" | v `577ada5` 13× `null` / `'chybi-ve-zdroji'` (mezera G1); **v konečném stavu `f59aabd` 13× vyplněno**: `coordsStatus: 'overene'` 13×, `coordsSource: 'osm-nominatim'` 13×, `coordsCheckedAt: '2026-09-13'` 13× — viz DODATEK D3 |
| `mapsQuery` + `mapsUrl()` | ř. 398 „navigační odkaz" | 13×, pravidlo R-NAV |
| `sources` | ř. 398–399 „oficiální nebo ověřovací zdroj" | 13× `[]` — zdroj u pláží žádné URL neuvádí |
| `verify` | ř. 399 „aktuálnost" | 4 položky celkem (viz oddíl 5) |
| „oblíbené / navštíveno v localStorage" | ř. 399 | NENÍ ve statických datech — runtime stav, klíč `korfu2026:selection:v1`, implementace v dalším kole |

## 4. Mezery ve zdroji (kontrakt bod 16 — pole ponechaná prázdná, NE doplněná odhadem)

- **G1 — souřadnice. ⚠ PŘEKONÁNO** rozhodnutím vlastníka D01-A (viz DODATEK a oddíl 11);
  platilo pouze pro commit `577ada5`. V konečném stavu checkpointu 2 (`f59aabd`) má všech
  13 karet ověřený bod z OSM Nominatimu. Text níže je ponechán jako záznam původního zjištění.
  SOURCE_PACK neobsahuje ani jednu číselnou souřadnici. Ověřeno:
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

Sloupec `places.ts` ř. udává řádek s `id:` **v commitu `577ada5`**. Po `f59aabd` se karty
posunuly (přibyl import a `PlaceSeed`), proto je přidán sloupec s platnými čísly pro HEAD.
Doklad: `git show 577ada5:app/korfu2026/_data/places.ts | grep -n "id:"` vs
`grep -n "id:" app/korfu2026/_data/places.ts`.

| # (část 6) | Název ve zdroji | `id` | `places.ts` ř. (`577ada5`) | `places.ts` ř. (HEAD `f59aabd`) | Citace SOURCE_PACKu |
|---|---|---|---|---|---|
| 1 | Canal d'Amour u Sidari | `canal-damour` | 26 | 39 | SP:57, SP:80, SP:116, SP:413 |
| 2 | Porto Timoni | `porto-timoni` | 54 | 64 | SP:58, SP:82–83, SP:117, SP:200, SP:353, SP:414 |
| 3 | Paleokastritsa / Palaiokastritsa | `paleokastritsa` | 85 | 92 | SP:59, SP:84–85, SP:101, SP:118, SP:183–185, SP:221, SP:417 |
| 4 | Kassiopi Beach | `kassiopi-beach` | 119 | 123 | SP:61–62, SP:89, SP:98, SP:119, SP:416 |
| 5 | Rovinia Beach | `rovinia-beach` | 153 | 154 | SP:63, SP:84–85, SP:118, SP:184 |
| 6 | Agios Gordios | `agios-gordios` | 181 | 179 | SP:64, SP:88, SP:102, SP:122 |
| 7 | Issos Beach | `issos-beach` | 209 | 204 | SP:65, SP:92–93, SP:123 |
| 8 | Avlaki Beach | `avlaki-beach` | 237 | 229 | SP:66, SP:89, SP:119, SP:413 |
| 9 | Marathias Beach | `marathias-beach` | 265 | 254 | SP:67, SP:92, SP:124 |
| 10 | Nissaki Beach | `nissaki-beach` | 293 | 279 | SP:68, SP:91, SP:120, SP:194–198, SP:221–222 |
| 11 | Chalikounas / Halikounas Beach | `chalikounas-beach` | 327 | 310 | SP:69, SP:92–93, SP:123 |
| 12 | Myrtiotissa Beach | `myrtiotissa-beach` | 355 | 335 | SP:70, SP:87–88, SP:122, SP:353 |
| 13 | Barbati Beach | `barbati-beach` | 389 | 366 | SP:71, SP:91, SP:120, SP:210 |

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

Kontrola prázdnosti neodvoditelných polí — **stav ke commitu `577ada5`**:
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

Tytéž kontroly nad **konečným stavem checkpointu 2** (`f59aabd`, přeměřeno 2026-09-13,
`grep -r -F -o -- "<vzor>" app/korfu2026 | wc -l`):
```
wow: null                       → 13
timeFromHotel: null             → 13
parking: null                   → 13
tier: 'must-see'                → 13
coords: null                    → 1   (jen fallback ve withGeocode(), places.ts:401)
coordsStatus: 'overene'         → 13
coordsSource: 'osm-nominatim'   → 13
coordsCheckedAt: '2026-09-13'   → 13
```
Řádky `coords: null → 13×` a `coordsStatus: 'chybi-ve-zdroji' → 13×` platí VÝHRADNĚ pro
`577ada5`; po `f59aabd` jsou neplatné.

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

Všech 13 tlačítek Navigovat bylo v HTML **v tomto mezikroku (`577ada5`)** ve tvaru
`https://www.google.com/maps/search/?api=1&query=<název>%2C%20Korfu` — bez souřadnic.
**V konečném stavu checkpointu 2 (`f59aabd`) to už neplatí**: všech 13 odkazů míří na
`…&query=<lat>,<lon>` — viz DODATEK D4.

## 9. Hranice běhu

Údaje v tomto oddílu popisují stav **na konci checkpointu 2, tj. v commitu `f59aabd`**.
Dnešní (2026-09-13, běh korfu2026-02) `git status --porcelain=v1` ukazuje navíc
` M .gitignore`, ` M .korfu/SOURCE_PACK.md`, `?? .korfu/TASK-02.md`, `?? .korfu/supervisor.sh`
— to jsou změny pozdějšího běhu, ne checkpointu 2; vysvětlení v oddílu 11.

- `git diff --stat HEAD` = prázdný → žádný dosud trackovaný soubor nebyl změněn.
- `git diff --stat HEAD -- app/lefkada-2026 app/cesky-raj-2026 public/` = prázdný.
- Nové soubory pouze pod `app/korfu2026/` a `.korfu/`.
- Žádný `git push`, žádná změna `main`, žádný deploy, žádný blokující `npm run dev`.
- Nic mimo `/Users/janbindr/Projects/korfu2026-build` nebylo čteno ani měněno.

## 10. Co zbývá (další kola)

Mapa Leaflet+OSM přes `next/dynamic` (`ssr:false`) s fallbackem; localStorage
`korfu2026:selection:v1`; volitelné počasí bez klíče; zbytek katalogu (části 7, 8, 10–18),
`_data/combos.ts`, `_data/practical.ts`; filtry; sekce koní; kontrolní skript;
CHECKPOINT-3/4; nezávislý `.korfu/AUDIT.md`.

Pozn. k názvu kontrolního skriptu: `.korfu/COVERAGE.md:804` a `:817` mluví o
`.korfu/check-no-itinerary.sh`. Takový soubor v repu nikdy nevznikl
(`git ls-files | grep -i itinerary` → 0 zásahů) a zadáním korfu2026-02 je nahrazen
skriptem `scripts/korfu2026-check.sh`. Pojmenování v COVERAGE.md je tedy zastaralé;
srovnání patří do kola, které skript píše.

**Otevřená otázka z tohoto oddílu je UZAVŘENÁ** — viz DODATEK D7 a oddíl 11. Souřadnice
dodalo rozhodnutí vlastníka D01-A (geokódování přes OSM Nominatim), 13/13 bodů je ověřených
a staticky v repu. Původní znění otázky: chyběl doložený zdroj souřadnic a executor
odmítal hodnotu doplnit sám — což bylo správně.


## 11. OPRAVA vnitřního rozporu (běh korfu2026-02, kolo 1, 2026-09-13)

Zadání korfu2026-02 bod 6: „`.korfu/CHECKPOINT-2.md` obsahuje vnitřní rozpor (počty souborů /
stav inventáře). Oprav ho tak, aby seděl na skutečný stav repa, a rozdíl vysvětli."

### 11.1 V čem byl rozpor

Dokument vznikl ve **dvou vrstvách** a druhá vrstva nikdy nepřepsala první:

| Vrstva | Commit | Co tvrdí |
|---|---|---|
| Oddíly 1–10 | `577ada5` | 4 soubory; `types.ts` 178, `places.ts` 419, `PlaceCard.tsx` 125, `page.tsx` 53; „žádný jiný soubor nebyl vytvořen"; `coords: null` 13×; Navigovat = search podle názvu |
| DODATEK D1–D7 | `f59aabd` | 6 souborů (+ `coords.generated.ts` 121, + `scripts/korfu2026-geocode.mjs` 143); `types.ts` 201, `places.ts` 427, `PlaceCard.tsx` 143; `coordsStatus: 'overene'` 13×; Navigovat = `query=<lat>,<lon>` |

Konkrétní rozpory, které kolo korfu2026-02 našlo a opravilo:

1. **Počty řádků.** Oddíl 1 uváděl 178 / 419 / 125, skutečnost v HEAD je 201 / 427 / 143
   (`git show --stat f59aabd`; `find app/korfu2026 -type f | xargs wc -l` → `945 total`).
2. **Úplnost inventáře.** Věta „Žádný jiný soubor v repozitáři nebyl vytvořen ani změněn"
   byla popřena o ~240 řádků níž tabulkou D1, která přidává dva další soubory.
3. **Stav souřadnic.** Oddíl 3, mezera G1 (oddíl 4), raw blok v oddílu 6 a oddíl 8 tvrdily
   „13× `coords: null`". Přeměřeno dnes: `coords: null` je v `app/korfu2026/` **jednou**
   (`places.ts:401`, fallback ve `withGeocode()`), zatímco `coordsStatus: 'overene'`,
   `coordsSource: 'osm-nominatim'` a `coordsCheckedAt: '2026-09-13'` jsou 13×.
4. **Otevřená otázka.** Oddíl 10 nechával mapové body jako otevřené rozhodnutí pro manažera,
   ačkoli D7 je o pár řádků níž prohlašuje za vyřešené.
5. **Čísla řádků v oddílu 5.** Sloupec `places.ts` ř. byl měřen v `577ada5`; po `f59aabd`
   se karty posunuly (`id: 'canal-damour'` z ř. 26 na ř. 39 atd.). Doplněn druhý sloupec.
6. **Křížový odkaz v oddílu 2.** Odkazoval na `git status` „v oddílu 7", kde je ale build.
7. **Délka SOURCE_PACKu.** DODATEK tvrdil 511 řádků a část 26 na ř. 483–511. Dnes:
   `wc -l .korfu/SOURCE_PACK.md` → **478**, `grep -i -E "supervisor|directive|^## *26"` → 0 zásahů.
   Všechny citace typu „SOURCE_PACK ř. 487–511" v D2/D6 proto mířily do neexistujících řádků;
   převedeny na „D01-A"/„D01-C" s původem v `.korfu/TASK-02.md`.

### 11.2 Proč rozpor vznikl

Checkpoint 2 byl uzavřen commitem `577ada5`. Poté do běhu vstoupil **zásah do zdroje pravdy
za běhu**: do `.korfu/SOURCE_PACK.md` byla připsána část 26 „SUPERVISOR DIRECTIVE 01"
(ř. 483–511), která zrušila mezeru G1 a povolila geokódování. Executor direktivu zapracoval
commitem `f59aabd` a evidenci k ní připsal jako DODATEK **na konec** už uzavřeného dokumentu,
místo aby opravil oddíly 1–10. Dokument tak zůstal konzistentní s časem svého vzniku, ale
nekonzistentní sám se sebou.

Metodická příčina je pojmenovaná v zadání korfu2026-02 bodu 1: připisovat obsah do zdroje
pravdy uprostřed běhu byla chyba v metodě, ne ve věci. Auditor korfu2026-01 ji správně
zachytil (nešlo ověřit původ sekce 26). Část 26 byla proto ze SOURCE_PACKu odstraněna a její
obsah platí dál pouze jako jmenovaná rozhodnutí vlastníka **D01-A / D01-B / D01-C**.
Commit `f59aabd` a `scripts/korfu2026-geocode.mjs` jsou tím zpětně autorizované a nerevertují se.

### 11.3 Ověřený stav repa, na který je dokument narovnán (2026-09-13)

```
$ git rev-parse --abbrev-ref HEAD
feat/korfu2026
$ git log --oneline -2
f59aabd feat(korfu2026): ověřené mapové body podle SUPERVISOR DIRECTIVE 01 / D01-A
577ada5 feat(korfu2026): datový model + 13 must-see + minimální route
$ git status --porcelain=v1
 M .gitignore
 M .korfu/SOURCE_PACK.md
?? .korfu/TASK-02.md
?? .korfu/supervisor.sh
$ wc -l .korfu/SOURCE_PACK.md .korfu/COVERAGE.md .korfu/TASK.md .korfu/CHECKPOINT-1.md
     478 .korfu/SOURCE_PACK.md
     833 .korfu/COVERAGE.md
      77 .korfu/TASK.md
     201 .korfu/CHECKPOINT-1.md
$ find app/korfu2026 -type f | sort | xargs wc -l
     143 app/korfu2026/_components/PlaceCard.tsx
     121 app/korfu2026/_data/coords.generated.ts
     427 app/korfu2026/_data/places.ts
     201 app/korfu2026/_data/types.ts
      53 app/korfu2026/page.tsx
     945 total
```

`git diff -- .gitignore` = 6 přidaných řádků (ignorování běhových artefaktů `.korfu/runs/`,
`.korfu/*.log`, `.korfu/GATE.md`, `.korfu/SUPERVISOR-STATE.md`).
`.korfu/TASK-02.md` (75 ř.) je zadání tohoto běhu a `.korfu/supervisor.sh` (77 ř.) je smyčka,
která běh spouští (`lh-harness run --task @.korfu/TASK-02.md`). Oba jsou **netrackované
a nejsou autoritativním vstupem pro obsah webu** — zdrojem obsahu zůstává
`.korfu/SOURCE_PACK.md` ř. 1–478 mapovaný přes `.korfu/COVERAGE.md`.

### 11.4 Nálezy předané dalším kolům (v tomto kole ZÁMĚRNĚ neopraveno)

Kolo korfu2026-02/1 mělo mandát editovat pouze `.korfu/CHECKPOINT-2.md`. Tyto nálezy proto
zůstávají otevřené:

- `app/korfu2026/_data/types.ts:74, 80, 84, 88, 89` a `app/korfu2026/_data/coords.generated.ts:3`
  citují „SOURCE_PACK ř. 487–498 / 494 / 495 / 496–497 / 498" — po smazání části 26 jsou to
  odkazy do neexistujících řádků. Mají se přepsat na „D01-A".
- `.korfu/COVERAGE.md:804` a `:817` mluví o `.korfu/check-no-itinerary.sh`; ten soubor v repu
  nikdy nevznikl a zadáním je nahrazen `scripts/korfu2026-check.sh`.
- `.korfu/COVERAGE.md:602–698` (ČÁST Q) navrhuje jiná jména polí než implementovaný
  `types.ts` (`czechName`/`whyGo`/`comboIds`/`risks`/`navUrl`/`freshness` vs.
  `czName`/`why`/`combinesWith`/`warnings`/`mapsQuery`/`verify`) a `CoordsStatus` bez hodnot
  `'neoveritelne'` / `'chybi-ve-zdroji'`. Rozdíl je nutné v checkpointu 3 buď srovnat,
  nebo doložit jako vědomou odchylku.
- `.korfu/SOURCE_PACK.md` přeskakuje číslo sekce 23 (`## 22.` = ř. 437 → `## 24.` = ř. 447).
  Ověřeno, že tak je to i v commitu `577ada5` — nejde o důsledek smazání části 26.
- Zadání korfu2026-02 mluví o „coverage matrix částí A–Q"; `.korfu/COVERAGE.md` má reálně
  části **A–T** (A ř. 31 … T ř. 804). Pro checkpoint 3 platí skutečný rozsah A–T.

---

# DODATEK k CHECKPOINTU 2 — SUPERVISOR DIRECTIVE 01 / D01-A (souřadnice)

> **OPRAVENO 2026-09-13 (běh korfu2026-02, kolo 1).** Původní znění tohoto odstavce tvrdilo,
> že `.korfu/SOURCE_PACK.md` má 511 řádků a obsahuje část 26 na ř. 483–511. **To už neplatí.**
> Část 26 byla ze SOURCE_PACKu odstraněna (zásah do zdroje pravdy za běhu byl chybou v metodě),
> soubor je zpět na **478 řádcích**:
> `wc -l .korfu/SOURCE_PACK.md` → `478`;
> `grep -n -i -E "supervisor|directive|^## *26" .korfu/SOURCE_PACK.md` → 0 zásahů (exit 1);
> `shasum -a 256` pracovní kopie == `git show HEAD:.korfu/SOURCE_PACK.md | head -n 478 | shasum -a 256`
> (`615ef034065f66e840c3d11f839f26620ac5dc92b80b79aec87b8cd0f558de86`) → modifikace je
> **výhradně smazání části 26**, `git diff --stat` = `33 -----`, 0 vložených řádků.
> Obsah direktivy platí dál, ale jako **rozhodnutí vlastníka D01-A / D01-B / D01-C**
> se jmenovaným původem v `.korfu/TASK-02.md` (ř. 22–34). Odkazy na „SOURCE_PACK ř. 483–511"
> níže i v `types.ts` a `coords.generated.ts` míří do neexistujících řádků — viz oddíl 11.

Řádky 1–478 SOURCE_PACKu se v žádném okamžiku nezměnily — všechny hlavičky `## 1.` až `## 25.`
sedí na původních číslech (`## 6.` = ř. 55, `## 19.` = ř. 376, `## 21.` = ř. 411, `## 25.` = ř. 461),
takže **všechny citace `SP:xxx` výše zůstávají platné**.

Direktiva ruší mezeru G1: `coords: null` u všech karet prohlašuje za nepřijatelné a povoluje
jedinou výjimku ze zákazu síťového ověřování — geokódování přes veřejné OSM Nominatim.
Executor to provedl přesně v rozsahu D01-A; D01-B (ceny, otevírací doby, sezonní provoz,
dostupnost, program akcí) zůstává NEOVĚŘOVÁNO a se štítkem „ověřit aktuálně".

## D1. Nové / změněné soubory

| Soubor | Řádků | Účel |
|---|---|---|
| `scripts/korfu2026-geocode.mjs` | 143 | Jednorázový geokódovací skript podle D01-A |
| `app/korfu2026/_data/coords.generated.ts` | 121 | Statický výsledek geokódování (generovaný, needitovat) |
| `app/korfu2026/_data/types.ts` | 201 | + `CoordsSource`, `coordsSource`, `coordsQuery`, `coordsCheckedAt`, stav `neoveritelne` |
| `app/korfu2026/_data/places.ts` | 427 | Karty jsou nyní `PlaceSeed[]`; bod se doplňuje `withGeocode()` z generovaných dat |
| `app/korfu2026/_components/PlaceCard.tsx` | 143 | Vykresluje souřadnice + atribuci OpenStreetMap + datum ověření |

## D2. Dodržení D01-A bod po bodu

| Požadavek (D01-A) | Jak je splněn | Důkaz |
|---|---|---|
| jen Nominatim bez klíče (D01-A) | `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=…` | `scripts/korfu2026-geocode.mjs:60–61` |
| rate limit max 1 dotaz/s (D01-A) | `await sleep(1100)` mezi dotazy | `scripts/korfu2026-geocode.mjs:84` |
| vlastní `User-Agent` (D01-A) | `korfu2026-build/1.0 (osobni cestovni web, kontakt pres repo muj-web)` — bez osobních údajů | `scripts/korfu2026-geocode.mjs:21, 63` |
| jednorázově při buildu dat, NE za běhu (D01-A) | skript je mimo `app/`; `grep -rn 'fetch(' app/korfu2026` → 0 zásahů | grep, oddíl D4 |
| výsledek staticky v repu (D01-A) | `app/korfu2026/_data/coords.generated.ts` je commitnutý | `git status` |
| `coordsSource` / `coordsQuery` / `coordsCheckedAt` (D01-A) | povinná pole v `Place` i v generovaném souboru | `types.ts:172–176`, `coords.generated.ts` |
| nejednoznačný výsledek → `null` + `neoveritelne` (D01-A) | větev v `geocode()` + kontrola bounding boxu Korfu (39.3–39.9 N, 19.3–20.2 E) | `scripts/korfu2026-geocode.mjs:27, 49–56, 76–78` |
| nikdy nevymýšlet zpaměti (D01-A) | v `places.ts` nezbyla ani jedna ručně psaná souřadnice; jediné `coords: null` je fallback ve `withGeocode()` | `grep -c "coords: null" places.ts` = 1 |

## D3. Raw výstup geokódování (`node scripts/korfu2026-geocode.mjs`)

```
OK   canal-damour  39.7974749, 19.6980829  <- Canal d'Amour, Sidari, Municipality of Northern Corfu, Corfu Regional Unit, ...
OK   porto-timoni  39.7150927, 19.657751  <- Porto Timoni, Afionas, Municipality of Northern Corfu, Corfu Regional Unit, ...
OK   paleokastritsa  39.6757716, 19.7119035  <- Palaiokastritsa, Municipality of Central Corfu and Diapontia Islands, ...
OK   kassiopi-beach  39.7891062, 19.9220526  <- Kassiopi, Kassopaia Municipal Unit, Municipality of Northern Corfu, ...
OK   rovinia-beach  39.6705236, 19.7278861  <- Rovinia, Liapades, Municipality of Central Corfu and Diapontia Islands, ...
OK   agios-gordios  39.5463723, 19.8535708  <- Agios Gordios, Municipality of Central Corfu and Diapontia Islands, ...
OK   issos-beach  39.4293085, 19.9393258  <- Issos Beach, Municipal Unit of Meliteieis, Municipality of Southern Corfu, ...
OK   avlaki-beach  39.7799454, 19.9425103  <- Avlaki Beach, Kariotiko, Kassopaia Municipal Unit, ...
OK   marathias-beach  39.4141688, 19.9838528  <- Marathias beach, Potamia, Marathias, Municipal Unit of Korissia, ...
OK   nissaki-beach  39.7240175, 19.8969852  <- Nissaki Beach, Nissaki, Kassopaia Municipal Unit, ...
OK   chalikounas-beach  39.4475963, 19.8861189  <- Chalikounas Beach, Chalikounas, Municipal Unit of Meliteieis, ...
OK   myrtiotissa-beach  39.5955325, 19.799522  <- Myrtiotissa Beach, Glyfada, Municipality of Central Corfu ...
OK   barbati-beach  39.7157285, 19.8672221  <- Barbati Beach, Glyfa, Barbati, Municipality of Central Corfu ...

zapsáno: app/korfu2026/_data/coords.generated.ts  (13/13 bodů)
```

13/13 bodů dohledáno, všechny uvnitř bounding boxu Korfu, každý `display_name` obsahuje
„Corfu Regional Unit". Žádný bod nespadl do stavu `neoveritelne`.
`coordsStatus` je tedy 13× `'overene'`, `coordsSource` 13× `'osm-nominatim'`,
`coordsCheckedAt` 13× `'2026-09-13'`.

Zbývá otevřené (nejde o souřadnici, ale o výběr místa): u **Kassiopi** SOURCE_PACK ř. 61–62 a 89
sám žádá ověřit, zda „Kassiopi Beach" znamená Bataria, Kanoni nebo jinou pláž. Bod proto míří na
obec Kassiopi a karta nese položku „ověřit aktuálně". Nejde o vymyšlenou hodnotu.

## D4. Kontroly po zapracování direktivy (raw)

```
=== 1a den N / day N ===          0
=== 1b dny v týdnu ===            0 (pondělí…neděli, víkend)
=== 1c itinerář/týden/rozvrh ===  0
=== 2 Albánie/Ksamil ===          0
=== 3 Paxos ===                   0
=== 4 Silver Beach + koně ===     0
=== 5 citlivé/secrets ===         0
=== 6 telefony/e-maily ===        0
=== 7 API klíč ===                3 zásahy — všechny React prop `key=` (page.tsx:37,
                                  PlaceCard.tsx:70, PlaceCard.tsx:83), žádný API klíč
=== 8 fetch( v app/korfu2026 ===  0 — web za běhu žádné API nevolá
```

Render z build artefaktu `.next/server/app/korfu2026.html`: 13 karet, 13 tlačítek Navigovat,
všechna nyní ve tvaru `…/maps/search/?api=1&query=<lat>,<lon>`; žádný zbylý search deep-link
podle názvu. Atribuce `openstreetmap.org/copyright` a datum `ověřeno 2026-09-13` jsou v HTML
u každé karty.

## D5. Build po zapracování direktivy

```
> muj-web-next@0.1.0 build
> next build

▲ Next.js 16.2.1 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 1469ms
  Running TypeScript ...
  Finished TypeScript in 1843ms ...
  ...
├ ○ /korfu2026
...
○  (Static)   prerendered as static content
```

`exit=0`.

## D6. Dopad D01-C na další kola

Rozhodnutí D01-C (`.korfu/TASK-02.md` ř. 32–34) potvrzuje cíl deploymentu a mění implementační vzor:
**vzorem je `app/soci/` a `app/cesky-raj-2026/`, NE `app/lefkada-2026/`** (to je jen route handler
pro statické HTML). `app/soci/` navíc už obsahuje Leaflet mapu přes dynamický import
(`app/soci/components/GuideMapDynamic.tsx` → `GuideMapClient.tsx`) — to je vzor pro mapu
v dalším kole. Žádný z těchto adresářů nebyl v tomto běhu měněn.

Beze změny platí: NEPUSHOVAT, NEDEPLOYOVAT, neměnit `main`.

## D7. Zbývající otevřená rozhodnutí

Otevřená otázka z oddílu 10 (souřadnice) je direktivou D01-A **vyřešena** — 13/13 bodů
je ověřených a staticky uložených. Další kola mohou rovnou stavět mapu.
