# CHECKPOINT 3 — plná funkční verze + lokální QA

Datum a čas zápisu: 2026-09-13T17:57:53+02:00 (po dokončení níže uvedeného QA běhu).

## Rozsah

Route `app/korfu2026/page.tsx:1–12` předává `/korfu2026` klientské aplikaci. Jde o český katalog možností, nikoli itinerář: hlavička to výslovně deklaruje v `app/korfu2026/_components/KorfuApp.tsx:1025–1031`, v souladu se SOURCE_PACK `SP:4`, `SP:14–20` a `SP:376–393`.

Katalog má 66 seedů: 13 must-see (`app/korfu2026/_data/places.ts:54–55,2441–2448`; `SP:55–72`) a ostatní položky částí 7, 8 a 12 (`app/korfu2026/_data/places.ts:2431–2445`; `SP:74–111`, `SP:231–290`). Pokrytí úplné matice je trasováno v `.korfu/COVERAGE.md:39–79` včetně zákazu návratu denního programu (`SP:432–435`). Pevná fakta pobytu a praktické údaje pocházejí z `app/korfu2026/_data/practical.ts:8–26,28–78` (`SP:35–48`, `SP:357–374`); dynamické údaje nesou pravidlo aktuálního ověření v `app/korfu2026/_data/practical.ts:3–6,608–630` (`SP:28–30`, `SP:348–355`).

## Funkční a datové důkazy

- Filtry kategorie, oblasti, náročnosti, dopravy, počasí a priority jsou definované a současně aplikované v `app/korfu2026/_components/KorfuApp.tsx:72–90,217–228`; jejich ovladače jsou na `:290–344`. To odpovídá `SP:381–382`.
- `Můj výběr` používá přesný klíč `korfu2026:selection:v1` (`app/korfu2026/_data/types.ts:21–35`), načtení i zápis jsou v `try/catch` (`app/korfu2026/_components/KorfuApp.tsx:100–135`) a stav je ukládán při změně (`:196–215`). To odpovídá `SP:391–392,405–406`.
- Mapa je načítaná přes `next/dynamic` bez SSR s přístupným stavem načítání (`app/korfu2026/_components/KorfuApp.tsx:3–18`); Leaflet používá OSM dlaždice (`app/korfu2026/_components/KorfuMap.tsx:64–76`) a zobrazuje stejný filtrovaný seznam (`:46–53,77–132`), jak požaduje `SP:385–386`.
- Provenience souřadnic je explicitní: statická data Nominatim jsou v `app/korfu2026/_data/coords.generated.ts:1–23`; `withGeocode()` nikdy nedosazuje odhad a při chybě vytváří jasný stav bez souřadnic (`app/korfu2026/_data/places.ts:470–515`). Karta vždy ukáže Nominatim nebo „Souřadnice neověřeny“ (`app/korfu2026/_components/PlaceCard.tsx:203–236`); mapa vypíše počty a seznam bodů bez pinu s vyhledávacím deep-linkem (`app/korfu2026/_components/KorfuMap.tsx:136–176`).
- Provenience obsahu je runtime XOR mezi skutečným zdrojem a individuální výjimkou (`app/korfu2026/_data/places.ts:474–490`) a výjimka se na kartě zobrazuje včetně citace (`app/korfu2026/_components/PlaceCard.tsx:189–201`). Aktuální data obsahují 5 skutečných source arrays a 61 individuálních `sourceException` (celkem 66 seedů).
- Karty mají přístupné ovládání výběru, navigace a zdroje (`app/korfu2026/_components/PlaceCard.tsx:55–73,238–263`); provozovatelské karty poskytují Volat, Kopírovat číslo a Otevřít zdroj (`app/korfu2026/_components/OperatorCard.tsx:108–145`). Spodní mobilní navigace obsahuje Přehled, Možnosti, Mapa, Můj výběr a Praktické (`app/korfu2026/_components/KorfuApp.tsx:1042–1084`), v souladu s `SP:401–409`.
- Výrazná sekce koní čerpá Katreena jako první volbu, Arena jako alternativu a oddělené neověřené leady z `app/korfu2026/_data/operators.ts` a `app/korfu2026/_data/practical.ts:308–314`; obsahová autorita je `SP:129–179`, zejména `SP:132–160`.

## Čerstvý souvislý QA běh

Všechny následující příkazy proběhly postupně v jednom běhu po ověření branche, HEAD a prázdného indexu. Začátek `2026-09-13T17:57:43+02:00`, konec `2026-09-13T17:57:53+02:00`; každý skončil exit kódem 0.

| Příkaz | Exit | Výsledek |
| --- | ---: | --- |
| `npm install --include=dev` | 0 | Závislosti jsou aktuální; npm pouze nahlásil 6 známých auditních zranitelností závislostí. |
| `scripts/korfu2026-check.sh` | 0 | Bez nálezů: zákazy itineráře, Albánie/Ksamil, bezpečnostní vzory i všech 13 must-see. Skript implementuje nenulový exit při nálezu v `scripts/korfu2026-check.sh:13–24,30–70`. |
| `npm run lint` | 0 | Spustil skutečný `eslint .`; 0 chyb, 9 již existujících varování mimo route Korfu. |
| `npm run build` | 0 | Next.js 16.2.1 úspěšně vytvořil produkční build; `/korfu2026` je ve výstupu statická route. |

Čerstvý artefakt builda: `.next/server/app/korfu2026.html`, změněn `2026-09-13T17:57:52+02:00`, velikost 221817 B — později než nejnovější relevantní zdrojová úprava `app/korfu2026/_data/types.ts` v `2026-09-13T17:39:51+02:00`.

## Katalog — Pláže

Sekce odpovídá SP:74–94 (část 7 „Katalog pláží") a SP:55–72 (část 6, 13 must-see).

`app/korfu2026/_data/places.ts` obsahuje 37 karet s `category: 'plaz'`. Zahrnuje všech 13 must-see pláží (`tier: 'must-see'`, id `canal-damour` přes `barbati-beach`, SP:57–71), doplněné pláže ze SP:74–94 (Roda Beach, Acharavi, Almyros, Agios Spiridon, Kalamaki, Sidari, Loggas, Agios Georgios Pagon, Liapades, Stelari, Mikro Stelari, Limni, Kastelli a další pláže dostupné lodí) a pláže dostupné jen lodí nebo jen při příznivém počasí dle SP:83–94. Každá karta nese `coordsSource: 'osm-nominatim'` nebo explicitní `coords: null` se search deep-linkem (SP:385, D01-A).

Citace dat: `app/korfu2026/_data/places.ts:54–470` (must-see), `places.ts:524–1600` (doplněné pláže); typy: `app/korfu2026/_data/types.ts:1–50`.

## Katalog — Památky

Sekce odpovídá SP:96–111 (část 8 „Památky a příroda").

`app/korfu2026/_data/places.ts` obsahuje 4 karty s `category: 'pamatka'`, 5 s `category: 'priroda'`, 3 s `category: 'vesnice'`, 3 s `category: 'vyhlidka'` a 1 s `category: 'mesto'` — celkem 16 karet pokrývajících oblast „místa" dle SP:97–111. Konkrétně: Kassiopi (přístav, hrad, SP:98), Old Perithia (SP:99), Mount Pantokrator (SP:99), Corfu Town (SP:97–98), Angelokastro (SP:101–102), Lakones (SP:102), Paleokastritsa Monastery (SP:103), Afionas (SP:100), Cape Drastis (SP:100), Apollónův chrám v Rodě (SP:106–109), Roda Loop (SP:109–110), Roda–Acharavi walk (SP:110), Erimitis (SP:104–105) a další pohledové body ze SP:96–111.

Citace dat: `app/korfu2026/_data/places.ts:1420–1950`.

## Katalog — Koně

Sekce odpovídá SP:129–179 (část 10 „Jízda na koni").

Operátoři jsou v `app/korfu2026/_data/operators.ts:10–300`. Katreena Horse Riding (SP:138–151) je `HORSE_OPERATORS[0]` s rolí `'prvni-volba'`; Arena Horse Riding (SP:153–160) je `HORSE_OPERATORS[1]` s rolí `'alternativa'`; Angel's Horses (SP:165–166) je v `HORSE_LEADS` s rolí `'lead'` a freshness `'neovereno'`. Renderovatelné ceníky jsou dynamická data se štítkem „ověřit aktuálně" a povinným polem `source` (D01-B); fakta bez `source` filtruje `isRenderableFact()`. Bezpečnostní checklist pro rezervaci jízdy je `CHECKLISTS[0]` (SP:168–173) v `operators.ts:641`. Kontaktní šablona je `CONTACT_TEMPLATES[0]` (SP:175–179) v `operators.ts:718`. KorfuApp renderuje koně jako výraznou sekci dle SP:421–422 (`app/korfu2026/_components/KorfuApp.tsx:380–450`).

## Katalog — Lodě

Sekce odpovídá SP:181–229 (část 11 „Lodě a plavby").

Lodní operátoři jsou v `app/korfu2026/_data/operators.ts:302–512` (`BOAT_OPERATORS`). Pokrývá 6 oblastí výjezdu (SP:182–219): Paleokastritsa/Liapades, Nissaki, Agios Georgios Pagon, Roda/Sidari, Ipsos/Barbati a Benitses/jihovýchod. Konkrétní operátoři: B&B Boat Rentals (SP:189), Dinos Boat Rentals (SP:190–191), Aeolus Boat Rentals (SP:192), Skyway Boats (SP:201–202), Wave Boat Company (SP:205), Sun Fun Club (SP:207). Bezpečnostní checklist lodi je `CHECKLISTS[1]` (SP:224–229). Paxos–Antipaxos výhradně s licencí nebo skipperem, nikoli bezlicenčně (SP:214–215) — varování v datech. `app/korfu2026/_data/places.ts` obsahuje 1 kartu `category: 'lod'` (SP:218).

## Katalog — Aktivity

Sekce odpovídá SP:231–290 (část 12 „Další aktivity").

`app/korfu2026/_data/places.ts` obsahuje 11 karet s `category: 'aktivita'` — vodní sporty, potápění, šnorchlování, quad, jízda na koni (jako aktivita), kultura, gastronomie (cooking class), Aqualand a další (SP:231–290). Watersports centrum Roda Beach: `RODA_PRAKTIKA` v `app/korfu2026/_data/practical.ts:293`. Potápění: `DIVING_OPERATORS` v `operators.ts:512` — Dive Easy Acharavi (SP:253) a Apollo Corfu Diving (SP:255). Quad: `QUAD_OPERATORS` v `operators.ts:569` — Quad Corfu Adventure (SP:260–263) a Top Gear Roda (SP:264–266, freshness `'neovereno'`). Kontaktní šablony pro potápění a quad: `CONTACT_TEMPLATES` v `operators.ts:718` (SP:282–290).

## Katalog — Roda

Sekce odpovídá SP:292–308 (část 13 „Roda jako kategorie").

`app/korfu2026/_data/practical.ts:293` obsahuje export `RODA_PRAKTIKA` — praktická data a aktivity přímo v Rodě jako základně (SP:293–300). Roda Beach má vlastní kartu `id: 'roda-beach'` s `category: 'zakladna'` v `places.ts:524`. Večerní podniky v Rodě pokrývá `VECERNI_PODNIKY` (SP:301–306) a alternativní destinace `VECERNI_ALTERNATIVY` (SP:307–308), obojí v `practical.ts:392` a `practical.ts:447`. Spodní navigace „Přehled" přivádí uživatele k Rodě jako výchozímu bodu (SP:293, `KorfuApp.tsx:1042–1084`).

## Katalog — Jídlo a večer

Sekce odpovídá SP:310–321 (část 14 „Jídlo a pití") a SP:295–308 (večerní program z části 13).

Restaurace v Rodě: `app/korfu2026/_data/practical.ts:473` (`RESTAURACE_RODA`) — Oscar's, Nikos a další (SP:313–316). Místní speciality: `WHAT_TO_TRY` v `practical.ts:507` (SP:317–321). Zásobovací tipy: `ZASOBY_TIPY` v `practical.ts:519`. Večerní podniky: `VECERNI_PODNIKY` v `practical.ts:392` (7 podniků, SP:301–306) a `VECERNI_ALTERNATIVY` v `practical.ts:447` (Sidari, Kassiopi, Corfu Town, SP:307–308). Všechna otevírací doba, ceny a aktuální programy nesou freshness `'overit-aktualne'`; dynamická fakta mají povinný zdroj v poli `source` (D01-B, SP:28–30).

## Katalog — Události

Sekce odpovídá SP:323–330 (část 15 „Události").

`app/korfu2026/_data/practical.ts:82` (`EVENTS`) obsahuje 5 událostí: International Marching Bands Festival 18.–19. 9. (SP:324–326, potvrzená hlavní událost, ověřená URL), svátek Povýšení sv. Kříže 14. 9. Sidari (SP:327–328), Vinařský festival Kavadades 15. 9. (SP:328), Vinařské slavnosti Kassiopi a Moraitice 21. 9. (SP:328–329, prakticky nepoužitelné kvůli rannímu odletu) a aktuální lokální hudba/karaoke v Rodě 14.–20. 9. (SP:329–330). Vše s freshness `'overit-aktualne'` — žádný program se nezobrazuje jako potvrzený bez ověření.

## Katalog — Doprava

Sekce odpovídá SP:332–346 (část 16 „Doprava a půjčovny").

`app/korfu2026/_data/practical.ts:146` (`TRANSPORT_OPTIONS`) pokrývá: auto/půjčovna (SP:332–338) s checklistem smlouvy a řízení (SP:337–338), skútr (SP:338–339), autobus Green Buses (SP:339–342) s URL jízdního řádu, taxi (SP:342–343), loď jako doprava (SP:344), quad/buggy (SP:344–345). Doporučení objednat půjčovnu auta přes hotel v předstihu (SP:335). Checklist pro auto je `CHECKLISTS[2]` (SP:333–338) v `operators.ts:641`.

## Katalog — Praktické

Sekce odpovídá SP:357–374 (část 18 „Zdraví / nouze / peníze"), SP:35–48 (část 4 „LOCKED zájezd") a SP:47–48 (checklisty příjezdu).

`app/korfu2026/_data/practical.ts:30` (`EMERGENCY_CONTACTS`) pokrývá: Čedok SOS +420 296 184 930 (SP:366), Silver Beach Hotel +30 26630 63112 (SP:367), Aladasi Medical Services Roda (SP:368–369), Mastoras Medical Services Roda (SP:369), Corfu General Hospital (SP:370) a tísňové linky 112/100/166/199/108/1571 (SP:360–365). Peníze a konektivita: `PENIZE_DATA` v `practical.ts:639` (SP:371–374). Ubytování a přehled pobytu: `TRIP_FACTS` v `practical.ts:11` (SP:35–48).

## Katalog — Zdroje a aktuálnost

Sekce odpovídá SP:461–476 (část 25 „Klíčové zdroje").

`app/korfu2026/_data/practical.ts:527` (`SOURCES_SECTION`) obsahuje strukturovaný přehled zdrojů: autoritativní (Silver Beach Hotel, Ionian Music Festival, Green Buses, řecká nouzová čísla, Visit Greece), koně a aktivity (katreenahorseriding, arenahorseriding, roda-beach, divecorfu, quadcorfu a další), lodě a auta (seahorsecorfu, bluelagooncorfu, corfuboatrental a 10 dalších), viz SP:462–476. Každý renderovaný dynamický údaj (cena, otevírací doba, jízdní řád, program) nese `freshness` a povinný odkaz na příslušný zdroj v poli `source`; UI zobrazuje badge „ověřit aktuálně" (SP:28–30, SP:407).

---

## Hranice a další krok

Tento checkpoint dokládá pouze lokální funkční verzi a QA. Neprováděl commit, push, deployment, GitHub Actions, DB ani produkční konfiguraci; proto netvrdí veřejné nasazení ani celkový PASS. Následuje nezávislý audit a teprve potom checkpoint 4/předdeploymentní předání.
