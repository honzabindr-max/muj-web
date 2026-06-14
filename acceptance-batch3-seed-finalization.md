# Acceptance: promote 5 EN seeds from experimental to production pool (batch 3)

## Výsledek: PASS ✓

| Check | Výsledek |
|---|---|
| `py_compile` | PASS |
| `_INTENT_SEEDS["en"]` | 15 seedů (10 + 5) ✓ |
| `_INTENT_SEEDS_EXPERIMENTAL["en"]` | 3 seedy (best, best broadband for, best fiber internet for) ✓ |
| `_INTENT_SEEDS_EXPERIMENTAL["pt"]` | `["melhor "]` beze změny ✓ |
| Žádný duplikát mezi poolem | ✓ |
| `git diff --name-only` | jen `scripts/phase2b_pilot_crawl.py` ✓ |

## `_INTENT_SEEDS["en"]` po změně (15 seedů)

```
how to fix
how to cancel
how to apply for
how much does
cost of
where to buy
near me
best restaurants in
alternative to
compare
best app for           ← přesunuto z experimental
best software for      ← přesunuto z experimental
best credit cards for  ← přesunuto z experimental
best internet provider for  ← přesunuto z experimental
best home internet for      ← přesunuto z experimental
```

## `_INTENT_SEEDS_EXPERIMENTAL["en"]` po změně (3 seedy)

```
best                  (geo-biased, zatím nevhodné)
best broadband for    (UK idiom — postcode)
best fiber internet for  (dotest v příštím kole)
```

## Commit

```bash
cd ~/Projects/muj-web
git add scripts/phase2b_pilot_crawl.py
git commit -m "feat: promote 5 EN seeds from experimental to production pool (batch 3 finalization)"
git push
```
