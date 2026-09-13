# KORFU 2026 — COVERAGE MATRIX (Checkpoint 1)

Vytvořeno: 2026-09-13. Branch: `feat/korfu2026`.
Jediný autoritativní zdroj obsahu: `.korfu/SOURCE_PACK.md` — **478 řádků**, sekce 1–22 + 24–25.
**Sekce 23 v SOURCE_PACKu neexistuje** (číslování skáče z `## 22.` na ř. 437 na `## 24.` na
ř. 447; ověřeno `grep -n '^## ' .korfu/SOURCE_PACK.md`).

Notace: `SP:<řádek>` = konkrétní řádek v `.korfu/SOURCE_PACK.md` (všechna čísla ověřena
přes `awk '{printf "%d| %s\n", NR, $0}'`).
Cíl umístění: `D:places` = `app/korfu2026/_data/places.ts`, `D:combos` = `_data/combos.ts`,
`D:practical` = `_data/practical.ts`, `C:<Jméno>` = komponenta v `app/korfu2026/_components/`.

### Ověřený index sekcí SOURCE_PACKu
| Sekce | Řádky | Sekce | Řádky |
|---|---|---|---|
| 1. Výsledek | 6–12 | 13. Roda jako kategorie | 292–308 |
| 2. LOCKED rozhodnutí | 14–20 | 14. Jídlo a pití | 310–321 |
| 3. Autorita dat | 22–30 | 15. Události | 323–330 |
| 4. LOCKED zájezd | 32–48 | 16. Doprava a půjčovny | 332–346 |
| 5. Privacy firewall | 50–53 | 17. Počasí | 348–355 |
| 6. Ruční seznam (13) | 55–72 | 18. Zdraví / nouze / peníze | 357–374 |
| 7. Katalog pláží | 74–94 | 19. Produktové zadání | 376–399 |
| 8. Památky a příroda | 96–111 | 20. Design a chování | 401–409 |
| 9. Co spojit | 113–127 | 21. Kontrolní matice | 411–435 |
| 10. Jízda na koni | 129–179 | 22. Deployment subpath | 437–445 |
| 11. Lodě a plavby | 181–229 | 24. Definition of Done | 447–459 |
| 12. Další aktivity | 231–290 | 25. Klíčové zdroje | 461–476 |

---

## ČÁST A — Kontrolní matice z části 21 (SP:411–435) — 100 % pokrytí

Matice je v SOURCE_PACKu jeden souvislý odstavec oddělený středníky (SP:412–430).
Rozdělena na **40 atomických obsahových položek** + 1 zákazové pravidlo (SP:432–435).
Nic nevynecháno, nic nesloučeno.

| # | Položka matice (doslovně) | Kde v matici | Zdrojová data v SP | Plánované umístění |
|---|---|---|---|---|
| M01 | rychlé doporučení a pobyt v kostce | SP:412 | SP:35–48, SP:379–380 | `D:practical` → `TRIP` + `C:PrehledSection` |
| M02 | Silver Beach Hotel a kontrola při příjezdu | SP:412 | SP:37, SP:47–48, SP:277, SP:293, SP:367, SP:463 | `D:practical` → `HOTEL`, `CHECKLISTS.hotel`; `C:PraktickeSection` |
| M03 | Roda | SP:412 | SP:292–308 | `D:places` `roda` (kategorie `zakladna`) + `C:RodaSection` |
| M04 | Roda Beach | SP:412 | SP:75–76, SP:243–248, SP:293 | `D:places` `roda-beach` |
| M05 | Acharavi | SP:413 | SP:76–77, SP:110–111, SP:251–253 | `D:places` `acharavi-beach` |
| M06 | Agios Spiridon a Kalamaki/Apraos | SP:413 | SP:78–79, SP:103, SP:115 | `D:places` `agios-spiridon-beach`, `kalamaki-apraos`, `antinioti-lagoon` |
| M07 | Avlaki a severovýchod | SP:413 | SP:66, SP:89–91 | `D:places` `avlaki-beach` + oblast `severovychod` |
| M08 | Sidari a Canal d'Amour | SP:413 | SP:57, SP:80, SP:307 | `D:places` `canal-damour`, `sidari-beach` |
| M09 | Porto Timoni | SP:414 | SP:58, SP:82–83, SP:100, SP:200 | `D:places` `porto-timoni`, `afionas` |
| M10 | restaurace v Rodě včetně Oscar's | SP:414 | SP:302, SP:313–316 | `D:practical` → `RESTAURACE_RODA` + `C:JidloVecerSection` |
| M11 | místní jídla a zásoby | SP:414 | SP:317–321 | `D:practical` → `SPECIALITY`, `ZASOBY` |
| M12 | večerní zábava v Rodě, Sidari, Kassiopi a Corfu Town | SP:414–415 | SP:295, SP:301–308 | `D:practical` → `VECERNI_PODNIKY`, `VECERNI_ALTERNATIVY` |
| M13 | události 14., 15., 18.–19. a 21. 9. | SP:415 | SP:323–330 | `D:practical` → `UDALOSTI` |
| M14 | počasí a pravidla flexibility | SP:415–416 | SP:348–355 | `C:PocasiPanel` + `POCASI_PRAVIDLA`; pole `weather` na kartě |
| M15 | autobusy, taxi, auto, půjčovny, smlouva a řízení | SP:416 | SP:332–346 | `D:practical` → `DOPRAVA` + `CHECKLISTS.auto` |
| M16 | Kassiopi, Old Perithia a Pantokrator | SP:416–417 | SP:98–100 | `D:places` `kassiopi`, `old-perithia`, `mount-pantokrator` |
| M17 | Sidari, Cape Drastis a Afionas | SP:417 | SP:80–81, SP:100 | `D:places` `sidari-beach`, `cape-drastis`, `loggas-sunset`, `afionas` |
| M18 | Paleokastritsa a Angelokastro/Lakones | SP:417 | SP:59, SP:84, SP:101–102, SP:105 | `D:places` `paleokastritsa`, `angelokastro`, `lakones-viewpoint`, `paleokastritsa-monastery` |
| M19 | Corfu Town | SP:417 | SP:97–98, SP:125, SP:308 | `D:places` `corfu-town` (podbody pevnost, Spianada, Liston, sv. Spyridon) |
| M20 | severovýchodní pobřeží | SP:418 | SP:89–91, SP:104–105 | `D:places` oblast `severovychod`: Kerasia, Kouloura, Kalami, Agni, Nissaki, Kaminaki, Barbati, Ipsos, Erimitis |
| M21 | lodní oblasti Paleokastritsa/Liapades, Nissaki, Agios Georgios Pagon, Roda/Sidari, Ipsos/Barbati a Benitses/jihovýchod | SP:418–419 | SP:182–219 | `D:practical` → `BOAT_AREAS` (6 oblastí) + `C:LodeSection` |
| M22 | všechny lodní jeskyně, zátoky, půjčovny, orientační ceny a bezpečnost | SP:419–420 | SP:183–229 | `D:places` (boat-only pláže + jeskyně), `BOAT_OPERATORS`, `BOAT_PRICES`, `CHECKLISTS.lod` |
| M23 | zdravotní pomoc a nouzové kontakty | SP:420 | SP:357–370 | `D:practical` → `EMERGENCY` + `C:PraktickeSection` |
| M24 | peníze, data a navigace | SP:420 | SP:371–374 | `D:practical` → `PENIZE_DATA` |
| M25 | předodjezdové, hotelové, automobilové a lodní checklisty | SP:421 | SP:47–48, SP:168–173, SP:224–229, SP:333–338, SP:371–374 | `D:practical` → `CHECKLISTS` = `{ predodjezd, hotel, auto, lod, kone, potapeni }` |
| M26 | všechny ruční must-see pláže | SP:421 | SP:55–72 | `D:places` — 13 karet `tier: 'must-see'`; viz ČÁST B |
| M27 | jízda na koni po pláži a koupání s koňmi | SP:421–422 | SP:129–179 | `C:KoneSection` (vlastní top-level sekce) + `D:practical.HORSE_*` |
| M28 | další ověřené možnosti (SUP/kajak, šnorchlování, potápění, climbing, caving, paragliding, Jeep safari, cooking class, Greek Night, Aqualand, další plavby) | SP:422–423 | SP:231–240 | `D:places` kategorie `aktivita` + `C:AktivitySection` |
| M29 | Katreena Horse Riding přímo v Rodě včetně aktuálního ceníku a kontaktu | SP:424 | SP:138–151 | `D:practical` → `HORSE_OPERATORS[0]` (první karta v `C:KoneSection`) |
| M30 | Arena Horse Riding jako druhá konkrétní varianta a Angel's Horses jako neověřený lead | SP:424–425 | SP:153–160, SP:165–166 | `HORSE_OPERATORS[1]` + `HORSE_LEADS` |
| M31 | Roda Beach Watersports Center a úplný seznam vodních sportů | SP:425–426 | SP:242–248 | `D:practical` → `WATERSPORTS_RODA` (9 položek) |
| M32 | Dive Easy Acharavi a Apollo Corfu Diving | SP:426 | SP:250–257 | `D:practical` → `DIVING_OPERATORS` (2) |
| M33 | Quad Corfu Adventure a Top Gear Roda | SP:426–427 | SP:259–268 | `D:practical` → `QUAD_OPERATORS` (2) |
| M34 | rybaření / malé pobřežní výlety | SP:427 | SP:270–274 | `D:practical` → `FISHING` (štítek „ověřit na místě / přes hotel") |
| M35 | wellness a možnost day-visitor spa | SP:427 | SP:276–280 | `D:practical` → `WELLNESS` |
| M36 | pozůstatky Apollónova chrámu, Roda Loop a pobřežní procházka | SP:427–428 | SP:106–111 | `D:places` `apollon-chram-roda`, `roda-loop`, `roda-acharavi-walk` |
| M37 | konkrétní večerní podniky v Rodě | SP:428 | SP:301–306 | `D:practical` → `VECERNI_PODNIKY` (7 podniků) |
| M38 | B&B, Dinos, Aeolus, Skyway, Wave a Sun Fun Club | SP:428–429 | SP:188–207 | `D:practical` → `BOAT_OPERATORS` |
| M39 | Paxos–Antipaxos jen organizovaně nebo se skipperem | SP:429 | SP:214–218 | `BOAT_AREAS` položka `paxos-antipaxos` s `warnings` |
| M40 | hotové kontaktní šablony pro koně, potápění a quad safari | SP:429–430 | SP:175–179, SP:282–290 | `D:practical` → `CONTACT_TEMPLATES` (3) + `C:CopyTemplate` |
| M41 | 🚫 ZÁKAZ: „Původní část s doporučeným programem po jednotlivých dnech… Nesmí se vrátit ani v implementaci. …zachovat pouze neutrální metadata jako nejlepší část dne, vhodné počasí a časová náročnost; NIKDY konkrétní den pobytu." | SP:432–435 | — | Vynuceno datovým modelem (`bestPartOfDay`, `weather`, `duration`) + `.korfu/check-no-itinerary.sh` |

**Pokrytí: 40/40 obsahových položek + 1 zákazové pravidlo = 100 %.**

---

## ČÁST B — 13 ručních must-see míst (část 6, SP:55–72)

### ⚠ Zjištění o souřadnicích (riziko R1 v `CHECKPOINT-1.md`)
SOURCE_PACK **neobsahuje ani jediné zeměpisné souřadnice** — ověřeno
`grep -nE '[0-9]{1,3}\.[0-9]{4,}' .korfu/SOURCE_PACK.md` → 0 shod.
Hlavička sekce 6 (SP:55) sice žádá „každá vlastní karta + ověřený mapový bod", ale žádná
lat/lng v packu není a síťové ověřování obsahu je pro tento běh zakázané.
→ **U všech 13 karet je souřadnice ze SOURCE_PACKu nedoložitelná.**
Plánované řešení bez vymýšlení dat: `coords: null`, `coordsStatus: 'chybi-v-source-packu'`,
mapový bod se **nevykreslí jako falešně přesný pin**, a „Navigovat" vede na Google Maps
**vyhledávací** deep-link podle `canonicalName`
(`https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(canonicalName)>`),
což nefabrikuje žádnou hodnotu. Rozhodnutí, zda smí executor souřadnice dohledat jinde,
patří manažerovi/vlastníkovi — viz R1.

| # | Místo (doslovně dle SP) | Citace | Souřadnice v SP? | Karta / poznámka |
|---|---|---|---|---|
| MS01 | „1. Canal d'Amour u Sidari" | SP:57 | **NE** | `canal-damour`, `priority: 1` |
| MS02 | „2. Porto Timoni — dvojitá pláž, označena srdcem" | SP:58 | **NE** | `porto-timoni`, `priority: 2`, `marker: 'srdce'` |
| MS03 | „3. Paleokastritsa / Palaiokastritsa" | SP:59 | **NE** | `paleokastritsa`, `priority: 3` |
| MS04 | „4. Kassiopi Beach — ověřit, zda nejlépe odpovídá Bataria, Kanoni nebo jiné konkrétní pláži; prezentovat i přístav a hrad" | SP:61–62 | **NE** | `kassiopi-beach` + štítek „ověřit aktuálně: která pláž" + podbody přístav/hrad (SP:98) |
| MS05 | „5. Rovinia Beach" | SP:63 | **NE** | `rovinia-beach`; přístup pěšky i z vody (SP:84–85) |
| MS06 | „6. Agios Gordios — vesnice, pláž a panorama" | SP:64 | **NE** | `agios-gordios`; 3 aspekty v jedné kartě (SP:64, SP:88, SP:102) |
| MS07 | „7. Issos Beach — v poznámce označena hvězdičkou = viditelně silné přání" | SP:65 | **NE** | `issos-beach`, `marker: 'hvezdicka'`; „výrazná uživatelská priorita" (SP:92) |
| MS08 | „8. Avlaki Beach" | SP:66 | **NE** | `avlaki-beach` |
| MS09 | „9. Marathias Beach" | SP:67 | **NE** | `marathias-beach` |
| MS10 | „10. Nissaki Beach" | SP:68 | **NE** | `nissaki-beach` |
| MS11 | „11. Chalikounas / Halikounas Beach" | SP:69 | **NE** | `chalikounas-beach`; spojka Lake Korission (SP:92–93) |
| MS12 | „12. Myrtiotissa Beach" | SP:70 | **NE** | `myrtiotissa-beach` + „ověřit přístup, parkování, sestup a aktuální charakter pláže" (SP:87–88) + „problematické za mokra" (SP:353–354) |
| MS13 | „13. Barbati Beach" | SP:71 | **NE** | `barbati-beach` |

Pravidlo SP:72: „Poznámky ‚malá/malinka' = charakteristika, nikoli délka návštěvy."
→ nesmí se promítnout do pole `duration`.

---

## ČÁST C — Kompletní katalog pláží a koupání (část 7, SP:74–94)

Všechny do `D:places`, kategorie `plaz`, s polem `area`.

| Oblast | Citace | Položky (počet) |
|---|---|---|
| Bez přesunu / blízko základny | SP:75–79 | Roda Beach; Acharavi Beach; Almyros Beach; Agios Spiridon Beach; Kalamaki / Apraos — **5** |
| Severozápad | SP:80–83 | Canal d'Amour; Sidari Beach; Cape Drastis; Loggas / Sunset Beach; Agios Georgios Pagon; Porto Timoni — **6** |
| Západ | SP:84–88 | Paleokastritsa; Rovinia; Liapades; Stelari; Mikro Stelari; Limni; Kastelli; Mikro Kastelli; Paradise / Chomi; Giali; Myrtiotissa; Agios Gordios — **12** |
| Severovýchod | SP:89–91 | Kassiopi / Bataria / Kanoni; Avlaki; Kerasia; Kouloura; Kalami (+ White House); Agni Bay; Nissaki; Kaminaki; Barbati; Ipsos — **10** |
| Jih a jihozápad | SP:92–94 | Chalikounas / Halikounas; Issos; Marathias; Lake Korission; Boukari; Petriti; Benitses a jihovýchod — **7** |

Celkem **40 položek**. Překryv s must-see (Roda Beach, Canal d'Amour, Porto Timoni,
Paleokastritsa, Rovinia, Myrtiotissa, Agios Gordios, Avlaki, Nissaki, Barbati, Chalikounas,
Issos, Marathias) = jedna karta, dvě role (`tier: 'must-see'` + `area`).

Specifická upozornění k přenesení do `risks`:
- Canal d'Amour: „za větru a vln opatrnost" (SP:80)
- Cape Drastis: „přístup a lodní provoz ověřit" (SP:81)
- Porto Timoni: „pěší sestup z Afionasu nebo loď; strmá kamenitá cesta" (SP:82–83)
- Paradise / Chomi: „lodí, respektovat omezení pod útesy" (SP:86–87)
- Giali: „jen v povoleném lodním dosahu" (SP:87)
- Myrtiotissa: „ověřit přístup, parkování, sestup a aktuální charakter pláže" (SP:87–88)
- Kassiopi / Bataria / Kanoni: „přesný výběr ověřit" (SP:89)
- Stelari, Mikro Stelari, Kastelli, Mikro Kastelli: „zejména lodí" (SP:85–86)

---

## ČÁST D — Památky, města, vesnice, příroda, vyhlídky (část 8, SP:96–111)

| Položka | Citace | Karta v `D:places` |
|---|---|---|
| Corfu Town: Stará pevnost, Spianada, Liston, kostel sv. Spyridona, staré město, promenáda, gastronomie, večerní kultura | SP:97–98 | `corfu-town` |
| Kassiopi: přístav, hrad, restaurace, blízké pláže | SP:98 | `kassiopi` |
| Old Perithia: historická kamenná vesnice, kostely, taverny | SP:99 | `old-perithia` |
| Mount Pantokrator: nejvyšší bod, klášter, výhledy; „jen za dobré viditelnosti" | SP:99–100 | `mount-pantokrator` |
| Afionas: vesnice a vyhlídka nad Porto Timoni | SP:100 | `afionas` |
| Angelokastro: hrad a výhledy; „spojitelné s Paleokastritsou" | SP:101 | `angelokastro` |
| Lakones viewpoint: „snazší panoramatická alternativa" | SP:101–102 | `lakones-viewpoint` |
| Agios Gordios: panoramatické pohledy | SP:102 | `agios-gordios` |
| Pelekas / Kaiser's Throne: „volitelné panorama" | SP:102–103 | `pelekas-kaisers-throne` |
| Antinioti Lagoon: chráněné území u Agios Spiridon, „součást jezdeckých tras" | SP:103 | `antinioti-lagoon` |
| Cape Ekaterini: severní mys u delších jezdeckých tras | SP:104 | `cape-ekaterini` |
| Erimitis: přírodnější SV pobřeží a malé zátoky | SP:104–105 | `erimitis` |
| Paleokastritsa Monastery | SP:105 | `paleokastritsa-monastery` |
| Agios Ioannis Monastery u Sidari (slavnost 14. 9.) | SP:105 | `agios-ioannis-sidari` → vazba na `UDALOSTI` (SP:327–328) |
| Pozůstatky Apollónova chrámu v Rodě: „základy dórského chrámu z 5. stol. př. n. l. západně od obce; nenápadný archeologický bod, ne monumentální ruina; nálezy souvisejí s Archeologickým muzeem v Corfu Town; po ověření vstupu/mapového bodu krátká lokální zastávka" | SP:106–108 | `apollon-chram-roda` |
| Roda Loop / Sfakera: „lehký okruh cca 5,5 km / 1 h 20 min; orientační trasa, ověřit průchodnost" | SP:109 | `roda-loop` |
| Pobřežní procházka Roda–Acharavi: „na úsecích bez chodníku a za tmy reflexní prvky a opatrnost" | SP:110–111 | `roda-acharavi-walk` |

---

## ČÁST E — Geografické balíčky „Co spojit" (část 9, SP:113–127) → `D:combos`

12 balíčků. Hlavička SP:113 explicitně: „geografické balíčky, **NE dny**".

| # | Balíček | Citace |
|---|---|---|
| K01 | Roda / Apollónův chrám / Roda Loop nebo pobřežní procházka / Acharavi / Almyros | SP:114 |
| K02 | Agios Spiridon / Antinioti / Kalamaki / jezdecká aktivita | SP:115 |
| K03 | Sidari / Canal d'Amour / Cape Drastis / Loggas | SP:116 |
| K04 | Afionas / Porto Timoni / Agios Georgios Pagon | SP:117 |
| K05 | Paleokastritsa / Liapades / Rovinia / Angelokastro nebo Lakones | SP:118 |
| K06 | Kassiopi / Avlaki / Kerasia / Kouloura / Kalami / Agni | SP:119 |
| K07 | Nissaki / Kaminaki / Barbati / Ipsos | SP:120 |
| K08 | Old Perithia / Pantokrator / Agios Spiridon nebo Kalamaki | SP:121 |
| K09 | Myrtiotissa / Pelekas / Agios Gordios | SP:122 |
| K10 | Chalikounas / Lake Korission / Issos | SP:123 |
| K11 | Marathias / Boukari / Petriti | SP:124 |
| K12 | Corfu Town / festival / pevnost / večerní gastronomie | SP:125 |

Povinné na každé kartě (SP:126–127): „přibližný čas jízdy z hotelu, reálná doba návštěvy,
obtížnost, parkování, tlačítko Navigovat."

---

## ČÁST F — JÍZDA NA KONI (část 10, SP:129–179) — samostatná výrazná sekce

Rámec (SP:130–131): „Výrazná možnost, která nesmí znovu zmizet: jízda na koni po pláži
**nebo koupání s koňmi** v severní části Korfu."

**FAKTICKÁ OPRAVA PO REAUDITU (SP:132–136), doslovně:**
> „přímo v Rodě působí Katreena Horse Riding, základna „Close to Roda Taxi". Trasy přes
> olivové háje a pobřeží, sunset beach ride i koupání s koňmi. **NENÍ to tvrzení, že se jezdí
> přímo před Silver Beach Hotelem nebo po celé hlavní Roda Beach**; přesný meeting point a
> konkrétní úsek pobřeží uvádět podle potvrzení provozovatele. Druhá silná varianta: Arena
> Horse Riding u Agios Spiridon / Perithia. Další nabídky v severní části ostrova jako
> alternativy."

→ **Tvrdý zákaz na webu:** žádná formulace o startu vyjížďky před Silver Beach Hotelem ani
o jízdě po celé hlavní Roda Beach. Vynuceno grepem v `.korfu/check-no-itinerary.sh`.

### F1. Katreena Horse Riding — PRVNÍ VOLBA přímo v Rodě (SP:138–151) → `HORSE_OPERATORS[0]`

| Pole | Hodnota dle SP | Citace |
|---|---|---|
| Role | první volba, přímo v Rodě | SP:132, SP:138 |
| Základna | „Close to Roda Taxi, Roda, Kerkira 49081" | SP:132–133, SP:149–150 |
| Ověření | „Oficiální web při kontrole 13. 9. 2026 potvrzuje" | SP:139 |
| Nabídka | začátečníci i pokročilí, kombinace olivových hájů a pobřeží | SP:139–140 |
| Beach and Nature Ride | 1 h 15 min, 30 € / osoba | SP:141 |
| Sunset Beach Ride | 1,5 h, 45 € / osoba | SP:142 |
| Sunset Swim (jízda a koupání s koňmi) | 65 € / osoba | SP:143 |
| Advanced Ride | 65 € / osoba, rezervace přímým kontaktem | SP:144 |
| Horse Riding Vacation | týdenní 1 000 € / osoba — „pro tento projekt okrajové" | SP:145 |
| **STARŠÍ LEAD** | 3hodinové/denní/BBQ balíčky + otevírací doba 09:00–13:00 a 15:00–22:00; „Aktuální oficiální stránka je nepotvrdila → na webu označit **‚starší lead — potvrdit přímo'**, nikoli jako aktuální nabídku" | SP:146–148 |
| Telefon | +30 694 482 9461 | SP:149 |
| E-mail | katreenahorseriding@gmail.com | SP:149 |
| Web | https://www.katreenahorseridingcorfu.com/ a /experiences | SP:150 |
| Aktuálnost | „Ceny a dostupnost pro 14.–20. 9. 2026 znovu potvrdit" → štítek **„ověřit aktuálně"** | SP:151 |

### F2. Arena Horse Riding — konkrétní alternativa Agios Spiridon / Perithia (SP:153–160) → `HORSE_OPERATORS[1]`

Ověření: „Oficiální web 13. 9. 2026 potvrzuje beach rides a swimming with horses." (SP:154)

| Varianta | Cena | Citace |
|---|---|---|
| začátečníci skupina: morning/afternoon beach ride | 45 € | SP:155 |
| začátečníci skupina: sunset | 55 € | SP:155 |
| začátečníci private: beach ride | 80 € | SP:156 |
| začátečníci private: sunset | 100 € | SP:156 |
| začátečníci private: swimming | 120 € | SP:156 |
| pokročilí skupina: morning beach | 70 € | SP:157 |
| pokročilí skupina: sunset | 85 € | SP:157 |
| pokročilí skupina: half day | 150 € | SP:157 |
| pokročilí skupina: all day | 280 € | SP:157 |
| pokročilí private: morning beach | 100 € | SP:158 |
| pokročilí private: sunset | 120 € | SP:158 |
| pokročilí private: swimming | 150 € | SP:158 |

Kontakt: +30 698 733 7101, katia6135@hotmail.com (SP:159).
Storno: „méně než 3 dny předem není podle webu refundovatelné" (SP:159–160).
Zdroj: https://www.arenahorseriding.com/ (SP:160). Všechny ceny se štítkem „ověřit aktuálně".

### F3. NEOVĚŘENÉ LEADY (SP:162–166) → `HORSE_LEADS`, štítek `neovereno`
- **North Corfu Horses / Corfu Tourist Services** (SP:163–164): „dříve dohledané trasy
  Agios Spiridon, Antinioti, Almyros, Cape Ekaterini, Old Perithia; **ceny a identitu
  provozovatele znovu ověřit**." Zdroje: northcorfuhorses.com (SP:468),
  corfutouristservices.gr/tours/horse-riding-corfu/ (SP:468).
- **Angel's Horses** (SP:165–166): +30 699 502 2671, horses.corfu@gmail.com,
  časy 09:00/11:00/17:00/19:00, orientačně 30 € nebo 35 € s transferem.
  „**Místo, provoz i cenu považovat za NEOVĚŘENÉ.**"

### F4. Povinný checklist před rezervací (SP:168–173) → `CHECKLISTS.kone`
pro koho je trasa vhodná a zda berou úplné začátečníky; hmotnostní a zdravotní omezení;
zda „beach ride" vede skutečně po pláži a zda „swim" znamená vstup do vody; čas v sedle vs.
celkové trvání; helma, pojištění, fotografie, nápoje, případný transfer; meeting point,
oblečení, storno a postup při špatném počasí; dlouhé kalhoty a uzavřené boty; na swimming
ride plavky, ručník a suché oblečení. (9 položek)

### F5. Hotová kontaktní zpráva — koně (SP:175–179) → `CONTACT_TEMPLATES.kone`
Doslovné znění ze SP:176–179 včetně placeholderu „[beginners/experienced riders]".
Obsahuje jen „two adults" + hotel + termín → **neporušuje privacy firewall** (SP:50–53).

---

## ČÁST G — Lodě a mořské možnosti (část 11, SP:181–229)

### G1. Bezlicenční loď — Paleokastritsa / Liapades (SP:182–193)
Cíle (SP:183–185): Blue Eye Cave; Nausicaa a další jeskyně; Paradise/Chomi; Stelari a
Mikro Stelari; Limni; Kastelli a Mikro Kastelli; Rovinia; „Giali jen pokud je v povoleném dosahu".

| Kandidát | Detail dle SP | Citace |
|---|---|---|
| Seahorse Corfu | seahorsecorfu.com | SP:186 |
| Blue Lagoon Corfu | bluelagooncorfu.com | SP:186 |
| Corfu Boat Rental | corfuboatrental.com | SP:187 |
| Nika Boat Rental | nikaboatrental.com | SP:187 |
| Vive Corfu / Alipa Bay | vivecorfu.com/paleokastritsa-secret-beaches-boat-tour | SP:187–188 |
| **B&B Boat Rentals** | rentaboatcorfu.gr — Alipa Port, +30 697 458 5157 | SP:188–189 |
| **Dinos Boat Rentals** | dinosboatrentals.com — Paleokastritsa, 30HP no-license půlden/celý den nebo skipper, +30 697 375 4561, dinosboatrentalscfu@gmail.com, „web blokoval automatické načtení → **vše potvrdit přímo**" | SP:189–191 |
| **Aeolus Boat Rentals** | aeolusboatrentals.gr — Liapades Beach, WhatsApp +30 698 311 2325, „sezonu a hodiny ověřit" | SP:192–193 |
| nabídky přímo v Liapades | — | SP:193 |

### G2. Bezlicenční loď — Nissaki / severovýchod (SP:194–198)
Cíle: Nissaki, Kaminaki, Agni, Kalami, Kouloura, Kerasia; „Erimitis a případně Kassiopi jen
v povoleném dosahu" (SP:195–196).
Kandidáti: Nissaki Boat Rental
(nissakiboatrental.com/prices-reservation-nissaki-boat-rental-corfu/) (SP:196–197);
Nissaki Rent a Boat (nissakirentaboat.com) (SP:197–198).

### G3. Další lodní oblasti (SP:199–219) → `BOAT_AREAS`

| Oblast | Detail | Citace |
|---|---|---|
| Agios Georgios Pagon | Porto Timoni bez pěšího sestupu, Diaplo a okolní pobřeží | SP:200 |
| **Roda — Skyway Boats** | skywayboats.com/contact-us/, „oficiálně základnu na Roda Beach", WhatsApp +30 698 568 7929, skywayboats@gmail.com; no-license i speed boats; „Marketingové označení konkrétního výkonu jako ‚bez licence' **ověřit písemně** podle lodi a aktuální legislativy" | SP:201–203 |
| **Sidari — Wave Boat Company** | waveboathire.com/en, hlavní pláž, bezlicenční severní pobřeží, info@waveboathire.com; „požadované doklady a povolený dosah ověřit" | SP:204–205 |
| **Agios Georgios Pagon — Sun Fun Club** | sunfunclub-boathire.com — „bezlicenční čluny do 30 HP a silnější s licencí; výchozí bod k Porto Timoni v povoleném dosahu" | SP:206–207 |
| Roda / Sidari obecně | „nejkratší přesun od hotelu, Canal d'Amour a severní pobřeží, ale vyšší citlivost na vítr a skutečný povolený dosah" | SP:208–209 |
| Ipsos / Barbati | Ipsos Caves, Agios Arsenios, Barbati, Nissaki | SP:210 |
| Benitses / jihovýchod | Boukari a Petriti podle dosahu | SP:211 |
| Organizovaná krátká plavba | „varianta pro jeskyně bez vlastního řízení" | SP:212 |
| Loď se skipperem | „dražší, bez starosti s řízením a limity zkušeností" | SP:213 |
| **Paxos / Antipaxos** | „**POUZE organizovaná loď nebo charter s profesionálním skipperem; malý bezlicenční člun není vhodný pro otevřený přejezd.**" Typicky Blue Caves Paxos, koupání u Antipaxosu, Gaios nebo Lakka. „Odjezdy bývají z Corfu Town, Lefkimmi nebo Benitses, **NE přímo z Rody**; ověřit transfer, skutečný čas na místě, počasí a kompletní cenu. Katalogové částky kolem 49 € jsou jen **orientační lead, ne garantovaná cena**." | SP:214–218 |
| Jiná celodenní plavba | „jen po ověření odjezdu, délky dne a transferu z Rody" | SP:219 |

### G4. Orientační ceny — hlavička doslova „(vše štítek ‚ověřit')" (SP:220–223)
- Paleokastritsa: „základní bezlicenční loď cca od 100 €, často bez paliva" (SP:221)
- Nissaki od 16. 9.: „cca 80–170 € podle lodi, často bez paliva" (SP:221–222)
- Soukromá 4h plavba se skipperem: „cca 400–450 € včetně paliva" (SP:222–223)

### G5. Bezpečnost na lodi (SP:224–229) → `CHECKLISTS.lod`
jen loď výslovně označená jako bez licence; nechat si zakreslit povolenou oblast; instruktáž
(start, neutrál, zpátečka, nouzové vypnutí, kotva); vyfotit trup, vrtuli, palivoměr a vybavení;
ověřit pojištění, palivo, asistenci a počasí; nevjíždět do jeskyní při vlnách nebo bez povolení;
nekotvit mezi plavci ani na mořské trávě; mobil v pouzdře, powerbanka, voda, SPF, pokrývka hlavy
a boty do vody; alkohol před řízením lodi vynechat. (9 položek)

---

## ČÁST H — Další aktivity (část 12, SP:231–290)

### H1. Katalog „Další možnosti" (SP:231–240) → `D:places` kategorie `aktivita`
Hlavička SP:231 doslova: „sekce ‚Další možnosti', **ne povinnost**".

**Voda (SP:232–234) — 7:** šnorchlování; SUP a sea kayaking; potápění; vodní sporty na Roda
Beach nebo v jiných letoviscích; cliff jumping / coasteering „**pouze s kvalifikovaným
průvodcem**"; plavby při západu slunce; soukromý motorový člun nebo plachetnice.

**Země a vzduch (SP:235–237) — 8:** pěší túry a trekking; cyklistické výlety; Jeep safari /
self-drive 4×4 safari; paragliding nebo paramotor; rock climbing; caving; včelařský zážitek;
Aqualand „jako záložní zábavní možnost".

**Kultura a gastronomie (SP:238–240) — 6:** historická pěší prohlídka Corfu Town; food &
culture walking tour; kurz řeckého vaření; řecký večer s hudbou a tancem; návštěva místních
slavností; trhy, lokální produkty a kumquat.

### H2. Roda Beach Watersports Center (SP:242–248) → `WATERSPORTS_RODA`
„Oficiální Roda Beach Resort Watersports Center potvrzuje za příplatek" (SP:243) — **9 aktivit**
(SP:243–244): paragliding/parasailing, jet ski, vodní lyže, banana boat, inflatable rings,
kánoe, šlapadla, SUP, kajak.
Ověřit (SP:245–246): sezonní provoz v druhé polovině září, cenu, pojištění, vítr,
věkové/zdravotní limity a „**hlavně zda je centrum přístupné hostům Silver Beach Hotelu**".
Doporučení (SP:246–247): „Klidnější SUP/kajak dává smysl ráno; motorové aktivity jen v určené
zóně licencovaného provozovatele."
Zdroj: https://roda-beach.com/en/water-sports/ (SP:248).

### H3. Potápění a šnorchlování (SP:250–257) → `DIVING_OPERATORS`
- **Dive Easy Acharavi** (SP:251–253): „nejbližší konkrétně ověřená možnost"; try dive bez
  certifikace, ponory pro certifikované, malé skupiny s instruktorem, útesy, stěny, vraky,
  jeskyně, snorkeling trips. +30 26630 29350, +30 697 960 0560, divecorfu@hotmail.com,
  zdroj divecorfu.com
- **Apollo Corfu Diving, Nissaki Port** (SP:254–255): try diving, snorkeling, obsluha
  Nissaki/Barbati/Agni/Kalami/Kassiopi; +30 697 470 5697, chris@corfudive.com,
  zdroj corfudive.com/contact-us/
Před rezervací ověřit (SP:256–257): cenu, délku, transfer z Rody, lékařský dotazník,
max. hloubku, pojištění, výbavu a „interval před letem či výjezdem do vyšší nadmořské výšky
podle instrukcí centra" → `CHECKLISTS.potapeni`.

### H4. Quad safari, skútry a kola (SP:259–268) → `QUAD_OPERATORS`
- **Quad Corfu Adventure, Acharavi** (SP:260–263): „oficiální web pro sezonu 2026 uvádí"
  2 h za 80/140 €, 3 h za 110/200 €, 4 h za 140/260 € pro jednu/dvě osoby; trasy Pantokrator
  Highlands a Old Perithia; max. 6 strojů / 12 osob; řidič min. 21 let, skupina B, originál
  dokladu, pevná obuv, helma poskytována; +30 698 642 8516, info@quadcorfu.com, quadcorfu.com
- **Top Gear Roda** (SP:264–266): půjčovna skútrů, motorek, quadů a kol na hlavní silnici
  v Rodě, +30 26630 63191 / +30 26630 64554. „Web se nepodařilo spolehlivě načíst; ceny,
  provoz, pojištění a **existenci potvrdit přímo**." → štítek `neovereno`
- Varování (SP:267–268): „Malé auto je obecně bezpečnější dopravní základ. U quad/skútru
  kontrolovat oprávnění, helmu, pojištění, spoluúčast, fotky škod a krytí cestovním
  pojištěním; nejezdit v žabkách."

### H5. Rybaření a malé výletní lodě (SP:270–274) → `FISHING`
„V Rodě a Sidari prověřit shared/private fishing charter nebo pobřežní výlet. Zdroje nejsou
dostatečně aktuální → nabídku označit **‚ověřit na místě / přes hotel'**" a ptát se na skutečný
čas rybaření, pruty, návnadu, licenci, limit osob, palivo, nápoje, stín, toaletu a možnost
ponechat či připravit úlovek.

### H6. Wellness a masáže (SP:276–280) → `WELLNESS`
„Silver Beach uvádí bazén/Jacuzzi, nikoli plnohodnotné spa." (SP:277)
„Roda Beach Resort & Spa oficiálně uvádí Aegeo Spa, vnitřní bazén s mořskou vodou, ošetření
a placené masáže." (SP:277–278)
„**Přístup neubytovaných hostů NENÍ potvrzen**; předem se zeptat na day visitor treatment,
cenu, délku a přístup do spa/bazénu." (SP:278–280)
Zdroj: https://roda-beach.com/en/sport-and-leisure-facilities/ (SP:280)

### H7. Hotové kontaktní zprávy (SP:282–290) → `CONTACT_TEMPLATES`
- Dive Easy — doslovné znění SP:283–285
- Quad safari — doslovné znění SP:286–289
- Rozšířená nabídka: corfutouristservices.gr/activities-in-corfu/, corfuextremesports.com (SP:290)

---

## ČÁST I — Roda jako samostatná kategorie (část 13, SP:292–308) → `C:RodaSection`

Praktické možnosti v Rodě (SP:293–300), 13 položek: Roda Beach; hotelový bazén a odpočinek;
Katreena Horse Riding přímo v Rodě; Apollónův chrám, Roda Loop a pobřežní procházka do
Acharavi; procházka přístavem a hlavní ulicí; bary, beach bary, sportovní přenosy, karaoke a
občasná živá hudba; vodní sporty (parasailing/paragliding, jet ski, vodní lyže, banana/rings,
kánoe, šlapadla, SUP, kajak — „sezonu a přístup nehostů ověřit"); Skyway Boats, rybářské výlety
a malé pobřežní plavby („dosah, cenu a počasí ověřit"); obchody a supermarkety; půjčovny aut,
skútrů, quadů a kol; wellness/masáž jako možná day-visitor služba v Roda Beach Resort & Spa
(„ověřit"); spojení do Acharavi, Sidari, Kassiopi a Corfu Town; „první večer projít tabule
podniků a vyfotit aktuální program".

Konkrétní večerní podniky — hlavička doslova „Konkrétní večerní podniky **k ověření**" (SP:301)
→ `VECERNI_PODNIKY`, všechny `freshness.status = 'overit-aktualne'`:

| Podnik | Charakteristika dle SP | Citace |
|---|---|---|
| Drunken Sailor | koktejly, sport, tribute/cabaret/DJ | SP:301 |
| Oscar's Entertainment Diner | jídlo, bar, tribute program | SP:302 |
| Crusoe's Pub Cafe | pub, kvízy | SP:302 |
| Pirates Bar | karaoke, tematické večery | SP:303 |
| The Boathouse | klidnější posezení u moře, západ slunce | SP:303–304 |
| Big Ben | řecké večery, hudba, turistická show | SP:304 |
| Nemo Café | koktejly, terasa, klidnější atmosféra | SP:304–305 |

Pravidlo SP:305–306: „Program, otevírací dobu a skutečný provoz v září 2026 ověřit na
aktuálních tabulích/sociálních sítích; **nezobrazovat starý program jako dnešní**."

Večerní alternativy mimo Rodu (SP:307–308): Sidari („živější scéna"); Kassiopi („přístavní
atmosféra, komornější bary"); Corfu Town („nejširší kultura, gastronomie, koktejlové bary").

---

## ČÁST J — Jídlo a pití (část 14, SP:310–321) → `C:JidloVecerSection`

Polopenze zahrnutá. Restaurace dělit na 5 kategorií (SP:311–312): oběd na cestě; výjimečný
večer mimo hotel; plážový bar; rychlé zásoby; hotelové jídlo.

| Podnik v Rodě | Poznámka dle SP | Citace |
|---|---|---|
| Nikos Family Restaurant | silná dlouhodobá hodnocení, rodinné prostředí, řecká kuchyně | SP:313–314 |
| Roda Park Restaurant | tradiční řecká a středomořská kuchyně, rodapark.com | SP:314–315 |
| Drosia Taverna & Grill Room | — | SP:315 |
| La Luz All Day Beach Bar | — | SP:315 |
| Oscar's Entertainment Diner | „spíš atmosféra a večerní zábava" | SP:315–316 |

SP:316: „Dynamické recenze, otevření a rezervace ověřit." → `freshness.status = 'overit-aktualne'`.

Co ochutnat (SP:317–318): sofrito; pastitsada; bourdeto; saganaki; pražma, mořský vlk,
chobotnice a kalamáry; moussaka, stifado, souvlaki; řecký salát a tzatziki; kumquatový likér
nebo sladkosti.
SP:319: „U ryb ověřit, zda je cena za porci, nebo podle hmotnosti."
Zásoby (SP:320–321): voda, ovoce, jogurt, pečivo, svačiny; na lodní den „minimálně 1,5–2 l
vody na osobu, slané i sladké občerstvení a jednoduchý oběd".

---

## ČÁST K — Události (část 15, SP:323–330) → `UDALOSTI`

| Událost | Stav dle SP | Citace |
|---|---|---|
| **International Marching Bands Festival of the Ionian Islands 2026**, 18.–19. 9. 2026, Corfu Town; průvody, prezentace, koncerty a TATTOO show | „Potvrzená hlavní událost"; „přesné hodiny ověřit"; program https://ionianmusicfestival.com/en/schedule/ | SP:324–326 |
| 14. 9. svátek Povýšení svatého Kříže u kláštera Agios Ioannis v oblasti Sidari | „pouze po aktuálním ověření" | SP:327–328 |
| 15. 9. vinařský festival v Kavadades | „pouze po aktuálním ověření" | SP:328 |
| 21. 9. vinařské slavnosti v Kassiopi a Moraitice | „kvůli rannímu odletu prakticky nepoužitelné" | SP:328–329 |
| aktuální lokální hudba, karaoke a program barů v Rodě | jen po aktuálním ověření | SP:329–330 |

---

## ČÁST L — Doprava a půjčovny (část 16, SP:332–346) → `D:practical.DOPRAVA`

**Auto (SP:333–338):** „pro dva preferovat malé auto s klimatizací".
Ověřit (SP:333–335) → `CHECKLISTS.auto`: konečnou cenu a daně; kauci a spoluúčast; CDW/SCDW;
pneumatiky, skla, podvozek a zrcátka; palivovou politiku; druhého řidiče; asistenci a náhradní
auto; fotodokumentaci vozu. (8 položek)
Kandidáti v Rodě (SP:335–338): Dromeas Rent a Car (dromeas-rentacar-roda.com); NSK Rent a Car
(nsk-carrentalcorfu.com); Infinity Car Hire (infinitycarhire.com/roda-office-corfu/);
Corfu Cars (corfucars.com/contact.php); Dimitra & Manos / hotelové doručení —
„aktuální nabídku ověřit".

**Skútr (SP:339–340):** „jen s odpovídajícím oprávněním, helmami a zkušeností. Nedoporučovat
automaticky na vzdálený jih, Pantokrator nebo návrat po tmě."

**Autobus (SP:341–342):** Green Bus A3 Corfu Town ↔ Roda/Acharavi; severní S5 Sidari ↔
Roda/Acharavi ↔ Kassiopi („provozní dny a časy ověřit").
Timetable: https://mng.greenbuses.gr/usersc/pdf-en.php

**Taxi (SP:343–344):** „na večerní návrat nebo jednosměrný přesun; cenu delší cesty potvrdit
předem; objednat přes hotel nebo ověřený podnik."

**Řízení (SP:345–346):** „jezdí se vpravo. Horské silnice úzké, klikaté, někdy bez krajnic.
Počítat s autobusy, skútry, chodci a zvířaty. Na Pantokrator a do Old Perithie jet za světla."

---

## ČÁST M — Počasí a dynamická logika (část 17, SP:348–355)

Snapshot (SP:349–350): 13. 9. 2026 indikoval na 14.–19. 9. cca 27–28 °C přes den a 17–19 °C
v noci, s možností přeháněk. SP:350 doslova: „**Není to trvalý údaj.**"
→ na webu jen jako datovaný snapshot se zdrojem, nikdy jako předpověď.

Povinná pravidla webu (SP:351–355) → `POCASI_PRAVIDLA` + chování `C:PocasiPanel`:
1. „zobrazovat živé počasí jen z reálného zdroje a **s timestampem**" (SP:351)
2. „při chybě nabídnout **odkaz na živou předpověď**" (SP:351–352)
3. „pro loď sledovat **vítr a vlny**, ne jen teplotu" (SP:352)
4. „Pantokrator a panoramata doporučit za dobré viditelnosti" (SP:352–353)
5. „Porto Timoni a Myrtiotissu označit jako **problematické za mokra**" (SP:353–354)
6. „Corfu Town, restaurace, případná muzea a hotelový odpočinek označit jako možnosti při
   horším počasí" (SP:354–355)
7. „**žádný automatický denní itinerář**" (SP:355)

Implementace: open-meteo (veřejné API bez klíče), `try/catch`, při chybě fallback odkaz;
selhání API nesmí shodit stránku (SP:405 „hlavní obsah použitelný i při výpadku API").

---

## ČÁST N — Zdraví, nouze, peníze a data (část 18, SP:357–374)

| Situace | Kontakt | Citace |
|---|---|---|
| Jednotná evropská nouzová linka | 112 | SP:360 |
| Policie | 100 | SP:361 |
| Záchranná služba | 166 | SP:362 |
| Hasiči | 199 | SP:363 |
| Pobřežní stráž | 108 | SP:364 |
| Turistická policie | 1571 | SP:365 |
| Čedok SOS / vady zájezdu | +420 296 184 930 | SP:366 |
| Silver Beach Hotel | +30 26630 63112 | SP:367 |

Místní zdravotnická zařízení — „(před použitím ověřit)" (SP:368):
Aladasi Medical Services Roda +30 26630 99377 / +30 6942 564409 (SP:368–369);
Mastoras Medical Services Roda +30 26630 63388 (SP:369);
Corfu General Hospital +30 26613 60400 (SP:370).

Praktické (SP:371–374) → `PENIZE_DATA` + `CHECKLISTS.predodjezd`: EHIC a cestovní pojištění;
pravidelné léky v originálním balení; „**fotka dokladů bezpečně online, NE ve veřejném webu**";
offline mapa Korfu; ověřit roamingový limit; karta + hotovost v eurech; „při platbě kartou
odmítnout přepočet do Kč a platit v EUR"; uložit hotel, nemocnici, půjčovny a nouzová čísla.

Všechna čísla → tlačítka `tel:` + „Kopírovat číslo" (SP:407–408).

---

## ČÁST O — LOCKED fakta o zájezdu (část 4, SP:32–48) → `D:practical.TRIP`

| Údaj | Hodnota | Citace |
|---|---|---|
| Termín | 14. 9. 2026 – 21. 9. 2026, 7 nocí | SP:35 |
| Cestující | Honzík a Markétka | SP:36 |
| Hotel | Silver Beach Hotel 3★, Roda, Korfu | SP:37 |
| Ubytování | 1× dvoulůžkový pokoj | SP:38 |
| Strava | Polopenze | SP:39 |
| Transfer | Letiště → hotel → letiště zahrnutý | SP:40 |
| Let tam | 14. 9. 2026, Brno 05:10 → Korfu 08:05, TVS 2368 | SP:41 |
| Odbavení | 2 hodiny před odletem; finální čas znovu ověřit | SP:42 |
| Let zpět | 21. 9. 2026, Korfu 08:55 → Brno 09:55, TVS 2369 | SP:43 |
| Zavazadla | Každý: kabinové 8 kg + odbavené 23 kg | SP:44 |
| Catering v letadle | Ne | SP:45 |

Praktický dopad (SP:47–48) — **neutrální fakta, NE itinerář**: „po příletu 14. 9. zbývá část
dne; 21. 9. se kvůli časnému letu nepočítá s výletem; čas transferu zpět potvrdit; u hotelu
včas objednat časnou snídani nebo balíček."

**Privacy firewall (SP:50–53):** NEPŘENÁŠET příjmení, data narození, adresu, telefon ani
e-mail cestujících; číslo smlouvy/rezervace; cenu, variabilní symbol, bankovní údaje; kopie
dokladů; SSH klíče, hesla, tokeny, přístupové údaje k VPS. „Stačí jména Honzík a Markétka."
→ SOURCE_PACK sám žádný z těchto údajů neobsahuje; úkolem je je **nepřidávat**.

---

## ČÁST P — Povinné sekce webu (část 19, SP:376–393)

| # | Sekce dle SP | Citace | Komponenta |
|---|---|---|---|
| 1 | Přehled — termín, hotel, lety, základní praktická fakta; rychlé vstupy Pláže, Aktivity, Lodě, Místa, Mapa, Praktické; „**ŽÁDNÁ sekce ‚Dnes' s přiděleným programem**" | SP:379–380 | `C:PrehledSection` |
| 2 | Všechny možnosti — úplný katalog; filtry podle kategorie, oblasti, náročnosti, dopravy, počasí a priority | SP:381–382 | `C:KatalogSection` + `C:FilterBar` |
| 3 | Pláže — všechna must-see i doplněná místa | SP:383 | `C:KatalogSection` (filtr `plaz`) |
| 4 | Aktivity — „jízda na koni **výrazně**"; lodě, voda, dobrodružství, kultura, gastronomie | SP:384 | `C:AktivitySection` + `C:KoneSection` |
| 5 | Mapa — hotel jako základna; ověřené body; barevné oblasti a filtry; Google Maps deep-link pro každý bod; „ideálně OpenStreetMap/Leaflet **bez API klíče**" | SP:385–386 | `C:MapaDynamic` → `C:MapaClient` (`next/dynamic`, `ssr:false`) |
| 6 | Co spojit — geografické balíčky z části 9; „**bez kalendáře a bez konkrétních dnů**" | SP:387 | `C:ComboSection` |
| 7 | Jídlo a večer — restaurace, speciality, bary, události | SP:388 | `C:JidloVecerSection` |
| 8 | Doprava a rezervace — auto, skútr, autobus, taxi, lodě, koně; checklisty a ověřovací odkazy | SP:389 | `C:DopravaSection` + `C:Checklist` |
| 9 | Praktické — lety, zavazadla, transfer, hotel, polopenze, kontakty, bezpečnost | SP:390 | `C:PraktickeSection` |
| 10 | Můj výběr — oblíbené / chceme navštívit / navštíveno; „ukládat **POUZE lokálně v prohlížeči**; žádné automatické rozvržení do dní" | SP:391–392 | `C:MujVyberSection` + `useSelection()` |
| 11 | Zdroje a aktuálnost — zdroj a poslední kontrola dynamických údajů | SP:393 | `C:ZdrojeSection` |

**Design a technické chování (část 20, SP:401–409):** mobile-first a plně responzivní; čeština;
„prémiový cestovní magazín + praktická palubní deska"; barvy Jónského moře (tmavá modrozelená,
tyrkys, písková, teplá korálová); kompaktní karty, čitelné štítky, minimum vizuálního šumu;
„**spodní mobilní navigace Přehled – Možnosti – Mapa – Můj výběr – Praktické**" → `C:BottomNav`;
rychlé načítání; „hlavní obsah použitelný i při výpadku API"; localStorage pro osobní stav;
obrázky musí odpovídat konkrétním místům, mít alt text, legální zdroj a lazy loading;
„žádné falešné recenze, ceny, dostupnosti ani otevírací doby"; tlačítka **Navigovat, Volat,
Kopírovat číslo, Otevřít zdroj**; žádný login, backend, rezervace ani platby v MVP;
přístupnost (klávesnice, kontrast, focus states, srozumitelné popisky); žádné chyby v konzoli.

---

## ČÁST Q — DATOVÝ MODEL KARTY (doslovně podle SP:395–399)

SP:395–399 vyjmenovává **21 položek**. Mapování 1:1, **žádné pole navíc, žádné vynechané**:

| # | Položka dle SP (doslovně) | TS název | Typ | Povinné |
|---|---|---|---|---|
| 1 | canonical name | `canonicalName` | `string` | ano |
| 2 | český název | `czechName` | `string` | ano |
| 3 | kategorie a podkategorie | `category`, `subcategory` | `Category`, `string \| null` | `category` ano |
| 4 | must-see / doporučení / další možnost | `tier` | `'must-see' \| 'doporuceni' \| 'dalsi-moznost'` | ano |
| 5 | oblast ostrova | `area` | `Area` | ano |
| 6 | krátké „proč sem" | `whyGo` | `string` | ano |
| 7 | WOW faktor 1–5 | `wow` | `1 \| 2 \| 3 \| 4 \| 5` | ano |
| 8 | doporučená délka | `duration` | `string` | ano |
| 9 | nejlepší část dne | `bestPartOfDay` | `PartOfDay[]` | ano |
| 10 | vhodné počasí | `weather` | `WeatherFit[]` | ano |
| 11 | doprava | `transport` | `Transport[]` | ano |
| 12 | náročnost přístupu | `accessDifficulty` | `'snadny' \| 'stredni' \| 'narocny'` | ano |
| 13 | parkování | `parking` | `string` | ano |
| 14 | co lze spojit | `comboIds` | `string[]` | ano (může být `[]`) |
| 15 | rizika / upozornění | `risks` | `string[]` | ano (může být `[]`) |
| 16 | orientační čas z Silver Beach Hotelu | `timeFromHotel` | `string` | ano |
| 17 | ověřené souřadnice | `coords`, `coordsStatus` | `{lat:number;lng:number} \| null`, `CoordsStatus` | ano |
| 18 | navigační odkaz | `navUrl` | `string` | ano |
| 19 | oficiální nebo ověřovací zdroj | `sources` | `SourceRef[]` | ano (může být `[]`) |
| 20 | aktuálnost | `freshness` | `Freshness` | ano |
| 21 | oblíbené / navštíveno v localStorage | — | — | **není pole karty** — nese `useSelection()`, klíč `korfu2026:selection:v1` |

```ts
// app/korfu2026/_data/types.ts

export type Category =
  | 'plaz' | 'pamatka' | 'vesnice' | 'vyhlidka' | 'priroda'
  | 'aktivita' | 'lod' | 'jidlo' | 'vecer' | 'zakladna';

/** Oblasti přesně podle členění SP:75–94. */
export type Area =
  | 'roda-okoli' | 'severozapad' | 'zapad' | 'severovychod'
  | 'jih-jihozapad' | 'corfu-town';

/** Povolené neutrální metadatum dle SP:433–435. NIKDY konkrétní den pobytu. */
export type PartOfDay = 'rano' | 'dopoledne' | 'odpoledne' | 'podvecer' | 'vecer';

/** Povolené neutrální metadatum dle SP:433–435. */
export type WeatherFit = 'slunecno' | 'oblacno' | 'destivo' | 'bezvetri' | 'vitr-vadi';

export type Transport = 'auto' | 'bus' | 'taxi' | 'pesky' | 'lod' | 'skutr' | 'quad';

/** 'overene'    = doložená lat/lng
 *  'orientacni' = poloha známá jen přibližně, na mapě označena jako orientační
 *  'chybi-v-source-packu' = SOURCE_PACK souřadnici neuvádí → coords === null */
export type CoordsStatus = 'overene' | 'orientacni' | 'chybi-v-source-packu';

export interface SourceRef { label: string; url: string; }

export interface Freshness {
  /** 'overeno'          = SP uvádí konkrétní datum kontroly (SP:139, SP:154, SP:243, SP:260)
   *  'overit-aktualne'  = dynamický údaj, SP nařizuje znovu potvrdit (SP:28–30)
   *  'starsi-lead'      = SP:146–148 (Katreena starý ceník a otevírací doba)
   *  'neovereno'        = SP:165–166 (Angel's Horses), SP:264–266 (Top Gear Roda) */
  status: 'overeno' | 'overit-aktualne' | 'starsi-lead' | 'neovereno';
  /** ISO datum kontroly dle SOURCE_PACKu; null když SP datum neuvádí. */
  checkedAt: string | null;
  /** Kam se jde ověřit. Povinné, když status !== 'overeno'. */
  verifyUrl: string | null;
  /** Doslovná citace/poznámka ze SOURCE_PACKu. */
  note?: string;
}

export interface Place {
  id: string;
  canonicalName: string;
  czechName: string;
  category: Category;
  subcategory: string | null;
  tier: 'must-see' | 'doporuceni' | 'dalsi-moznost';
  area: Area;
  whyGo: string;
  wow: 1 | 2 | 3 | 4 | 5;
  duration: string;
  bestPartOfDay: PartOfDay[];
  weather: WeatherFit[];
  transport: Transport[];
  accessDifficulty: 'snadny' | 'stredni' | 'narocny';
  parking: string;
  comboIds: string[];
  risks: string[];
  timeFromHotel: string;
  coords: { lat: number; lng: number } | null;
  coordsStatus: CoordsStatus;
  navUrl: string;
  sources: SourceRef[];
  freshness: Freshness;
  /** jen u must-see ze SP:57–71 */
  priority?: number;
  marker?: 'srdce' | 'hvezdicka';
}
```

### Q1. Jak model nese štítek „ověřit aktuálně" + zdroj (SP:28–30, SP:393, SP:407)
- Každý **dynamický údaj** (cena, otevírací doba, sezonní provoz, dostupnost, jízdní řád,
  program) se renderuje **výhradně** přes `C:DynamicFact`, která povinně zobrazí badge podle
  `freshness.status` a odkaz `freshness.verifyUrl`.
- `C:DynamicFact` s `status !== 'overeno'` a `verifyUrl === null` **nevykreslí hodnotu vůbec**
  — tím je strukturálně vynuceno SP:30 („Žádná falešná přesnost") a SP:407 („žádné falešné
  recenze, ceny, dostupnosti ani otevírací doby").
- `kde SP mlčí` → `parking` / `timeFromHotel` dostanou hodnotu `'ověřit aktuálně'`, nikoli
  odhad. SOURCE_PACK **neuvádí konkrétní časy jízdy z hotelu ani parkovací kapacity** pro
  žádné místo (riziko R2).

### Q2. Typy mimo kartu
```ts
// _data/combos.ts
export interface Combo { id: string; title: string; placeIds: string[]; note: string; }

// _data/practical.ts
export interface PriceItem {
  label: string; price: string; duration?: string; freshness: Freshness;
}
export interface Operator {
  id: string; name: string;
  role: 'prvni-volba' | 'alternativa' | 'lead';
  base: string;
  offers: PriceItem[];
  phones: string[]; emails: string[];
  sources: SourceRef[];
  freshness: Freshness;
  warnings: string[];
}
export interface Checklist { id: string; title: string; items: string[]; }
export interface ContactTemplate { id: string; title: string; body: string; }
```

### Q3. localStorage (SP:391–392, SP:405–406)
```ts
export const SELECTION_KEY = 'korfu2026:selection:v1';
export interface SelectionState {
  oblibene: string[];      // „Oblíbené"      (SP:19, SP:391)
  chceme: string[];        // „Chceme navštívit" (SP:19, SP:391)
  navstiveno: string[];    // „Navštíveno"    (SP:19, SP:391)
}
```
Čtení i zápis v `try/catch` — privátní režim / zakázané úložiště nesmí shodit stránku.
Žádný backend, žádná cookie, žádné odesílání stavu (SP:408).

---

## ČÁST R — Zdroje (část 25, SP:461–476) → `C:ZdrojeSection`

**Autoritativní (SP:462–466):** smlouva Čedoku (část 4, citlivé údaje vynechány); dva ruční
seznamy (část 6); Silver Beach Hotel https://silverbeachcorfu.com/; International Marching
Bands Festival https://ionianmusicfestival.com/en/schedule/; Green Buses
https://mng.greenbuses.gr/usersc/pdf-en.php; řecká nouzová čísla
https://www.gov.gr/en/sdg/healthcare/national-emergency-numbers; Visit Greece Health & Safety
https://www.visitgreece.gr/before-travelling-to-greece/health-safety/

**Koně a aktivity (SP:467–471):** katreenahorseridingcorfu.com (+ /experiences);
arenahorseriding.com; corfutouristservices.gr/tours/horse-riding-corfu/; northcorfuhorses.com;
roda-beach.com/en/water-sports/; divecorfu.com; corfudive.com/contact-us/; quadcorfu.com;
roda-beach.com/en/sport-and-leisure-facilities/; corfutouristservices.gr/activities-in-corfu/;
corfuextremesports.com

**Lodě, auta, gastronomie (SP:472–476):** seahorsecorfu.com; bluelagooncorfu.com;
corfuboatrental.com; nikaboatrental.com; rentaboatcorfu.gr; dinosboatrentals.com;
aeolusboatrentals.gr; skywayboats.com/contact-us/; waveboathire.com/en;
sunfunclub-boathire.com; nissakiboatrental.com; dromeas-rentacar-roda.com;
nsk-carrentalcorfu.com; infinitycarhire.com/roda-office-corfu/; corfucars.com/contact.php;
rodapark.com

---

## ČÁST S — Úplný soupis kontaktů ze SOURCE_PACKu

Všechno jsou **firemní / veřejné** kontakty provozovatelů a tísňové linky, **nikoli údaje
cestujících** → neporušují privacy firewall (SP:50–53).

| Subjekt | Telefon | E-mail | Citace |
|---|---|---|---|
| Katreena Horse Riding | +30 694 482 9461 | katreenahorseriding@gmail.com | SP:149 |
| Arena Horse Riding | +30 698 733 7101 | katia6135@hotmail.com | SP:159 |
| Angel's Horses (NEOVĚŘENO) | +30 699 502 2671 | horses.corfu@gmail.com | SP:165 |
| B&B Boat Rentals | +30 697 458 5157 | — | SP:189 |
| Dinos Boat Rentals | +30 697 375 4561 | dinosboatrentalscfu@gmail.com | SP:190–191 |
| Aeolus Boat Rentals | WhatsApp +30 698 311 2325 | — | SP:192 |
| Skyway Boats (Roda) | WhatsApp +30 698 568 7929 | skywayboats@gmail.com | SP:201–202 |
| Wave Boat Company (Sidari) | — | info@waveboathire.com | SP:205 |
| Dive Easy Acharavi | +30 26630 29350, +30 697 960 0560 | divecorfu@hotmail.com | SP:253 |
| Apollo Corfu Diving | +30 697 470 5697 | chris@corfudive.com | SP:255 |
| Quad Corfu Adventure | +30 698 642 8516 | info@quadcorfu.com | SP:263 |
| Top Gear Roda (NEOVĚŘENO) | +30 26630 63191, +30 26630 64554 | — | SP:264–265 |
| Silver Beach Hotel | +30 26630 63112 | — | SP:367 |
| Čedok SOS / vady zájezdu | +420 296 184 930 | — | SP:366 |
| Aladasi Medical Services Roda | +30 26630 99377, +30 6942 564409 | — | SP:368–369 |
| Mastoras Medical Services Roda | +30 26630 63388 | — | SP:369 |
| Corfu General Hospital | +30 26613 60400 | — | SP:370 |
| Tísňové linky | 112 / 100 / 166 / 199 / 108 / 1571 | — | SP:360–365 |

**17 provozovatelů/institucí + 6 tísňových linek.** Všechny jako `tel:` / `mailto:`
+ tlačítko „Kopírovat číslo" (SP:407–408).

---

## ČÁST T — Tvrdé zákazy → automatická kontrola (`.korfu/check-no-itinerary.sh`)

| # | Zákaz | Zdroj | Kontrola |
|---|---|---|---|
| Z1 | Žádný itinerář po dnech („den 1", „úterý", „doporučený týden", „program na …") | SP:4, SP:15–16, SP:20, SP:379–380, SP:432–435 | grep na názvy dnů v týdnu, `den [0-9]`, „doporučený týden", „rozvržení do dní" |
| Z2 | Albánie / Ksamil nikde | zadání úkolu; v SOURCE_PACKu se nevyskytují (ověřeno grepem) | grep `-i 'albáni\|albani\|ksamil'` |
| Z3 | Žádné tvrzení, že vyjížďka na koni začíná před Silver Beach Hotelem nebo vede po celé hlavní Roda Beach | SP:133–135 | grep na kolokaci „Silver Beach" v odstavci s „kůň/koni/jízd/vyjížď" |
| Z4 | Paxos–Antipaxos NIKDY malým bezlicenčním člunem | SP:214–215 | grep `Paxos` v kontextu „bez licence\|bezlicenč" |
| Z5 | Žádná citlivá data cestujících ani klíče/tokeny/hesla | SP:50–53 | secret scan + grep na příjmení, adresu, číslo smlouvy, cenu zájezdu, IBAN, token |
| Z6 | Žádné falešné recenze, ceny, dostupnosti ani otevírací doby | SP:407 | code review: dynamický údaj jen přes `C:DynamicFact` s `verifyUrl` |
| Z7 | Žádná sekce „Dnes" s přiděleným programem | SP:379–380 | grep na `„Dnes"` jako název sekce |

### Rozsah kontrolního skriptu (důležité)
`.korfu/check-no-itinerary.sh` musí grepovat **výhradně `app/korfu2026/`** (produkční výstup),
nikoli `.korfu/`. Důvod ověřen: `.korfu/COVERAGE.md:809` obsahuje slova „Albánie / Ksamil"
uvnitř definice zákazu Z2 a `.korfu/COVERAGE.md:568` cituje doslovné znění privacy firewallu
ze SP:51–53 („číslo smlouvy/rezervace; cenu, variabilní symbol, bankovní údaje"). Obojí je
**popis pravidla, ne obsah webu**. Skript se scope na `.korfu/` by na sobě samém falešně
selhal. Skript také nesmí číst `.korfu/runs` ani `.lh-harness` (harness-owned cesty).

### Ověření úplnosti matice (automatické)
```
$ sed -n '412,430p' .korfu/SOURCE_PACK.md | tr '\n' ' ' | tr ';' '\n' \
    | sed 's/^ *//; s/ *$//' | grep -vc '^$'
40
$ grep -c '^| M[0-9][0-9] ' .korfu/COVERAGE.md   # 40 obsahových + M41 zákazové pravidlo
41
```
Automatický split části 21 po střednících dává **40 položek** ve stejném pořadí jako
řádky M01–M40 v ČÁSTI A. Shoda 1:1, žádná položka nevynechána ani nesloučena.
