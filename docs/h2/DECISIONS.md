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
