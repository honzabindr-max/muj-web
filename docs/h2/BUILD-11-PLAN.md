# BUILD-11 — Telegram + web delivery — návrh plánu

**Status:** NÁVRH — čeká na Honzíkovo schválení. **NEIMPLEMENTOVÁNO.** Podle
zadání (2026-09-04): "BUILD-11 plán. ... Plán mi ukaž před stavbou." Tenhle
dokument se neimplementuje, dokud nedostane explicitní GO — na rozdíl od
BUILD-05-PLAN.md/BUILD-10-PLAN.md v tomhle repu, které už byly schválené
před zápisem.

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

Honzíkovo zadání pro tenhle plán (2026-09-04) přidává čtyři komponenty nad
rámec holého Build Specification textu: oprava `payload_type` u hlasovek po
transkripci, retry taxonomie, migrace `MANUALLY_CLEARED`, kontrola
`owner_control_epoch` před odesláním (Pravidlo 10). Všechny čtyři jsou
rozpracované níže jako součást plánu, ne odděleně.

## Co BUILD-11 znovu nestaví

- `claimNextJob()`/`renewLease()`/`recordJobFailure()`/`quarantineJob()`
  (BUILD-05, `h2/processing/lease.ts` + `quarantine.ts`) — queue/lease/
  backoff/karanténa beze změny mimo Rozhodnutí 3 (retry taxonomie) níže.
- `generateBuddyResponse()` (BUILD-10) — Buddy runtime beze změny.
- `extractOperationalCandidates()` (BUILD-08) — Haiku extrakce beze změny.
- `responses`/`response_deliveries` schéma (BUILD-02, `0002_messaging.sql`)
  — beze změny mimo Rozhodnutí 4 (epoch sloupec) a Rozhodnutí 5 (quarantine
  notice seam) níže.
- `commitVoiceTranscript()` (BUILD-06) — beze změny mimo Rozhodnutí 2 níže.

## Rozhodnutí 1 (návrh): trigger — `after()` v ingest routách, ne samostatný worker

**Kontext (ověřeno v `docs/h2/BUILD-05-PLAN.md` "Rozhodnutí 2" + živě v
Notionu §4.2):** architektura explicitně předepisuje `after()` (Next.js)
nebo ekvivalentní post-response execution, spuštěný **hned po ACK** v
ingest requestu (Telegram/web webhook, BUILD-04), pod stejnou rolí
`h2_runtime`, kterou už používá `ingestMessage()`. `after()` **není
durability mechanismus** — source of truth zůstává `message_processing_job`
v Postgresu; pokud `after()` selže/timeoutne/instance restartuje, job
zůstává `PENDING` a čeká na recovery (BUILD-23's scheduler catch-up, nebo
příští `after()` volání z dalšího requestu stejného ownera, protože
`claimNextJob()` bere vždy nejnižší processable sequence — i cizí request
tak vyzvedne zapomenutý job).

**Návrh:** nová funkce `processOwnerQueue(pool, registry, credentials,
ownerId)` v `h2/processing/process-owner-queue.ts`, volaná přes `after()`
na konci `app/api/h2/telegram/webhook/route.ts` a
`app/api/h2/web/messages/route.ts`, hned po `ingestMessage()`'s ACK. Smyčka:

```
loop:
  token = claimNextJob(pool, ownerId)
  if token === null: return  // nic k zpracování, další request to zkusí znovu
  try:
    if token je control command (Command Gate re-detekce už uvnitř generateBuddyResponse):
      // no-op ack, generateBuddyResponse ho zpracuje sám
    if payload_type vyžaduje extrakci (viz Rozhodnutí 2 pro VOICE):
      await extractOperationalCandidates(...)  // BUILD-08, best-effort — chyba tady
                                                 // nesmí zablokovat generateBuddyResponse()
    result = await generateBuddyResponse(pool, registry, credentials, token)
    await deliverResponse(pool, result.responseId, token.ownerId)  // BUILD-11 nové, Rozhodnutí 4/6
  catch (error):
    await recordJobFailure(pool, token, classifyError(error), String(error))  // Rozhodnutí 3
  continue loop  // další job stejného ownera, pokud existuje (input_sequence pořadí)
```

**Proč smyčka, ne jeden job na `after()` volání:** pokud dorazí dvě rychlé
zprávy za sebou, druhý `ingestMessage()` request má vlastní `after()`, který
by jinak soutěžil o stejný job s prvním (zbytečný `claimNextJob()` promarněný
pokus). Smyčka uvnitř jednoho `after()` zpracuje frontu ownera do vyprázdnění
dřív, než se vrátí — `claimNextJob()`'s `for update` zámek na
`owner_processing_state` řádku стejně serializuje souběžné pokusy, smyčka
jen snižuje počet zbytečných no-op volání.

**`extractOperationalCandidates()` chyba nesmí zablokovat odpověď:** BUILD-08
je "best-effort advisory data" (BUILD-10-PLAN.md), ne kritická cesta —
`try/catch` kolem volání zvlášť, chyba se zaloguje (ne `recordJobFailure`,
protože extrakce sama nevlastní žádný job/response), `generateBuddyResponse()`
pokračuje bez entity kontextu, přesně jak dnes funguje (entity resolution
prázdná, Buddy odpoví bez povědomí o zmíněných projektech).

**Otevřené pro Honzíkovo schválení:** tohle je implementační/orchestrační
rozhodnutí (kde žije trigger smyčka), ne produktová/architektonická změna —
Build Specification/Technical Architecture ho nechávají BUILD-11 na
vlastní úsudek. Zapsáno jako návrh, ne jako mechanické rozhodnutí bez GO
(na rozdíl od BUILD-05's Rozhodnutí 1), protože se dotýká dvou už
nasazených produkčních routes (BUILD-04) — chci Honzíkovo potvrzení dřív,
než se to zapojí do živého Telegram/web provozu.

## Rozhodnutí 2 (návrh): voice → text handoff — `readMessageText()` přijme obojí

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
`'TEXT'` by tenhle historický fakt smazalo (zpráva vypadá, jako by byla od
začátku psaná). Po `commitVoiceTranscript()` je `payload_ciphertext` vždy
čitelný jako text bez ohledu na `payload_type` — čtenář, co potřebuje
textový obsah, může bezpečně přijmout obojí.

**Dopad:** `readMessageText()`'s SQL `where ... and payload_type = 'TEXT'`
→ `where ... and payload_type in ('TEXT', 'VOICE')`. Žádná migrace,
žádná změna schématu — jen rozšíření WHERE podmínky v `h2/buddy/
generate-response.ts`. Nový test: hlasovka po `commitVoiceTranscript()` →
`generateBuddyResponse()` ji najde a zpracuje.

## Rozhodnutí 3 (návrh): retry taxonomie — rozpad chybových tříd napříč adaptérem a frontou

**Nalezená mezera (ověřeno v kódu 2026-09-04, `h2/processing/quarantine.ts`
+ `h2/prompts/anthropic-adapter.ts`):** `resolveJobFailure()` dnes
rozhoduje retry-vs-karanténa jen podle `attempt_count >= 3` a
`processing_deadline_at` — `reasonCode` se ukládá pro audit, nikdy se
nečte pro rozhodnutí. Adaptér má dnes (po dnešním Structured Outputs PR
#38) 5 kódů: `ANTHROPIC_TIMEOUT`, `ANTHROPIC_RATE_LIMITED`,
`ANTHROPIC_HTTP_ERROR` (míchá retryovatelné 500/529 s neretryovatelnými
400/401/403), `ANTHROPIC_REFUSAL`, `ANTHROPIC_MAX_TOKENS_TRUNCATED`
(obojí neretryovatelné — model odmítl/oříznul, retry se stejným vstupem
dopadne stejně). `ANTHROPIC_RATE_LIMITED` nečte `retry-after` hlavičku.

**Honzíkova zadaná taxonomie:** retryovat 429/500/529/síť, nikdy
400/auth/token budget/schema violation/refuz.

**Návrh — adaptér (`h2/prompts/anthropic-adapter.ts`):**
- rozpad `ANTHROPIC_HTTP_ERROR` na `ANTHROPIC_BAD_REQUEST` (400 —
  neretryovatelné, request samotný je vadný), `ANTHROPIC_AUTH_ERROR`
  (401/403 — neretryovatelné, retry se stejným klíčem nikdy neuspěje),
  `ANTHROPIC_SERVER_ERROR` (500/529 — retryovatelné, přechodná chyba
  poskytovatele),
- `ANTHROPIC_RATE_LIMITED` přečte `retry-after` hlavičku (pokud přítomná)
  a vrátí ji jako pole na chybě (např. `retryAfterSeconds?: number`) — dnes
  se zahazuje,
- `ANTHROPIC_TIMEOUT` zůstává retryovatelné (síťová chyba/AbortController),
- `ANTHROPIC_REFUSAL`/`ANTHROPIC_MAX_TOKENS_TRUNCATED` (dnešní PR #38)
  zůstávají neretryovatelné — patří do stejné třídy jako "schema
  violation"/"token budget" z Honzíkovy taxonomie.

**Návrh — fronta (`h2/processing/quarantine.ts`):** `resolveJobFailure()`
dostane novou vstupní klasifikaci `retryable: boolean` (odvozenou z
`reasonCode` přes malou lookup tabulku, ne string matching ad hoc) a
volitelný `retryAfterSeconds?: number` (přebije `RETRY_BACKOFF_SECONDS`
ladder, pokud přítomné — 429 s `retry-after: 45` čeká 45s, ne
5s/15s/30s ladder). Pokud `retryable === false`, **okamžitá karanténa bez
ohledu na `attempt_count`** — dnešní kód by neretryovatelnou chybu (např.
`ANTHROPIC_AUTH_ERROR`) nechal projít 3 marné pokusy s exponenciálním
backoffem, než by šla do karantény; to je zbytečná latence pro chybu, co
nikdy neuspěje.

**Volající (`h2/buddy/generate-response.ts`, `h2/extraction/operational-
extraction.ts`, budoucí `processOwnerQueue()`):** catch blok kolem
`generateBuddyResponse()`/`extractOperationalCandidates()` musí mapovat
zachycenou chybu (včetně `H2AnthropicCallError.code`) na
`recordJobFailure()`'s nový `retryable`/`retryAfterSeconds` vstup — dnes
`recordJobFailure()` nemá v produkci žádného volajícího vůbec (stejná
mezera jako BUILD-11 trigger obecně), takže tohle mapování dnes nikde
neexistuje a vzniká poprvé s Rozhodnutím 1's `processOwnerQueue()`.

**Mezera v meteringu zavedená PR #38 — patří sem, ne jako samostatný
forward-pointer:** `h2/prompts/anthropic-adapter.ts`'s `callAnthropicModel()`
throwuje `ANTHROPIC_REFUSAL`/`ANTHROPIC_MAX_TOKENS_TRUNCATED` dřív, než
`generateBuddyResponse()` stihne zavolat `recordLlmRun()`/
`recordAnthropicUsage()` — tahle třída chyb tak dnes nemá žádný záznam
spotřeby. Mid-stream refuz i ořez na `max_tokens` se u Anthropic API ale
účtují (na rozdíl od pre-output refuzu, který se neúčtuje vůbec), takže
dnešní kód porušuje disciplínu "zavolalo se, zaplatilo se" (BUILD-07
AT-34) přesně pro tyhle dva kódy. Obě chybové třídy už v tomhle
Rozhodnutí figurují jako neretryovatelné (viz adaptér výše) a oprava sahá
na stejná dvě místa jako zbytek rozhodnutí — adaptér i frontu/volající —
takže patří do stejného kroku/PR: adaptér musí vracet dost informace
(alespoň token counts z Anthropic response, pokud jsou u refuzu/ořezu
přítomné) na to, aby volající mohl zaznamenat spotřebu PŘED tím, než
chybu znovu vyhodí dál k `recordJobFailure()` klasifikaci výše.

**Rozsah:** tohle je největší jednotlivá komponenta plánu — dotýká se
adaptéru, fronty i nového trigger kódu zároveň. Navrhuji samostatný krok/PR
uvnitř BUILD-11 (ne jeden PR pro celý slice), aby šel review a testovat
odděleně od delivery samotné.

## Rozhodnutí 4 (návrh, vyžaduje migraci): `owner_control_epoch` kontrola před odesláním — Pravidlo 10

**Nalezená mezera (DEC-007, Pravidlo 10, BUILD-STATUS.md):**
`commitJobResult()` (BUILD-05) fencuje zápis `responses` řádku atomicky nad
`lease_epoch`+`owner_control_epoch` (AT-67/AT-71) — ale **negenerated
epoch se nikam neukládá na `responses` řádek samotný**. `response_
deliveries` (schéma dnes) nemá epoch sloupec vůbec. Bez tohohle by committed-
ale-ještě-nedoručená odpověď šla odeslat i po mezitímním PAUSE/STOP — přímo
proti §8.1 ("jeho výsledek se nesmí commitnout ani doručit, pokud control
epoch zestárl", ověřeno živě v Notionu výše).

**Návrh (vyžaduje novou migraci):**
1. `responses.owner_control_epoch bigint not null` — nový sloupec,
   populovaný `commitJobResult()` z `token.ownerControlEpoch` (hodnota už
   dnes existuje ve `FencingToken`, jen se nikam neukládá). Malá,
   bezpečná migrace — `alter table responses add column
   owner_control_epoch bigint`, pak `commitJobResult()`'s insert dostane
   nový sloupec. Existující `responses` řádky (žádné v produkci dnes —
   BUILD-10 evidence: "žádné reálné Sonnet volání") nepotřebují backfill.
2. `deliverResponse()` (Rozhodnutí 6 níže) PŘED voláním Telegram/web send
   API přečte aktuální `owner_processing_state.owner_control_epoch` pro
   ownera a porovná s `responses.owner_control_epoch` zaznamenaným při
   commitu. Pokud current > committed: **neodešle**, `response_deliveries`
   řádek (pokud existuje) zůstává/přejde do stavu, který explicitně říká
   "stopped by sovereignty", incident se založí (stejný vzor jako
   quarantine — auditovatelné, ne tiché zahození).
3. Test (Pravidlo 10's explicitní požadavek): commit response → simuluj
   `bumpOwnerControlEpochWithClient()` (STOP mezi commitem a delivery) →
   `deliverResponse()` musí odmítnout odeslání, žádné volání Telegram API
   neproběhne (mock ověří `fetch`/sendMessage nebyl zavolán).

**Proč nový sloupec, ne alternativa bez migrace:** zvažoval jsem číst
`owner_control_epoch` přímo z `owner_processing_state` v okamžiku delivery
a porovnat s... čím? Bez zaznamenané hodnoty "jaký epoch platil při
commitu" nemá delivery co porovnávat — potřebuje baseline z okamžiku
commitu, ne jen aktuální hodnotu. Jediná alternativa bez migrace by byla
přepočítávat epoch zpětně z `identity_audit_events`/control command historie
podle timestampu commitu, což je křehčí a pomalejší než jeden sloupec.
**Tohle vyžaduje Honzíkovo GO na migraci** (Pravidlo 4).

## Rozhodnutí 5 (návrh): quarantine notice delivery — samostatná cesta, ne `response_deliveries`

**Nalezená mezera (BUILD-05-PLAN.md "Rozhodnutí 3", zapsáno jako známý seam
pro BUILD-11):** `response_deliveries.response_id` je dnes `NOT NULL` —
karanténovaná zpráva ale nemá žádný `responses` řádek (proto je
karanténovaná). `response_deliveries` tak nejde použít pro doručení
"tvoje zpráva se nezpracovala" notice tak, jak je dnes navržená.

**Varianty (z BUILD-05-PLAN.md, zopakováno tady k rozhodnutí):**
- (a) rozšířit `response_deliveries.response_id` na nullable + přidat
  sloupec/typ rozlišující "je to response, nebo systémová notice",
- (b) samostatná tabulka/mechanismus pro systémové notice.

**Doporučení:** (b) — samostatný, jednodušší mechanismus mimo `response_
deliveries`. Quarantine notice nemá delivery states (`SENDING`/
`FAILED_RETRYABLE`/`AMBIGUOUS`) ve stejném smyslu jako Buddy response —
je to jednorázové systémové oznámení s idempotency klíčem už
architekturou pojmenovaným (`quarantine_notice:{job_id}`, §4.2). Návrh:
malá funkce `sendQuarantineNotice(ownerId, jobId)` volaná ze stejného
místa jako `quarantineJob()` (uvnitř `processOwnerQueue()`'s catch větve),
používající Telegram send API přímo s `idempotency_key =
quarantine_notice:{jobId}` proti **nové** malé tabulce (např.
`system_notice_deliveries`) nebo — pokud se ukáže dost jednoduché —
existující `message_processing_jobs.quarantine_notice_sent_at` marker
(BUILD-05) rozšířený o "opravdu se poslalo" stav vedle "systém se
rozhodl, že notice existuje" (dnešní sémantika, viz BUILD-05-PLAN.md).
Varianta (a) míchá dva různé lifecycle do jednoho sloupce (nullable FK +
discriminator) a riskuje, že budoucí BUILD-11+ změny v `response_
deliveries` (pro skutečné Buddy odpovědi) omylem ovlivní notice cestu.
**Vyžaduje Honzíkovo potvrzení** — dotýká se schématu (nová tabulka nebo
rozšíření `message_processing_jobs`, obojí je migrace).

## Rozhodnutí 6 (návrh): delivery mechanismus — Telegram outbound + web polling

**Telegram:** `sendMessage` Bot API (`H2_TELEGRAM_BOT_TOKEN` — dnes ve
Vercelu, ale kód ho **nikde nečte**, ověřeno BUILD-04 evidence blokem;
tohle je první místo, kde se použije). `deliverResponse()` pro
`channel='telegram'`:
1. vloží/najde `response_deliveries` řádek (`idempotency_key =
   {responseId}:telegram`, `unique(owner_id, idempotency_key)` chrání
   proti duplicitě),
2. Rozhodnutí 4's epoch check,
3. `status='SENDING'`, zavolá `sendMessage`,
4. na úspěch (Telegram vrátí `message_id`) → `status='DELIVERED'`,
   `external_message_id` uloženo,
5. na definitivní chybu (400 špatný `chat_id`, zpráva odmítnutá) →
   `status='FAILED_RETRYABLE'` (backoff, Rozhodnutí 3's taxonomie) nebo
   `DEAD_LETTER` po vyčerpání,
6. na network timeout/nejistý výsledek (fetch abort, 5xx bez jasné
   odpovědi) → `status='AMBIGUOUS'` (AT-10 přesně tohle vyžaduje) +
   incident, **žádný automatický retry** — architektura říká "recovery
   policy pracuje s původním response ID a incidentem", ne slepé znovu-
   odeslání (to by mohlo poslat zprávu dvakrát, přesně čemu se AT-10
   vyhýbá).

**Web:** žádná websocket/SSE infrastruktura dnes neexistuje — "polling"
(explicitně povolená varianta v Build Specification "podle platform
capabilities") je nejjednodušší bezpečná volba. Nová route `GET
/api/h2/web/responses` (owner-scoped přes `requireOwnerSession()`, stejný
vzor jako existující web routes), vrací responses od zadaného cursoru
(`source_input_sequence` nebo `created_at`). Web kanál nemá síťovou
nejistotu ve stejném smyslu jako Telegram (žádné externí push API,
žádný "send" krok, co může timeoutnout uprostřed) — jakmile je `responses`
řádek committed a klient ho stihne vyzvednout přes poll, je doručeno.
`response_deliveries` řádek pro `channel='web'` může jít rovnou na
`DELIVERED` v okamžiku, kdy je response dostupná k pollu (žádný
`SENDING`/`AMBIGUOUS` mezikrok pro tenhle kanál — network nejistota tam
prostě není).

## Rozhodnutí 7: migrace `MANUALLY_CLEARED` — prep hotový (PR #35), aplikace před mergem triggeru

**Stav:** implementace hotová a otestovaná na branchi (PR [#35]
(https://github.com/honzabindr-max/muj-web/pull/35), CI zelené), **ne
mergnutá, migrace neaplikovaná, skript nespuštěný** — čeká na Honzíkovo
explicitní GO "bezprostředně před BUILD-11 mergem" (jeho rozhodnutí
2026-09-03, varianta B).

Obsah (ověřeno proti PR #35 diffu): migrace `0016_manually_cleared_job_
status.sql` rozšiřuje `message_processing_jobs_status_check` o
`MANUALLY_CLEARED` — aditivní, `claimNextJob()` vybírá jen `PENDING`/
`RETRY_PENDING`, takže nový stav je strukturálně "settled" beze změny
`lease.ts`. `h2/db/scripts/clear-stale-pending-jobs.ts` — dry-run
default, `--confirm` pro zápis, `--reason` povinné pro audit trail,
nikdy se nedotkne `raw_events` (I7.2).

**Pořadí, které tenhle plán předpokládá** (Pravidlo 5 — migrace se
neaplikují automaticky, ověřit `_h2_migrations` přímo):
1. Honzíkovo GO na merge PR #35 (samotný merge nic neprovede — jen
   rozšíří CHECK constraint a přidá skript).
2. Aplikace migrace 0016 na production i preview `h2-runtime`, ověřeno
   přímým dotazem na `_h2_migrations`.
3. Honzíkovo GO na spuštění `clear-stale-pending-jobs.ts --confirm`
   (jednorázová operace, odklidí stale PENDING joby, co se nahromadily
   před BUILD-11's triggerem existoval).
4. Teprve pak merge BUILD-11's trigger PR (Rozhodnutí 1) — aby nový
   trigger nezačal zpracovávat historické stale zprávy najednou.

## Test plán (návrh, upřesní se při implementaci)

- **AT-10**: mock Telegram `sendMessage` timeoutne/vrátí nejasnou chybu →
  `response_deliveries.status='AMBIGUOUS'`, žádný druhý `responses` řádek
  ani druhý delivery pokus.
- **Pravidlo 10 (nový test, explicitně vyžadovaný před AT GREEN)**:
  commit response → `owner_control_epoch` vzroste (STOP) → `deliverResponse()`
  odmítne odeslat, `sendMessage` mock nebyl zavolán.
- Voice handoff (Rozhodnutí 2): hlasovka po `commitVoiceTranscript()` →
  `generateBuddyResponse()` ji najde a zpracuje (dnes by nenašla nic).
- Retry taxonomie (Rozhodnutí 3): `ANTHROPIC_AUTH_ERROR`/`ANTHROPIC_REFUSAL`
  → okamžitá karanténa bez ohledu na `attempt_count`; `ANTHROPIC_SERVER_
  ERROR`/`ANTHROPIC_RATE_LIMITED` → retry s backoffem (`retry-after`
  respektován, pokud přítomný).
- Idempotence: dva `processOwnerQueue()` běhy nad stejným `responseId`
  → jeden `response_deliveries` řádek (`unique(owner_id, idempotency_key)`).
- Trigger smyčka (Rozhodnutí 1): dvě rychlé zprávy stejného ownera →
  obě zpracované v pořadí `input_sequence`, žádná soutěž o job.
- `MANUALLY_CLEARED` (Rozhodnutí 7, PR #35): `claimNextJob()` ho přeskočí
  stejně jako `QUARANTINED`/`RESPONSE_READY`/`DELIVERED` — test už napsaný
  v PR #35.

## Co zůstává mimo scope (vědomě)

- Skutečné websocket/SSE pro web delivery — polling je dostačující pro M1
  (Build Specification explicitně povoluje "podle platform capabilities").
- Scheduler-driven recovery pro zapomenuté/zaseknuté joby (BUILD-23) —
  BUILD-11's trigger je reaktivní (na příchozí zprávu), ne proaktivní
  catch-up.
- Bare-word/IGNORE/DELETE/HARD_DELETE/RECONSIDER/CORRECT Command Gate
  detekce — BUILD-10's zúžený scope, BUILD-11 se ho nedotýká.
- Kontrakt "LLM navrhuje význam, kód rozhoduje o stavu" a trivial-turn
  gate (docs/h2/RED-TEAM-FINDINGS.md body 1–2) — BUILD-12, ne BUILD-11.

## Co potřebuji od Honzíka

1. **Schválení celého plánu** nebo úpravy k jednotlivým Rozhodnutím výše —
   žádný řádek kódu zatím nevznikl.
2. Rozhodnutí 4 a 5 vyžadují **novou migraci** (Pravidlo 4) — explicitní
   GO na obě, až budou navržené konkrétní SQL migrace.
3. Rozhodnutí 7's pořadí (GO na merge PR #35 → aplikace migrace 0016 →
   GO na `--confirm` spuštění skriptu → teprve pak merge triggeru).
4. Případné úpravy Rozhodnutí 1 (kde žije trigger smyčka) a Rozhodnutí 6
   (delivery mechanismus) — implementační volby, ale dotýkají se dvou
   živých produkčních routes.
