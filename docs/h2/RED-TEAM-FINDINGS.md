# H2 Buddy — Red Team nálezy (2026-09-04)

Zápis nálezů z red-team review, obsah dodal Honzík 2026-09-04. **Zapsáno, neimplementováno** — žádný z bodů níže nemění kód v tomhle repu. Účel: aby tyhle nálezy nezmizely z dohledu, až se za pár sliců budou řešit BUILD-12/BUILD-23.

Formát: nález → kam patří / proč teď ne → co bylo ověřeno proti kódu (ne jen tvrzeno).

---

## 1. Kontrakt "LLM navrhuje význam, kód rozhoduje o stavu" → BUILD-12

**Nález:** čtyři konkrétní povrchy, kde LLM output nesmí být přímo autoritativní: canonical timestamp, `entity_id` (identita entity, ne jen její popis), dedup rozhodnutí a state transitions. Model smí klasifikovat/navrhnout, ale finální zápis dělá deterministický kód — stejný princip jako AT-50 ("žádný LLM output není přímo autoritativním DB state transition bez deterministic validation"), tady rozšířený na čtyři jmenovité povrchy, aby se nezapomnělo na entity resolution a dedup, které AT-50 dnes explicitně nejmenuje.

**Kam patří:** BUILD-12 (Reconsideration / entity resolution — viz BUILD-10-PLAN.md "Co zůstává mimo scope", `operational_extractions` už dnes ukládá jen advisory data přes `resolveMessageEntities()`, žádný z těch čtyř povrchů zatím nemá vlastní zápisovou logiku postavenou).

**Proč teď ne:** BUILD-12 dosud nezačalo — psát kontrakt do kódu, který ještě neexistuje, by bylo hádání tvaru dopředu.

---

## 2. Trivial-turn gate před Haiku extrakcí → BUILD-12 nebo později

**Nález:** než se zavolá `extractOperationalCandidates()` (OPERATIONAL_EXTRACTION, Haiku), měl by běžet deterministický gate, co u triviálních zpráv (holé potvrzení, emoji, jednoslovné "ok"/"díky") vůbec nepustí zprávu na extrakci — **exact whitelist, ne fuzzy match** (stejná disciplína jako Command Gate, DEC-007 I7.7: "control intent má být protokolová struktura, ne odvozený z přirozeného jazyka" — trivial-turn klasifikace nesmí hádat význam běžné věty stejně jako command detekce nesmí). **Kritické pravidlo:** tenhle gate nikdy nesmí zafungovat, dokud systém čeká na potvrzení od uživatele (např. uprostřed multi-turn potvrzovacího flow) — krátká odpověď v tu chvíli NENÍ triviální, i když vypadá stejně jako běžné "ok".

**Kam patří:** BUILD-12 nebo později — potřebuje stejnou "protokolová struktura, ne NLP hádání" disciplínu jako Command Gate, a musí vědět o owner's pending-confirmation stavu, který dnes (BUILD-10) není nikde explicitně trackovaný jako vlastní stav.

**Proč teď ne:** `extractOperationalCandidates()` dnes nemá v produkci žádného volajícího vůbec (BUILD-STATUS.md, BUILD-10 evidence blok) — psát gate před voláním, které se samo ještě neděje, je předčasné.

---

## 3. Žádné LLM ve scheduleru, zálohách, rotaci klíčů, deletion ledgeru → potvrzení stávajícího návrhu

**Nález:** scheduler (BUILD-23), zálohy, rotace šifrovacích klíčů a deletion ledger (BUILD-20) nesmí nikde volat LLM — jsou to čistě deterministické/auditovatelné cesty, kde nedeterminismus modelu nemá co dělat.

**Toto NENÍ nové rozhodnutí — je to potvrzení stávajícího návrhu**, ověřené proti kódu (2026-09-04):
- `grep -rln "callAnthropicModel|callModel" h2/` → jen dva volající existují v celém repu: `h2/buddy/generate-response.ts` (BUDDY_RESPONSE) a `h2/extraction/operational-extraction.ts` (OPERATIONAL_EXTRACTION). Žádný jiný modul LLM nevolá.
- `h2/db/control-schema/deletion-ledger.ts` (BUILD-20, append-only, `h2-control` databáze) — čistě HMAC/timestamp/manifest_version sloupce, žádná LLM závislost.
- Scheduler (`job_definitions`/`job_runs`, migrace `0009_proactivity_and_jobs.sql`) — BUILD-23 samo ještě nemá žádnou implementaci mimo schéma, natožpak LLM volání.

**Kam patří:** nikam — je to hlídané pravidlo pro budoucí BUILD-20/23 implementaci, ne otevřený úkol. Zapsáno, aby review těchhle bloků mělo na co odkázat.

---

## 4. Zapier/Make/n8n do core cesty nepatří — ZAMÍTNUTO

**Nález:** no-code automation platformy (Zapier, Make, n8n) byly zvažované jako možný mechanismus někde v message-processing cestě, ale **zamítnuty** — osobní data (obsah zpráv, entity, odpovědi Buddyho) by tekly přes třetí stranu bez kontroly nad tím, kde se ukládají/logují/replikují. To je přímo v rozporu s H2 Buddy's privacy-first designem (encryption at rest, RLS, owner-scoped čtení).

**Stav:** trvalé zamítnutí, ne odložené rozhodnutí — zapsáno jako Pravidlo 11 v [BUILD-STATUS.md](./BUILD-STATUS.md#pravidla), aby to žádný budoucí BUILD blok nezkusil zavést jako "rychlé řešení".

---

## 5. Scheduler ledger už existuje — otevřená zůstává jen volba budíku pro BUILD-23

**Nález:** `job_definitions.next_due_at` a `job_runs` s unique constraintem `(job_name, scheduled_for)` už v schématu existují.

**Ověřeno proti kódu (2026-09-04):**
```
h2/db/migrations/0009_proactivity_and_jobs.sql:27:create table job_definitions (
h2/db/migrations/0009_proactivity_and_jobs.sql:30:  next_due_at timestamptz null,
h2/db/migrations/0009_proactivity_and_jobs.sql:38:create table job_runs (
h2/db/migrations/0009_proactivity_and_jobs.sql:51:  constraint job_runs_job_name_scheduled_for_unique unique (job_name, scheduled_for)
```
Ledger (co běžet má a kdy, a záznam že proběhlo) je tedy hotový už z BUILD-02/BUILD-09 éry migrací.

**Co zůstává otevřené pro BUILD-23:** volba **budíku** — mechanismus, co scheduler skutečně probudí/spustí v daný čas (pg_cron → Edge Function → GitHub workflow_dispatch, po vzoru suggest-db `trigger-google-crawl`? Vercel Cron? něco jiného?). Ledger existuci `next_due_at` sloupce neřeší, kdo se na něj dívá a kdy.

**Kam patří:** BUILD-23, jako první rozhodnutí toho slicu.

---

## Zdroje pravdy

Tenhle soubor je jen zápis red-team review, ne ARCHITECTURE DECISION REQUIRED log — žádný z bodů 1/2/5 neblokuje žádný dnešní slice (BUILD-12/BUILD-23 ještě nezačaly), bod 3 je potvrzení beze změny a bod 4 je uzavřené zamítnutí. Pokud některý bod při stavbě BUILD-12/BUILD-20/BUILD-23 narazí na skutečnou nejasnost, patří to rozhodnutí do [DECISIONS.md](./DECISIONS.md), ne sem.
