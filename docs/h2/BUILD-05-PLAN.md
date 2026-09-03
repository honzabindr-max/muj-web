# BUILD-05 — Queue, lease, fencing, quarantine — schválený plán

**Status:** SCHVÁLENO Honzíkem 2026-09-03, čeká na implementaci.
**Účel tohoto souboru:** Honzíkův kontext byl na půlce v okamžiku schválení a
session se čistí. Tenhle dokument je zdroj pravdy pro START implementace —
spolu s `docs/h2/BUILD-STATUS.md` a `docs/h2/DECISIONS.md` stačí k
rehydrataci bez ztráty rozhodnutí z plánovací konverzace. Nezmenšovat,
neotvírat znovu bez nové konverzace s Honzíkem — je to schválený plán, ne
návrh k diskuzi.

## Rozsah (z Build Specification v1.0 §2, Technical Architecture v1.2 §4)

Nízkoúrovňový mechanismus zpracování fronty nad už existujícím schématem
(BUILD-02, migrace `0002_messaging.sql`): owner lease s monotónním
`lease_epoch`, `owner_control_epoch`, zpracování striktně podle
`input_sequence`, text deadline 120 s / voice deadline 300 s, retry/backoff,
automatická karanténa s právě jednou notifikací, karanténní mezera neblokuje
další input. Pozdní processor s neaktuálním epoch nesmí commitnout
response/action/delivery.

**DoD:** AT-03, AT-06, AT-07, AT-54, AT-67, AT-71 (Build Specification §6
ownership matrix).

**Žádná nová migrace, žádné nové env proměnné, žádné nové credentials.**
`message_processing_jobs`/`owner_processing_state` (migrace `0002`) už mají
všechny potřebné sloupce (`lease_epoch`, `owner_control_epoch`,
`processing_deadline_at`, `quarantined_at`, `quarantine_reason`,
`quarantine_notice_sent_at`, `attempt_count`, `available_at`...). `incidents`
(migrace `0009_proactivity_and_jobs.sql`) nemá CHECK omezení na
`incident_type`, takže nový typ hodnoty nevyžaduje migraci. `h2_runtime` má
plný GRANT (select/insert/update/delete) na obě tabulky i na `incidents`
(migrace `0011_roles_and_rls.sql`).

## Rozhodnutí 1: role `h2_runtime`, ne `h2_job`

Zvažováno `h2_job` (§31.5 architektury ho jmenuje pro "background operace v
přesném allowlistu"), ale **`h2_job` nemá GRANT na `responses`** — migrace
`0011_roles_and_rls.sql` řádky 99-105 grantují `h2_job` jen na
`job_definitions, job_runs, incidents, message_processing_jobs,
owner_processing_state, proactivity_events, calendar_event_cache,
backup_runs, encryption_rotation_runs, usage_ledger`. `responses` a
`response_deliveries` jsou v `owner_scoped_tables` poli (řádky 50-52), který
grantuje **jen** `h2_runtime`.

Jediná role, co dnes smí commitnout response, je tedy `h2_runtime`. To sedí i
s architekturou §4.2 ("`after()` nebo ekvivalentní post-response execution
smí okamžitě proces spustit jako latency optimization") — primární
zpracování běží ve stejném requestu jako ingest (Telegram/web webhook), tedy
pod stejnou rolí `h2_runtime`, kterou už používá `ingestMessage()` (BUILD-04).

`h2_job` zůstává nepoužitá až do BUILD-23 (Scheduler, jobs, health) — to je
mechanická poznámka využívající už existující GRANT, ne
`ARCHITECTURE DECISION REQUIRED` (nemění produkt ani architekturu).

## Rozhodnutí 2: žádný produkční trigger v tomhle slicu

`after()` (Next.js, zmíněný přímo v §4.2 architektury) by šel zapojit do
Telegram/web webhook route (BUILD-04) hned po ACK. Ale BUILD-05 nemá co
reálně vykonat — Sonnet adapter je BUILD-07 (Prompt Registry & model
adapter), skutečná Buddy inteligence je BUILD-10 (Buddy runtime). Zapojení
`after()` teď by znamenalo, že KAŽDÁ reálná Telegram/web zpráva na produkci
vytvoří **placeholder/stub response** v `responses` tabulce — to je horší
než žádný trigger, je to tichý datový dluh (BUILD-10 by pak musela řešit,
co s haldou fake responses v produkční DB).

**Rozhodnutí:** BUILD-05 dodá a otestuje mechanismus výhradně přes přímé
volání funkcí proti reálné (test) DB — žádné HTTP, žádný scheduler, žádné
zapojení do produkčního requestu. Reálné zapojení triggeru patří:
- primární cesta (`after()` po ACK) → **BUILD-10** (Buddy runtime), až bude
  co spouštět,
- recovery/catch-up cesta (scheduler pro zaseknuté/zapomenuté joby) →
  **BUILD-23** (Scheduler, jobs, health).

Honzík souhlasil explicitně: "placeholder response v produkci by byl horší
než žádný trigger."

## Rozhodnutí 3: seam pro quarantine notifikaci → BUILD-11

Doručovací kanál (BUILD-11 — Telegram + web delivery) neexistuje v době
BUILD-05, takže **žádná zpráva fyzicky nikam neodejde**. Existující schéma
už má potřebný seam, žádné nové sloupce:

- **`message_processing_jobs.quarantine_notice_sent_at`** — user-facing
  "quarantine notice" marker, per-job. Matchuje architekturou zmíněný
  idempotency key `quarantine_notice:{job_id}` (§4.2). BUILD-05 ho nastaví
  atomicky přes `UPDATE ... WHERE quarantine_notice_sent_at IS NULL` VE
  STEJNÉ transakci jako přechod do `QUARANTINED` — `rowCount` odpovědi
  potvrzuje, jestli šlo o první (a tedy jediný) zápis. Exactly-once je
  garantované na DB úrovni (WHERE podmínka + transakce), ne jen aplikační
  logikou.
- **`incidents` řádek** (`incident_type = 'MESSAGE_QUARANTINED'`,
  `severity = 'WARNING'`) — operační/health záznam, oddělený od notice
  markeru. `incidents.notified_at` zůstává `NULL` — to je BUILD-23's
  mechanismus (admin/health alert), ne BUILD-05.

**Sémantika `quarantine_notice_sent_at` v BUILD-05 je "systém se rozhodl
přesně jednou, že notice existuje", NE "Honzíkovi fakticky přišla zpráva".**

**Otevřený problém pro BUILD-11, zapsaný teď, aby nebyl objeven pozdě:**
`response_deliveries.response_id` je dnes `NOT NULL` (schema `h2/db/schema/
core.ts`, migrace `0002_messaging.sql`) — ale quarantined zpráva **nemá**
žádný `responses` řádek (proto je quarantined — zpracování nikdy
neuspělo). BUILD-11 tedy nemůže rovnou použít `response_deliveries` pro
doručení quarantine notice tak, jak je dnes navržená. Bude si muset vybrat
mezi (a) rozšířit `response_deliveries.response_id` na nullable + přidat
sloupec/typ rozlišující "je to response, nebo systémová notice", nebo (b)
samostatná tabulka/mechanismus pro systémové notice. **Tohle rozhodnutí
patří BUILD-11, ne BUILD-05** — tady je jen zapsané jako známý seam, ne
vyřešené.

## Rozhodnutí 4: jak se testuje fencing (jádro slicu)

Stejný vzor jako race test owner enrollmentu v BUILD-03A
(`h2/identity/__tests__/owner-enrollment.test.ts` konceptuálně) — dva
skutečně souběžní klienti proti reálné Postgres, `Promise.all`, ověření na
finálním stavu DB po závodu, ne na mock voláních ani na "nastav epoch ručně
a zkontroluj if".

**Postup (AT-67):**
1. `claimJob(pool, ownerId)` jako "processor A" → dostane `lease_epoch = 7`,
   commitnuto do DB.
2. Simulace vypršení leasu: **manipulace uloženého `lease_until` timestampu
   přímo SQL updatem do minulosti** — legitimní technika (produkční kód
   stejně jen porovnává `now()` proti uloženému časovému razítku), ne cheat.
   Tohle je odlišné od bodu 4 — jde o simulaci uplynulého ČASU, ne o
   simulaci SOUBĚHU.
3. `claimJob(pool, ownerId)` jako "processor B" → protože lease A vypršel,
   B dostane `lease_epoch = 8`.
4. **Skutečný závod:** dva nezávislé `pool.connect()` klienti (dvě opravdové
   DB connections), `Promise.all([commitJobResult(clientA, tokenA_epoch7,
   work), commitJobResult(clientB, tokenB_epoch8, work)])` — spuštěné
   opravdu současně přes `Promise.all`, ne sekvenčně.
5. `commitJobResult` fencing check NENÍ "přečti epoch v aplikaci, pak
   zapiš" (to má TOCTOU race okno) — je to **jedna atomická
   `UPDATE ... WHERE`** s epoch podmínkou přímo v SQL, např.:
   ```sql
   update message_processing_jobs
   set status = 'RESPONSE_READY', ...
   where id = $1
     and (select lease_epoch from owner_processing_state where owner_id = $2) = $3
   ```
   Postgres row lock serializuje i genuinně simultánní requesty korektně —
   fencing garance nezávisí na aplikačním timingu.
6. Assert na DB stavu PO závodu: přesně jeden `responses` řádek (unique
   constraint `unique(source_raw_event_id)` to navíc vynutí i na DB úrovni
   jako druhá vrstva obrany), patří procesoru B. Processor A dostane zpět
   explicitní chybu/no-op návratovou hodnotu (ne tichý úspěch).

**AT-07** je zjednodušená verze bez processoru B: A zmrzne (nikdy
nedokončí), čas uplyne (`lease_until` do minulosti), recovery (nový
`claimJob` volaný jako "processor B" po expiraci) úspěšně dokončí.

**AT-71** stejný vzor jako AT-67, ale invaliduje se `owner_control_epoch`
(přes `bumpOwnerControlEpoch(pool, ownerId)`) místo `lease_epoch` — simuluje
budoucí explicitní PAUSE/STOP command (BUILD-12), bez nutnosti stavět
skutečný command parser. Fencing WHERE podmínka v `commitJobResult` musí
kontrolovat OBA epochy zároveň (lease i control), ne jen jeden.

**AT-03** (crash po ACK → přesně jedna response): claim, "crash" = nikdy
nezavolat commit, čas uplyne, recovery claim + commit uspěje. Ověří se
existence přesně jednoho `responses` řádku.

**AT-06** (Telegram + web současně → owner sequence zachová pořadí): dvě
zprávy ingestnuté (různé kanály, `input_sequence` 1 a 2 přes BUILD-04
`ingestMessage()`), pak `claimNextJob()` musí vrátit job pro
`input_sequence=1` bez ohledu na to, kdy/jak byly zprávy vloženy. Dokud je
job 1 `PROCESSING` (claimnutý, nedokončený), druhé volání `claimNextJob()`
pro stejného ownera musí vrátit `null` — job 2 nesmí být claimnutelný, dokud
job 1 není `DELIVERED`/`RESPONSE_READY` nebo `QUARANTINED`.

**AT-54** (auto quarantine, gap neblokuje): 3 zprávy (`input_sequence`
1,2,3), zpráva 2 má stub `work` funkci co vždy throwne. Po 3 pokusech NEBO
překročení `processing_deadline_at` (simulováno manipulací timestampu, ne
reálným čekáním 120 s) přejde job 2 do `QUARANTINED`. Ověří se: přesně jeden
`incidents` řádek, přesně jeden `quarantine_notice_sent_at` (i při
souběžném pokusu o dvojí quarantine — race test stejného typu jako
fencing výše), a že job 3 (vyšší `input_sequence`) je claimnutelný i s
jobem 2 v karanténě (protože `QUARANTINED` je terminální, ne blokující).

## Claim logika (§4.3 "nejnižší dostupná processable sequence")

`claimNextJob` najde min `input_sequence` mezi joby ownera ve stavu
`PENDING`/`PROCESSING`/`RETRY_PENDING` (= "ještě otevřené") — `QUARANTINED`
a `DELIVERED`/`RESPONSE_READY` se do téhle množiny nepočítají (settled).
Claimnutelný je pouze job, jehož `input_sequence` je přesně tohle minimum A
jehož stav je `PENDING`/`RETRY_PENDING` (ne už `PROCESSING` někým jiným) A
`available_at <= now()` (backoff window). Tohle zajišťuje: starší
quarantined zprávy neblokují (nejsou v "otevřené" množině), ale starší
stále-otevřená zpráva blokuje claim čehokoli novějšího.

## Soubory k vytvoření

- `h2/processing/lease.ts` — `claimNextJob()`, `renewLease()`, fencing token
  typ.
- `h2/processing/commit.ts` — `commitJobResult(pool, fencingToken, work)`;
  `work` je injektovaná funkce (BUILD-05 negeneruje skutečnou Buddy
  odpověď — to je BUILD-07/10), jen bezpečně commitne cokoliv `work` vrátí,
  přesně jednou, fencing-chráněně.
- `h2/processing/quarantine.ts` — deadline/retry/backoff (5s→15s→30s, max 3
  pokusy, deadline text=120s/voice=300s dle `raw_events.payload_type`),
  terminální přechod do `QUARANTINED` + incident + notice marker.
- `h2/processing/control-epoch.ts` — `bumpOwnerControlEpoch(pool, ownerId)`.
- `h2/processing/errors.ts` — typované chyby (např. `H2FencingError`).
- Testy pod skutečnou rolí `h2_runtime` (ne admin), stejný vzor jako
  `h2/identity/__tests__/production-signin-flow.test.ts` (BUILD-03A) a
  `h2/ingestion/__tests__/ingest-message.test.ts` (BUILD-04).

## Co zůstává mimo scope (vědomě)

- Skutečné volání Sonnet/Haiku (BUILD-07, BUILD-10).
- Skutečné odeslání zprávy uživateli, jakéhokoli druhu (BUILD-11).
- Automatické produkční spuštění procesoru (`after()` nebo scheduler) —
  viz Rozhodnutí 2.
- Skutečný PAUSE/STOP command a jeho UI/parsing (BUILD-12) —
  `bumpOwnerControlEpoch()` je jen primitiv, který BUILD-12 později zavolá.
