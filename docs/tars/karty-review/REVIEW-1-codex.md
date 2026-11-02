## Verdikt celkem: FAIL

Všech pět karet obsahuje sedm očíslovaných sekcí a uvádí příčku §2b. **Obsahově ale §2a nesplňují supervizor a brána: chybí jim kontrolor jiné modelové rodiny.** Sentinel navíc rozšiřuje zdrojové zákazy na dovolenou přípravu kódu a migrací.

Kontrola vychází pouze z deseti dodaných souborů. Soubory jsem neměnil; prováděl jsem jen čtení.

## Po kartách

### supervizor.md — FAIL

- `supervizor.md:53 › „Supervizor nemá modelového kontrolora“ a nemá PASS/FIX/BLOCK › NÁLEZ (v rozporu se zdrojem) › Doplnit nezávislého GPT kontrolora zadání, checklist odvozený z bodů 3 a 5 a verdikt PASS/FIX/BLOCK. ORCH §2a bod 6 platí pro každou roli a výjimku pro supervizora neobsahuje. Zákaz, aby supervizor sám kontroloval specialisty, tuto výjimku nezakládá.`

- `supervizor.md:61 › Notion pouze přes příčku 2 a „jediný povolený nástroj notion-fetch“ › NÁLEZ (bez zdroje) › Odstranit výhradní povolení jednoho nástroje. ORCH §2b požaduje nejvyšší dostupnou příčku; §7 a §9 počítají pro v0 s Notion API. Dostupnost příčky 1 a důvod případného fallbacku označit UNKNOWN, pokud nejsou doloženy.`

- `supervizor.md:41,49 › Přesný JSON protokol, brief.md, parseBrief a dva pokusy před UNKNOWN › NÁLEZ (bez zdroje) › Oddělit návrh technického protokolu od převzatých pravidel. ORCH stanovuje obsah zadání a state.json, nikoli tento parser, úplné schéma ani počet pokusů. Limit dvou pokusů v §2b se týká selhání UI.`

- `supervizor.md:37 › Dodržení pravidel „vynucuje kód“ › NÁLEZ (bez zdroje) › Označit skutečné vynucení jako UNKNOWN. ORCH požaduje deterministické ochrany, ale dodané podklady nedokládají jejich implementaci.`

### copy-studio.md — PASS WITH REQUIRED PATCHES

- `copy-studio.md:23–28 › Kanonické vstupy bez povinného UI_BUILD_BRIEF_V1; obsah funnelu může zůstat UNKNOWN › NÁLEZ (chybí) › Pro zakázku GPT Copy System doplnit povinný UI Build Brief a obsah locked product/funnel kontraktů. Build OS P1.2 je výslovně vyžaduje. Jejich nedodání musí blokovat posouzení shody, nestačí pouze doplnit UNKNOWN do výsledného textu.`

- `copy-studio.md:37,49 › Povinné označení právních textů LEGAL_PENDING › NÁLEZ (v rozporu se zdrojem) › Převzít přesné znění A3: nefinální text může být označen LEGAL_PENDING; právní layout sloty se zamykají do P1.7. Finální právní text se nemá automaticky označovat jako nefinální.`

- `copy-studio.md:50 › Cena, název a platby se pouze označí „ROZHODNE SPONZOR“ › NÁLEZ (v rozporu se zdrojem) › Rozlišit převzetí již schválené pracovní konfigurace od nového rozhodnutí. HANDOFF rozhodnutí č. 2 dovoluje pracovní cenu 1 990 Kč pro prototyp; zakázané je vydávat ji za zamčenou launch cenu nebo ji samostatně rozhodnout.`

- `copy-studio.md:51–52 › Povinná závěrečná sekce a minimální délka 400 znaků › NÁLEZ (bez zdroje) › Odstranit tyto dodatečné podmínky PASS, případně je doložit samostatným schváleným zdrojem. Zdroj podporuje ověřitelná kritéria a secret-scan, nikoli tento délkový práh.`

- `copy-studio.md:42 › Povinné ukládání DRAFT pod V3 Deep Dive › NÁLEZ (bez zdroje) › Doložit určení výstupního rodiče. Dodané zdroje potvrzují, že V3 Deep Dive je rodičem HANDOFF, ale neurčují jej jako rodiče nových DRAFT výstupů. Do doložení označit cílového rodiče UNKNOWN.`

### vizual.md — PASS WITH REQUIRED PATCHES

- `vizual.md:35 › „Jen domény Claude, ChatGPT, Notion“ jako úplný seznam › NÁLEZ (bez zdroje) › Zachovat formulaci ORCH §2b: profil je přihlášen jen do nástrojů potřebných pro oddělení; uvedené služby jsou příklady. Konkrétní doménový allowlist není ve zdroji stanoven.`

- `vizual.md:35,58 › Neúplné podmínky browser adaptéru a ukončení po dvou pokusech pouze UNKNOWN › NÁLEZ (chybí) › Doplnit přihlášení a 2FA výhradně vlastníkem, zákaz osobních účtů a přístupů do e-mailu, banky a GitHub adminu. Po selhání doplnit kartu vlastníkovi a zákaz slepého opakování zápisu; samotné UNKNOWN není celý postup §2b.`

- `vizual.md:43 › Mobil 375 px jako obecné akceptační kritérium role › NÁLEZ (bez zdroje) › Omezit 375 px na experiment podle HANDOFF rozhodnutí č. 14 nebo na výslovné zadání zakázky. Zdroj nestanovuje tento viewport pro všechny budoucí vizuální zakázky.`

- `vizual.md:39,58 › Určený rodič DRAFT výstupu a konkrétní adaptér tars/orch/browser.ts › NÁLEZ (bez zdroje) › Doložit výstupního rodiče a existenci adaptéru, jinak označit UNKNOWN. Zdroj podporuje browser adaptér, Playwright a vyhrazený profil; tento soubor ani cílového rodiče nepotvrzuje.`

### vyvojar.md — FAIL

- `vyvojar.md:22 › run.sh nepředává --model a „dnes“ používá Opus › NÁLEZ (bez zdroje) › Označit skutečný implementační model UNKNOWN a doložit jej odkazem na ověřený kód nebo běh. Dodané zdroje stanovují Opus architekt → Sonnet implementace; tvrzení karty samo není důkazem odchylky.`

- `vyvojar.md:28 › Povinný invariant-sentinel.md v ai-chain-mezi-vami › NÁLEZ (chybí) › Doplnit jednoznačné mapování na dodaný ai-chain-sentinel.md. V kontrolované sadě není doloženo, že uvedená cesta obsahuje právě kontrolovaný seznam zákazů.`

- `vyvojar.md:38,42 › Commit a PR provádí orchestrátor; pevná větev tars/<order-id> a umístění worktree › NÁLEZ (bez zdroje) › Oddělit návrh implementace od zdrojových oprávnění a doložit jej. Zdroje požadují draft PR a vyhrazují merge vlastníkovi; přesné rozdělení commit/push operací, názvy větví a cesty worktree neurčují.`

- `vyvojar.md:49 › Akceptace, pokud STATUS „není FAIL“ › NÁLEZ (v rozporu se zdrojem) › Vyžadovat jednoznačný kladný výsledek příslušné kontroly. Podmínka „není FAIL“ připouští i neznámý, chybějící nebo jiný neúspěšný stav. ORCH §3 vyžaduje kontrolu s explicitním PASS/FIX/BLOCK před doručením.`

- `vyvojar.md:36 › Každá materiální změna ui_data_contract_v1 znamená CTE › NÁLEZ (v rozporu se zdrojem) › Doplnit časovou podmínku „po P1.7 / zamčení webu“. Build OS A2 i HANDOFF T3 ji výslovně uvádějí; karta ji v tomto pravidle vypouští.`

### brana.md — FAIL

- `brana.md:46–50 › Kontrolora jiné rodiny nahrazuje deterministické mapování › NÁLEZ (v rozporu se zdrojem) › Doplnit kontrolora Claude a checklist pro úplnost, doložení a správné použití verdiktu, s PASS/FIX/BLOCK. ORCH §2a bod 6 nestanovuje výjimku pro kartu kontrolora. Tím se nemění produktová pravomoc GPT Gate podle Build OS A6.`

- `brana.md:50 › Odlišnou rodinu kontrolovaného modelu „kód vynucuje“ › NÁLEZ (bez zdroje) › Zachovat pravidlo oddělení rodin, ale jeho skutečné technické vynucení označit UNKNOWN, dokud není doloženo implementací nebo testem.`

- `brana.md:38 › Povinný JSON a umístění check-r<N>.md › NÁLEZ (bez zdroje) › Označit jako návrh technického protokolu nebo doplnit jeho zdroj. Build OS P1.6 stanovuje čtyři verdikty, nikoli JSON serializaci a tuto cestu souboru.`

### _spolecne.md — PASS WITH REQUIRED PATCHES

Následující nálezy se dědí do všech pěti karet.

- `_spolecne.md:19 › Technické artefakty jsou specialistům NEDOSTUPNÉ › NÁLEZ (bez zdroje) › Rozlišit známé umístění od ověřené dostupnosti. HANDOFF potvrzuje ChatGPT Library, nikoli nemožnost přístupu orchestrátoru. Dostupnost je UNKNOWN; Build OS A5 navíc vyžaduje příslušný source intake před regionálním Roxy trackem.`

- `_spolecne.md:38 › Hero varianta A je pracovní copy › NÁLEZ (bez zdroje) › Doložit konkrétním artefaktem nebo označit UNKNOWN. HANDOFF potvrzuje otevřený milník 3.1, ale variantu A neidentifikuje; odkazovaný kufřík není mezi dodanými zdroji.`

- `_spolecne.md:39 › Absolutní zákaz placeného API › NÁLEZ (v rozporu se zdrojem) › Převzít podmínku ORCH §1: placené API = 0 bez výslovného GO vlastníka. Případné GO musí být doložené pro danou zakázku; HANDOFF rozhodnutí č. 18 dokládá konkrétní experimentální výjimku, nikoli obecné povolení.`

- `_spolecne.md:39 › Bezpečnostní souhrn bez zastavení při ALARM › NÁLEZ (chybí) › Doplnit požadavek běhu pod TARS-GUARD a zastavení supervizora při ALARM podle ORCH §6.`

### ai-chain-sentinel.md — FAIL

- `ai-chain-sentinel.md:28–30 › Jakýkoli výskyt názvu ui_data_contract automaticky blokuje › NÁLEZ (v rozporu se zdrojem) › Odlišit odkaz, validaci nebo použití kontraktu od jeho materiální změny. Build OS A2 vyžaduje CTE pro materiální změnu po P1.7; nezakazuje všechny soubory a řádky zmiňující kontrakt.`

- `ai-chain-sentinel.md:32–35 › Nový, smazaný nebo přejmenovaný page.tsx znamená změnu zamčeného screen-flow › NÁLEZ (bez zdroje) › Označit tento test pouze jako indikátor k posouzení. Zdroj zamyká zákaznické obrazovky a pořadí, nikoli souborovou strukturu. Naopak změna flow uvnitř existujícího souboru může tímto testem projít.`

- `ai-chain-sentinel.md:37–39 › Výskyt platebních názvů nebo identifikátorů je zakázaným rozhodnutím Sponzora › NÁLEZ (v rozporu se zdrojem) › Rozlišit volbu partnera a skutečnou transakci od přípravy shellu, testu či implementace podle zadání. Build OS P1.4 výslovně připouští platební shelly a P3 požaduje integraci.`

- `ai-chain-sentinel.md:41–43 › Jakákoli změna číselného řádku s cenou blokuje › NÁLEZ (v rozporu se zdrojem) › Rozlišit nové cenové rozhodnutí od použití již schválené pracovní ceny, konfigurace nebo testu. HANDOFF rozhodnutí č. 2 povoluje prototypovou cenu 1 990 Kč.`

- `ai-chain-sentinel.md:49–51 › Všechny SQL a migrační soubory jsou zakázané › NÁLEZ (v rozporu se zdrojem) › Oddělit přípravu migrace od jejího provedení. Build OS §4 zahrnuje migrace do odpovědnosti Executora; ORCH §6 zakazuje DB zápis, nikoli přípravu SQL v draft PR.`

- `ai-chain-sentinel.md:53–55 › Každá změna workflows, .claude nebo souboru tars-guard porušuje zákaz dispatch/oslabení ochran › NÁLEZ (bez zdroje) › Nezaměňovat editaci souboru za spuštění workflow nebo oslabení ochrany. Takto široký zákaz cest dodané zdroje nestanovují.`

- `ai-chain-sentinel.md:23–72 › Checklist pokrývá společné zákazy › NÁLEZ (chybí) › Doplnit návaznost na product/evidence/privacy/time-domain/ephemeris/PDF kontrakty a na celý seznam „Co se NESMÍ dělat znovu“. Neměřitelné položky výslovně předat GPT kontrolorovi; MECHANICAL_OK nesmí nahrazovat jejich kontrolu. Nyní chybí například opakování auditů, nová syntéza/V5, nový governance framework a předčasná plná automatizace reportu.`

- `ai-chain-sentinel.md:14–19,57–72,115 › Přesné STAV hodnoty, zákaz slov PASS/SAFE…, regexové prahy a blokace při nejistotě › NÁLEZ (bez zdroje) › Tyto dodatečné normy doložit schválenou specifikací sentinelu nebo je označit jako návrh. ORCH potvrzuje použití sentinelů a secret-scanu, ale tento konkrétní protokol a rozsah zákazů neobsahuje.`

## Ověřená tvrzení

- **Rozdělení pěti hlavních rolí a jejich základní pravomoci** odpovídá [Build OS §4](zdroje/buildos.md:68).
- **Copy: GPT → Claude; vizuál: Claude → GPT; vývoj: Claude → GPT** splňují deklarované oddělení rodin. Požadavek vychází z [ORCH §1 a §2a](zdroje/orch001.md:16). Skutečné obsazení běhů nebylo předmětem kontroly.
- **Marketingová, UX a factual/legal/privacy copy mají odlišné hranice; maximálně tři marketingové směry** odpovídají [Build OS P1.2](zdroje/buildos.md:299). Kreativní přepis oproti Fázi C dovoluje A2.
- **Čtyři produktové verdikty, fresh-context GPT a jedno review s patch confirmation** odpovídají [Build OS P1.6](zdroje/buildos.md:377).
- **Schema-valid fixtures, ui_data_contract_v1 a CTE po freeze** odpovídají [Build OS A2](zdroje/buildos.md:797).
- **Neúplný Gate Packet není READY FOR GATE** odpovídá [Build OS A4](zdroje/buildos.md:829).
- **Vybraný švestkový vizuál, EB Garamond + Jost a prototyp bez plateb s noindex** odpovídají [HANDOFF rozhodnutí č. 15](zdroje/handoff.md:319).
- **Zákazy opakovaných auditů, nové syntézy/V5, předčasné automatizace a nového governance frameworku** jsou správně převzaty do `_spolecne.md` z [HANDOFF „Co se NESMÍ dělat znovu“](zdroje/handoff.md:325).
- **První placený trh pouze ČR při podporovaných rodištích CZ + SK** odpovídá [HANDOFF, rozsah trhu](zdroje/handoff.md:295).

Evidence:
- Commit: N/A
- Branch: N/A
- DB: N/A
- GHA: N/A
- Artifact: 7 souborů `karty/`, 3 soubory `zdroje/`; odkazy na zdrojové řádky výše
- Deployment: N/A
- Timestamp: 2026-11-02 10:10:33 UTC
- Verified by: GPT, statické porovnání dodaných souborů
- Remaining risk: Implementace adapté­rů, skutečné modely běhů a obsah odkazovaných externích artefaktů nebyly ověřeny.