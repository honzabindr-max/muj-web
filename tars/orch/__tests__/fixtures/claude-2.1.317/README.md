# Fixture `claude -p --output-format stream-json`, Claude Code 2.1.317 (PR 4c)

Tvary jsou svázané s verzí (DR-027 v2.1 §6). Test `etapa4-4c.test.ts` vyžaduje, aby každá verze v
`WATCHDOG_VERIFIED_CLAUDE_VERSIONS` měla vlastní složku `fixtures/claude-<verze>/` se souborem `VERSION`.

Původ (nic není zachycené z živého běhu, kvóta se nečerpala):

- `api-retry-rate-limit.jsonl`: pole události `system/api_retry` přesně podle emitoru v binárce 2.1.317
  (`subtype:"api_retry",attempt,max_retries,retry_delay_ms,error_status:429,error:"rate_limit"`), viz
  `tars/orch/evidence/pr4c-versions.md`. Událost nenese čas resetu.
- `result-limit-epoch.jsonl`: obálka `result` s `is_error: true` a hláškou tvaru 1 z DR-027 §8.2
  (`Claude AI usage limit reached|<epoch>`, fixture `terryso/claude-auto-resume`). `__EPOCH__` dosadí test.
- `result-limit-unknown.jsonl`: obálka limitu s tvarem, který parser nezná → „nedoloženo“.
