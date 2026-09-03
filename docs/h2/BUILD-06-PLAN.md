# BUILD-06 — Voice transcription — schválený plán

**Status:** SCHVÁLENO Honzíkem 2026-09-03 v tomto rozsahu, s doplněním
Rozhodnutí 4 (metering), 5 (šifrování transcriptu) a 6 (Whisper failure
handling) na jeho výslovný požadavek. Zapsáno pro implementaci stejným
způsobem jako `docs/h2/BUILD-05-PLAN.md`.

## Rozsah (z Build Specification v1.0, Technical Architecture v1.2 §5, §28, §31.8)

- Telegram voice download,
- `whisper-1` transkripce,
- transcript jako šifrovaný user evidence payload,
- úspěšné audio okamžitě odstranit,
- karanténní audio nejvýš 24 h,
- usage metering minut.

**DoD:** AT-04, AT-05 + test voice deadline 300 s s jedním retry (Build
Specification §6 ownership matrix).

Acceptance testy (doslovně z Technical Architecture §32):
- **AT-04** „3min voice → okamžitý ACK, transcript a odpověď bez duplicity."
- **AT-05** „Uměle zpožděný Whisper → retry bez druhého raw eventu."

## Co BUILD-06 znovu nestaví

BUILD-05 (mergnuto) už dává: `claimNextJob()` počítá `processing_deadline_at`
podle `raw_events.payload_type` (`VOICE` → 300 s, viz
`h2/processing/quarantine.ts` `deadlineSecondsFor()`), retry/backoff
(5s→15s→30s, max 3 pokusy), `commitJobResult()` (fencing-chráněné, exactly
jedna `responses` řádka), `recordJobFailure()` (retry vs. terminální
karanténa). BUILD-06 tohle **znovu nestaví** — jen to použije s reálným
voice jobem místo textového stubu, přesně jako `docs/h2/BUILD-05-PLAN.md`
používalo injektovaný `work`.

Skutečná Buddy odpověď (Sonnet volání) zůstává mimo scope — to je BUILD-10,
stejný důvod jako BUILD-05 Rozhodnutí 2 (placeholder response v produkci by
byl horší než žádný trigger). AT-04 test "odpověď bez duplicity" se ověří
stejně jako BUILD-05 ověřilo AT-03: přes `commitJobResult()` se stub
odpovědí, ne přes skutečné volání Sonnetu.

## Rozhodnutí 1: žádná nová migrace

**Transcript se ukládá in-place do stejného `raw_events` řádku**, ne do
nové tabulky ani nového sloupce.

Voice flow podle architektury (§5): "1. raw event uchová metadata a
dočasný reference handle, 2. processor stáhne audio, 3. Whisper vytvoří
transcript, 4. transcript se uloží jako versioned derived artifact, 5.
audio se po úspěšném procesu standardně odstraní."

Čtení: **ingest** (BUILD-04 `ingestMessage()`, beze změny — už je plně
generická napříč `payloadType`) zapíše `raw_events.payload_ciphertext` =
zašifrovaný malý JSON reference handle (`{telegramFileId, durationSeconds}`,
`payload_type='VOICE'`). Frontend/Buddy runtime ho v tomhle stavu nikdy
nezobrazí (žádný trigger, viz níže). **Processing** (nová
`h2/voice/commit-transcript.ts`) později přepíše **STEJNÝ** řádek —
`UPDATE raw_events SET payload_ciphertext = <transcript>, encryption_key_
version = <aktivní verze> WHERE id = $1 AND payload_type = 'VOICE'`, fencing-
chráněné stejnou epoch-check `WHERE` klauzulí jako `commitJobResult()`
(BUILD-05 vzor — subquery na `owner_processing_state` přímo v `UPDATE`, ne
"přečti pak zapiš").

**Proč to nepotřebuje novou "transcript už hotový" vlajku/sloupec:** `UPDATE`
na existující řádek je z podstaty idempotentní — opakovaný pokus (retry po
selhání/timeoutu) přepíše řádek na stejný výsledek, nevznikne duplicitní
řádek. Na rozdíl od `INSERT`u (kde by duplicita hrozila) tu není potřeba
žádný exactly-once guard navíc k tomu, co už `commitJobResult()` dělá pro
`responses`. Cena: při retry se **znovu zavolá Whisper** (stažení + přepis
proběhne znovu) — to stojí pár centů, ne data integrity riziko. AT-05 testuje
přesně tohle: "retry bez druhého raw eventu" (ne "bez druhého Whisper
volání").

**Šifrování (Honzíkův bod 2, potvrzeno explicitně):** transcript je obsah
zprávy jako každý jiný — jde přes **stejný envelope jako zbytek payloadů**
(`h2/crypto/envelope.ts` `encryptPayload()`, AES-256-GCM, `[12B IV][16B auth
tag][ciphertext]`) s vlastní `encryption_key_version` na tom samém
`raw_events` řádku (sloupec už existuje, jen se přepíše z verze platné pro
reference handle na aktuální aktivní verzi v okamžiku transkripce — mixed
key versions jsou čitelné, BUILD-03 AT-41). Žádná výjimka, žádný
plaintext-in-transit-jinam-než-do-Whisperu-a-zpět: audio i transcript
existují v plaintextu jen v paměti procesu během jednoho zpracování
požadavku, nikdy na disku/v logu (§31.7 log sanitization — `h2/voice/*`
nebude nikam logovat obsah, stejný kontrakt jako `h2/crypto/*` v BUILD-03).

**`usage_ledger`** (BUILD-02, migrace `0009`/`0002` — už existuje, `h2_runtime`
má plný GRANT) má všechny potřebné sloupce (`purpose`, `model_id`, `unit`,
`quantity`, `cost_usd`, `occurred_at`) — žádná nová migrace.

**Karanténní audio max 24 h (architektura §31.8):** BUILD-06 audio **nikdy
nepersistuje** — stáhne se do paměti (`Buffer`), pošle na Whisper a
zahodí se (garbage collected po requestu). Retry znovu stáhne z Telegramu
(file_id zůstává platný v řádu minut, retry okno je max ~50 s celkem
backoff + 3 pokusy, hluboko pod jakýmkoli Telegram file expiry). Tohle
splňuje "max 24 h" se silnější zárukou (0 h — nikdy se neuloží), takže
nevzniká potřeba žádného cleanup jobu ani Vercel Blob store. Mechanické
rozhodnutí (stejná váha jako BUILD-05 Rozhodnutí 1), ne
`ARCHITECTURE DECISION REQUIRED` — nesnižuje kontrolu/soukromí (naopak,
audio se nikde neukládá), nemění produkt.

## Rozhodnutí 2: žádný produkční trigger (stejné jako BUILD-05)

Webhook route (`app/api/h2/telegram/webhook/route.ts`) se rozšíří, aby
`voice` update **ingestoval** (raw_event + job vznikne, ACK hned po
commitu — to je přesně "okamžitý ACK" z AT-04), ale nic automaticky
nespustí stažení/přepis. Voice joby budou v produkci sedět `PENDING`,
stejně jako dnes sedí textové joby z BUILD-04 (`4 raw_events`,
`4 message_processing_jobs PENDING` — živě potvrzeno). Skutečné
zapojení (`after()` nebo scheduler) patří BUILD-10/BUILD-23, ne sem.

Feature flag `telegramVoice` (`h2/config/capabilities.ts`, dnes `false`)
se přepne na `true` po AT GREEN — gate přesně na tenhle nový branch ve
webhook routě, stejný vzor jako `telegramIngest`/`webBuddyChat`.

## Rozhodnutí 3: žádné reálné externí volání v automatických testech

Telegram `getFile`/download a OpenAI Whisper jsou skutečná HTTP volání —
CI/lokální testy proti nim nepůjdou (bez credentials, náklady, flaky síť).
Stejný princip jako zbytek repa (žádný existující test nikdy nevolá
skutečný Telegram/Google endpoint — i BUILD-03A/BUILD-04 testy volají
route handler přímo se sestaveným payloadem).

- `h2/voice/telegram-download.ts` a `h2/voice/transcribe.ts` — tenké
  adaptéry na `fetch`, testované mockovaným `fetch` (request shape, chybové
  stavy, timeout), ne reálnou sítí.
- `h2/voice/process-voice-job.ts` (orchestrace: claim → decrypt reference
  handle → download → transcribe → `commitVoiceTranscript` (transcript +
  usage_ledger atomicky, Rozhodnutí 4) → `commitJobResult` se stub
  odpovědí) přijímá `download`/`transcribe` jako injektované funkce
  (stejný vzor jako BUILD-05 `work`) — AT-04/AT-05 testy injektují fake
  verze proti reálné Postgres pod rolí `h2_runtime`.
- Skutečné ověření (reálný Telegram download + reálný Whisper call) je
  **samostatný ruční krok** po implementaci, stejný vzor jako
  `verify-ingestion.ts` — ne součást automatického test běhu ani mergu.

## Rozhodnutí 4: metering — usage_ledger se zapisuje TEĎ, ne odloženo

Whisper je první placený provider, který BUILD-06 skutečně zapojuje (na
rozdíl od BUILD-04/05, kde nic placeného neběží). Honzíkovo M1 deploy gate
pravidlo (`docs/h2/BUILD-STATUS.md` "Poznámky k zadání" č. 1) vyžaduje
`usage_ledger` zápis (purpose, exact `model_id`, token/minute count) hotový
už k M1, ne až v BUILD-27 — a explicitní odpověď, ne ticho.

**Rozhodnutí: BUILD-06 zapisuje `usage_ledger` řádek při KAŽDÉM reálném
Whisper volání, bez výjimky, od prvního commitu tohoto slicu.** Nic v
tomhle repu nezavolá skutečný Whisper endpoint mimo
`h2/voice/process-voice-job.ts` (Rozhodnutí 3 — testy jedou na mocích,
žádná jiná cesta k reálnému volání neexistuje), takže "první placený
provider běžel měsíc bez záznamu" nemůže nastat i tak, protože dokud
BUILD-10 nezapojí trigger, nic Whisper v produkci vůbec nevolá (Rozhodnutí
2) — a jakmile BUILD-10 trigger zapojí, zavolá výhradně tuhle
`process-voice-job.ts` cestu, která metering má vestavěný, ne přidaný
navíc.

**Atomicita:** `commitVoiceTranscript()` udělá `UPDATE raw_events` (fencing)
a `INSERT INTO usage_ledger` **ve STEJNÉ DB transakci** (jeden
`withOwnerScope` blok, dvě dotazy na stejném klientovi) — ne dva oddělené
round-tripy. Buď se transcript i usage záznam zapíšou oba, nebo žádný
(rollback při chybě). Vylučuje scénář "transcript se zapsal, ale metering
selhal a nikdo si toho nevšiml".

**Přesné hodnoty do `usage_ledger`:**
- `purpose = 'voice_transcription'`,
- `model_id = 'whisper-1'` (pinned, přesně podle architektury "Voice: OpenAI whisper-1"),
- `unit = 'minutes'`,
- `quantity` = Telegramem nahlášená `voice.duration` (sekundy, ze samotného
  Telegram update, ne odhad z velikosti souboru ani wall-clock doba
  zpracování) `/ 60`,
- `cost_usd` = `quantity * 0.006` (referenční sazba `$0.006/min` přímo z
  architektury §28 — hardcoded konstanta v `h2/voice/usage.ts` s komentářem
  že `pricing_catalog` lookup je BUILD-27, ne BUILD-06; `cost_usd` NOT NULL
  ve schématu, takže hodnotu nejde nechat prázdnou "na později").

**Co se OPRAVDU odkládá a proč — explicitně, ne mlčky:**
1. **Tvrdý strop 35 USD/měsíc (blokace volání)** — BUILD-06 zapisuje
   spotřebu, ale nekontroluje kumulativní součet před voláním a
   neodmítá volání nad limitem. Důvod: bez produkčního triggeru
   (Rozhodnutí 2) dnes nic Whisper automaticky nevolá, takže je
   fakticky nemožné limit v produkci překročit tímhle slicem. Enforcement
   (`< 25 USD` normální, `>= 25` warning, `>= 30` pozastavit neurgentní,
   `>= 35` blokovat non-essential call) patří do M1 deploy gate checklistu
   (`docs/h2/BUILD-STATUS.md`, položka "Minimální metering... tvrdý strop
   35 USD/měsíc vynucený") — **musí být hotové PŘED M1, ne až v plném
   BUILD-27**, ale je to samostatný kus práce (čte `usage_ledger`
   agregovaně přes všechny purposes, ne jen voice), ne součást BUILD-06.
   Zapsáno tady explicitně, aby to nezůstalo tichou mezerou do M1.
2. **`pricing_catalog` řádek pro `whisper-1`** — BUILD-06 cenu hardcoduje
   (viz výše), neseeduje `pricing_catalog` tabulku. Plný katalog + dashboard
   `projected_monthly_cost` je BUILD-27.

## Rozhodnutí 5: šifrování transcriptu — viz Rozhodnutí 1

Potvrzeno výše u Rozhodnutí 1 (Honzíkův bod 2) — transcript jde přes
stejný `encryptPayload()` envelope jako každý jiný payload, vlastní
`encryption_key_version` na řádku, žádná výjimka.

## Rozhodnutí 6: selhání Whisperu jde přes BUILD-05 retry/karanténu beze změny

**Žádná voice-specific failure cesta.** Timeout, rate limit (`429`), `5xx`
z Telegram downloadu i z Whisperu se chovají identicky — `download()`/
`transcribe()` throwne, `process-voice-job.ts` chybu **nepolyká**, stejný
kontrakt jako `commitJobResult()`'s `work()` (BUILD-05: "Pokud work()
selže, commitJobResult nic nemění v DB a chybu propaguje — volající zavolá
recordJobFailure()"). Volající (ruční ověřovací skript, později BUILD-10
trigger) chybu odchytí a zavolá `h2/processing/quarantine.ts`
`recordJobFailure(pool, token, errorCode, errorDetail)` — **beze změny
kódu BUILD-05**. Backoff (5s→15s→30s), max 3 pokusy, terminální
`QUARANTINED` s exactly-once incidentem fungují pro voice job úplně stejně
jako pro text job — jediný rozdíl je `deadlineSecondsFor('VOICE') = 300s`
místo `120s`, což `claimNextJob()` už počítá automaticky podle
`raw_events.payload_type` (BUILD-05, beze změny).

**Žádná klasifikace retryable/non-retryable:** timeout, rate limit, 5xx,
i teoreticky "trvalá" chyba (např. `400` na poškozené audio) jdou všechny
stejnou cestou (retry → případně karanténa po 3 pokusech/deadline).
Zbytečný Whisper call navíc při netriviálně vadném vstupu stojí pár centů,
ne datovou integritu — konzistentní s tím, že BUILD-05 dnes taky
nerozlišuje typy selhání. `errorCode` string předaný do
`recordJobFailure()` (`TELEGRAM_DOWNLOAD_TIMEOUT`,
`TELEGRAM_DOWNLOAD_HTTP_ERROR`, `WHISPER_TIMEOUT`, `WHISPER_RATE_LIMITED`,
`WHISPER_HTTP_ERROR`) je jen observabilita (`last_error_code`,
`incidents.detail_code`), neřídí control flow.

**Rozpočet do 300s deadline:** 3 pokusy × (download timeout + transcribe
timeout) + backoff (5+15+30 = 50s) musí bezpečně vejít pod 300s. Každý
`fetch` v `telegram-download.ts`/`transcribe.ts` dostane explicitní
`AbortController` timeout **45s** (300s / 3 pokusů ≈ 100s na pokus i s
rezervou, 45s na jedno síťové volání je konzervativní — 3× (45s download +
45s transcribe) + 50s backoff = 320s teoreticky těsné, proto claim/retry
smyčka navíc kontroluje `processing_deadline_at` před KAŽDÝM novým
pokusem (BUILD-05 `isJobExhausted()` — beze změny), takže i kdyby jednotlivé
timeouty souhrnně mírně přetáhly, job jde do karantény, ne do nekonečné
smyčky nad deadline).

## Credentials / env proměnné — ANO, dvě nové (fail-closed, `requireEnv`)

Implementace + všechny automatické testy (mockovaný `fetch`) **nepotřebují
žádné nové credentials** — jedou čistě proti reálné testovací Postgres,
stejně jako BUILD-05.

Aby ale mechanismus mohl v realitě něco udělat (ruční ověření po
implementaci, a později skutečné zapojení v BUILD-10), potřebuju od tebe:

1. **`H2_TELEGRAM_BOT_TOKEN`** — Telegram Bot API `getFile` + stažení
   audio bajtů vyžaduje bot token v URL cesty. Tenhle token **už máš** (použil
   jsi ho na `setWebhook`) — kód ho dnes nikde nečte (BUILD-04 poznámka:
   "H2_TELEGRAM_BOT_TOKEN vůbec nečte"). Potřebuju ho přidat do Vercel env
   (production + preview) — **nikdy mi ho neposílej v chatu**, rovnou do
   Vercelu (`vercel env add H2_TELEGRAM_BOT_TOKEN`) nebo mi řekni, až bude
   uložený, a já ověřím jen jméno proměnné přes `check-required-env.ts`.
2. **`H2_OPENAI_API_KEY`** — nový credential, tohle je první OpenAI
   integrace v projektu (zatím jen Anthropic). Potřebuješ účet na
   platform.openai.com s aktivním billingem (Whisper je placené, referenční
   cena v architektuře `$0.006/min`) a vygenerovaný API klíč. Stejně jako
   výše — rovnou do Vercel env, nikdy do chatu.

**Kdy je reálně potřebuju:** NE na začátek implementace — mechanismus
postavím a otestuju (mockovaně) bez nich. Potřebuju je až těsně před ruční
end-to-end verifikací (pošlu ti přesný `vercel env add` příkaz na zkopírování,
až tam budu). Merge do `main` na ně čekat nemusí — stejně jako
`H2_LEDGER_HMAC_KEY` dnes, `check-required-env.ts` je jen nahlásí jako
chybějící (informační, ne blokující merge), dokud nic v produkci
automaticky netriggeruje jejich použití (Rozhodnutí 2).

## Soubory k vytvoření/upravit

- `h2/voice/telegram-download.ts` — `downloadTelegramVoiceAudio(fileId, botToken)`: `getFile` + stažení, `AbortController` timeout 45s (Rozhodnutí 6).
- `h2/voice/transcribe.ts` — `transcribeAudio(audio, mimeType, apiKey)`: OpenAI Whisper `whisper-1`, timeout stejným vzorem (45s).
- `h2/voice/config.ts` — `loadVoiceProviderConfig()`: `requireEnv({H2_TELEGRAM_BOT_TOKEN, H2_OPENAI_API_KEY})`, stejný fail-closed vzor jako `h2/crypto/keys.ts`.
- `h2/voice/usage.ts` — konstanty (`WHISPER_MODEL_ID = 'whisper-1'`, `WHISPER_RATE_USD_PER_MINUTE = 0.006`) + `recordWhisperUsage(client: PoolClient, ownerId, durationSeconds)`: čistý insert builder do `usage_ledger`, volaný ZEVNITŘ `commitVoiceTranscript`ovy transakce (Rozhodnutí 4), ne jako samostatný round-trip.
- `h2/voice/commit-transcript.ts` — `commitVoiceTranscript(pool, registry, token, transcriptPlaintext, durationSeconds)`: JEDNA `withOwnerScope` transakce = fencing-chráněný `UPDATE raw_events` in-place (Rozhodnutí 1/5) + `recordWhisperUsage` insert (Rozhodnutí 4), atomicky.
- `h2/voice/process-voice-job.ts` — orchestrace claim → decrypt reference handle → `download`/`transcribe` (injektované, chyby se nepolykají — Rozhodnutí 6) → `commitVoiceTranscript` → `commitJobResult` (stub response).
- `h2/voice/errors.ts` — typované chyby (`H2VoiceDownloadError`, `H2VoiceTranscriptionError`) s `errorCode` hodnotami z Rozhodnutí 6.
- `app/api/h2/telegram/webhook/route.ts` — nová větev pro `message.voice` (ingest s reference handle payloadem, feature-flag `telegramVoice`), beze změny existující TEXT větve.
- `h2/config/capabilities.ts` — `telegramVoice: false → true` po AT GREEN.
- `h2/build-governance/required-env.ts` — přidat `H2_TELEGRAM_BOT_TOKEN`, `H2_OPENAI_API_KEY` (fail-closed).
- Testy pod rolí `h2_runtime`: `h2/voice/__tests__/process-voice-job.test.ts` (AT-04, AT-05, voice-deadline-s-retry), `h2/voice/__tests__/telegram-download.test.ts` a `transcribe.test.ts` (mockovaný `fetch`), `app/api/h2/telegram/webhook/__tests__/route.voice.test.ts` (ingest větev + okamžitý ACK).

## Test plán

- **AT-04:** ingest voice update (duration 180 s) → route vrátí `200` hned po `ingestMessage()` commitu (bez volání download/transcribe — ty se nevolají synchronně ve webhook requestu). Odděleně: `claimNextJob` (300s deadline potvrzen) → `processVoiceJob` s fake `download`/`transcribe` → `raw_events.payload_ciphertext` dešifruje (stejným `registry`) na transcript text (ne na file_id JSON), `encryption_key_version` odpovídá aktivní verzi → přesně jedna `responses` řádka → přesně jeden `usage_ledger` řádek (`purpose='voice_transcription'`, `model_id='whisper-1'`, `unit='minutes'`, `quantity = 180/60 = 3`, `cost_usd = 0.018`).
- **AT-05:** fake `transcribe` na první pokus throwne (simulace "uměle zpožděný/timeoutlý Whisper", `errorCode='WHISPER_TIMEOUT'`) → `recordJobFailure` (BUILD-05, beze změny) → `RETRY_PENDING` → manipulace `available_at` do minulosti (stejná technika jako BUILD-05 testy) → druhý claim → fake `transcribe` uspěje → commit. Assert: **stále jen jeden** `raw_events` řádek pro původní ingest (žádný druhý vznikl), přesně jedna `responses` řádka, přesně **jeden** `usage_ledger` řádek (první, selhaný pokus nevolal `commitVoiceTranscript`, takže nezapsal usage — metering se váže na úspěšný Whisper call, ne na pokus).
- **Voice deadline 300 s + 1 retry:** ingest voice → claim → `processing_deadline_at` = `first_started_at + 300s` (ne 120s) → simulace jednoho selhání + retry v rámci deadline → druhý claim uspěje bez karantény (na rozdíl od AT-54's 3 pokusy, tady stačí ověřit, že `deadlineSecondsFor('VOICE')` reálně řídí `claimNextJob` pro skutečný voice job, ne syntetický).
- **Atomicita metering (Rozhodnutí 4):** fencing selže (stejný vzor jako AT-71 — `bumpOwnerControlEpoch` mezi claim a commit) → `commitVoiceTranscript` throwne `H2FencingError` → assert **nula** `usage_ledger` řádků (rollback smazal i insert, ne jen `raw_events` update).
- Adaptéry (`telegram-download.test.ts`, `transcribe.test.ts`): mockovaný `fetch` — happy path, non-200 response, timeout/abort → mapování na `errorCode` z Rozhodnutí 6.
- Webhook route: nová větev ingestuje `message.voice`, existující TEXT větev beze změny (regresní pokrytí).

## Co zůstává mimo scope (vědomě)

- Skutečné volání Sonnetu / Buddy odpověď (BUILD-10).
- Automatické produkční spuštění zpracování voice jobů (`after()`/scheduler) — Rozhodnutí 2.
- Enforcement tvrdého 35 USD měsíčního stropu (M1 deploy gate / BUILD-27) — BUILD-06 jen **zapisuje** do `usage_ledger`, neblokuje volání podle limitu.
- `pricing_catalog` lookup pro cenu — BUILD-06 použije zdokumentovanou referenční sazbu `$0.006/min` přímo (stejná hodnota jako v architektuře §28), plný katalog patří BUILD-27.
- Jakýkoli storage pro audio (Vercel Blob apod.) — Rozhodnutí 1, audio se nikdy nepersistuje.
