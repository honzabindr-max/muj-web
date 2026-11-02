## Verdikt: FAIL

Přetrvávají plošné blokace povolené přípravy změn a nedoložená tvrzení. Výslovně označený technický protokol v0 posuzuji jako návrh implementace podle zadání.

## Nálezy z 1. kola

| nález | stav | proč |
|---|---|---|
| **supervizor** — chybějící kontrolor | VYŘEŠENO | Bod 6 doplňuje GPT kontrolora, checklist a verdikt PASS / FIX / BLOCK podle ORCH §2a. |
| supervizor — Notion pouze přes příčku 2 | ČÁSTEČNĚ | Přednost API je doplněna, ale tvrzení o připravené implementaci a ověřeném důvodu fallbacku nemají v dodané sadě důkaz ani označení UNKNOWN. |
| supervizor — JSON, brief.md, parser a počet pokusů | VYŘEŠENO | Tyto požadavky jsou odděleny jako technický protokol v0. |
| supervizor — pravidla „vynucuje kód“ | NEVYŘEŠENO | Karta stále tvrdí doložené vynucení, přestože odkazovaný kód ani testy nejsou v podkladech a tvrzení není označeno jako návrh či UNKNOWN. |
| **copy-studio** — chybějící povinné vstupy | VYŘEŠENO | UI_BUILD_BRIEF_V1 a locked product/funnel kontrakty jsou povinné a jejich absence vede k BLOCK. |
| copy-studio — povinné LEGAL_PENDING | VYŘEŠENO | Označení je nyní volitelné pro nefinální právní text a layout sloty odpovídají A3. |
| copy-studio — pracovní cena versus nové rozhodnutí | VYŘEŠENO | Karta dovoluje schválenou prototypovou cenu 1 990 Kč a odděluje ji od launch ceny i nových rozhodnutí. |
| copy-studio — minimum 400 znaků a závěrečná sekce | VYŘEŠENO | Dodatečné formální požadavky jsou výslovně označeny jako implementační volba, nikoli zdrojové kritérium. |
| copy-studio — rodič DRAFT stránky | VYŘEŠENO | Zdrojové určení rodiče je UNKNOWN a V3 Deep Dive je uveden samostatně jako návrh v0. |
| **vizual** — úplný doménový allowlist | VYŘEŠENO | Zdrojové pravidlo používá potřebné nástroje a příklady, zatímco konkrétní allowlist je označen jako technický protokol v0. |
| vizual — neúplná pravidla browser adaptéru | VYŘEŠENO | Jsou doplněny vlastníkovo přihlášení a 2FA, zakázané účty i celý postup po dvou selháních UI. |
| vizual — obecně povinných 375 px | VYŘEŠENO | Viewport 375 px je omezen na experiment CTE-04 a ostatní viewporty určuje zadání. |
| vizual — rodič DRAFT a browser.ts | VYŘEŠENO | Zdrojové určení rodiče zůstává UNKNOWN a konkrétní rodič i adaptér jsou označeny jako implementační návrh. |
| **vyvojar** — skutečný implementační model | ČÁSTEČNĚ | Model konkrétního běhu je UNKNOWN, ale tvrzení o obsahu run.sh a nastavení účtu na Opus zůstávají bez dodaného důkazu. |
| vyvojar — mapování invariant-sentinel.md | NEVYŘEŠENO | Popsané kopírování souboru stále neobsahuje jednoznačné mapování na dodaný ai-chain-sentinel.md ani důkaz shody obsahu. |
| vyvojar — commit/push, větev a worktree | VYŘEŠENO | Rozdělení operací a konvence větve/worktree jsou označeny jako implementační volba a zachovávají draft PR i merge vlastníkem. |
| vyvojar — akceptace „není FAIL“ | VYŘEŠENO | Akceptace nyní vyžaduje explicitní kladný STATUS a samostatný PASS kontrolora. |
| vyvojar — CTE při každé materiální změně kontraktu | VYŘEŠENO | Pravidlo výslovně obsahuje časovou podmínku po P1.7 podle A2. |
| **brana** — chybějící kontrolor jiné rodiny | VYŘEŠENO | Je doplněn Claude kontrolor s checklistem a PASS / FIX / BLOCK při zachování produktové pravomoci GPT Gate. |
| brana — technické vynucení oddělení rodin | VYŘEŠENO | Konkrétní technické řešení je nyní součástí označeného protokolu v0 a pravidlu oddělení rodin neodporuje. |
| brana — JSON a check-rN.md | VYŘEŠENO | Serializace a cesta souboru jsou výslovně označeny jako technický protokol v0. |
| **_spolecne** — technické artefakty „NEDOSTUPNÉ“ | VYŘEŠENO | Dostupnost je UNKNOWN a povinný intake relevantních artefaktů před regionálním trackem je doplněn. |
| _spolecne — hero varianta A jako pracovní copy | ČÁSTEČNĚ | Přibyly identifikátory PR a commitu, ale jejich obsah ani odkazovaný kufřík nejsou dodány, takže status varianty A nelze potvrdit. |
| _spolecne — absolutní zákaz placeného API | VYŘEŠENO | Zákaz nyní obsahuje výjimku na výslovné GO vlastníka pro danou zakázku. |
| _spolecne — chybějící zastavení při ALARM | VYŘEŠENO | Souhrn výslovně požaduje TARS-GUARD a zastavení při ALARM. |
| **ai-chain-sentinel** — každý výskyt ui_data_contract blokuje | ČÁSTEČNĚ | Běžné odkazy jsou povoleny, ale změny souborů odpovídajících názvu stále blokují bez rozlišení materiality a fáze požadovaného A2. |
| ai-chain-sentinel — page.tsx automaticky znamená změnu flow | VYŘEŠENO | Test je označen jako indikátor a posouzení skutečné změny screen-flow předává vlastníkovi nebo GPT kontrolorovi. |
| ai-chain-sentinel — platební názvy znamenají rozhodnutí Sponzora | ČÁSTEČNĚ | Shell je povolen, ale import poskytovatele stále automaticky blokuje i test nebo implementaci podle schváleného zadání. |
| ai-chain-sentinel — každá změna ceny blokuje | ČÁSTEČNĚ | Použití pracovní ceny je povoleno, ale rozdílné částky v testu či konfiguraci se stále nerozlišují od nového cenového rozhodnutí. |
| ai-chain-sentinel — zákaz všech SQL a migrací | ČÁSTEČNĚ | Příprava SQL je povolena, ale pouhé přidání migračního příkazu do skriptu nebo CI se stále zaměňuje za provedení DB zápisu. |
| ai-chain-sentinel — workflow/.claude/tars-guard | ČÁSTEČNĚ | Zákaz .claude zmizel, ale jakákoli editace workflow či souboru tars-guard zůstává blokována bez rozlišení spuštění nebo skutečného oslabení ochrany. |
| ai-chain-sentinel — neúplné pokrytí společných zákazů | VYŘEŠENO | Neměřitelné zákazy a kontrakty jsou výslovně předány GPT kontrolorovi a MECHANICAL_OK jejich kontrolu nenahrazuje. |
| ai-chain-sentinel — STAV, zakázaná slova, regexy a nejistota | NEVYŘEŠENO | Dodatečné normy nejsou označeny jako návrh a odkazovaný původní sentinel ani schválená specifikace nejsou v dodaných podkladech. |

## Nové nálezy

žádné