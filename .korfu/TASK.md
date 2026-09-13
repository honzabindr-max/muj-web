# ÚKOL: Korfu 2026 — web jako katalog možností (Next.js route /korfu2026)

## Kontext a pracovní prostor
- Pracuj VÝHRADNĚ v `/Users/janbindr/Projects/korfu2026-build` (klon repa muj-web, branch `feat/korfu2026`).
- NIKDY nesahej na `/Users/janbindr/Projects/muj-web` ani na žádný jiný adresář mimo workspace.
- Jediný zdroj pravdy pro obsah: `.korfu/SOURCE_PACK.md` v tomto workspace. Přečti ho CELÝ, než začneš.
- Vzor existující implementace stejného typu: `app/lefkada-2026/` a `app/cesky-raj-2026/` v tomto repu.
  Prostuduj je a drž se stejné konvence (App Router, Tailwind, client component tam, kde je potřeba stav).

## Co postavit
Český, mobile-first web „Korfu 2026" jako Next.js App Router route `app/korfu2026/`,
dostupný na `/korfu2026/`. Je to EXPLORER MOŽNOSTÍ, ne itinerář.

### Technika
- `app/korfu2026/page.tsx` + potřebné komponenty v `app/korfu2026/_components/`.
- Data odděleně: `app/korfu2026/_data/places.ts` (typovaný katalog karet), `_data/combos.ts`,
  `_data/practical.ts`. Datový model karty přesně podle části 19 SOURCE_PACK.
- Mapa: Leaflet + OpenStreetMap dlaždice, BEZ API klíče, načítaná dynamicky
  (`next/dynamic`, `ssr: false`). Při výpadku dlaždic musí zbytek webu fungovat.
- Stav „Oblíbené / Chceme navštívit / Navštíveno": localStorage, klíč `korfu2026:selection:v1`.
  Ošetři chybu localStorage (privátní režim) bez pádu.
- Počasí: pokud přidáš živé počasí, jen z veřejného API bez klíče (např. open-meteo) s timestampem
  a s fallbackem na odkaz na živou předpověď. Selhání API nesmí rozbít stránku.
- Žádný login, backend, rezervace, platby. Žádné cookies třetích stran.
- Obrázky: NEPOUŽÍVEJ obrázky, u kterých neumíš doložit legální zdroj. Raději CSS/gradient/ikony.
  Pokud obrázek použiješ, musí mít alt text, lazy loading a doložený zdroj.
- Odkazy „Navigovat" = Google Maps deep-link z ověřených souřadnic.
  Odkazy „Volat" = `tel:` s čísly ze SOURCE_PACK. „Kopírovat číslo" přes clipboard API.
- Přístupnost: klávesnice, viditelné focus states, kontrast, popisky. Žádné chyby v konzoli.

### Obsah — tvrdé požadavky
- Všech 13 ručních must-see míst z části 6 = vlastní karta + ověřené souřadnice.
- Jízda na koni je VÝRAZNÁ sekce: Katreena Horse Riding jako první volba PŘÍMO V RODĚ
  (základna „Close to Roda Taxi"), Arena Horse Riding jako konkrétní alternativa,
  Angel's Horses a North Corfu Horses jako neověřené leady. NIKDY netvrď, že vyjížďka
  začíná před Silver Beach Hotelem.
- Pokryj CELOU kontrolní matici z části 21 SOURCE_PACK. Nic nevynechávej kvůli délce.
- Dynamické údaje (ceny, otevírací doby, sezonní provoz) vždy se štítkem „ověřit aktuálně"
  a s odkazem na zdroj. Žádná falešná přesnost, žádné vymyšlené recenze.
- Souřadnice: použij jen ty, které umíš doložit. U nejistého bodu kartu ponech, ale mapový bod
  označ jako orientační a napiš to.

### ZAKÁZÁNO (tvrdý fail)
- Jakýkoli program rozdělený do dnů pobytu („den 1", „úterý", „doporučený týden").
  Povolená neutrální metadata: nejlepší část dne, vhodné počasí, časová náročnost.
- Albánie a Ksamil kdekoli na webu.
- Citlivé údaje: příjmení, adresa, telefon/e-mail cestujících, číslo smlouvy, ceny zájezdu,
  bankovní údaje, jakékoli klíče/tokeny/hesla — ani v kódu, ani v komentářích, ani v logu.
- Tvrzení o Paxos–Antipaxos malým bezlicenčním člunem. Jen organizovaná loď nebo profi skipper.

## Provozní omezení běhu
- Pracuj POUZE přes CLI a editaci souborů. NEOTVÍREJ prohlížeč, neřiď GUI, nepoužívej
  computer-use pro čtení zdrojů. Veškerý potřebný obsah je v `.korfu/SOURCE_PACK.md`.
- Síť používej jen pro `npm`/build. Ověřování cen na webech provozovatelů NENÍ tvůj úkol —
  označ je štítkem „ověřit aktuálně" podle SOURCE_PACK.
- NEDĚLEJ `git push`. NEMĚŇ branch `main`. Commituj jen do `feat/korfu2026`.
- NEDEPLOYUJ. Deployment provede supervisor po schválení vlastníkem.
- Nespouštěj `npm run dev` jako blokující proces bez timeoutu; pro QA použij build + `next start`
  na volném portu a proces po kontrole ukonči.

## Checkpointy (vždy zapiš do `.korfu/CHECKPOINT-<n>.md`)
1. Coverage matrix (`.korfu/COVERAGE.md`) — každá položka části 21 + všech 13 must-see + všechny
   aktivity/provozovatelé/kontakty → kde bude v datech pokryta. Plus datový model.
2. První funkční lokální verze — `npm run build` prochází, route se vykreslí.
3. Lokální QA — build bez chyb, lint bez chyb, kontrola: žádný denní itinerář (grep),
   žádná Albánie/Ksamil, všech 13 must-see přítomno, localStorage funguje, mapa se načte,
   žádné chyby v konzoli.
4. Před deploymentem — shrnutí změn, seznam souborů, rollback poznámka. TADY SE ZASTAV.

## Definition of Done pro tento běh
Splněná část 24 SOURCE_PACK ve všech bodech, které nezávisí na deploymentu, plus:
- `.korfu/COVERAGE.md` s doloženým pokrytím 100 % kontrolní matice;
- `npm run build` zelený;
- automatická kontrola zákazu denního itineráře zapsaná jako skript `.korfu/check-no-itinerary.sh`;
- `.korfu/AUDIT.md` od nezávislého auditora s konkrétními důkazy (soubor + řádek + citace),
  ne jen tvrzení „splněno".
Executor NESMÍ sám prohlásit PASS. Auditor pracuje nezávisle proti `.korfu/SOURCE_PACK.md`.
