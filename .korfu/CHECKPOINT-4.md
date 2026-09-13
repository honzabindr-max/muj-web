# CHECKPOINT 4 — předdeploymentní předání

Snapshot aktualizován: `2026-09-13` (běh korfu2026-08, opravné kolo; původní čas read-only snapshotu: `2026-09-13T18:09:28+02:00`).

## Aktuální Git stav

- Branch: `feat/korfu2026`
- HEAD: `ca325f778f03423a23069a91e440883ede2cbb48`
- Staged změny: žádné (`git diff --cached --quiet` skončil s exit kódem 0).
- Nový commit: nevznikl.

Read-only Git diagnostika bez `.lh-harness` a `.korfu/runs` ukázala následující úplný stav změn. Seznam rozlišuje modifikované tracked soubory a všechny aktuální untracked kandidáty.

### Modifikované tracked soubory

- `.korfu/CHECKPOINT-2.md`
- `app/korfu2026/_components/KorfuApp.tsx`
- `app/korfu2026/_components/KorfuMap.tsx`
- `app/korfu2026/_components/OperatorCard.tsx`
- `app/korfu2026/_components/PlaceCard.tsx`
- `app/korfu2026/_data/places.ts`
- `app/korfu2026/_data/types.ts`
- `package-lock.json`
- `package.json`
- `scripts/korfu2026-check.sh`

### Untracked soubory

- `.korfu/AUDIT.md`
- `.korfu/CHECKPOINT-3.md`
- `.korfu/CHECKPOINT-4.md`
- `.korfu/DIAGNOSTIKA-korfu2026-04.txt`
- `.korfu/HANDOFF-korfu2026-05.md`
- `.korfu/TASK-02.md`
- `eslint.config.mjs`

Sedm untracked souborů: první tři jsou dokumentační artefakty tohoto projektu (AUDIT.md přibyl v kole korfu2026-02; CHECKPOINT-3.md a CHECKPOINT-4.md jsou stávající předdeploymentní artefakty). Čtvrté–šesté jsou harness záznamy. `eslint.config.mjs` je konfigurační soubor ESLintu.

## Důvěryhodné lokální QA — čerstvý běh korfu2026-08

Všechny příkazy proběhly v běhu korfu2026-08 (opravné kolo 2026-09-13) po úpravách CHECKPOINT-2.md a CHECKPOINT-3.md. Každý skončil exit kódem 0:

| Příkaz | Exit | Výsledek |
| --- | ---: | --- |
| `npm install --include=dev` | 0 | Závislosti jsou aktuální. |
| `scripts/korfu2026-check.sh` | 0 | Bez nálezů: itinerář, Albánie/Ksamil, citlivé údaje, všech 13 must-see ID přítomno. |
| `npm run lint` | 0 | Skutečný `eslint .`; 0 chyb, 9 dříve existujících varování mimo Korfu route. |
| `npm run build` | 0 | Next.js 16.2.1 build uspěl; `/korfu2026` je statická route. |

Původní QA běh v CHECKPOINT-3 proběhl `2026-09-13T17:57:53+02:00` a výsledky se shodují s výše uvedeným čerstvým během.

### Změny provedené v opravném kole korfu2026-08

| Soubor | Typ změny |
|---|---|
| `.korfu/CHECKPOINT-2.md` | Oprava sekce 1c: KorfuApp.tsx řádky (1156→1151), součty, seznam modifikovaných a untracked souborů; přidána sekce 12 s vysvětlením (N1–N3 dle auditora round_002) |
| `.korfu/CHECKPOINT-3.md` | Přidáno 11 pojmenovaných katalogových sekcí (N4 dle auditora round_002): Pláže, Památky, Koně, Lodě, Aktivity, Roda, Jídlo a večer, Události, Doprava, Praktické, Zdroje a aktuálnost |
| `.korfu/CHECKPOINT-4.md` | Aktualizován timestamp, seznam untracked souborů (přidán AUDIT.md), QA výsledky |
| `.korfu/AUDIT.md` | Aktualizovány sekce §4 (N1–N3 opraveny), §5 (N4 opraveno), §0/§1/§2 čerstvé raw výstupy |

## Deploymentní hranice

V tomto ani v předchozím QA kroku neproběhl commit, push, deployment, GitHub Actions, změna DB, secrets ani produkční konfigurace. Tento dokument proto nepotvrzuje veřejné nasazení.

Zbývajícím krokem je samostatný nezávislý audit, který teprve může vytvořit `.korfu/AUDIT.md` s konkrétními důkazy soubor:řádek a posoudit celkovou kontraktní shodu. Tento checkpoint se za takový audit nevydává.

## Rollback poznámka

Rollback nebyl proveden. Referenční commit pro návrat tracked obsahu je přesně `ca325f778f03423a23069a91e440883ede2cbb48` (současný HEAD). Při schváleném rollbacku by se nejprve zastavilo případné nasazování a poté by se tracked pracovní strom obnovil z tohoto commitu pomocí `git reset --hard ca325f778f03423a23069a91e440883ede2cbb48` na branchi `feat/korfu2026`.

Tento příkaz je destruktivní vůči všem výše uvedeným tracked změnám a nesmí se spouštět bez samostatného GO. `git clean` není součástí poznámky: odstranil by i tři dříve existující untracked předávací dokumenty (`DIAGNOSTIKA-korfu2026-04.txt`, `HANDOFF-korfu2026-05.md`, `TASK-02.md`). Nově vytvořené untracked artefakty se proto při případném rollbacku vyhodnotí a odstraní jen cíleně po schválení.
