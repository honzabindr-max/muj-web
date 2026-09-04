# BUILD-11 — Telegram + web delivery — návrh plánu (v2, po adversarial gate)

**Status:** NÁVRH — čeká na Honzíkovo schválení. **NEIMPLEMENTOVÁNO.**
Tenhle dokument nahrazuje předchozí verzi po adversarial review přes GPT
(2026-09-04) nad Rozhodnutími 1–4 níže. Rozhodnutí 2/3/5/6/7 z v1 zůstávají
věcně beze změny (jen přečíslovaná návaznost); Rozhodnutí 1 je přepsané,
Rozhodnutí 3 má doplněný odkaz na nové Rozhodnutí 10, a přibyla tři nová
rozhodnutí (8, 9, 10) z gate výstupu. Založeno [DEC-008](./DECISIONS.md#dec-008)
pro deadline sémantiku — mění doslovné znění uzamčené Technical Architecture
v1.2 §4.2 a zasahuje do uzavřeného BUILD-05.

## Rozsah (Build Specification §2 BUILD-11, ověřeno živě v Notionu)

> **BUILD-11 — Telegram + web delivery**
> - Telegram outbound,
> - web chat projection/polling/stream path podle platform capabilities,
> - delivery states včetně `AMBIGUOUS`,
> - idempotent delivery key,
> - oddělit logical response od physical delivery.
>
> **DoD:** žádná síťová nejistota nevytvoří druhý logical response. Vlastník AT-10.

**AT-10 (plné znění, ověřeno živě v Notionu, §32 Acceptance Test katalog):**
> Delivery timeout po externím send → stav `AMBIGUOUS`, žádný druhý logical response.

**§4.4 Exactly-once semantics (ověřeno živě v Notionu):**
> Externí síťové API nemusí umět dokázat fyzické exactly-once doručení při
> timeoutu po přijetí requestu. Delivery proto rozlišuje: `PENDING → SENDING →
> DELIVERED / FAILED_RETRYABLE / AMBIGUOUS / DEAD_LETTER`. `AMBIGUOUS`
> znamená: není možné bezpečně určit, zda externí služba zprávu přijala.
> Systém nesmí slepě vytvářet druhou logickou odpověď; recovery policy
> pracuje s původním response ID a incidentem.

**§8.1 Sovereignty Fast Lane (ověřeno živě v Notionu — přímo zakládá Pravidlo 10):**
> In-flight worker po novém STOP/PAUSE může technicky doběhnout u providera,
> ale jeho výsledek se nesmí commitnout ani doručit, pokud control epoch
> zestárl.

**§4.2 Processing queue (ověřeno živě v Notionu — přímo zakládá [DEC-008](./DECISIONS.md#dec-008)):**
> Při prvním přechodu do `PROCESSING` se nastaví `processing_deadline_at =
> first_started_at + 120 s`. Jeden logical user message má maximálně 3
> processing pokusy v tomto okně; doporučený bounded backoff je přibližně
> `5 s → 15 s → 30 s`. Retry nesmí posouvat původní deadline. Po překročení
> deadline nebo po třetím neúspěšném pokusu přechází user message
> automaticky do `QUARANTINED`.

**§4.3 Owner-level serializace (ověřeno živě v Notionu — beze změny, citováno
pro odlišení od §4.2 výše):**
> Před durable response commitem i před každým operational side effectem
> musí transakčně ověřit, že lease i control epoch jsou stále aktuální.
> Worker, který se po expiraci lease „probudí" později, nesmí nic
> commitnout a svůj výsledek zahodí.

Honzíkovo zadání pro v1 tohoto plánu (2026-09-04) přidalo čtyři komponenty
nad rámec holého Build Specification textu: oprava `payload_type` u
hlasovek po transkripci, retry taxonomie, migrace `MANUALLY_CLEARED`,
kontrola `owner_control_epoch` před odesláním (Pravidlo 10). Adversarial
gate (GPT, 2026-09-04) nad touhle v1 přidal tři další: rozpočtovanou
`after()` smyčku (Rozhodnutí 1 revize), nezávislý minutový budík
(Rozhodnutí 8), a rozdělení deadline sémantiky na wall-clock vs.
ACTIVE/stage processing budget (Rozhodnutí 9) — plus potvrdil `llm_attempt`
CALL_INTENT metering (Rozhodnutí 10) nezávisle na volbě budíku. Všech deset
rozhodnutí je rozpracováno níže jako součást jednoho plánu.

## Co BUILD-11 znovu nestaví

- `claimNextJob()`/`renewLease()` (BUILD-05, `h2/processing/lease.ts`) —
  beze změny mimo Rozhodnutí 9 (deadline sémantika) níže.
- `recordJobFailure()`/`quarantineJob()` (BUILD-05, `h2/processing/
  quarantine.ts`) — beze změny mimo Rozhodnutí 3 (retry taxonomie) a
  Rozhodnutí 9 (deadline sémantika) níže.
- `generateBuddyResponse()` (BUILD-10) — Buddy runtime beze změny mimo to,
  že catch blok kolem jejího volání (v novém `processOwnerQueueBounded()`)
  teď mapuje chyby na `recordJobFailure()`'s nový vstup (Rozhodnutí 3) a
  obaluje volání `llm_attempts` CALL_INTENT insertem (Rozhodnutí 10).
- `extractOperationalCandidates()` (BUILD-08) — Haiku extrakce beze změny,
  stejná poznámka jako výše.
- `responses`/`response_deliveries` schéma (BUILD-02, `0002_messaging.sql`)
  — beze změny mimo Rozhodnutí 4 (epoch sloupec) a Rozhodnutí 5 (quarantine
  notice seam) níže.
- `commitVoiceTranscript()` (BUILD-06) — beze změny mimo Rozhodnutí 2 níže.
- Ověřeno v kódu proti mylnému tvrzení z gate reviewu (níže, "Co gate
  tvrdil špatně"): head-of-line invariant a Command Gate re-detekce
  existují dnes beze změny, tenhle plán do nich nezasahuje.

## Co gate tvrdil špatně — neimplementuje se, ověřeno v kódu 2026-09-04

- **Head-of-line invariant UŽ EXISTUJE.** `h2/processing/lease.ts`'s
  `OPEN_JOB_CANDIDATE_QUERY` vyžaduje `re.input_sequence = min(...)` přes
  `PENDING`/`PROCESSING`/`RETRY_PENDING` napříč vlastníkem — job v
  `PROCESSING` i backoffovaný `RETRY_PENDING` tak blokují vyšší sekvence.
  Nic se sem nepřidává.
- **Anthropic SDK auto-retry neexistuje.** `h2/prompts/anthropic-adapter.ts`
  jede přes syrový `fetch` (`ANTHROPIC_MESSAGES_URL`), žádná `@anthropic-
  ai/sdk` závislost — potvrzeno gate i grepem, žádná akce.

## Rozhodnutí 1 (revize po gate): trigger — `after()` fast path, ohraničený rozpočtem času

**Kontext (ověřeno v `docs/h2/BUILD-05-PLAN.md` "Rozhodnutí 2" + živě v
Notionu §4.2):** architektura explicitně předepisuje `after()` (Next.js)
nebo ekvivalentní post-response execution, spuštěný **hned po ACK** v
ingest requestu (Telegram/web webhook, BUILD-04), pod stejnou rolí
`h2_runtime`, kterou už používá `ingestMessage()`. `after()` **není
durability mechanismus** — source of truth zůstává `message_processing_job`
v Postgresu (§4.2, citováno výše: "Není durability mechanismem. Source of
truth je processing job v Postgresu.").

**Gate nález (2026-09-04):** v1 tohoto plánu navrhovala smyčku "dokud se
fronta nevyprázdní" (`loop: claim → process → continue`). To je špatně
ohraničené — Next.js `after()` běží uvnitř téže serverless/edge function
invocation jako request, která má svůj vlastní hard wall-clock limit
(Vercel `maxDuration`, konkrétní hodnota závisí na plánu — dnes
neověřeno, viz "Otevřené pro Honzíka" níže). Neohraničená smyčka riskuje,
že function timeoutne uprostřed `claimNextJob()`→`generateBuddyResponse()`
cyklu, což je přesně ten scénář, který Rozhodnutí 9's ABANDONED_UNKNOWN
accounting musí umět pojmout, ale nemělo by se do něj chodit zbytečně
často jen kvůli špatně ohraničené smyčce. **`after()` je optimalizace
latence, nikdy liveness mechanismus** — pokud function timeoutne, systém
musí zůstat funkční přes Rozhodnutí 8's nezávislý budík, ne spoléhat na to,
že `after()` frontu vyprázdní samo.

**Návrh (revidovaný):** nová funkce `processOwnerQueueBounded(pool,
registry, credentials, ownerId, deadlineAt)` v
`h2/processing/process-owner-queue.ts`, volaná přes `after()` na konci
`app/api/h2/telegram/webhook/route.ts` a `app/api/h2/web/messages/route.ts`
(`deadlineAt` = request start + funkce `maxDuration` mínus bezpečnostní
rezerva), a **stejná funkce** volaná z nového wake endpointu (Rozhodnutí
8) s vlastním `deadlineAt` odvozeným od jeho vlastního `maxDuration`.

```
function processOwnerQueueBounded(pool, registry, credentials, ownerId, deadlineAt):
  loop:
    remaining = deadlineAt - now()
    if remaining < WORST_CASE_JOB_DURATION_MS:
      return  // nezbývá rezerva na celý další job vč. hard timeoutů všech
              // stages — přenech ho dalšímu after() volání nebo budíku
    token = claimNextJob(pool, ownerId)
    if token === null: return  // fronta prázdná
    try:
      if payload_type vyžaduje extrakci (Rozhodnutí 2 pro VOICE):
        await withLlmAttempt(pool, token, 'OPERATIONAL_EXTRACTION', () =>
          extractOperationalCandidates(...))  // Rozhodnutí 10, best-effort —
                                               // chyba nesmí zablokovat odpověď
      result = await withLlmAttempt(pool, token, 'BUDDY_RESPONSE', () =>
        generateBuddyResponse(pool, registry, credentials, token))
      await deliverResponse(pool, result.responseId, token.ownerId)  // Rozhodnutí 4/6
    catch (error):
      await recordJobFailure(pool, token, classifyError(error), String(error))  // Rozhodnutí 3
    continue loop
```

`WORST_CASE_JOB_DURATION_MS` = součet hard timeoutů **všech** stages, co
smyčka pro jeden job může spustit: `CALL_TIMEOUT_MS` (60 000 ms,
`h2/prompts/anthropic-adapter.ts`, sdílené `callAnthropicModel()` pro
extrakci i Buddy response — dvakrát, pokud VOICE/extrakce proběhne) +
`DELIVERY_CALL_TIMEOUT_MS` (Rozhodnutí 6, návrh 15 000 ms) + malá režie na
DB round-tripy. Kontrola **PŘED** každým dalším `claimNextJob()` voláním,
ne jen na začátku funkce — dvě rychlé zprávy stejného ownera by jinak mohly
smyčku natáhnout přes hranici, kde by druhý job zbytečně začal, ale nestihl
dokončit.

**`extractOperationalCandidates()` chyba nesmí zablokovat odpověď:** beze
změny oproti v1 — `try/catch` kolem volání zvlášť, chyba se zaloguje (ne
`recordJobFailure`, protože extrakce sama nevlastní žádný job/response),
`generateBuddyResponse()` pokračuje bez entity kontextu.

**Proč smyčka, ne jeden job na `after()` volání:** stejný důvod jako v1 —
`claimNextJob()`'s `for update` zámek serializuje konkurentní pokusy,
smyčka jen snižuje počet zbytečných no-op volání, teď navíc s explicitní
horní mezí, aby nikdy nepřekročila function timeout.

**Otevřené pro Honzíka:** implementační/orchestrační rozhodnutí, dotýká se
dvou už nasazených produkčních routes (BUILD-04) — potvrzení stejné jako
v1, žádná změna v důvodu žádosti o GO.

## Rozhodnutí 2 (beze změny oproti v1): voice → text handoff — `readMessageText()` přijme obojí

**Nalezená mezera (zapsaná v BUILD-STATUS.md od 2026-09-03):**
`commitVoiceTranscript()` (BUILD-06, `h2/voice/commit-transcript.ts:50`)
přepíše `raw_events.payload_ciphertext` na přepis, ale **nechává
`payload_type='VOICE'`** (`where ... and payload_type = 'VOICE'`) — ověřeno
v kódu 2026-09-04. `generateBuddyResponse()`'s `readMessageText()`
(`h2/buddy/generate-response.ts`) čte `where id = $1 and payload_type =
'TEXT'` — u hlasovky po transkripci by nenašla nic.

**Varianty:**
- (A) `commitVoiceTranscript()` přepne `payload_type` na `'TEXT'` po
  transkripci,
- (B) `readMessageText()` (a budoucí čtenáři obsahu) přijme `payload_type
  IN ('TEXT', 'VOICE')`.

**Doporučení:** (B). `payload_type` na `raw_events` je součást I6
(Versioned Raw Evidence) provenance — zaznamenává, **jak** zpráva vznikla
(namluvená, ne napsaná), ne jen její dnešní reprezentaci. Přepnutí na
`'TEXT'` by tenhle historický fakt smazalo. Po `commitVoiceTranscript()` je
`payload_ciphertext` vždy čitelný jako text bez ohledu na `payload_type`.

**Dopad:** `readMessageText()`'s SQL `where ... and payload_type = 'TEXT'`
→ `where ... and payload_type in ('TEXT', 'VOICE')`. Žádná migrace,
žádná změna schématu. Nový test: hlasovka po `commitVoiceTranscript()` →
`generateBuddyResponse()` ji najde a zpracuje.

## Rozhodnutí 3 (beze změny oproti v1, s doplněním): retry taxonomie — rozpad chybových tříd napříč adaptérem a frontou

**Nalezená mezera (ověřeno v kódu 2026-09-04, `h2/processing/quarantine.ts`
+ `h2/prompts/anthropic-adapter.ts`):** `resolveJobFailure()` dnes
rozhoduje retry-vs-karanténa jen podle `attempt_count >= 3` a
`processing_deadline_at` — `reasonCode` se ukládá pro audit, nikdy se
nečte pro rozhodnutí. Adaptér má dnes (po dnešním Structured Outputs PR
#38) 5 kódů: `ANTHROPIC_TIMEOUT`, `ANTHROPIC_RATE_LIMITED`,
`ANTHROPIC_HTTP_ERROR` (míchá retryovatelné 500/529 s neretryovatelnými
400/401/403), `ANTHROPIC_REFUSAL`, `ANTHROPIC_MAX_TOKENS_TRUNCATED`
(obojí neretryovatelné). `ANTHROPIC_RATE_LIMITED` nečte `retry-after`
hlavičku.

**Honzíkova zadaná taxonomie:** retryovat 429/500/529/síť, nikdy
400/auth/token budget/schema violation/refuz.

**Návrh — adaptér (`h2/prompts/anthropic-adapter.ts`):**
- rozpad `ANTHROPIC_HTTP_ERROR` na `ANTHROPIC_BAD_REQUEST` (400 —
  neretryovatelné), `ANTHROPIC_AUTH_ERROR` (401/403 — neretryovatelné),
  `ANTHROPIC_SERVER_ERROR` (500/529 — retryovatelné),
- `ANTHROPIC_RATE_LIMITED` přečte `retry-after` hlavičku (pokud přítomná)
  a vrátí ji jako pole na chybě (`retryAfterSeconds?: number`),
- `ANTHROPIC_TIMEOUT` zůstává retryovatelné,
- `ANTHROPIC_REFUSAL`/`ANTHROPIC_MAX_TOKENS_TRUNCATED` zůstávají
  neretryovatelné.

**Návrh — fronta (`h2/processing/quarantine.ts`):** `resolveJobFailure()`
dostane novou vstupní klasifikaci `retryable: boolean` (odvozenou z
`reasonCode` přes malou lookup tabulku) a volitelný `retryAfterSeconds?:
number`. Pokud `retryable === false`, **okamžitá karanténa bez ohledu na
`attempt_count`**.

**Volající** (`h2/buddy/generate-response.ts`, `h2/extraction/operational-
extraction.ts`, nové `processOwnerQueueBounded()`): catch blok musí
mapovat zachycenou chybu (včetně `H2AnthropicCallError.code`) na
`recordJobFailure()`'s nový `retryable`/`retryAfterSeconds` vstup.

**Mezera v meteringu zavedená PR #38 — vyřešena Rozhodnutím 10 níže, ne
tady.** `callAnthropicModel()` throwuje `ANTHROPIC_REFUSAL`/
`ANTHROPIC_MAX_TOKENS_TRUNCATED` dřív, než `generateBuddyResponse()`
stihne zavolat `recordLlmRun()`/`recordAnthropicUsage()` — tahle třída
chyb dnes nemá žádný záznam spotřeby, přestože Anthropic API mid-stream
refuz/ořez účtuje. V1 tohoto plánu to nechávala jako otevřený
forward-pointer uvnitř Rozhodnutí 3; gate potvrdil `llm_attempt`
CALL_INTENT mechanismus (Rozhodnutí 10) jako řešení nezávisle na volbě
budíku — CALL_INTENT řádek existuje **před** voláním, takže i
pre-response throw má co aktualizovat na `FAILED_CONFIRMED`/
`ABANDONED_UNKNOWN` s `charged_processing_ms`, aniž by závisel na tom, že
`generateBuddyResponse()` stihne dojít až k dnešnímu `recordLlmRun()`
volání.

**Rozsah:** samostatný krok/PR (Krok 1 níže) — dotýká se adaptéru i fronty
zároveň, ale ne ještě delivery ani trigger wiring.

## Rozhodnutí 4 (beze změny oproti v1, vyžaduje migraci): `owner_control_epoch` kontrola před odesláním — Pravidlo 10

**Nalezená mezera (DEC-007, Pravidlo 10, BUILD-STATUS.md):**
`commitJobResult()` (BUILD-05) fencuje zápis `responses` řádku atomicky nad
`lease_epoch`+`owner_control_epoch` (AT-67/AT-71) — ale epoch se nikam
neukládá na `responses` řádek samotný. `response_deliveries` (schéma dnes)
nemá epoch sloupec vůbec. Bez tohohle by committed-ale-ještě-nedoručená
odpověď šla odeslat i po mezitímním PAUSE/STOP — přímo proti §8.1.

**Návrh (vyžaduje novou migraci):**
1. `responses.owner_control_epoch bigint not null` — nový sloupec,
   populovaný `commitJobResult()` z `token.ownerControlEpoch`. Existující
   `responses` řádky (žádné v produkci dnes) nepotřebují backfill.
2. `deliverResponse()` (Rozhodnutí 6) PŘED voláním Telegram/web send API
   přečte aktuální `owner_processing_state.owner_control_epoch` pro
   ownera a porovná s `responses.owner_control_epoch` zaznamenaným při
   commitu. Pokud current > committed: **neodešle**, incident se založí.
3. Test (Pravidlo 10's explicitní požadavek): commit response → simuluj
   `bumpOwnerControlEpochWithClient()` → `deliverResponse()` musí odmítnout
   odeslání, žádné volání Telegram API neproběhne.

**Proč nový sloupec, ne alternativa bez migrace:** beze změny oproti v1 —
potřeba baseline z okamžiku commitu, ne jen aktuální hodnota.
**Vyžaduje Honzíkovo GO na migraci** (Pravidlo 4).

## Rozhodnutí 5 (ROZHODNUTO — Honzík, 2026-09-04): quarantine notice delivery — samostatná cesta, ne `response_deliveries`

**Nalezená mezera (BUILD-05-PLAN.md "Rozhodnutí 3"):**
`response_deliveries.response_id` je dnes `NOT NULL` — karanténovaná
zpráva nemá žádný `responses` řádek.

**Varianty (zvažované):**
- (a) rozšířit `response_deliveries.response_id` na nullable + discriminator,
- (b) samostatná tabulka/mechanismus pro systémové notice.

**Rozhodnuto: (b), nová tabulka `system_notice_deliveries`.** Malá
funkce `sendQuarantineNotice(ownerId, jobId)` volaná ze stejného místa
jako `quarantineJob()` (uvnitř `processOwnerQueueBounded()`'s catch
větve), `idempotency_key = quarantine_notice:{job_id}` proti nové malé
tabulce `system_notice_deliveries` — beze změny oproti Code's doporučení,
Honzík ho potvrdil beze změny.

## Rozhodnutí 6 (beze změny oproti v1): delivery mechanismus — Telegram outbound + web polling

**Telegram:** `sendMessage` Bot API (`H2_TELEGRAM_BOT_TOKEN`). `deliverResponse()`
pro `channel='telegram'`:
1. vloží/najde `response_deliveries` řádek (`idempotency_key =
   {responseId}:telegram`),
2. Rozhodnutí 4's epoch check,
3. `status='SENDING'`, zavolá `sendMessage` s vlastním `AbortController`
   timeoutem — **nový konstantní `DELIVERY_CALL_TIMEOUT_MS = 15_000`**
   (Rozhodnutí 1's `WORST_CASE_JOB_DURATION_MS` ho počítá jako vstup;
   hodnota je implementační default, ne produktové rozhodnutí — analogie
   `LEASE_DURATION_SECONDS=60` z BUILD-05),
4. na úspěch → `status='DELIVERED'`, `external_message_id` uloženo,
5. na definitivní chybu (400 špatný `chat_id`) → `status='FAILED_RETRYABLE'`
   (Rozhodnutí 3's taxonomie) nebo `DEAD_LETTER` po vyčerpání,
6. na network timeout/nejistý výsledek → `status='AMBIGUOUS'` + incident,
   **žádný automatický retry**.

**Web:** `GET /api/h2/web/responses`, owner-scoped, cursor-based. Web kanál
nemá síťovou nejistotu ve stejném smyslu jako Telegram — `response_
deliveries` řádek pro `channel='web'` může jít rovnou na `DELIVERED`.

## Rozhodnutí 7 (beze změny oproti v1, pořadí aktualizováno pro 4-krokový plán): migrace `MANUALLY_CLEARED`

**Stav:** implementace hotová a otestovaná na branchi (PR
[#35](https://github.com/honzabindr-max/muj-web/pull/35), CI zelené,
branch `prep/h2-manually-cleared-job-status`, stále OPEN 2026-09-04), **ne
mergnutá, migrace neaplikovaná, skript nespuštěný**.

Obsah (ověřeno proti PR #35 diffu): migrace `0016_manually_cleared_job_
status.sql` rozšiřuje `message_processing_jobs_status_check` o
`MANUALLY_CLEARED` — aditivní. `h2/db/scripts/clear-stale-pending-jobs.ts`
— dry-run default, `--confirm` pro zápis, `--reason` povinné.

**Aktualizované pořadí (viz "Implementační strategie" níže pro plné
zdůvodnění):**
1. Honzíkovo GO na merge PR #35 — **před Krokem 1**, aby migrace `0016`
   zabrala své číslo dřív, než ho zabere jiná nová migrace z tohoto plánu
   (viz "Migrace" tabulka níže — bez tohohle pořadí by dvě souběžné
   branche kolidovaly na stejném čísle).
2. Aplikace migrace 0016 na production i preview `h2-runtime`, ověřeno
   přímým dotazem na `_h2_migrations`.
3. Honzíkovo GO na spuštění `clear-stale-pending-jobs.ts --confirm` —
   **bezprostředně před Krokem 4** (trigger wiring), ne dřív — aby nový
   trigger nezačal zpracovávat historické stale zprávy najednou, přesně
   podle Honzíkova původního zadání (varianta B, 2026-09-03).
4. Teprve pak merge Kroku 4.

## Rozhodnutí 8 (nové, z gate; interval ROZHODNUT 2026-09-04): nezávislý budík (30 min, pevně) — control plane wake, ne data plane

**Nález (gate, 2026-09-04):** systém dnes nemá liveness. Jediný spouštěč
zpracování fronty je `after()` uvnitř příchozí zprávy (Rozhodnutí 1) — bez
další příchozí zprávy stejného ownera zůstane `RETRY_PENDING`/reap-po-
lease-expiraci job nedotčený, dokud nedorazí něco nového. To je mezera pro
karanténu-po-timeoutu i pro retry backoff (job čekající na `available_at`
nemá, kdo by ho po uplynutí backoffu vyzvedl).

**Zvažované varianty (zamítnuté Honzíkem 2026-09-04, zaznamenáno pro
budoucí review, ať se neopakuje diskuze):**
- Vercel Pro cron — zamítnuto, nenavyšovat plán teď,
- GitHub Actions schedule — zamítnuto, 5min interval je pozdě pro tenhle
  účel a 8 640 běhů/měsíc (1/min) přeteče 2 000 included minut na Free
  tieru,
- Neon pg_cron — zamítnuto, neumí outbound HTTP a Free plán scale-to-zero
  po 5 min neaktivity by pg_cron job stejně nespustil spolehlivě.

**Návrh:** externí ping (cron-job.org, zdarma, interval **30 minut —
ROZHODNUTO Honzíkem, pevná hodnota, neladí se ani nedopočítává, viz
otevřený bod 4 níže pro odůvodnění**, custom headers) → nový
autentizovaný endpoint `POST /api/internal/queue-wakeup` → pro
**každého** ownera zavolá `processOwnerQueueBounded()` (Rozhodnutí 1), ne
jen pro jednoho — na rozdíl od Rozhodnutí 1's volání z ingest routy, kde
je `ownerId` dán requestem.

**Oprava nálezu (2026-09-04) — enumerace ownerů přes `message_processing_
jobs` je stejná třída bugu jako `verify-ingestion.ts` před Pravidlem 9:**
v1 tohoto rozhodnutí navrhovala enumeraci `select distinct owner_id from
message_processing_jobs where status in ('PENDING', 'RETRY_PENDING') and
available_at <= now()`. `message_processing_jobs` má ale **FORCE RLS**
(§4.3, migrace 0011) vyžadující `app.owner_id` v session — dotaz bez
scope pod `h2_runtime` **tiše vrátí nula řádků bez ohledu na to, co ve
frontě skutečně je** (přesně popsáno v Pravidle 9, BUILD-STATUS.md: "RLS
na owner-scoped tabulkách nehlásí chybu, jen tiše filtruje na nulu").
Wake endpoint by tak vypadal zdravě (`204`), ale nikdy by nic reálně
neprobudil.

**Opravený návrh:** enumerace ownerů přes `owners` tabulku, **ne** přes
`message_processing_jobs` — `owners` RLS nemá vůbec (jen `GRANT`, ověřeno
`verify-ingestion.ts`'s komentářem: "`owners` RLS nemá (jen GRANT), takže
single owner lze vyřešit bez scope"), takže `select id from owners` pod
`h2_runtime` funguje bez jakéhokoli owner scope a nemůže tiše vrátit
zavádějící prázdný výsledek:
```
const owners = await pool.query<{ id: string }>('select id from owners')
for (const { id: ownerId } of owners.rows) {
  await processOwnerQueueBounded(pool, registry, credentials, ownerId, deadlineAt)
}
```
Žádná samostatná "má tenhle owner něco ve frontě" kontrola není potřeba —
`processOwnerQueueBounded()` samo uvnitř volá `claimNextJob()` →
`withOwnerScope()`, který teprve **správně scoped** nastaví `app.owner_id`
pro daného ownera a vrátí `null`, pokud je fronta prázdná. Tenhle no-op
návrat je dost levný na to, aby se volal pro každého ownera při každém
probuzení (dnes jeden owner — `verify-ingestion.ts`'s komentář — bez
architektonické změny i pro víc ownerů v budoucnu).

**Readback guard (Pravidlo 9), sdílená oprava přesahující Rozhodnutí 8:**
`withOwnerScope()` (`h2/db/with-owner-scope.ts`) dnes zavolá `set_config
('app.owner_id', ...)`, ale **neověřuje readbackem, že se scope skutečně
nastavil** — přesně ta mezera, kterou Pravidlo 9 opravilo ve
`verify-ingestion.ts` po incidentu s tichou nulou. Návrh: `withOwnerScope()`
se rozšíří o `select current_setting('app.owner_id', true)` hned po
`set_config` a porovná výsledek s `ownerId`; pokud se neshodují, throwne
explicitní chybu **před** voláním `fn(client)` — stejný vzor jako
`verify-ingestion.ts`'s guard. `withOwnerScope()` je sdílená
infrastruktura (BUILD-02/BUILD-03A), kterou dnes používá **každé** volání
`claimNextJob()`/`commitJobResult()`/`recordJobFailure()`, ne jen wake
endpoint — oprava tedy chrání celou frontu, ne jen Rozhodnutí 8.
Doporučeno zařadit do Kroku 1 (nejdřívější krok, který `withOwnerScope()`
přes `claimNextJob()` volá) — nevyžaduje migraci, nemá důvod čekat na
Krok 4.

**Wake endpoint musí selhat hlasitě, ne prázdně:** pokud enumerace ownerů
selže (DB nedostupná, chyba dotazu), nebo pokud `withOwnerScope()`'s
readback guard výše pro kteréhokoli ownera selže, endpoint **nesmí**
vrátit `204` jako by nebylo co probudit — musí vrátit `5xx` a založit
incident. `204` smí znamenat jen "probudil jsem frontu pro všechny
ownery, žádný neměl co dělat", nikdy "nepodařilo se mi ani zjistit, koho
probudit". Stejný princip jako Pravidlo 9: mechanismus, co místo chyby
tiše vrátí "nic", je horší než žádný — vede k falešnému "systém běží v
pořádku" závěru přesně tam, kde by měl spustit alarm (tenhle endpoint je
jediný liveness mechanismus mimo `after()`, takže jeho tiché selhání by
znamenalo, že se karanténa/backoff mezery z Rozhodnutí 8's úvodu vrátí
neviditelně).

**Autentizace a scope (Pravidlo 11 aktualizace, viz BUILD-STATUS.md):**
- nový env `H2_QUEUE_WAKE_SECRET` (Vercel Secret, production), scoped
  jen pro tenhle endpoint, rotovatelný nezávisle na ostatních credentials,
- endpoint porovná hlavičku (`X-H2-Wake-Secret`, cron-job.org custom
  header) proti secretu (constant-time compare),
- **žádné čtení dat, žádná mutace mimo probuzení fronty** — prázdné tělo
  requestu, odpověď `204 No Content` bez obsahu,
- cron-job.org "save responses"/logování odpovědí **vypnuté** — endpoint
  ani nemá co logovat (204 prázdné), ale nastavení se ověří explicitně.

**Proč je tohle control plane, ne data plane (odlišuje se od Pravidla 11's
zamítnutí Zapier/Make/n8n):** ping nenese ani nevrací žádný obsah zprávy,
entitu, ani Buddyho odpověď — je to čistě signál "zkontroluj frontu",
stejná třída jako healthcheck. Zamítnutí no-code platforem se týkalo
vedení **osobních dat** přes třetí stranu v core message-processing cestě;
tenhle mechanismus žádná osobní data nikdy nenese. Podrobně rozepsáno v
aktualizovaném Pravidle 11, BUILD-STATUS.md.

**Vztah k BUILD-23 (scheduler):** `job_definitions`/`job_runs`
(`0009_proactivity_and_jobs.sql`) — scheduler ledger pro proaktivní
připomínky/deadliny — **už existuje v schématu** (RED-TEAM-FINDINGS.md bod
5), ale jeho vlastní "budík" (kdo se dívá na `next_due_at` a kdy) zůstává
otevřená volba pro BUILD-23, samostatně od tohohle mechanismu.
**Rozhodnutí 8's wake endpoint neřeší BUILD-23's scheduler** — probouzí
jen `message_processing_jobs` frontu (reaktivní zpracování zpráv), ne
proaktivní `job_definitions` cestu. Nezaměňovat, až se BUILD-23 bude
stavět — bude potřebovat vlastní rozhodnutí o mechanismu (može, ale
nemusí, znovupoužít stejný `cron-job.org` účet s jiným endpointem).

**Otevřené pro Honzíka:**
1. Založení `cron-job.org` účtu (externí služba, mimo tenhle repo) —
   Honzíkův krok, Code může připravit přesnou konfiguraci (URL, header
   název, interval) k vložení.
2. `H2_QUEUE_WAKE_SECRET` vygenerování a přidání do Vercelu — GO na nový
   credential (Pravidlo 4).
3. Ověření skutečného Vercel `maxDuration` limitu pro tenhle endpoint
   (závisí na plánu — dnes neověřeno) — vstup pro Rozhodnutí 1's
   `deadlineAt` výpočtu, musí se zjistit před implementací Kroku 4, ne
   předpokládat.
4. **Interval budíku — ROZHODNUTO (Honzík, 2026-09-04): 30 minut,
   pevně.** Neladí se, nedopočítává se, nečeká se na ověření velikosti
   computu (viz "Poznámka" níže — přesunuto z blokujícího ověření do
   nezávazné monitorovací poznámky).

   **Honzíkovo zdůvodnění:** osobní projekt — budík je záchranná síť pro
   případ, že `after()` (Rozhodnutí 1) selže nebo nestihne frontu
   vyprázdnit, ne běžná zpracovávací cesta. Latence do 30 min v tomhle
   scénáři nemá dopad. Priorita je velká rezerva proti Neon suspendu, ne
   nízká latence budíku.

   **(a) Minutový interval — ZAMÍTNUT.** Důvod: Neon Free 100 CU-h/měsíc
   limit + (b)'s suspend-při-vyčerpání chování. Minutový ping (1/min,
   24/7) resetuje 5minutový scale-to-zero idle timer při každém volání
   (1 min < 5 min suspend threshold) — `h2-runtime`'s compute tak nikdy
   nestihne usnout a běží fakticky nepřetržitě. Na dokumentované
   výchozí/minimální velikosti 0,25 CU (`neon.com/docs/introduction/
   plans`: "100 CU-hodin stačí run a 0.25 CU compute in a project for
   400 hours/month") by kontinuální běh 720 h/měsíc (30denní měsíc)
   spotřeboval `720 × 0,25 = 180 CU-hodin/měsíc` — 1,8× nad limitem,
   vyčerpáno za `400 h ÷ 24 h/den ≈ 16,7 dne`. Zamítnuto.

   **(b) Ověřený fakt, proč se volí velká rezerva, ne těsný výpočet:**
   Neon dokumentace (`neon.com/docs/introduction/free-tier`, ověřeno
   živě 2026-09-04) doslovně: *"when you run out of CU-hours...your
   compute is suspended until the next billing period or until you
   upgrade."* Po vyčerpání 100 CU-h Neon compute **SUSPENDUJE** do
   dalšího fakturačního období — **netrotluje, nezdraží tiše**.
   Vyčerpání limitu tak nesrazí jen budík — srazí **celou aplikaci
   včetně Telegram ingestu**, protože `app/api/h2/telegram/webhook/
   route.ts` (BUILD-04) běží na tom samém `h2-runtime` Neon projektu.
   Proto se interval nevolí těsně u matematického stropu, ale s velkou
   rezervou nad ním.

   **(c) Matematický strop (kontext k (b), ne návod na doladění):** Free
   budget `100 CU-h ÷ 0,25 CU = 400 h` wall-clock/měsíc (na
   dokumentované výchozí velikosti); jeden ping ~5 min aktivního computu
   (probuzení + čekání na 5minutový scale-to-zero timer); strop bez
   rezervy `24 000 min ÷ 5 min = 4 800 pingů/měsíc` → `43 200 min ÷
   4 800 = 9 min` minimální bezpečný interval. **30 min je ~3,3× nad
   tímhle stropem** — i kdyby skutečná velikost computu nebo spotřeba
   běžného provozu (viz (d) níže) vybočila z dokumentovaného výchozího
   odhadu, 30minutový interval má prostor to absorbovat beze změny.

   **(d) Rozpočet je sdílený s běžným provozem aplikace, ne jen s
   budíkem.** Každý reálný Telegram webhook a web request taky budí
   `h2-runtime`'s compute (stejný scale-to-zero mechanismus) a
   spotřebovává ze stejného měsíčního rozpočtu jako budík. Skutečná
   spotřeba běžného provozu je dnes neznámá (žádný produkční trigger
   ještě neběží — BUILD-STATUS.md) — 30minutová rezerva z (c) tohle
   částečně kompenzuje, ale ne neomezeně, proto monitorovací bod níže.

   **(e) Tenhle interval je použitelný teprve PO Kroku 2, ne dřív.** S
   dnešní wall-clock sémantikou (`processing_deadline_at =
   first_started_at + 120 s`, §4.2) by budík běžící po 30 minutách místo
   po 1 minutě znamenal, že mezi dvěma probuzeními uplyne mnohem víc než
   120 s wall clock i pro joby, které nikdy neběžely — `isJobExhausted()`
   by je našel **už propadlé** (`now > processing_deadline_at`) a poslal
   rovnou do karantény, bez ohledu na to, kolik reálné práce se stihlo.
   Přesně tenhle scénář Krok 2 ([DEC-008](./DECISIONS.md#dec-008),
   Rozhodnutí 9) řeší — `charged_processing_ms`/`processing_budget_ms`
   měří jen ACTIVE/stage čas, ne čekání na další wake. **Do Kroku 2 tedy
   žádný budík nenasazovat.** Dnešní pořadí Kroků 1→2→3→4 (Rozhodnutí 8's
   endpoint je součást Kroku 4, poslední) tuhle podmínku už samo splňuje
   — jde o to nezkracovat pořadí, ne o novou závislost navíc.

   **Poznámka — ověření velikosti computu, NEBLOKUJE Krok 4:** skutečnou
   nakonfigurovanou velikost computu (`h2-runtime`, `h2-control`) nejde
   z tohohle repu/prostředí ověřit (žádný Neon API klíč, žádný
   `neonctl`, žádný Neon MCP server připojený k téhle session) — pokud
   by se to v budoucnu hodilo přesněji dopočítat (viz monitorovací bod
   níže), Honzík ji najde v Neon Console: **projekt → BRANCH selektor →
   "Postgres database" → Computes → Edit** — panel ukáže compute size,
   autoscaling rozsah (min/max CU) i scale-to-zero nastavení
   (`neon.com/docs/manage/computes`, ověřeno živě). Rozhodnutá hodnota
   30 min se na tomhle ověření nezakládá a nečeká na něj.

   **Monitorovací bod (první měsíc po nasazení Kroku 4):** sledovat
   spotřebu CU-h proti Free limitu — stránka **Projects** v Neon
   Console (zjednodušený přehled, řádek "Compute") nebo **Billing** pro
   detailnější rozpad (`neon.com/docs/introduction/monitor-usage`,
   ověřeno živě). Pokud se spotřeba blíží 100 CU-h/měsíc, **interval
   prodloužit** (ne zkrátit, ne přijmout riziko) — suspend celé databáze
   (a tím Telegram ingestu, viz (b)) je tvrdší failure mode než
   pomalejší budík.

## Rozhodnutí 9 (nové, z gate — [DEC-008](./DECISIONS.md#dec-008)): deadline sémantika — wall clock vs. ACTIVE/stage processing budget

**Nález (gate, 2026-09-04):** dnešní `processing_deadline_at =
first_started_at + 120s` (§4.2, citováno výše) měří **wall clock od
prvního pokusu**, ne skutečný zpracovávaný čas. Pokud infrastruktura
vypadne (Vercel incident, Neon výpadek) na 90 sekund mezi druhým a třetím
pokusem, těch 90 sekund se počítá do stejného 120s okna jako aktivní
zpracování — přechodný infrastrukturní výpadek se tak může stát
nerozeznatelným od skutečně vyčerpaného retry budgetu a zprávu pošle do
karantény, i když žádný pokus samotný nikdy neběžel dlouho. **Retry budget
dnes neměří retry, měří kvalitu scheduleru** (gate formulace, přesná).

**Rozdělení (závazné, čtyři samostatné role dnešního jednoho pole):**
- **lease expiry** (`owner_processing_state.lease_until`) → **wall clock,
  beze změny**. Chrání proti mrtvému/zaseknutému procesoru (§4.3),
  nesouvisí s tím, kolik práce zpráva stála.
- **backoff / `available_at`** → **wall clock, beze změny**. Backoff je
  záměrně čekání v reálném čase mezi pokusy (Rozhodnutí 3's `5s→15s→30s`
  nebo `retry-after`).
- **`max_attempts = 3`** → **beze změny**.
- **processing budget** → **ACTIVE/stage time, ne wall clock**. Nahrazuje
  `processing_deadline_at`'s dnešní roli coby "vyčerpán čas" test.
- **stale age** (produktová expirace staré zprávy — "tahle zpráva je moc
  stará na to, aby na ni Buddy ještě odpovídal") → **samostatné pravidlo,
  hodnotu ani tvar sloupce tenhle plán nenavrhuje** — čeká na Honzíkovo
  produktové rozhodnutí. Vědomě mimo migraci Kroku 2 (viz "Co zůstává mimo
  scope" níže).

**Návrh — schema (`message_processing_jobs`, nová migrace, Krok 2):**
- `processing_budget_ms bigint null` — nastaveno při prvním přechodu do
  `PROCESSING`, podle `payload_type` (`TEXT: 120_000`, `VOICE: 300_000` —
  **stejné hodnoty jako dnes**, jen reinterpretované jako budget součtu
  charged time, ne jako wall-clock okno),
- `charged_processing_ms bigint not null default 0` — kumulativní
  účtovaný čas napříč pokusy,
- `processing_deadline_at` — **ROZHODNUTO (Honzík, 2026-09-04): ZRUŠIT**
  (drop column) v téže migraci. Důvod: nulová produkční data (BUILD-10
  evidence — tabulka má dnes 0 řádků, drop je bezpečný bez migrace dat) a
  ponechaný nečtený sloupec vedle `charged_processing_ms`/
  `processing_budget_ms` by byl matoucí duplicitní koncept — dvě pole
  popisující "kdy job vyprší", z nichž jedno už nikdy nic nerozhoduje, je
  přesně ta nejednoznačnost, kterou DEC-008 měl odstranit, ne zavést v
  jiné podobě.

**Návrh — účtování (`isJobExhausted()`, `h2/processing/quarantine.ts`):**
druhá podmínka (`processing_deadline_at !== null && now >
processing_deadline_at`) se nahradí `charged_processing_ms >=
processing_budget_ms`. `attempt_count >= MAX_ATTEMPTS` zůstává první
podmínka beze změny.

**Návrh — kdo připočítává `charged_processing_ms` a kdy:**
- **Známý výsledek** (`work()` vrátí úspěch, nebo throwne a
  `recordJobFailure()` se zavolá explicitně): měřená doba trvání pokusu
  (`resolved_at - created_at` z odpovídajícího `llm_attempts` řádku,
  Rozhodnutí 10) se připočítá k `charged_processing_ms` ve stejné
  transakci jako `resolveJobFailure()`'s update.
- **ABANDONED_UNKNOWN** (lease vypršel, `lease.ts`'s reap větev
  reklamuje job po mrtvém procesoru): **nejvýše hard timeout právě
  běžící stage** — ne doba, po kterou job ležel bez executoru.

  **Oprava nálezu (2026-09-04):** v1 tohoto rozhodnutí počítala vždy s
  **plochou** hodnotou rovnou stage's hard timeoutu, kdykoli existoval
  `llm_attempts` řádek se `status='CALL_INTENT'` pro reapovaný job. To je
  špatně — gate rozhodl "**nejvýše** hard timeout stage" (horní mez), ne
  "**vždy přesně** hard timeout" (plochá hodnota). Plochých 60 000 ms
  znamená, že dva pokusy, co spadnou prakticky okamžitě po `CALL_INTENT`
  insertu (např. síťová chyba hned po odeslání requestu, reálná práce
  ≈ 0 ms), vyčerpají celý 120s TEXT budget (`2 × 60 000 ms = 120 000 ms`)
  dřív, než padne třetí pokus, aniž kdokoli reálně pracoval — **tatáž
  asymetrie, kvůli které vzniklo DEC-008** (retry budget by dál neměřil
  skutečnou práci, jen tentokrát skrz plochý odhad místo wall clocku).

  **Opravený vzorec:** pokud existuje `llm_attempts` řádek se
  `status='CALL_INTENT'` pro reapovaný job (Rozhodnutí 10 — znamená, že
  volání bylo v letu, když procesor zmrzl/spadl), připočítá se
  ```
  min(reap_time - llm_attempts.created_at, stage_hard_timeout_ms)
  ```
  kde `stage_hard_timeout_ms` je `CALL_TIMEOUT_MS = 60_000` pro LLM
  volání a `reap_time` je okamžik, kdy `lease.ts`'s reap větev job
  skutečně reklamuje (ne okamžik teoretického vypršení stage). `min()`
  splňuje obě strany DEC-008's pravidla zároveň: (1) **horní mez** —
  nikdy se nepřipočítá víc, než kolik mohla stage reálně běžet, ať reap
  přijde jakkoli pozdě (nikdy doba, po kterou job ležel bez executoru);
  (2) **žádné nadhodnocení krátkých selhání** — pokud reap přijde brzy po
  `CALL_INTENT` (rychlý crash), připočítá se ta krátká skutečná doba, ne
  vynucených 60 000 ms navíc. Pokud žádný `CALL_INTENT` řádek pro daný
  reap neexistuje (procesor spadl dřív, než stihl zavolat cokoliv
  externího), připočítá se `0` — žádný metered náklad nevznikl.
  `llm_attempts` řádek samotný se při reapu přepne na `ABANDONED_UNKNOWN`.

**Proč Krok 2 závisí na Kroku 1 (`llm_attempts`, Rozhodnutí 10):**
ABANDONED_UNKNOWN accounting výše potřebuje vědět, jestli byl v letu
`CALL_INTENT` řádek a jaké stage patřil — to je přesně to, co Rozhodnutí
10's tabulka poskytuje. Bez ní by `isJobExhausted()`'s reap větev neměla
zdroj pravdy pro "co se právě dělo", jen hádala by z `attempt_count`.
Proto je pořadí v "Implementační strategie" níže Krok 1 (retry taxonomie +
`llm_attempts`) → Krok 2 (deadline sémantika, čte `llm_attempts`).

**Dopad na §4.2 doslovné znění a na uzavřený BUILD-05:** viz
[DEC-008](./DECISIONS.md#dec-008) — mění chování popsané v uzamčené
architektuře, zapsáno jako `ARCHITECTURE DECISION REQUIRED`, ne jako tichá
implementační volba.

## Rozhodnutí 10 (nové, z gate — potvrzeno nezávisle na volbě budíku): `llm_attempts` s CALL_INTENT

**Kontext:** gate potvrdil tenhle mechanismus jako nutný bez ohledu na to,
jak se nakonec vyřeší liveness (Rozhodnutí 8) — je to metering/accounting
oprava, ne trigger oprava. Řeší zároveň mezeru z PR #38 (Rozhodnutí 3
výše) i dodává vstupní data pro Rozhodnutí 9's ABANDONED_UNKNOWN
accounting.

**Návrh — nová tabulka `llm_attempts` (migrace, Krok 1):**
```sql
llm_attempts
-------------
id uuid primary key
owner_id uuid not null references owners (id)
job_id uuid not null references message_processing_jobs (id)
purpose text not null              -- BUDDY_RESPONSE | OPERATIONAL_EXTRACTION
model_id text not null
status text not null default 'CALL_INTENT'
  -- CALL_INTENT | SUCCEEDED | FAILED_CONFIRMED | ABANDONED_UNKNOWN
charged_processing_ms bigint null  -- vyplní se při rozhodnutí (viz Rozhodnutí 9)
created_at timestamptz not null default now()
resolved_at timestamptz null
```
Grant pro `h2_runtime` v téže migraci (vzor `0015_prompt_registry_runtime_
grants.sql`), ne editace `0011_roles_and_rls.sql` přímo.

**Výklad "ve stejné transakci jako claim" — ROZHODNUTO (Honzík,
2026-09-04): varianta (b).** Honzíkovo zadání znělo "Řádek committed PŘED
externím voláním, ve stejné transakci jako claim." — připouštělo dvě
čtení:
- (a) doslovně — `claimNextJob()`/`claimSpecificJob()` (`h2/processing/
  lease.ts`) by musely být rozšířené o insert `llm_attempts` řádku uvnitř
  téže DB transakce, která claimuje job, PŘED commitem. Zavrženo: v
  okamžiku claimu ještě nevíme, kolik/jaká volání proběhnou (extrakce i
  Buddy response jsou dvě samostatná volání s různým `purpose`, ne
  jedno), takže by `claimNextJob()` musel přijmout seznam očekávaných
  `purpose`ů dopředu — mění to signaturu fronty kvůli něčemu, co fronta
  sama neví.
- (b) **potvrzeno** — "claim" se tu myslí volněji: insert `llm_attempts`
  řádku JE svůj vlastní atomický commit, který "claimuje" konkrétní
  volání, analogicky k tomu, jak `claimNextJob()` claimuje job. Dva
  nezávislé, ale oba atomické zápisy, každý bezprostředně před akcí,
  kterou reprezentuje (job claim před zpracováním jobu, `llm_attempt`
  claim před konkrétním LLM voláním).

`withLlmAttempt(pool, token, purpose, fn)` helper (viz Rozhodnutí 1's
pseudokód) insertne `CALL_INTENT` řádek v jedné krátké transakci, pak
zavolá `fn()` (externí volání MIMO transakci — nedrží se DB transakce
otevřená přes network round-trip, stejný vzor jako `commitJobResult()`),
pak podle výsledku updatne řádek na `SUCCEEDED`/`FAILED_CONFIRMED` a
zapíše `charged_processing_ms` (měřená doba). Žádné další potvrzení
nepotřeba — implementace Kroku 1 vychází z (b) přímo.

**Vztah k `llm_runs` (BUILD-07, existující tabulka):** `llm_runs` se
zapisuje **po** volání, jako audit log dokončeného runu (`status`: `OK` /
`ERROR` / `TIMEOUT`) — zůstává beze změny, `recordLlmRun()`/
`recordAnthropicUsage()` volání nikam nemizí. `llm_attempts` je nová,
komplementární tabulka pro **před-voláním** commit intent + retryable
metering gap z PR #38. Dvě různé odpovědnosti, ne duplicitní schema.

## Implementační strategie: 4 kroky, ne jeden diff (po vzoru BUILD-09)

Žádný krok kromě Kroku 4 nesmí zapojit produkční trigger, aby `main`
nikdy nebyl v nekonzistentním mezistavu — přesně stejný princip jako
BUILD-09's 4 kroky.

### Krok 0 (prerekvizita, ne vlastní BUILD-11 krok): PR #35 merge

Honzíkovo GO na merge PR #35 (Rozhodnutí 7) **před** Krokem 1 — čistě
proto, aby migrace `0016` zabrala své číslo dřív, než ji zabere Krok 1's
nová migrace (viz "Migrace" tabulka níže). Samotný merge nic neprovede v
produkci (jen rozšíří CHECK constraint a přidá skript) — `clear-stale-
pending-jobs.ts --confirm` se spustí až bezprostředně před Krokem 4.

### Krok 1 — retry taxonomie + `llm_attempts` CALL_INTENT metering

**Obsah:** Rozhodnutí 3 (adaptér error class split, `resolveJobFailure()`
retryable vstup) + Rozhodnutí 10 (`llm_attempts` tabulka, `withLlmAttempt()`
helper). Dotýká se `h2/prompts/anthropic-adapter.ts` a
`h2/processing/quarantine.ts` (oba BUILD-05/BUILD-07 uzavřené bloky) plus
nové migrace.

**Migrace:** `0017_llm_attempts.sql` — nová tabulka `llm_attempts` + grant.

**Proč je bezpečné mergnout samostatně:** žádný produkční caller dnes
volá `resolveJobFailure()` (BUILD-11's trigger je až Krok 4) ani
`withLlmAttempt()` (nová funkce, nikým nevolaná mimo testy) — merge mění
jen interní chování fronty a přidává prázdnou tabulku, viditelnost v
produkci nulová, dokud Krok 4 trigger nezapojí.

### Krok 2 — deadline sémantika split

**Obsah:** Rozhodnutí 9 ([DEC-008](./DECISIONS.md#dec-008)) —
`isJobExhausted()`/`resolveJobFailure()` přepracování na
`charged_processing_ms`/`processing_budget_ms`, ABANDONED_UNKNOWN
accounting čtoucí `llm_attempts` z Kroku 1. Dotýká se `h2/processing/
lease.ts` + `h2/processing/quarantine.ts` (BUILD-05 uzavřený blok).

**Migrace:** `0018_processing_budget.sql` — `message_processing_jobs` nové
sloupce (`processing_budget_ms`, `charged_processing_ms`), drop
`processing_deadline_at` (ROZHODNUTO, viz Rozhodnutí 9).

**Proč je bezpečné mergnout samostatně:** stejný důvod jako Krok 1 — žádný
produkční trigger dnes volá `claimNextJob()`/`recordJobFailure()`. Nulová
produkční řádka v `message_processing_jobs` dnes (BUILD-10 evidence),
takže drop sloupce nepotřebuje backfill ani netratí data.

**Závislost:** vyžaduje Krok 1 (čte `llm_attempts` pro ABANDONED_UNKNOWN
accounting) — musí mergnout po něm, ne paralelně.

### Krok 3 — voice handoff + delivery mechanismus + epoch kontrola (nevyžaduje)

**Obsah:** Rozhodnutí 2 (voice→text handoff, `readMessageText()`),
Rozhodnutí 4 (`responses.owner_control_epoch` sloupec, `deliverResponse()`
epoch check), Rozhodnutí 5 (quarantine notice seam), Rozhodnutí 6
(Telegram/web delivery mechanismus). `deliverResponse()` a
`sendQuarantineNotice()` implementované a jednotkově testované (vč.
Pravidlo 10's explicitní test — commit → epoch bump → `deliverResponse()`
odmítne), ale **nikým nevolané v produkci** — Krok 4 je připojí.

**Migrace — ROZHODNUTO (Honzík, 2026-09-04): dvě samostatné migrace, ne
sloučit.** `0019_response_delivery_epoch.sql` — `responses.
owner_control_epoch` sloupec; `0020_system_notice_deliveries.sql` — nová
tabulka `system_notice_deliveries` pro Rozhodnutí 5. Důvod oddělení:
různé subjekty (`responses` je existující BUILD-02 tabulka, `system_
notice_deliveries` je zcela nová) a Pravidlo 5 (BUILD-STATUS.md)
vyžaduje ověření `_h2_migrations` u každé migrace zvlášť, přímým dotazem
na production i preview větev — sloučením by se tohle ověření provedlo
jen jednou za dvě věcně nesouvisející schema změny, ne za každou.

**Proč je bezpečné mergnout samostatně:** `deliverResponse()`/
`sendQuarantineNotice()` jsou nové, testované funkce bez produkčního
volajícího — merge nemění, jestli se dnes něco reálně pošle přes Telegram
nebo web (nic se dnes nepošle, protože nic dnes nevolá
`generateBuddyResponse()` v produkci). Migrace přidávají sloupec/tabulku
bez existujících dat k migraci.

**Závislost:** nezávisí na Kroku 1/2 — mohl by jít paralelně, ale
sekvenčně po nich kvůli review kapacitě (stejný důvod jako BUILD-09).

### Krok 4 — trigger wiring (jediný krok s produkčním dopadem)

**Obsah:** Rozhodnutí 1 (`processOwnerQueueBounded()` zapojené do `after()`
v obou ingest routes), Rozhodnutí 8 (wake endpoint `/api/internal/queue-
wakeup` + `H2_QUEUE_WAKE_SECRET`), a **bezprostředně před mergem** tohohle
kroku: Rozhodnutí 7's `clear-stale-pending-jobs.ts --confirm` spuštění
(Honzíkovo GO).

**Migrace:** žádná nová — `0016` (PR #35, Krok 0) už aplikovaná a
ověřená.

**Proč TENHLE krok, a ne dřívější, zapojuje produkční trigger:** je to
jediné místo v celém plánu, kde `after()` skutečně začne volat
`claimNextJob()`/`generateBuddyResponse()`/`deliverResponse()` na živém
Telegram/web provozu — vše, co k tomu Kroky 1–3 potřebují (retry
taxonomie, deadline sémantika, delivery mechanismus, epoch kontrola), musí
existovat a být otestované PŘED touhle chvílí, jinak by trigger běžel proti
neúplné/nekonzistentní fázi vlastní fronty.

**Vyžaduje živé ověření před GO na merge:**
- Vercel `maxDuration` pro obě ingest routes i pro wake endpoint
  (Rozhodnutí 8's otevřený bod 3) — `WORST_CASE_JOB_DURATION_MS` výpočet
  (Rozhodnutí 1) je bezcenný bez skutečného čísla, ne odhadu.
- **Vyřešeno (Rozhodnutí 8's bod 4):** interval budíku je **ROZHODNUTO —
  30 minut, pevně** (Honzík, 2026-09-04; minutový interval zamítnut kvůli
  Neon Free 100 CU-h/měsíc limitu a suspend-při-vyčerpání chování).
  Jediná zbývající podmínka před mergem Kroku 4: wake endpoint se nesmí
  zapojit do provozu dřív, než je Krok 2 mergnutý (bod 4e) — dnešní
  pořadí Kroků 1→2→3→4 tohle už zajišťuje, stačí ho nezkracovat. Ověření
  skutečné velikosti computu je nezávazná monitorovací poznámka
  (Rozhodnutí 8's "Poznámka"/"Monitorovací bod"), Krok 4 na ní nečeká.

### Migrace — souhrn

| # | Krok | Soubor | Tabulka/sloupec | Zasahuje uzavřený blok? |
|---|------|--------|------------------|--------------------------|
| — | Krok 0 | `0016_manually_cleared_job_status.sql` (PR #35, existuje) | `message_processing_jobs_status_check` | ANO — BUILD-02 (`0002_messaging.sql`) |
| 1 | Krok 1 | `0017_llm_attempts.sql` (nová) | nová tabulka `llm_attempts` (FK na `message_processing_jobs`) | Aditivní FK na BUILD-02 tabulku, samo o sobě nová tabulka |
| 2 | Krok 2 | `0018_processing_budget.sql` (nová) | `message_processing_jobs` — 2 nové sloupce, 1 drop | ANO — BUILD-02 (`0002_messaging.sql`), sémanticky BUILD-05 |
| 3 | Krok 3 | `0019_response_delivery_epoch.sql` (nová) | `responses.owner_control_epoch` | ANO — BUILD-02 (`0002_messaging.sql`) |
| 3 | Krok 3 | `0020_system_notice_deliveries.sql` (nová, samostatně od 0019 — ROZHODNUTO) | nová tabulka `system_notice_deliveries` | Aditivní, nezasahuje existující tabulku |
| 4 | Krok 4 | žádná | — | — |

**Celkem: 4 nové migrace v tomto plánu (0017–0020) + 1 už existující
nemergnutá (0016 z PR #35).** Tři z pěti (0016, 0018, 0019) mění schéma
uzavřeného BUILD-02 bloku (`0002_messaging.sql`) — aditivně (sloupce/CHECK
rozšíření), žádná nepřepisuje ani neodstraňuje existující produkční data
(BUILD-10 evidence: 0 řádků v `responses`/`message_processing_jobs` dnes).

## Test plán (návrh, upřesní se při implementaci)

- **AT-10**: mock Telegram `sendMessage` timeoutne/vrátí nejasnou chybu →
  `response_deliveries.status='AMBIGUOUS'`, žádný druhý `responses` řádek
  ani druhý delivery pokus. (Krok 3)
- **Pravidlo 10**: commit response → `owner_control_epoch` vzroste (STOP)
  → `deliverResponse()` odmítne odeslat, `sendMessage` mock nebyl zavolán.
  (Krok 3)
- **Voice handoff** (Rozhodnutí 2): hlasovka po `commitVoiceTranscript()`
  → `generateBuddyResponse()` ji najde a zpracuje. (Krok 3)
- **Retry taxonomie** (Rozhodnutí 3): `ANTHROPIC_AUTH_ERROR`/
  `ANTHROPIC_REFUSAL` → okamžitá karanténa bez ohledu na `attempt_count`;
  `ANTHROPIC_SERVER_ERROR`/`ANTHROPIC_RATE_LIMITED` → retry s backoffem
  (`retry-after` respektován, pokud přítomný). (Krok 1)
- **`llm_attempts` CALL_INTENT** (Rozhodnutí 10): volání selže PŘED
  odpovědí → `llm_attempts` řádek existuje se `status='CALL_INTENT'`
  vytvořený před `fetch`; po throwu je `status='FAILED_CONFIRMED'` s
  `charged_processing_ms` nastaveným. (Krok 1)
- **Deadline sémantika** (Rozhodnutí 9, DEC-008): tři pokusy s uměle
  vloženou wall-clock prodlevou mezi nimi (simulovaný infra výpadek), ale
  nízkým `charged_processing_ms` součtem → job **nejde** do karantény jen
  kvůli uplynulému wall-clock času. ABANDONED_UNKNOWN reap s otevřeným
  `CALL_INTENT` řádkem → `charged_processing_ms` připočte přesně
  `CALL_TIMEOUT_MS`, ne měřenou dobu od insertu. (Krok 2)
- **Idempotence**: dva `processOwnerQueueBounded()` běhy nad stejným
  `responseId` → jeden `response_deliveries` řádek. (Krok 3)
- **Rozpočtovaná smyčka** (Rozhodnutí 1): mock `deadlineAt` blízko `now()`
  → smyčka se zastaví PŘED dalším `claimNextJob()`, i když fronta není
  prázdná; žádný claim, který by nestihl `WORST_CASE_JOB_DURATION_MS`.
  (Krok 4)
- **Wake endpoint** (Rozhodnutí 8): request bez/s nesprávným
  `X-H2-Wake-Secret` → `401`/`403`, žádné volání `processOwnerQueueBounded()`;
  se správným secretem → `204`, prázdné tělo odpovědi. (Krok 4)
- Trigger smyčka (Rozhodnutí 1): dvě rychlé zprávy stejného ownera → obě
  zpracované v pořadí `input_sequence`. (Krok 4)
- `MANUALLY_CLEARED` (Rozhodnutí 7, PR #35): `claimNextJob()` ho přeskočí
  — test už napsaný v PR #35. (Krok 0)

## Co zůstává mimo scope (vědomě)

- Skutečné websocket/SSE pro web delivery — polling je dostačující pro M1.
- Scheduler-driven recovery pro `job_definitions`/`job_runs` (BUILD-23) —
  BUILD-11's wake endpoint (Rozhodnutí 8) probouzí jen `message_processing_
  jobs` frontu, ne proaktivní scheduler cestu. Nezaměňovat.
- Bare-word/IGNORE/DELETE/HARD_DELETE/RECONSIDER/CORRECT Command Gate
  detekce — BUILD-10's zúžený scope, BUILD-11 se ho nedotýká.
- Kontrakt "LLM navrhuje význam, kód rozhoduje o stavu" a trivial-turn
  gate (RED-TEAM-FINDINGS.md body 1–2) — BUILD-12, ne BUILD-11.
- **Stale age pravidlo** (Rozhodnutí 9) — hodnota i přesný tvar (který
  sloupec, na které tabulce) čeká na Honzíkovo produktové rozhodnutí,
  vědomě nenavrženo v žádné migraci tohoto plánu.

## Co potřebuji od Honzíka

1. **Schválení celého plánu v2** (Rozhodnutí 1–10) nebo úpravy k
   jednotlivým bodům — žádný řádek kódu zatím nevznikl.
2. Rozhodnutí 4, 5, 9, 10 vyžadují **novou migraci** (Pravidlo 4) —
   explicitní GO na všechny čtyři, až budou navržené konkrétní SQL.
3. Rozhodnutí 7's aktualizované pořadí: GO na merge PR #35 (před Krokem 1)
   → aplikace migrace 0016 → GO na `--confirm` spuštění skriptu
   (bezprostředně před Krokem 4) → teprve pak merge Kroku 4.
4. Rozhodnutí 8: založení `cron-job.org` účtu (externí, mimo repo) a GO na
   nový `H2_QUEUE_WAKE_SECRET` credential.
5. ~~Rozhodnutí 9: potvrzení drop `processing_deadline_at` sloupce~~ —
   **VYŘEŠENO.** Honzík rozhodl ZRUŠIT (2026-09-04), viz Rozhodnutí 9.
   Není to už otevřený bod.
6. Rozhodnutí 9: **hodnota a tvar stale-age pravidla** — produktové
   rozhodnutí, Code ho nenavrhuje (viz "Co zůstává mimo scope").
7. Ověření Vercel `maxDuration` (plán/tier) pro ingest routes i wake
   endpoint — potřeba PŘED implementací Kroku 4, ne teď.
8. ~~Rozhodnutí 8's Neon compute nález (bod 4)~~ — **VYŘEŠENO.** Interval
   budíku je 30 minut, pevně (Honzík, 2026-09-04) — minutový interval
   zamítnut (Free 100 CU-h/měsíc + suspend-při-vyčerpání chování),
   dopočet/ladění podle skutečné velikosti computu se explicitně
   nedělá. Zbývá jen nezávazný monitorovací bod (první měsíc po nasazení
   Kroku 4 sledovat CU-h spotřebu) — neblokuje schválení plánu ani Krok
   4. Není to už otevřený bod.
9. ~~Rozhodnutí 5: nová tabulka vs. rozšíření `response_deliveries`~~ —
   **VYŘEŠENO.** Honzík potvrdil (b), nová tabulka `system_notice_
   deliveries` (2026-09-04), viz Rozhodnutí 5. Není to už otevřený bod.
10. ~~Krok 3: sloučit migrace 0019+0020, nebo oddělit?~~ — **VYŘEŠENO.**
    Honzík rozhodl oddělit (2026-09-04, Pravidlo 5 — ověření
    `_h2_migrations` zvlášť za každou), viz Krok 3. Není to už otevřený
    bod.

**Rozhodnutí 10's výklad (a) vs. (b) je vyřešeno — Honzík potvrdil (b)
2026-09-04, viz Rozhodnutí 10 výše. Není to už otevřený bod.**
