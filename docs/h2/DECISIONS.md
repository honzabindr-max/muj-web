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
