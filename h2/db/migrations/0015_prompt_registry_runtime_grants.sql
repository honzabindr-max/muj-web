-- H2 Buddy — h2-runtime — 0015_prompt_registry_runtime_grants
-- BUILD-07: h2_runtime dosud mělo na prompt_versions/prompt_test_runs jen
-- SELECT (0011_roles_and_rls.sql) — nemohlo vytvořit DRAFT verzi ani zapsat
-- test run. Enforcement "jen activatePromptVersion() smí nastavit ACTIVE"
-- zůstává na aplikační vrstvě (h2/prompts/activation.ts) + strojová CI
-- kontrola (h2/build-governance/__tests__/prompt-activation-single-writer.test.ts),
-- ne DB trigger ani column-level privilege split — viz komentář
-- v 0003_prompts_and_llm.sql řádky 20-22 a docs/h2/BUILD-07-PLAN.md
-- Rozhodnutí 1.

grant select, insert, update on prompt_versions to h2_runtime;
grant select, insert on prompt_test_runs to h2_runtime;
