# CHECKPOINT 1 — Uzavření autoritativního vstupu + coverage matrix

Datum: 2026-09-13
Workspace: `/Users/janbindr/Projects/korfu2026-build`
Branch: `feat/korfu2026`
Stav: **EVIDENCE_READY** — executor neprohlašuje PASS.

---

## 1. Co bylo přečteno

### 1.1 `.korfu/SOURCE_PACK.md` — CELÝ
- **478 řádků** (`wc -l`).
- Přečteno ve 4 souvislých blocích: 1–160, 160–330, 330–478, plus ověřovací průchody
  s čísly řádků pro sekce 1–6, 7–9, 10, 11–13, 13–20, 21–25.
- **22 sekcí**, ne 24: číslování jde 1–22, pak **skáče na 24** a 25.
  `## 23.` v souboru **neexistuje** — ověřeno `grep -n '^## '`:
  ```
  437:## 22. Deployment — technické požadavky subpath
  447:## 24. Definition of Done
  ```
  → Zadání odkazuje na „část 24 SOURCE_PACK" = Definition of Done, ta existuje (SP:447–459).
  Chybějící sekce 23 je fakt o zdroji, ne mezera v mém čtení.

### 1.2 Vzorové routy (POUZE ČTENY, nezměněny)
- `app/lefkada-2026/` — jediný soubor `route.ts` (16 ř.). Je to jen route handler, který
  servíruje statické `public/lefkada-2026.html`. **Není to použitelný vzor** pro App Router
  stránku s komponentami a stavem.
- `app/cesky-raj-2026/` — 19 souborů: `page.tsx`, `layout.tsx`, `data.ts`, `types.ts`,
  `gradient.ts`, `raj.css`, `components/` (13 komponent). Toto je skutečný vzor.
- `app/soci/` — objeveno jako **nejbližší vzor pro tento úkol** (katalog + Leaflet mapa +
  Tailwind): `page.tsx`, `layout.tsx`, `data.ts`, `types.ts`, `atlas.css`,
  `components/GuideMapClient.tsx` + `components/GuideMapDynamic.tsx`.

---

## 2. Konvence, které přebírám (a odkud)

| Konvence | Vzor | Soubor:řádek |
|---|---|---|
| Segment = `page.tsx` + `layout.tsx` + `data.ts`/`types.ts` + `components/` | `app/cesky-raj-2026`, `app/soci` | `app/cesky-raj-2026/page.tsx:19`, `app/soci/types.ts:1` |
| Typy odděleně od dat, data jako typované `export const` | `app/soci` | `app/soci/data.ts:1–7` (import z `./types`) |
| Server component jako default, `'use client'` jen kde je stav | `app/cesky-raj-2026` | `components/DayApp.tsx:1`, `components/ShoppingList.tsx:1` |
| localStorage: konstanta klíče + `useEffect` load + `useEffect` save, **oba v `try/catch`** | `app/cesky-raj-2026` | `components/ShoppingList.tsx:6,12–20,22–29` |
| Klávesnicová přístupnost u ne-button prvků: `role`, `aria-checked`, `tabIndex={0}`, `onKeyDown` Enter/Space | `app/cesky-raj-2026` | `components/ShoppingList.tsx:45–54` |
| Leaflet přes `next/dynamic` se `ssr: false` + `loading` fallback | `app/soci` | `components/GuideMapDynamic.tsx:3–15` |
| Leaflet client: `import 'leaflet/dist/leaflet.css'`, `L.divIcon` markery, `MapContainer`/`TileLayer` z `react-leaflet` | `app/soci` | `components/GuideMapClient.tsx:1–6,21–38` |
| Waypoint s `lat`/`lng` + komentář o původu souřadnic | `app/soci` | `data.ts:33` („Všechny souřadnice ověřeny přes Google Places 29.6.2026") |
| Tailwind v4 (bez `tailwind.config`), `@import "tailwindcss"` v `app/globals.css` | repo | `app/globals.css:1`, `postcss.config.mjs:3` |
| Čeština v UI i v `metadata` | oba vzory | `app/cesky-raj-2026/page.tsx:12–17` |

### Technický stav repa (ověřeno)
- `package.json`: **`leaflet` ^1.9.4, `react-leaflet` ^5.0.0, `@types/leaflet` ^1.9.21
  už jsou v závislostech** → mapu lze postavit bez přidávání balíčků a bez API klíče.
- Next.js `16.2.1`, React `19.2.4`, TypeScript `^5`, Tailwind `^4` přes `@tailwindcss/postcss`.
- `node_modules/` **v workspace neexistuje** → před prvním `npm run build` bude nutné
  `npm install` (síť pro npm je povolená).
- `next.config.ts` obsahuje jen jeden redirect pro `/honzik2`; **nic nekoliduje s `/korfu2026`**
  a žádný `basePath` není nastaven (SP:437–445 řeší subpath, ale to je deployment věc mimo
  tento běh).
- Skript `lint` v `package.json` **neexistuje** (jsou jen `dev`, `build`, `start`, `test`,
  db a fetch skripty). Checkpoint 3 „lint bez chyb" bude muset být splněn typovou kontrolou
  v rámci `next build` + `npx tsc --noEmit`, ne `npm run lint`. Viz riziko R7.

---

## 3. Plánovaná struktura `app/korfu2026/`

```
app/korfu2026/
├── page.tsx                      # server component, skládá sekce
├── layout.tsx                    # wrapper + import korfu.css
├── korfu.css                     # barvy Jónského moře (SP:403), mobile-first
├── _data/
│   ├── types.ts                  # Place, Combo, Operator, Freshness, SelectionState …
│   ├── places.ts                 # katalog karet (13 must-see + 40 pláží + památky + aktivity)
│   ├── combos.ts                 # 12 geografických balíčků (SP:114–125)
│   └── practical.ts              # TRIP, HOTEL, EMERGENCY, DOPRAVA, HORSE_*, BOAT_*,
│                                 # DIVING_*, QUAD_*, WATERSPORTS_RODA, FISHING, WELLNESS,
│                                 # VECERNI_PODNIKY, RESTAURACE_RODA, UDALOSTI,
│                                 # CHECKLISTS, CONTACT_TEMPLATES, SOURCES
├── _lib/
│   ├── useSelection.ts           # 'use client', localStorage 'korfu2026:selection:v1'
│   └── nav.ts                    # Google Maps deep-link builder
└── _components/
    ├── PrehledSection.tsx        # SP:379–380 — bez sekce „Dnes"
    ├── KatalogSection.tsx        # SP:381–383 + FilterBar
    ├── FilterBar.tsx             # 'use client' — kategorie/oblast/náročnost/doprava/počasí/priorita
    ├── PlaceCard.tsx             # render datového modelu z ČÁSTI Q
    ├── AktivitySection.tsx       # SP:384
    ├── KoneSection.tsx           # SP:129–179 — výrazná samostatná sekce
    ├── LodeSection.tsx           # SP:181–229
    ├── MapaDynamic.tsx           # 'use client', next/dynamic ssr:false
    ├── MapaClient.tsx            # 'use client', Leaflet + OSM dlaždice
    ├── ComboSection.tsx          # SP:387 — bez kalendáře
    ├── JidloVecerSection.tsx     # SP:388
    ├── DopravaSection.tsx        # SP:389
    ├── PraktickeSection.tsx      # SP:390
    ├── MujVyberSection.tsx       # SP:391–392 — 'use client'
    ├── ZdrojeSection.tsx         # SP:393
    ├── PocasiPanel.tsx           # SP:348–355, open-meteo bez klíče, timestamp + fallback
    ├── DynamicFact.tsx           # vynucuje štítek „ověřit aktuálně" + verifyUrl
    ├── Checklist.tsx             # 6 checklistů
    ├── ContactButtons.tsx        # Navigovat / Volat / Kopírovat číslo / Otevřít zdroj
    ├── CopyTemplate.tsx          # 3 hotové kontaktní zprávy
    ├── RodaSection.tsx           # SP:292–308
    └── BottomNav.tsx             # SP:404–405 — Přehled/Možnosti/Mapa/Můj výběr/Praktické
```

Plus mimo route:
- `.korfu/check-no-itinerary.sh` — automatická kontrola zákazů Z1–Z7 z ČÁSTI T COVERAGE.md.

---

## 4. RIZIKA A MEZERY (nic z toho si nedoplňuji z paměti)

### R1 — BLOKUJÍCÍ ROZHODNUTÍ: SOURCE_PACK neobsahuje žádné souřadnice
**Důkaz:** `grep -nE '[0-9]{1,3}\.[0-9]{4,}' .korfu/SOURCE_PACK.md` → **0 shod.**
**Konflikt:** SP:55 vyžaduje „každá vlastní karta + **ověřený mapový bod**" a SP:385 „**ověřené
body**" na mapě. SP:454 (DoD) vyžaduje „všechny názvy, **souřadnice** a navigační odkazy byly
ověřeny". Ale pack žádnou lat/lng neuvádí a tento běh má zakázané síťové ověřování obsahu
(„Síť používej jen pro `npm`/build").
**Můj plán bez vymýšlení dat (default, pokud nepřijde jiný pokyn):**
- `coords: null`, `coordsStatus: 'chybi-v-source-packu'` u všech karet;
- na mapě se nevykreslí falešně přesný pin — místo toho panel „mapový bod nedoložen ze
  zdrojového packu" + karta zůstane plně funkční;
- „Navigovat" = Google Maps **search** deep-link
  `https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(canonicalName)>`.
  Nefabrikuje žádnou hodnotu a v praxi vede na správné místo.
**Dopad:** mapová sekce (SP:385–386) bude bez pinů, dokud někdo nedodá ověřené souřadnice.
**Co potřebuji od manažera/vlastníka (rozhodnutí, ne otázka na mě):**
(a) doplnit ověřené souřadnice do SOURCE_PACKu nebo do samostatného schváleného vstupu, NEBO
(b) explicitně povolit executorovi dohledat souřadnice z geokódovacího zdroje a označit je
    `coordsStatus: 'orientacni'`, NEBO
(c) potvrdit variantu „bez pinů + search deep-link" jako finální.
→ Do rozhodnutí implementuji (c), protože jako jediná nic nevymýšlí.

### R2 — SOURCE_PACK neuvádí čas z hotelu ani parkování pro žádné místo
Datový model (SP:397–398) vyžaduje „parkování" a „orientační čas z Silver Beach Hotelu"
jako povinná pole, ale pack tyto hodnoty nikde nedodává (jediná zmínka je požadavek
SP:126–127 „Každá karta: přibližný čas jízdy z hotelu … parkování").
→ Vyplním `'ověřit aktuálně'` se štítkem, nikoli odhad. Stejná třída problému jako R1.

### R3 — Kassiopi Beach: nerozhodnutá identita místa
SP:61–62 sám nařizuje „ověřit, zda nejlépe odpovídá Bataria, Kanoni nebo jiné konkrétní pláži".
SP:89 přidává „Kassiopi / Bataria / Kanoni (přesný výběr ověřit)".
→ Karta vznikne jako `kassiopi-beach` s explicitním štítkem nerozhodnutosti a se všemi třemi
variantami vypsanými. Nebudu za autora rozhodovat.

### R4 — Části matice bez konkrétního obsahu v packu
- M01 „rychlé doporučení a pobyt v kostce" — pack nikde nedefinuje, co má „rychlé doporučení"
  obsahovat. Postavím ho jen z LOCKED faktů (SP:35–48) + rychlých vstupů (SP:379–380);
  **nebudu vymýšlet „top 5 doporučení"**, protože by to byl skrytý itinerář.
- M25 „předodjezdové … checklisty" — pack má checklisty pro koně (SP:168–173), loď
  (SP:224–229), auto (SP:333–335), potápění (SP:256–257), quad (SP:262–263) a praktické
  položky (SP:371–374), ale **nemá explicitní „předodjezdový checklist"**. Sestavím ho
  výhradně z existujících položek SP:42 (odbavení), SP:44 (zavazadla), SP:47–48 (časná
  snídaně/balíček), SP:371–374 (EHIC, léky, offline mapa, roaming, hotovost) — bez nových
  položek. Fakt, že jde o kompilaci, uvedu v textu.

### R5 — WOW faktor 1–5 je hodnotící údaj, který pack nedodává
SP:396 vyžaduje pole „WOW faktor 1–5", ale pack u žádného místa číslo neuvádí.
Odvodím ho **deterministicky** ze signálů, které v packu jsou, a pravidlo zapíšu do kódu:
must-see s prioritou 1–3 (SP:57–59) → 5; must-see s markerem srdce/hvězdička (SP:58, SP:65)
→ 5; ostatní must-see (SP:61–71) → 4; místa s vlastním odstavcem v části 7/8 → 3;
položky jen jmenované v seznamu → 2. Žádné subjektivní hodnocení navíc.

### R6 — Obrázky
SP:406 povoluje obrázky jen s legálním zdrojem. SOURCE_PACK **neobsahuje žádný obrázek ani
odkaz na licencovanou fotografii**. → Web postavím **bez fotografií**, na CSS gradientech
a ikonách (vzor `app/cesky-raj-2026/gradient.ts:1–12`). Sekce `PhotoCredits` nevznikne.

### R7 — Chybějící `lint` skript
`package.json` nemá `lint`. Checkpoint 3 splním `npx tsc --noEmit` + `npm run build`
(Next build dělá typovou kontrolu) a raw výstupy doložím. Pokud je vyžadován ESLint,
potřebuji GO na přidání závislosti — to by měnilo `package.json`, což je mimo tento běh.

### R8 — Kontrola konzolových chyb bez prohlížeče
DoD (SP:457) i zadání vyžadují „žádné chyby v konzoli". Zadání tohoto běhu ale zakazuje
prohlížeč a GUI. Konzolové chyby lze v CLI ověřit jen nepřímo (build warnings, hydration
mismatch hlášené buildem, `next start` + `curl` na HTML). **Plnou kontrolu konzole nelze
v CLI-only režimu doložit** — nahlásím to jako zbytkové riziko, ne jako splněné.

### R9 — Sekce 23 SOURCE_PACKu neexistuje
Není to mezera v mém čtení; pack skáče z 22 na 24. Zaznamenáno pro auditora, aby to
neinterpretoval jako vynechanou část.

---

## 5. Co v tomto kole NEVZNIKLO (záměrně)

- Žádný soubor v `app/korfu2026/` — zadání tohoto kola implementaci výslovně zakazuje.
- `app/lefkada-2026/` a `app/cesky-raj-2026/` **nebyly změněny** (jen čteny).
- Žádný `npm install`, žádný build, žádný commit bez pokynu, žádný push, žádný deploy.

## 6. Další krok (po schválení)

Checkpoint 2: `npm install`, vytvořit `_data/types.ts` + `_data/places.ts` (13 must-see jako
první), `page.tsx` s minimální sekcí, `npm run build` zelený, doložit raw výstup.
Předtím je ale potřeba **rozhodnutí R1** (souřadnice), protože určuje podobu mapové sekce
i pole `navUrl` na každé kartě.
