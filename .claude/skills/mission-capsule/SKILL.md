---
name: mission-capsule
description: Aktualizuje kufřík mise missions/mezi-vami/capsule.md na konci práce. Použij vždy, když skončila práce na MEZI VÁMI (nebo po změně stavu, důkazu, rozhodnutí či dalšího kroku).
---

# Aktualizace kufříku mise

Soubor: `missions/mezi-vami/capsule.md`. Dělej kroky v tomto pořadí. Nic nedomýšlej.

1. Načti `capsule.md` a `git log origin/main -10`. Pro změněné PR spusť `gh pr view <N> --json state,mergedAt,mergeCommit,statusCheckRollup`.
2. **Stav:** přepiš `current_state` a sekci KARTA (body 1, 4, 5) podle toho, co je ověřeno teď. Bod 4 = rozdíl proti předchozí verzi.
3. **Důkazy:** každé tvrzení v "hotové a ověřené" musí mít odkaz (PR, run, commit, blob SHA, timestamp). Bez důkazu přesuň tvrzení do sekce UNKNOWN. Nové soubory přidej do `artifacts[]` s git blob SHA (`git rev-parse <ref>:<cesta>`).
4. **Rozhodnutí:** do `decisions[]` přidej jen rozhodnutí, která vlastník skutečně učinil (stav, čas, odkaz). Produktová rozhodnutí neopisuj, odkaž na HANDOFF. Draft nikdy nezapisuj jako fakt.
5. **Čekání:** aktualizuj `waiting_for` (nic nemaž, jen označ vyřízené) a KARTA bod 3 (max 3 položky, zbytek zůstává ve `waiting_for`). Rozpory zapiš do `conflicts[]`.
6. **Další krok:** přepiš `next_action` a `blocker`. Nevíš-li, napiš UNKNOWN.
7. **Verze:** nastav `last_verified_at` na aktuální čas (ISO 8601, `date +%FT%T%z`) a `handoff_version` zvyš o 1.
8. **Kontrola:** v souboru nesmí být tajemství, klíče, tokeny ani osobní údaje (repo je veřejné). Pak commit v rozsahu `missions/mezi-vami/**`.
9. Neměň kód aplikace ani nic mimo `missions/mezi-vami/**` a `.claude/**`. Notion HANDOFF nepřepisuj, jen čti.
