# H2 Buddy — Decision Log (ARCHITECTURE DECISION REQUIRED)

Formát záznamu: **ID, datum, slice, co je nejasné, varianty, doporučení Code, dopad na I1–I8, rozhodnutí, kdo rozhodl.**

Zápis vzniká, kdykoli nejasnost implementace hrozí změnou Product Spec, invariantů I1–I8 nebo Locked Architecture. Zastavuje se pouze dotčený slice; ostatní pokračuje. Zdroj pravdy pro produkt/architekturu zůstává Notion (uzamčené dokumenty) — tento log jen eviduje otevřené a uzavřené rozhodovací body vzniklé při stavbě.

---

### DEC-001

- **Datum:** 2026-09-02
- **Slice:** BUILD-01
- **Co je nejasné:** Technical Architecture v1.2 §3 předepisuje strom `src/app/honzik2/` a `src/h2/*`. Existující `muj-web` nemá `src/` adresář vůbec — `app/` je na rootu, `tsconfig.json` alias `@/*` míří na root, a Next.js nedovoluje mít současně kořenový `app/` i `src/app/` (build error). Doslovné dodržení stromu z architektury by rozbilo existující produkční web.
- **Varianty:**
  - (A) přesunout celý existující web do `src/` — velký refaktor mimo scope H2, riziko pro nesouvisející produkční stránky,
  - (B) umístit H2 kód na rootu (`app/api/h2/*`, `h2/*`) po vzoru existujících `lib/`, `config/` adresářů; `docs/h2/` beze změny,
  - (C) zablokovat BUILD-01 a čekat na rozhodnutí.
- **Doporučení Code:** (B) — funkčně identické architektuře, nulový dopad na chování/testy/AT, nulové riziko pro existující web.
- **Dopad na I1–I8:** žádný — čistě fyzické umístění souborů, ne chování systému.
- **Rozhodnutí:** (B) přijato Code jako mechanická implementační nutnost (Next.js jinak build odmítne). Needituje produkt ani architekturu, negeneruje GO požadavek.
- **Kdo rozhodl:** Code (mechanické rozhodnutí bez dopadu na produkt/I1–I8/architekturu; zaznamenáno pro auditovatelnost).

---

### DEC-002

- **Datum:** 2026-09-02
- **Slice:** zjištěno v BUILD-01, dotýká se BUILD-11 a BUILD-26
- **Co je nejasné:** Locked Architecture §1 a §29 přiřazují H2 Buddymu web namespace `/honzik2` včetně kořenové stránky „Today" (`src/app/honzik2/page.tsx`, u nás dle DEC-001 `app/honzik2/page.tsx`). Na `app/honzik2/page.tsx` už ale existuje živá stránka — Markétka intro pack / pitch landing page (git historie: `feat: add /honzik2 page` → `feat: rework /honzik2 dramaturgy and content` → `redesign: rework /honzik2 as warm editorial letter` → `fix: improve readability/contrast/typography` → `copy: rewrite /honzik2 text for a more personal, relational tone` → `copy: de-jargon /honzik2 text + move two sections`). Přepsání této route Today dashboardem by smazalo existující, opakovaně editovaný obsah bez jasného svolení.
- **Varianty:**
  - (A) přesunout pitch landing page na vedlejší cestu (např. `/honzik2/o-projektu` nebo `/o-honzikovi`) a uvolnit kořen `/honzik2` pro Today — nejméně invazivní, respektuje locked namespace,
  - (B) změnit web namespace H2 Buddy aplikace (např. `/honzik2/app` jako root produktu) a ponechat landing page na `/honzik2` — vyžaduje formální úpravu Locked Architecture §1,
  - (C) najet Today jako `/honzik2` a landing page archivovat/smazat.
- **Doporučení Code:** (A) — přesunout landing page, uvolnit kořen přesně podle Locked Architecture; nejméně invazivní a nemění uzamčený namespace.
- **Dopad na I1–I8:** žádný přímo; nepřímo ovlivňuje BUILD-11 (web delivery routing) a BUILD-26 (Today page).
- **Rozhodnutí:** (A). Landing page přesunuta na `/honzik2/o-projektu` (obsah beze změny, jen cesta), kořen `/honzik2` uvolněn pro budoucí Today. Locked Architecture se neotvírá. Dočasný `redirect` (`permanent: false`) z `/honzik2` na `/honzik2/o-projektu` v `next.config.ts`, aby nespadl případný existující externí odkaz (např. sdílený s Markétkou) — smazat ho, až BUILD-26 přidá `app/honzik2/page.tsx` pro Today. V repu nebyly nalezeny žádné interní odkazy na `/honzik2` mimo samotnou route (grep přes `app/`, `lib/`, `config/`, `scripts/`).
- **Kdo rozhodl:** Honzík — přímo, bez GPT brány (jde o produktové/UX rozhodnutí v jeho vlastní věci, ne o hodnotu/metodiku vyžadující kritickou oponenturu).

---

### DEC-003

- **Datum:** 2026-09-02
- **Slice:** BUILD-02 (Neon provisioning)
- **Co je nejasné:** Technical Architecture v1.2 §1 uzamyká Neon **Launch** plán se 7denním PITR pro h2-runtime i h2-control. Honzík založil oba projekty na **Free** plánu (History Retention 6 hodin) — Launch upgrade zatím nedává smysl platit, dokud do systému netečou reálná data. Zároveň hlavní větev obou projektů se v Neonu jmenuje `production` (Neon default), ne `main` — čistě nomenklatura, žádný dopad na chování.
- **Varianty:**
  - (A) zůstat na Free až do M1 a upgradovat na Launch těsně před prvním produkčním deploymentem, kdy vzniknou reálná uživatelská data vyžadující 7denní restore window,
  - (B) upgradovat na Launch hned, i když ještě žádná reálná data neexistují — zbytečná platba měsíce/týdny předem,
  - (C) zablokovat pokračování BUILD-02 provisioningu, dokud plán neodpovídá architektuře.
- **Doporučení Code:** (A) — 6hodinová PITR na prázdné/testovací databázi bez reálných uživatelských dat nenese architektonické riziko (I3/I6 historical integrity se týká dat, která ještě neexistují); upgrade na Launch je mechanický (Neon to umožňuje bez downtime) a nemá cenu platit dřív, než je co chránit.
- **Dopad na I1–I8:** žádný dnes — čistě rozpočtové rozhodnutí nad prázdnou infrastrukturou. Stal by se relevantním, pokud by se do produkce pustila reálná data před upgradem (proto je vázáno na M1 deploy gate, viz checklist).
- **Rozhodnutí:** (A). Free plán / 6h retention do M1. Upgrade na Launch (7denní PITR) je nový bod v M1 deploy gate checklistu — bez něj se M1 nesmí spustit, protože Definition of BUILT §1 vyžaduje 7denní restore window jako uzamčenou technickou pojistku, ne doporučení.
- **Kdo rozhodl:** Honzík — přímo, rozpočtové/timing rozhodnutí v jeho vlastní věci, bez GPT brány.

---

### DEC-004

- **Datum:** 2026-09-02
- **Slice:** BUILD-02 (KROK 5 role/RLS ověření, `h2/db/scripts/check-neon-roles.ts`)
- **Co je nejasné:** Není to nejasnost implementace, ale zaznamenané **známé riziko** vzniklé při KROK 5 — `pg` driver (`pg-connection-string`) hlásí deprecation warning: SSL módy `prefer`/`require`/`verify-ca` (naše connection stringy používají `sslmode=require`) se v `pg-connection-string@3.0.0` / `pg@9.0.0` přestanou chovat jako alias `verify-full` a přejdou na standardní libpq sémantiku se slabší zárukou (menší ochrana proti MITM, protože `require` samo o sobě neověřuje certifikát serveru).
- **Varianty:**
  - (A) neřešit teď — dnešní `pg@8.16.4` má současné (silnější) chování, riziko se aktivuje až budoucím major upgradem, který je samostatná, plánovaná akce,
  - (B) hned přepnout všechny connection stringy na `sslmode=verify-full` nebo `uselibpqcompat=true&sslmode=require`, aby budoucí upgrade byl no-op,
  - (C) ignorovat trvale a nezaznamenávat.
- **Doporučení Code:** (A) — dnešní chování je bezpečné, oprava (B) je nenákladná, ale nemá se dělat mimo řízený pg major upgrade (menší diff, jasný bod ke kontrole), aby se nezavlekla ad hoc.
- **Dopad na I1–I8:** žádný dnes. Stal by se relevantním až při pg major upgradu, pokud by se `sslmode` nezpřísnil zároveň — proto zápis sem, ne jen do poznámky.
- **Rozhodnutí:** (A). Neřešit teď. Při budoucím upgradu `pg`/`pg-connection-string` na verzi ≥ major s touto změnou explicitně zkontrolovat a případně přepnout `sslmode` na `verify-full` ve všech `h2/db/scripts/*` a budoucích BUILD-04+ DB klientech.
- **Kdo rozhodl:** Honzík — přímo, zaznamenat jako riziko pro budoucí pg upgrade, ne řešit teď.

---

### DEC-005

- **Datum:** 2026-09-02
- **Slice:** BUILD-03A (identity setup)
- **Co je nejasné:** Není to architektonická nejasnost, ale bezpečnostní incident vzniklý při stavbě. Code spustil `tail -5 .env.local`, aby ověřil bezpečný bod pro append — příkaz ale vypsal celý obsah posledních řádků včetně `H2_GOOGLE_CLIENT_SECRET` a `H2_AUTH_SECRET` v plaintextu do tool výstupu, který se stal součástí konverzačního kontextu (session transcript). `H2_GOOGLE_CLIENT_ID` se objevil taky, ale ten je podle OAuth designu veřejný identifikátor, ne secret.
- **Varianty:**
  - (A) rotovat `H2_GOOGLE_CLIENT_SECRET` (Google Cloud Console) a vygenerovat nový `H2_AUTH_SECRET` — podle Honzíkova vlastního globálního pravidla Secret Handling ("pokud se secret objeví kdekoli v chatu s modelem, považuj ho za kompromitovaný"),
  - (B) neuzavírat incident, dokud nedojde k rotaci,
  - (C) uzavřít bez rotace na základě vlastního posouzení rizika vlastníkem.
- **Doporučení Code:** (A) podle vlastního globálního pravidla — Code hodnotu neopakoval, ale vznikla v tool výstupu tohoto session transcriptu.
- **Dopad na I1–I8:** žádný — jde o operační bezpečnostní otázku mimo H2 Buddy produktová invarianty.
- **Rozhodnutí:** Honzík posoudil, že k reálné expozici nedošlo ("Nic neuniklo, hodnoty se v mé session neobjevily"), a incident uzavřel BEZ rotace. Nález: **"no exposure confirmed by owner"**. Code i nadále používá stejné `H2_GOOGLE_CLIENT_SECRET`/`H2_AUTH_SECRET`, které v `.env.local` už byly. Nové trvalé pravidlo pro Code: kontrola obsahu `.env` souborů výhradně přes `grep -oE '^[A-Z_]+='` (jen názvy klíčů), nikdy `cat`/`head`/`tail`/`less` na `.env*` soubory.
- **Kdo rozhodl:** Honzík — přímo, jde o jeho riziko a jeho infrastrukturu, uzavřel bez GPT brány.

---

### DEC-006

- **Datum:** 2026-09-02
- **Slice:** hotfix po BUILD-03A (PR #17) — zjištěno při ověřování `.env.migrate` v rámci produkční migrace 0012+0013
- **Co je nejasné:** Schéma (BUILD-02, migrace 0011) definuje roli `h2_migrator` jako určenou migrátorskou roli s `bypassrls`, oddělenou od `h2_runtime`/`h2_job`/`h2_blind_reader` podle principu nejmenších oprávnění. Té roli ale nikdy nebylo nastaveno heslo — `.env.migrate` (`H2_RUNTIME_MIGRATOR_DATABASE_URL`, `H2_CONTROL_MIGRATOR_DATABASE_URL`) proto od KROK 3 (BUILD-02 provisioning) reálně obsahuje connection stringy role `neondb_owner` (Neon výchozí superuser role obou projektů), ne `h2_migrator`. Všechny migrace včetně produkčního hotfixu 0012+0013 dosud běžely přes owner účet.
- **Varianty:**
  - (A) nastavit heslo pro `h2_migrator` (Neon SQL editor / connection string), přegenerovat `.env.migrate` přes `write-migrate-env.sh` tak, aby ukazoval na `h2_migrator`, a sladit realitu se schématem/architekturou,
  - (B) ponechat jako vědomou zdokumentovanou odchylku — `neondb_owner` má striktní superset oprávnění `h2_migrator` (včetně `bypassrls`), takže žádné migraci dnes nic nechybí a žádné funkční riziko nevzniká,
  - (C) zrušit roli `h2_migrator` ze schématu, pokud se nikdy reálně nepoužije.
- **Doporučení Code:** (A) před M1 deploy gate — migrace by měly běžet pod nejméně-privilegovanou určenou rolí, ne pod účtem vlastníka projektu (defense in depth); dnes to funguje, ale nemělo by to zůstat takhle natrvalo. (C) zahazuje užitečné oddělení rolí bez důvodu.
- **Dopad na I1–I8:** žádný přímý dnes (migrace fungují). Nepřímo oslabuje princip nejmenších oprávnění, který architektura pro migrátorské role předepisuje.
- **Rozhodnutí:** (B) pro teď — zaznamenat jako vědomou odchylku, funkčně bezpečnou. (A) přesunuto do M1 deploy gate checklistu jako otevřená položka (nastavení hesla = nový secret, vyžaduje Honzíkovo GO, až se bude řešit).
- **Kdo rozhodl:** Honzík — přímo, nahlásil nález a zadal zápis, řešení odloženo do M1 gate bez GPT brány (jde o operační/infra otázku, ne o produktovou hodnotu).

---

### DEC-007

- **Datum:** 2026-09-03
- **Slice:** BUILD-10 plán (Buddy runtime) — umístění Command Gate / Sovereignty Fast Lane (Technical Architecture v1.2 §8.1), retrofit do uzavřeného BUILD-04 (`h2/ingestion/ingest-message.ts`)
- **Co je nejasné:** §8.1 popisuje dvě různé věci pod jedním jménem: (1) ingress-level "exact-command detector", který běží **před vytvořením `message_processing_job`** a má control command zpracovat v oddělené high-priority lane, mimo běžnou frontu; (2) Command Gate jako první stage v §7.1's runtime pipeline, které běží **uvnitř** už claimnutého jobu, před ENTITY/INTENT/STANCE/reasoningem. Build Specification hodí "commands/sovereignty gate před reasoningem" jednoznačně pod BUILD-10, ale (1) architektonicky patří do BUILD-04's ingestní cesty (uzavřený blok), ne do BUILD-10's job processingu. Pokud se implementuje jen (2), explicitní PAUSE/STOP čeká za frontou přesně tak, jak §8.1 říká, že nesmí — riziko čtení proti I7 (Human Sovereignty) doslovnému znění.
- **Varianty (první kolo, Code):**
  - (A) jen (2) — Command Gate jako stage uvnitř BUILD-10's vlastního pipeline, nejmenší zásah, ale control command čeká ve frontě jako běžná zpráva,
  - (B) (2) **plus** retrofit BUILD-04's `ingestMessage()` o pre-check, který pro control command **vůbec nevytvoří** `message_processing_job` a rovnou zapíše `owner_control_epoch` bump — doslovnější podle §8.1, ale zásah do uzavřeného bloku,
  - (C) zablokovat BUILD-10 dokud se nerozhodne.
- **Doporučení Code (první kolo):** (B) — Honzík ho zprvu přijal jako svoje doporučení.
- **Adversarial review (GPT) — nalezená chyba ve variantě (B):** pokud se `message_processing_job` **vůbec nevytvoří** na základě deterministické klasifikace textu, pak chybná/hraniční klasifikace (např. text, co vypadá jako command, ale uživatel myslel něco jiného) **nevratně** připraví tu konkrétní zprávu o normální zpracování — zpráva zmizí z běžného lifecycle bez cesty zpět. To je přímo v rozporu s duchem I7 (sovereignty má chránit uživatele, ne ho nechat ztratit content kvůli chybné heuristice) a nebylo to v prvním kole vidět, dokud review neposoudilo failure mode klasifikace, ne jen happy path.
- **Rozhodnutí:** **C2** — control fast path jako **side effect ve STEJNÉ transakci**, nikdy jako exkluzivní routing. Nahrazuje (B), varianta (A) samotná je nedostatečná (viz "co je nejasné" výše).
  1. `ingestMessage()` zůstává jediným vstupem a **vždy** vytvoří `raw_event` i `message_processing_job` — i pro control command. Žádná zpráva nikdy nezmizí z lifecycle kvůli klasifikaci.
  2. Pokud text odpovídá přesné command syntaxi (`/stop`, `/pause`, `/resume` — trim, case-insensitive, celá zpráva, nic jiného), zavolá se navíc `bumpOwnerControlEpochWithClient()` ve **stejné** transakci jako insert `raw_event`u — dědí dedup (§4.1 `external_event_id` check) i per-owner ordering (advisory lock + sekvence), takže nevzniká druhá transakce ani crash window.
  3. Holé "stop"/"pause" v přirozené větě fast lane neřeší — to zůstává na Command Gate stage uvnitř BUILD-10 pipeline, kde je kontext a kde chybná klasifikace nemá destruktivní následek (zpráva se prostě zpracuje jako běžný text).
  4. `IGNORE` do fast lane nepatří (potřebuje cíl — co ignorovat) — zůstává výhradně v Command Gate stage.
  5. Job vzniklý z control commandu BUILD-10's pipeline zpracuje jako no-op s potvrzením — Command Gate re-detekuje stejnou deterministickou funkcí (`detectFastPathControlCommand()`), a shoda je strukturální důkaz, že epoch už byl bumpnutý při ingestu, takže pipeline nesmí bumpnout znovu (žádný nový sloupec/marker potřeba — dvě volání stejné čisté funkce nad stejným textem dají stejný výsledek).
- **Sub-invarianty k I7 (formulace GPT review, závazné pro BUILD-04/05/10 implementaci, zapsané zde protože Technical Architecture v Notionu zůstává uzamčená a neotevírá se kvůli implementační specifičnosti):**
  - **I7.1** control command nesmí záviset na dostupnosti conversation queue,
  - **I7.2** každý příchozí event má immutable raw záznam, včetně commandů,
  - **I7.3** control efekty jsou idempotentní podle `raw_event_id`,
  - **I7.4** control přechody mají deterministické per-owner pořadí,
  - **I7.5** každý běžící worker je fencovaný `owner_control_epoch` před jakýmkoli navenek viditelným efektem,
  - **I7.6** klasifikace commandu nesmí způsobit nevratnou ztrátu možnosti zprávu normálně zpracovat,
  - **I7.7** control intent má být protokolová struktura, ne odvozený z přirozeného jazyka.
- **Ověření I7.5 proti `commitJobResult()` (BUILD-05, na Honzíkovu žádost):** `commitJobResult()` atomicky kontroluje `lease_epoch` i `owner_control_epoch` v jedné `UPDATE ... WHERE` před insertem `responses` řádku (BUILD-05, AT-67/AT-71) — **pro jediný navenek viditelný efekt, který BUILD-10 samo přidává (zápis `responses` řádku), I7.5 platí beze změny kódu.** Sonnet API volání uvnitř `work()` běží před fencing checkem, ale to není "navenek viditelný efekt" ve smyslu I7 (nemění stav, který owner vidí) — je to náklad, ne akce; `usage_ledger`/`llm_runs` zápis (stejný "zavolalo se, zaplatilo se" vzor jako BUILD-07 AT-34) je proto v pořádku nechat nezávislý na fencing výsledku. **Reálná mezera, kterou jsem našel:** skutečné **odeslání** odpovědi (Telegram/web) je BUILD-11's `response_deliveries` mechanismus, který **dnes nemá žádnou `owner_control_epoch` kontrolu** — `response_deliveries` schéma (BUILD-02) nenese epoch sloupec vůbec. To znamená, že committed-ale-ještě-nedoručená odpověď se dnes doručí, i kdyby mezitím přišel PAUSE/STOP. Nejde o mezeru v BUILD-05/BUILD-10 (mimo jejich scope — delivery je jinam přiřazená stavba, co ještě neexistuje), ale je to reálná otevřená otázka pro BUILD-10/BUILD-11 rozhraní — zapsáno do BUILD-10-PLAN.md jako poznámka pro BUILD-11, neřeším ho teď vymýšlením BUILD-11 kódu předčasně.
- **Dopad na I1–I8:** I7 (Human Sovereignty) — přímo, tenhle zápis ho zpřesňuje na úroveň implementovatelnou napříč BUILD-04/05/10/11, aniž by se otevírala uzamčená Technical Architecture v Notionu.
- **Kdo rozhodl:** Honzík — po adversarial review přes GPT, který odhalil reálnou chybu v Code's původním doporučení (B). Rozhodnutí (C2) je Honzíkovo, GPT dodalo kritiku a sub-invarianty I7.1–I7.7, Code implementuje.

---

### DEC-008

- **Datum:** 2026-09-04
- **Slice:** BUILD-11 plán (Telegram + web delivery) — deadline/processing budget sémantika, zásah do doslovného znění uzamčené Technical Architecture v1.2 §4.2 a do uzavřeného BUILD-05 (`h2/processing/lease.ts` + `quarantine.ts`)
- **Co je nejasné:** §4.2 (ověřeno živě v Notionu, přesná citace): *"Při prvním přechodu do `PROCESSING` se nastaví `processing_deadline_at = first_started_at + 120 s`. Jeden logical user message má maximálně 3 processing pokusy v tomto okně... Retry nesmí posouvat původní deadline. Po překročení deadline nebo po třetím neúspěšném pokusu přechází user message automaticky do `QUARANTINED`."* Tohle jedno pole (`processing_deadline_at`, wall clock od prvního pokusu) dnes plní dvě různé role zároveň: (1) technický strop na to, kolik **skutečné práce** se do zprávy smí vložit, a (2) implicitně měří i čas, po který zpráva čeká na volný executor (backoff, infrastrukturní výpadek, restart procesu). Pokud mezi druhým a třetím pokusem vypadne infrastruktura (Vercel incident, Neon výpadek) na desítky sekund, tenhle čas se počítá do stejného 120s okna jako aktivní zpracování — přechodné infrastrukturní selhání se tak nerozeznatelně mísí s vyčerpaným retry budgetem. Nalezeno při adversarial gate review (GPT, 2026-09-04) nad BUILD-11 plánem v1 (Rozhodnutí 1, trigger), zapsáno sem, protože oprava mění chování doslovně popsané v uzamčené architektuře a sahá do uzavřeného BUILD-05 bloku (Pravidlo 3, BUILD-STATUS.md).
- **Varianty:**
  - (A) ponechat `processing_deadline_at` jako wall-clock od prvního pokusu beze změny — jednoduché, ale retry budget dál neměří retry, měří kvalitu scheduleru/infrastruktury,
  - (B) rozdělit dnešní jedno pole na explicitní role: lease expiry a backoff/`available_at` zůstávají wall clock (chrání proti mrtvému procesoru, resp. jsou záměrně čekání v reálném čase), `max_attempts = 3` beze změny, ale **processing budget** se měří jako kumulativní ACTIVE/stage čas (`charged_processing_ms` proti `processing_budget_ms`), ne jako wall-clock okno od prvního pokusu — a **stale age** (produktová expirace staré zprávy) se vyčleňuje jako zcela samostatné, budoucí pravidlo s vlastní hodnotou,
  - (C) zablokovat BUILD-11 dokud se nerozhodne.
- **Doporučení Code:** (B) — jediná varianta, která odstraňuje asymetrii "infrastrukturní výpadek = ztracený retry pokus". Vyžaduje účtovací pravidlo pro nejistý případ (ABANDONED_UNKNOWN po reapu vypršelého leasu): **nejvýše hard timeout právě běžící stage** (např. LLM volání 60s, `CALL_TIMEOUT_MS` v `h2/prompts/anthropic-adapter.ts`), **nikdy** doba, po kterou job ležel bez executoru — jinak by se stejná asymetrie vrátila zadními vrátky v reap větvi.
- **Dopad na I1–I8:** nedotýká se přímo I7 (Human Sovereignty, DEC-007) — lease/`owner_control_epoch` fencing (§4.3) zůstává beze změny, DEC-008 mění výhradně §4.2's deadline pole. Nepřímo posiluje spolehlivost retry mechanismu, na kterém I7's fencing i BUILD-05's karanténa (AT-54) stojí — nesprávně vyčerpaný retry budget kvůli infrastruktuře by vedl ke zbytečným karanténám a falešným "systém nefunguje" signálům.
- **Rozhodnutí:** (B), s doplněním z adversarial gate review (GPT, 2026-09-04): `after()` trigger (Rozhodnutí 1 BUILD-11-PLAN.md) smí zpracovávat frontu jen v mezích rozpočtu zbývajícího času do function timeoutu — kontrola PŘED každým dalším `claimNextJob()` voláním, ne jen jednou na začátku smyčky — protože bez tohohle by ohraničená deadline sémantika (B) mohla být obcházena neohraničenou `after()` smyčkou, co spotřebuje celý budget na jediné function invocation. Detailní schema/účtovací návrh viz `docs/h2/BUILD-11-PLAN.md` Rozhodnutí 9. Hodnota a tvar **stale age** pravidla zůstává výslovně Honzíkovo budoucí produktové rozhodnutí, ne součást tohohle zápisu.
- **Kdo rozhodl:** Honzík — po adversarial review přes GPT (2026-09-04), který nalezl asymetrii mezi wall-clock deadline a skutečným zpracovávaným časem v Code's BUILD-11 plánu v1. Rozhodnutí (B) je Honzíkovo; GPT dodalo nález a požadavek na ohraničenou `after()` smyčku, Code navrhuje schema/implementaci v BUILD-11-PLAN.md, čeká na Honzíkovo schválení konkrétní migrace před implementací.

---

### DEC-009

- **Datum:** 2026-09-23
- **Slice:** H2-IW — H2 Inbox Watcher (pilotní nástroj H2 Planning OS v0.3, **ne BUILD blok**)
- **Co je nejasné:** Vývoj H2 Buddy je pozastavený kvůli nákladové architektuře. Owner 23. 9. 2026 výslovně schválil jeden malý, nákladově minimální slice mimo BUILD-01..28: každou minutu zkontrolovat Todoist Doručené a novou položku roztřídit podle *H2 Planning OS v0.3* (Notion, uzamčeno 23. 9., pilot 23.–29. 9.) do Todoistu / Google Kalendáře + souhrn na Telegram. Watcher běží na Hetzner VPS (ne Vercel/Neon) a neotevírá Locked Architecture — Planning OS výslovně říká, že pilotní nástroje (Todoist, Google Kalendář) nejsou cílová architektura H2. Při plánování vzniklo 6 rozhodovacích bodů.
- **Varianty a rozhodnutí (ADR-1..6):**
  1. **Úložiště** — SQLite na VPS vs Postgres na VPS (suggest-db). **Rozhodnuto: SQLite** (`/var/lib/h2-inbox-watcher/state.db`) — izolace od crawler DB, žádný zásah do PG/pgbouncer, žádné riziko PG log gotchy (`log_parameter_max_length`).
  2. **Soukromí raw textu** — H2 Locked Architecture šifruje osobní data v Neon; watcher drží plaintext položek na sdíleném crawler VPS. **Rozhodnuto: pilotní výjimka** — samostatný systémový uživatel `h2iw`, stavový adresář 700, secrets `root:root 600` čtené jen systemd, `raw_text` se maže po 30 dnech, journald nese jen task id + typ, nikdy text. Pro cílovou architekturu H2 to precedens není.
  3. **Existující položky v Doručených při prvním startu** — **Rozhodnuto: baseline** — první běh označí všechny existující položky `BASELINE` (jen id, bez textu, bez LLM); zpracovávají se jen nové. Ruční `--process-existing` pro jednorázové zpracování.
  4. **Google OAuth** — v režimu *Testing* Google expiruje refresh token po 7 dnech (pilot má 7 dní). **Rozhodnuto:** nový OAuth client typu *Desktop* v existujícím GCP projektu H2, consent screen *In production* (neověřená app jen pro ownera), scope jen `calendar.events` + `calendar.calendarlist.readonly`. Loopback flow běží na Macu ownera, refresh token jde rourou přímo do env souboru na VPS, nikdy na obrazovku ani do chatu.
  5. **Telegram bot** — `H2_TELEGRAM_BOT_TOKEN` je bot H2 Buddyho; odpověď ownera na souhrn by šla webhookem do Buddy ingestu (= Sonnet volání). **Rozhodnuto:** použít jak zadáno, zpráva končí „na tuhle zprávu neodpovídej"; samostatný bot zůstává levná alternativa, pokud se to v pilotu ukáže jako problém.
  6. **Opravy po UNKNOWN** — položka s komentářem „❓" se znovu nezpracuje (idempotence podle task_id). **Rozhodnuto:** v pilotu neřešit, owner třídí ručně.
- **Upřesnění JSON kontraktu oproti zadání:** `labels[]`/`area_emoji` nahrazeny enumy `context` (`telefon|doma|venku`) a `area` (10 oblastí) — model nesmí vymyslet štítek ani emoji, mapování dělá kód (`h2iw/render.py`). `due_string` nahrazen ISO `due_date` (+ volitelný `due_time`) — model dostane tabulku dnů, kód nespoléhá na Todoist parser češtiny. EVENT bez času → UNKNOWN; EVENT/BLOCK bez konce → +60 min (uvedeno v souhrnu).
- **Nákladové pojistky:** prázdný běh = 1 Todoist GET, 0 LLM; model `claude-haiku-4-5` (1 USD / 5 USD za MTok), jedno volání na položku, strop 200 volání/den + 3 USD/měsíc, každé volání v `llm_calls` s cenou.
- **Dopad na I1–I8:** žádný — watcher nepíše do H2 Buddy dat, neběží v H2 runtime, nesahá na Neon ani Vercel. Jediný dotyk s H2 Buddy je sdílený Telegram bot token (ADR-5).
- **Kdo rozhodl:** Honzík — schválil slice 2026-09-23 a schválením plánu přijal doporučení Code u ADR-1..6 jako celek.
- **Doplněk 2026-09-23 (odpoledne), zadání ownera před GO-4:**
  - **Více záměrů v jednom vstupu → UNKNOWN**, komentář „❓ více věcí najednou — rozdělit"; nikdy se neklasifikuje jen první věc. Důvod: živý eval kolo 2 ukázal „vyzvednout léky … a v pátek v 17:00 kadeřník" → TASK „Vyzvednout léky" (druhá věc tiše vypadla). Dvě vrstvy: pole modelu `multiple_items` + deterministická pojistka `validate._check_nothing_dropped()` — když vstup obsahuje výslovný čas nebo den a přijatá klasifikace žádný čas / žádné datum nepoužije, výsledek je UNKNOWN. Vědomé falešně pozitivní případy (např. „zavolat mámě kvůli neděli") skončí bezpečně v Doručených s komentářem.
  - **Nový typ NOTE** (nápad / deník / informace o lidech / jiné — nic k vykonání, žádný termín): celý text do SQLite tabulky `notes` (`todoist_task_id` unique, `subtype` idea|journal|person|other, `raw_text`, `created_at`), Todoist položka se uzavře s komentářem „→ H2 poznámky", Telegram „📝 poznámka uložena". Žádný kalendář, žádný projekt H2. NOTE s jakýmkoli datem/časem = UNKNOWN.
  - **Dopad na ADR-2 (soukromí):** `notes.raw_text` se **nemaže** po 30 dnech (je to produkt typu NOTE, ne pomocná data) — deníkové a osobní poznámky tak leží v plaintextu na sdíleném crawler VPS trvale, dokud je owner nepřesune/nesmaže. Chráněno stejně jako zbytek stavu (user `h2iw`, adresář 700). Pro cílovou architekturu H2 to není precedens; přesun poznámek do H2 Buddy (šifrovaně, Neon) je budoucí rozhodnutí.
  - Živý eval (28 fixtur, z toho 6 NOTE a 3 víc-záměrové/negativní): **28/28**, 0,0776 USD.
- **Doplněk 2 — 2026-09-23 večer, zadání ownera z ostrého provozu:**
  - **INFO vs EVENT podle aktéra.** Ostrý provoz: „Dnes 19:30 přijede Markétka" skončilo jako EVENT v hlavním kalendáři. Pravidlo: podmětem je jiná osoba a Honzík není aktér („přijede", „bude pryč", „má akci", „odjíždí") → INFO; EVENT jen pro Honzíkův závazek („mám", „jdu", „jedu", „schůzka s…", lékař). Řešeno promptem (sémantika, deterministicky nerozhodnutelné), 8 nových fixtur.
  - **Nový typ COMMAND.** Pokyn ke změně existující věci („smaž", „přesuň", „přejmenuj", „zruš", „posuň", „hotovo") nesmí vzniknout jako TASK a watcher ho **neprovádí** (tvrdý zákaz úprav zůstává). Položka se uzavře s komentářem „→ příkaz, proveď v chatu", text jde šifrovaně do tabulky `commands`, Telegram „⚠️ příkaz ke změně neprovádím: … — napiš to do chatu s Claudem". Deterministická pojistka: text začínající rozkazovacím slovesem změny, který model neoznačil jako COMMAND → UNKNOWN (zůstává v Doručených, nic se nezapíše). Infinitiv („přesunout gauč") je běžný TASK.
  - **Šifrování `notes` + `commands`** AES-256-GCM, formát shodný s H2 Buddy `h2/crypto/envelope.ts` (iv 12 B | tag 16 B | ciphertext, bez AAD), sloupec `key_id`. Plaintext kopie v `items` (raw_text, raw_description, název v klasifikaci) se po šifrovaném zápisu maže; `secure_delete=on` + checkpoint + VACUUM, aby text nezůstal ve volných stránkách/WAL. Existující 1 poznámka se migruje automaticky při prvním startu nové verze. Test ověřuje, že DB soubory (vč. `-wal`) neobsahují čitelný text poznámky ani příkazu. **Nechráněno:** klíč leží na stejném VPS jako DB (chrání proti úniku souboru/zálohy, ne proti root přístupu na VPS); Todoist sám uzavřené položky dál drží v plaintextu.
  - **ARCHITECTURE DECISION REQUIRED — který klíč:** owner zadal `H2_ENCRYPTION_KEY_V1` (klíč H2 Buddy); ten v `.env.local` není (jen ve Vercelu), Code ho tedy nezkopíroval. Varianty: (A) samostatný `H2IW_ENCRYPTION_KEY` vygenerovaný přímo na VPS — hodnota nikdy neopustí server, kompromitace crawler VPS neodhalí šifrovací klíč H2 Buddy dat v Neonu; (B) owner vloží `H2_ENCRYPTION_KEY_V1` z Vercelu přes `set-secret.sh` — sdílená rodina klíčů usnadní pozdější přesun poznámek do H2 Buddy, ale rozšíří expozici hlavního klíče H2 na sdílený server. Kód podporuje obě (`key_id` `h2iw` / `h2-v1`). **Doporučení Code: (A).** **Rozhodnutí: (A)** — Honzík 2026-09-23. Klíč `H2IW_ENCRYPTION_KEY` vygenerován přímo na VPS (`openssl rand -base64 32 | set-secret.sh`), hodnota nikdy neopustila server ani se nevypsala; owner si ji uloží do správce hesel ze svého terminálu.
  - Živý eval (41 fixtur): **41/41**, 0,1219 USD.
- **Doplněk 3 — 2026-09-23, zadání ownera: COMMAND se předává Plánovači.**
  - COMMAND se už **neuzavírá**. Položka se beze změny (název i popis zůstávají původní) a otevřená přesune do Todoist projektu **„H2 · Příkazy"** (`6hcFGg26F99vCRpj`, založen Code přes Todoist MCP 2026-09-23, watcher ho hledá podle názvu a sám projekty nezakládá). Šifrovaný záznam do `commands` zůstává. Telegram: „➡️ předáno Plánovači: <text>". Plánovač = chat s Claudem.
  - COMMAND nově zahrnuje i **stavové aktualizace existujících úkolů** („hotovo…", „nedovolal jsem se…, čekám", „odlož…", „zavolal jsem…, auto bude v pátek"). Celé hlášení je jeden COMMAND i s „čekám"/„připomeň mi" — pole `multiple_items` se u COMMAND ignoruje (Plánovač dostane celý text). Nové WAITING („čekám až mi Petr pošle…") zůstává WAITING.
  - Pojistka rozšířena o slovesa `odlož`, `vyřízeno`, `nedovolal(a)`, `nestihl(a)`, `nezvládl(a)` na začátku textu — pokud je model neoznačí jako COMMAND, položka zůstane v Doručených s „❓".
  - **Tvrdý zákaz zůstává:** watcher příkaz neprovádí, na úkol, kterého se týká, nesahá; jediná operace je přesun samotné položky z Doručených do „H2 · Příkazy" (hlídá `_assert_in_inbox`).
  - Živý eval (47 fixtur, +6 stavových aktualizací vč. „Nedovolal jsem se Patrikovi, tak jsem mu napsal zprávu a čekám. Připomeň mi to zítra"): **47/47**, 0,1470 USD.
- **Doplněk 4 — 2026-09-23, chyba z provozu: nová věc s připomenutím není COMMAND.**
  - Provoz: „Dnes ve 20:15 vytáhnout imbus z auta a přidej připomenutí" → COMMAND (přesunuto do „H2 · Příkazy"). Pravidlo: nová věc + „připomeň mi / přidej připomenutí / upozorni mě" = **TASK**; COMMAND jen když text odkazuje na už existující věc (stavová aktualizace nebo změna). Řešeno promptem.
  - **Připomenutí:** TASK/WAITING s výslovným časem + žádost o připomenutí ve vstupu → Todoist reminder `relative`, `minute_offset 0`, `service push` (`POST /api/v1/reminders`, endpoint ověřen živě 2026-09-23 sondou s neexistujícím task id — nic nezapsáno). Bez času („připomeň mi zítra") jen datum, žádný reminder. Rozhoduje deterministicky `REMINDER_RE` nad textem + přítomnost času (ne model). Nový zápis `add_reminder` hlídá stejný `_assert_in_inbox` jako ostatní zápisy; pořadí update → reminder → move.
  - Známé omezení: pád procesu mezi úspěšným POST reminderu a zápisem kroku může po restartu vytvořit druhý reminder (Todoist reminder nemá idempotentní klíč).
  - Živý eval (53 fixtur, +6 připomenutí): **53/53**, 0,1731 USD.
- **Doplněk 5 — 2026-09-23, H2 Planning OS v0.4 (kalendář = časová mapa života, Notion §2–3).**
  - EVENT a BLOCK mají pole `life` ∈ {povinnost, fokus, regenerace, lide, domov, zazitky}; rozhoduje, co Honzík v tom čase **dělá**. Kalendáře podle názvu (calendarList, cache na běh): povinnost → hlavní `honza.bindr@gmail.com`, ostatní „H2 · Fokus" (dříve „H2 · Bloky"), „H2 · Regenerace", „H2 · Lidé", „H2 · Domov", „H2 · Zážitky"; INFO beze změny („H2 · Info"). Chybějící `life` → EVENT = povinnost, BLOCK = fokus (poznámka v souhrnu).
  - Všechny kalendáře života BUSY; připomenutí 60 min jen u povinnosti, jinak 15 min. INFO FREE bez upozornění.
  - **Chybějící kalendář** → cílový kalendář se hledá PŘED jakýmkoli zápisem; položka zůstane nedotčená v Doručených s „❓ chybí kalendář X", Telegram to uvede. Nikdy fallback do hlavního kalendáře.
  - Telegram: prefix barvy + název kalendáře (🔴 Hlavní, 🟣 H2 · Fokus, 🌿 H2 · Regenerace, 🩷 H2 · Lidé, 🟤 H2 · Domov, 🟡 H2 · Zážitky, ⚪ H2 · Info).
  - Nálezy z evalu během práce: (1) „pivo s Petrem" → zážitky místo lidé — prompt upřesněn (čas s konkrétním člověkem = lidé i v hospodě); (2) **„v pátek" → 2. 10. místo 25. 9.** — eval dřív data nekontroloval; teď porovnává datum proti referenci a prompt má pravidlo „nejbližší takový den"; (3) „účetní se neozvala, zkusím znovu" → jednou WAITING místo COMMAND — nová pojistka `STATUS_REPORT_RE` (minulé negativní hlášení kdekoli v textu → nikdy nový TASK/WAITING).
  - Živý eval (66 fixtur, každý druh času ≥ 2, typ + druh času + datum): **66/66**, 0,2725 USD (předchozí kola této změny 65/66, 66/66 s chybným datem, 65/66).
  - **Deploy čeká** na potvrzení ownera, že kalendáře existují (vytváří GPT). → Nasazeno 2026-09-23 19:36 UTC po „kalendáře hotové".
- **Doplněk 6 — 2026-09-23, časový rozsah = BLOCK.** Diktát s rozsahem („od X do Y", „10–12", „9 až 10") u vlastní činnosti je BLOCK do kalendáře podle `life` („Zítra od 10 do 11 volám Patrikovi" = 🟣 H2 · Fokus); TASK s časem jen při jednom časovém bodu („v 10 zavolat Patrikovi"). Prompt + deterministická pojistka `is_time_range()`: TASK/WAITING nad textem s rozsahem → ❓ v Doručených (konec rozsahu by se ztratil). „od X do Y" platí vždy; tvar s pomlčkou/„až" jen s dnem v textu nebo s minutami, aby „koupit 2-3 žárovky" nebyl rozsah (známý zbytkový případ: „zítra koupit 2-3 žárovky" → ❓). Živý eval 69 fixtur: **69/69**, 0,2925 USD.
- **Doplněk 7 — 2026-09-23, TASK dostává druh času + odhad délky.**
  - Každý nový TASK (a úkol vzniklý z BLOCK) dostane štítek podle `life` stejnou logikou jako EVENT/BLOCK: `povinnost` / `fokus` / `regenerace` / `lide` / `domov` / `zazitky` (bez diakritiky), vedle kontextových `telefon`/`doma`/`venku`; WAITING má dál jen `ceka`. Chybějící `life` u TASK → `fokus` (poznámka v souhrnu). Štítky založil Code přes Todoist MCP 2026-09-23 (povinnost red, fokus violet, regenerace lime_green, lide magenta, domov taupe, zazitky yellow). Pozn.: `zazitky` má stejnou barvu (yellow) jako dosavadní `focus`.
  - Štítek ⭐ top 1–3 se jmenuje **`top`** (dřív `focus`); watcher ho nikdy nepřiděluje (`NEVER_ASSIGNED_LABELS` = top, focus), existující štítky na položce zachová. Přejmenování v Todoistu dělá Plánovač.
  - Odhad délky `duration_min` ∈ {15, 30, 60, 120} → Todoist `duration` + `duration_unit=minute`. Pokud Todoist odhad odmítne (400, např. bez data), úkol se zapíše bez něj a souhrn to uvede — odhad nikdy nezablokuje úkol. Chování Todoistu u `duration` bez data zatím nebylo ověřeno živě.
  - Telegram: řádek TASK začíná barvou druhu času („🟤 TASK Vyčistit pračku … ⏱ 30 min").
  - Stávající úkoly se nemění (doplní Plánovač).
  - Eval: 12 nových TASK fixtur (každý druh času; hraniční „najít sedačku online" = fokus, „odnést sedačku" = domov, „objednat se k lékaři" = povinnost). Kolo 1: 78/81 (regrese „schůzka s Honzou z Optimia" → fokus, „domluvit s Petrem pivo" → lide, „večer s Markétkou" → BLOCK bez času = ❓); prompt upřesněn; kolo 2: **81/81**, 0,3777 USD.
- **Doplněk 8 — 2026-09-23, sladění s Planning OS v0.5 (porada).** Štítky, délky a `top` beze změny.
  - Prompt: čas s konkrétním člověkem = lide i výlet/hospoda; „Mám kluky" = lide (ne INFO); jízdy autem a pochůzky = domov; vymyslet/objednat/prodat/najít online = fokus, fyzické provedení = domov; čas bez dne = dnes (resp. zítra, pokud minul); „napadlo mě" = NOTE; úkol bez data je v pořádku.
  - Deterministické pojistky (`_check_v05_rules`): „cestou" + EVENT/BLOCK → ❓; „podívat se / nezapomenout / připomeň / upozorni" + EVENT/BLOCK/INFO → ❓; rituál/oběd (cigaretka, kafe, oběd) jako EVENT/BLOCK bez `lide` nebo jako TASK `regenerace` → ❓ („rituál spravuje Plánovač"; „oběd s tátou" = lide projde); „s/se + jméno", „s dětmi/tátou/…", „mám kluky" přepíše `zazitky`/`regenerace` na `lide` (jen barva, s poznámkou).
  - **Připomenutí:** každý TASK/WAITING s časem má vždy reminder relative 0 min (už ne jen při slově „připomeň"); úkol vzniklý z BLOCK dostane termín = začátek bloku a reminder. Ověřeno testem přes všechny tři cesty (TASK s časem, TASK „cestou", BLOCK).
  - **Celodenní EVENT** pro činnost s lidmi / zážitek bez času („v pondělí jedu se Sašenkou na houby" → 🩷 celý den, BUSY, bez popup upozornění — upozornění N minut před půlnocí nedává smysl). Povinnost bez času zůstává UNKNOWN. Vymyšlený čas u celodenní položky se zahodí, pokud vstup žádný čas neobsahuje.
  - Eval: +11 fixtur (všech 7 ze zadání + „oběd s tátou" = lide, „v sobotu ve 12 oběd" = ❓, „prodat kolo" = fokus, „nezapomenout vrátit knihu" = TASK domov). Kola: 90/92 → 89/92 (kolísání lide/zazitky, nákupní seznam → UNKNOWN) → po pojistce `WITH_PERSON_RE` a upřesnění promptu **92/92**, 0,4782 USD.
- **Doplněk 9 — 2026-09-23, dorovnání na Planning OS v0.6 (§1, §3, §4, §6).**
  - §3: 🚗 není kategorie — pravidlo v8 „jízdy a pochůzky = domov" odstraněno z promptu; `life` jízdy určuje účel (k lékaři/úřad = povinnost, na barák pracovat = domov, výlet = zazitky, s člověkem lide). Pojistka pro 🚗 v8 neexistovala (jen prompt).
  - §4: každá nadiktovaná EVENT mimo hlavní kalendář (i celodenní) má v popisu první řádek „📌 pevné"; povinnost (hlavní) ani BLOCK ne. Telegram řádek nese 📌.
  - §6: popis BLOCK = odkaz na vzniklý úkol (`Úkol: https://app.todoist.com/app/task/<id>`), ověřeno testem včetně toho, že odkazovaný úkol je ten přesunutý do H2.
  - §1: test vlastnictví — běh přes všechny fixtury se staršími úkoly v H2 / H2 · Příkazy a existující událostí v kalendáři: žádné volání Todoistu na jiné než Doručené id, existující úkoly i událost beze změny, každý zápis do kalendáře je insert nového id.
  - **Nález při evalu: Anthropic kredit došel** (400 „credit balance is too low", 2026-09-23 ~21:43 UTC; eval stihl 32/96 bez odchylky). Watcher by novou položku po 3 pokusech natrvalo označil ❓. Nové chování: billing chyba = položka čeká v Doručených (`SKIPPED_CAP`, `LLM_UNAVAILABLE`), pokus se nepočítá, Telegram jednou denně, po obnovení kreditu se zpracuje sama (test).
- **Doplněk 10 — 2026-09-24, náklady: prompt caching, Batches eval, cena ze skutečného usage.**
  - **Caching:** statická část (systémový prompt + schéma výstupu) má `cache_control: ephemeral` (5 min) — v provozu i v evalu (`request_params()` je sdílené). Haiku 4.5 cachuje až od 4096 tokenů; změřeno `count_tokens`: systémový prompt ~3 327 + schéma ~1 065 → cachovaný prefix **4 392 tokenů** (nad limitem). Ověřeno: 1. volání `cache_creation_input_tokens 4392`, 2. volání `cache_read_input_tokens 4392`.
  - **Ekonomika v provozu:** zápis 1,25×, čtení 0,1× ceny vstupu. Vyplatí se, když aspoň ~1 z 5 volání trefí cache do 5 minut od předchozího — typicky víc položek nadiktovaných za sebou (jeden běh je zpracuje za sebou). Osamocená položka stojí o ~0,001 USD víc než bez cache. Sledovatelné v `h2iw.status` (sloupce cache zápis/čtení, ledger `llm_calls` nově `cache_write_tokens`, `cache_read_tokens`; cena počítaná ze všech čtyř složek).
  - **Eval přes Message Batches API** (50 %): režimy `--changed` (jen případy změněné proti `origin/main`), `--full` (celá sada, jen před nasazením), `--ids`; jeden synchronní dotaz napřed zapíše cache. Každé hlášení uvádí cenu kola ze skutečného usage (vstup, cache zápis, cache čtení, výstup, batch sleva) a srovnání „bez cache a batche".
  - Ověřovací malé kolo (5 případů): batch dotazy cache jen zapisovaly (0 čtení) → 0,0140 USD. **Plné kolo (96): 96/96, 95 batch dotazů všechny četly cache, 0,0625 USD (bez cache a batche 0,5033 USD).**
  - **Proč hlášení uváděla ~1,4 USD místo ~4,5 USD z Console:** cena každého jednotlivého kola byla spočtená správně (sedí se ceníkem Haiku 4.5 1/5 USD za MTok), ale souhrn „všechna kola dnes dohromady asi 1,4 USD" v hlášení k v8 byl **chybný součet** — nesečetl jsem všechna kola. Skutečný součet 16 celých kol evalu 23. 9. = **4,13 USD** (+ přerušené kolo v9 32 volání + provoz ~0,06 USD), vstup ~3,7 M tokenů, ~1 000 volání (Console: ~3,87 M, ~840 volání — rozdíl v počtu volání nedokážu z dostupných dat doložit, pravděpodobně jiná hranice dne v Console). Příčina výše: každá změna spouštěla plné kolo rostoucí sady (20 → 92 případů) za plnou cenu a bez cache. Nápravou je `--changed` + batch + cache.
