# SAM-BYT — audit extrakce dat z 11 inzerátů

Datum a čas kontroly: **22. 9. 2026, cca 13:30 (Europe/Prague)**
Zdroj dat: otevřené originální inzeráty v prohlížeči Sam. Výstupní soubor: `SAM_BYT_DATA.json` (11 objektů `sam-01`–`sam-11`).
Upozornění: existence stránky není důkazem, že je byt stále volný. Stav volnosti nebyl u žádného inzerenta potvrzen (nikdo nebyl kontaktován).

## 1. Kolik inzerátů se podařilo načíst
Načteno a přečteno **11 z 11**. Žádná stránka nevrátila 404, přesměrování ani chybu.
`sam-10` je jeden fyzický byt inzerovaný na dvou místech (Sreality + Bazoš, shodné ID nabídky N8188) – veden jako jeden záznam, Bazoš je v `alternative_urls`.

## 2. Použitelná hlavní fotografie
Hlavní fotografii (přímé absolutní HTTPS URL na serveru zdroje nebo jeho obrazovém CDN) má **11 z 11**.
- Plná galerie ověřena u: `sam-01` (12 fotek), `sam-08` (12), `sam-10` (15), `sam-11` (8 z Bazoše).
- Pouze hlavní fotografie: `sam-02`, `sam-04` (Bezrealitky dočítá galerii dynamicky), `sam-05`, `sam-07`, `sam-09` (Sreality dočítá galerii dynamicky), `sam-03`, `sam-06`.
- **Riziko:** `sam-03` a `sam-06` mají fotografie na CDN `t.rmcl.cz` s tokenem v URL – odkaz může po čase přestat fungovat, před nasazením na web je potřeba ověřit funkčnost.

## 3. Chybí potvrzení ohledně psa (australský ovčák)
Výslovné schválení australského ovčáka **nemá ani jeden z 11 bytů**.
- `sam-06` (Vondrákova, Reality Veselý) je jediný, kde je zvíře vůbec zmíněno: „Domácí mazlíčci jsou po dohodě vítáni za předpokladu, že jsou zvyklí na pobyt v bytě a nebudou rušit ostatní obyvatele domu." To je podmíněná formulace, nikoli souhlas s konkrétním psem.
- Zbývajících 10 (`sam-01`–`sam-05`, `sam-07`–`sam-11`) psa vůbec nezmiňuje. Mlčení inzerátu není zákaz, ale ani povolení – u všech je `australian_shepherd_explicitly_approved = false` a `pets_requires_confirmation = true`.

## 4. Chybí úplné měsíční náklady
Kompletní povinné měsíční náklady má pouze **`sam-11`** (nájem 16 500 + zálohy na energie 5 000 = 21 500 Kč pro 2 osoby).
U ostatních 10 je `monthly_total_complete = false`:
- `sam-01` – 5 000 Kč „měsíční výdaje" bez rozpisu; není jasné, zda zahrnují elektřinu a plyn.
- `sam-02`, `sam-04`, `sam-08` – známé zálohy na služby, ale rozpis a energie neuvedeny.
- `sam-03` – zálohy 3 500 Kč bez rozpisu.
- `sam-05` – zálohy uvedeny jen rozsahem 3 500–4 000 Kč, proto `services_czk = null`.
- `sam-07` – elektřinu a plyn si nájemník přepisuje na sebe, výše neznámá.
- `sam-09`, `sam-10` – podnájem s neuvedeným „poplatkem za podnájem".
- `sam-06` – měsíční náklady známé (21 000 + 5 000), ale chybí výše jednorázové odměny RK.

## 5. Nalezené rozpory (zachovány v datech)
- `sam-01`: provize RK 24 000 Kč se číselně shoduje s vratnou kaucí 24 000 Kč – ověřit, zda jde o dvě samostatné platby.
- `sam-04`: užitná plocha 61 m² vs. čistá podlahová plocha 56 m².
- `sam-05`: měsíční výdaje uvedeny rozsahem 3 500–4 000 Kč.
- `sam-07`: text uvádí provizi „ve výši jednoho měsíčního nájemného" (21 900 Kč), parametr inzerátu 26 499 Kč.
- `sam-10`: příslušenství uvádí „Balkon" i „Lodžie", text pouze zasklenou lodžii.
- `sam-11`: titulek inzerátu uvádí 18 000 Kč, text 16 500 Kč nájem / 21 500 Kč celkem; cena i kauce se mění podle počtu osob (2 os. 21 500 / 3 os. 23 000).
- `sam-03`: kauce uvedena jen vzorcem („jeden měsíční nájem včetně inkasa"), ne částkou → `deposit_czk = null`.
- `sam-08`, `sam-09`: depozit i provize RK zmíněny bez částky → `null`.

## 6. Údaje k ručnímu doplnění (telefonicky / e-mailem)
| ID | Co doplnit |
|---|---|
| sam-01 | rozpis 5 000 Kč, energie zvlášť, pes |
| sam-02 | rozsah služeb 4 352 Kč, pes, podmínky pojištění odpovědnosti a bezdlužnosti |
| sam-03 | konkrétní výše kauce, kdo hradí provizi, pes |
| sam-04 | zda energie jsou ve službách, pes |
| sam-05 | konkrétní zálohy, energie, pes |
| sam-06 | výše provize RK, souhlas s australským ovčákem, co z vybavení na fotkách zůstává |
| sam-07 | skutečná provize RK, odhad energií, balkon, pes |
| sam-08 | výše depozitu a provize, balkon, pes |
| sam-09 | jistota a poplatek za podnájem, balkon, pes |
| sam-10 | jistota a poplatek za podnájem, potvrzení absence výtahu, pes |
| sam-11 | ulice, výměra, podlaží, výtah, balkon, sklep, rozsah vybavení, pes |

## 7. Kontrolní seznam
- Přesně 11 bytů, žádná duplicita: **ANO**
- Dvě Vondrákovy správně rozlišené: **ANO** (`sam-06` Bystrc 60 m², 6. podlaží, Reality Veselý; `sam-10` Bystrc 50 m², 1. podlaží, Sreality/Bazoš)
- Dvě Jasanové správně rozlišené: **ANO** (`sam-08` 8. NP, 22 800 Kč, po rekonstrukci, PENB C; `sam-09` 1. podlaží, 22 900 Kč, podnájem, PENB G)
- Pouze Habřinova 60 m² ze Sreality: **ANO** (`sam-05`, ID 1636249676; odmítnutá Habřinova 777/2, 59 m² od Real Brno není zařazena)
- Žádné vymyšlené ceny, rozměry, souhlasy se psem ani URL fotografií: **ANO** (neověřené údaje jsou `null` nebo „neuvedeno")
- JSON syntakticky validní: **ANO**
- Cena za m² počítána z `known_monthly_total_czk`; u `sam-11` chybí plocha → `null`: **ANO**
