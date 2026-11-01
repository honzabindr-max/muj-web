---
mission_id: mezi-vami-t3-web-a-prodej
typ: mission-capsule
owner: Honza Bindr (Sponsor)
outcome: "T3 Web a prodej: vybraný a odsouhlasený vizuální směr (3.2) a klikací prototyp webu MEZI VÁMI na good-inventions.work/mezi-vami (noindex, ukázkový obsah, bez plateb)"
acceptance_evidence: "UNKNOWN: kritéria přijetí 3.2 nejsou v repu zapsána; autorita je HANDOFF (viz decisions)"
current_state: "3.2 vizuální směr vybrán 2026-10-24; klikací prototyp nasazen; PR #73 a #74 mergnuty do main; 3.1 Copy systém OPEN"
last_verified_at: 2026-11-02T00:58:00+01:00
next_action: "Vlastník zkontroluje desktop a mobil po PR #74 a dodá screenshoty; poté rozhodne, zda je 3.2 uzavřeno. UNKNOWN: pořadí dalších kroků určuje HANDOFF, ne tento soubor"
blocker: "žádný technický blokátor ověřen; UNKNOWN: zda je 3.2 uzavíratelné bez desktop důkazu"
waiting_for:
  - "Kontrola na telefonu po PR #74 (vlastník; PR #74 uvádí 'doplní Honza')"
  - "Desktop vizuální kontrola po PR #74 (UNKNOWN, nikdo ji nedoložil)"
  - "Screenshot po sjednocení CTA (UNKNOWN, neexistuje)"
  - "Schválení copy systému 3.1 (OPEN v HANDOFF)"
decisions:
  - id: D-3.2-visual-direction
    stav: "vybráno vlastníkem (fakt od vlastníka, zdroj zadání kroku 3)"
    cas: 2026-10-24
    odkaz: "HANDOFF, Klíčová rozhodnutí č. 15: https://app.notion.com/p/3d40ae49f507817db496c4e823996bc4"
  - id: D-hero-A-working-copy
    stav: "nasazeno jako pracovní copy; NENÍ schválený copy systém (3.1 OPEN)"
    cas: 2026-11-02
    odkaz: "PR #74 https://github.com/honzabindr-max/muj-web/pull/74 (merge 7692d63)"
  - id: D-working-price-1990
    stav: "pracovní cena prototypu, NENÍ launch lock (P1_WORKING_DISPLAY_PRICE)"
    cas: 2026-09-04
    odkaz: "HANDOFF, Klíčová rozhodnutí č. 2: https://app.notion.com/p/3d40ae49f507817db496c4e823996bc4"
artifacts:
  - uri: "https://github.com/honzabindr-max/muj-web/commit/7692d639dcaa924df622107eb450814f2af54fc8"
    verze: "commit 7692d639dcaa924df622107eb450814f2af54fc8"
    puvod: "PR #74 squash merge, hero copy varianta A"
  - uri: "https://github.com/honzabindr-max/muj-web/commit/2be54b3d2f6b2cba7f7f434d87de85d7c8210c3a"
    verze: "commit 2be54b3d2f6b2cba7f7f434d87de85d7c8210c3a"
    puvod: "PR #73 squash merge, pohyb výpočtu na /mezi-vami/vysledek"
  - uri: "docs/mezi-vami/hero-a-shots/375-landing-hero-a.png"
    verze: "git blob b02182d1d0566dc0ff2e5d1982eea085dbcce051"
    puvod: "PR #74, screenshot 375 px PŘED sjednocením CTA"
  - uri: "design/mezi-vami/proof-motion-shots/375-motion-1-ring-draw.png"
    verze: "git blob b44bd2bb2d9a20bfe079538808ecbd9da1a2a49a"
    puvod: "PR #73, 375 px, kreslení prstenců"
  - uri: "design/mezi-vami/proof-motion-shots/375-motion-2-oppory-revealed.png"
    verze: "git blob b9be8f65d19fdce708efa018b8f03b4162864bc9"
    puvod: "PR #73, 375 px, odhalené opory"
  - uri: "design/mezi-vami/proof-motion-shots/375-reduced-1-top.png"
    verze: "git blob eb06490d2a6582b6705896071dd9d02b61e549c2"
    puvod: "PR #73, 375 px, reduced-motion"
  - uri: "design/mezi-vami/proof-motion-shots/375-reduced-2-oppory.png"
    verze: "git blob eb06490d2a6582b6705896071dd9d02b61e549c2"
    puvod: "PR #73, 375 px, reduced-motion; STEJNÝ blob jako předchozí soubor, viz conflicts"
last_owner_go:
  co: "výběr hero varianty A a GO k nasazení (PR #74)"
  kdy: 2026-11-02
  zdroj: "fakt od vlastníka (chat) + merge PR #74 7692d63"
deployed_sha:
  commit: 7692d639dcaa924df622107eb450814f2af54fc8
  metoda: "gh api repos/honzabindr-max/muj-web/deployments (nejnovější environment Production = id 7480866214, sha 7692d63) + /deployments/7480866214/statuses (state success, 2026-11-01T23:37:41Z = 00:37:41 CET)"
  overeno: 2026-11-02T00:58:00+01:00
  omezeni: "GitHub deployment status říká, že Vercel Production deploy tohoto sha uspěl; ověření obsahu stránky viz curl v KARTĚ. Pozdější Production deploy v seznamu neexistuje."
policy_profile: "veřejné repo; žádná tajemství, klíče ani citlivá data; žádné integrace a nákupy; změny jen v rozsahu zadání"
data_zone: "public (repo je veřejné); prototyp používá ukázkový obsah, žádná reálná data"
allowed_tools: "git, gh pr view/list/create (draft), čtení Notion HANDOFF; bez merge do main, bez nákupů a integrací"
handoff_version: 2
conflicts:
  - "PR #73 má dva screenshoty reduced-motion (375-reduced-1-top.png a 375-reduced-2-oppory.png) se stejným git blob SHA eb06490d…; reduced-2 pravděpodobně nedokládá opory. UNKNOWN, nutno ověřit."
  - "PR #74 uvádí screenshot 375 px z 00:28, CTA bylo sjednoceno až v 00:34. Screenshot neodpovídá nasazenému stavu."
  - "Tělo PR #73 uvádí 'CI test ještě běžel'; později CI test pass (gh pr checks 73, 2m16s). Rozpor je vyřešen, zde jen pro stopu."
---

# KARTA

> Čitelné na telefonu. Fakta jsou odlišena od draftů. Kde chybí důkaz, stojí UNKNOWN.

**1. Jedna hlavní doručitelná věc teď**
Klikací prototyp webu MEZI VÁMI na `good-inventions.work/mezi-vami` (noindex, ukázkový obsah, bez plateb) jako podklad pro 3.2 Vizuální směr. Vizuální směr vybral vlastník 24. 10.

**2. Hotové a ověřené (s důkazem)**
- PR #73 (pohyb výpočtu) mergnut, CI `test` pass 2m16s a `janitor` pass: https://github.com/honzabindr-max/muj-web/pull/73
- PR #74 (hero copy A) mergnut jako 7692d63, CI `test` pass 1m49s a `janitor` pass: https://github.com/honzabindr-max/muj-web/pull/74
- Produkce `https://www.good-inventions.work/mezi-vami`: HTTP 200, text "Co se odehrává" přítomen, "Zjistit vaši" 0×, ověřeno 2026-11-02 00:48 CET (curl, jen text stránky, ne vzhled).
- Mobil 375 px: screenshoty z PR #73 (4 soubory, jeden pár je podezřele identický, viz konflikty) a z PR #74 (1 soubor, před sjednocením CTA).

**Poslední GO vlastníka:** 2026-11-02, výběr hero varianty A a GO k nasazení (PR #74, merge 7692d63); zdroj: fakt od vlastníka (chat).

**3. Čeká na vlastníka (max 3, ostatní viz `waiting_for`)**
1. Kontrola na telefonu po PR #74.
2. Desktop vizuální kontrola po PR #74 (UNKNOWN, nikdo ji nedoložil).
3. Screenshot po sjednocení CTA (UNKNOWN, neexistuje).

Další položka ve `waiting_for`: schválení copy systému 3.1 (OPEN).

**4. Co se změnilo od posledního návratu**
handoff_version 2: doplněno last_owner_go a deployed_sha (7692d63, ověřeno přes gh api deployments); hook SessionStart přepsán na JSON additionalContext. Poslední změny v repu: PR #73 (2. 11. 00:17) a PR #74 (2. 11. 00:36), obě v main.

**5. Co se má zastavit**
- Neschvalovat hero copy A jako copy systém: je to pracovní copy, 3.1 je OPEN.
- Nebrat 1 990 Kč jako launch cenu: je to pracovní cena prototypu.
- Neprohlašovat desktop za ověřený, dokud neexistuje důkaz.
- Nezačínat nové produktové syntézy, audity ani verze produktu (HANDOFF, "Co se NESMÍ dělat znovu").

---

## Fakta (ověřená důkazem)

| Fakt | Důkaz |
| --- | --- |
| main obsahuje PR #73 a #74 | `git log origin/main`: 7692d63, 2be54b3 |
| CI PR #74 pass | `gh pr checks 74` |
| CI PR #73 pass | `gh pr checks 73` |
| Produkce vrací 200 a nový hero text | curl 2026-11-02 00:48 CET |
| Sada screenshotů je v main | `git ls-tree origin/main` |

## Fakta od vlastníka (bez nezávislého důkazu v repu)

- ACTIVE TRACK = T3 Web a prodej.
- 3.2 vizuální směr vybrán 24. 10.; klikací prototyp na `good-inventions.work/mezi-vami`.
- 3.1 Copy systém OPEN.
- Hero varianta A nasazena 2. 11. (PR #74) jako pracovní copy, ne schválený copy systém.
- Pracovní cena 1 990 Kč není launch lock.

## Drafty (nejsou fakta)

- Hero copy A (nadpis "Co se odehrává mezi vámi?", CTA "Objevit Vztahovou DNA zdarma"): pracovní copy, ne schváleno.
- Cena 1 990 Kč v trust řádku: pracovní zobrazení prototypu.

## UNKNOWN (mezery v důkazech)

- Desktop vizuálně neověřen po PR #74.
- Žádný screenshot po sjednocení CTA (screenshot v PR #74 je před ním).
- Kontrola na telefonu po PR #74: PR uvádí "doplní Honza", výsledek není zapsán.
- Výkon animací z PR #73 neměřen (Lighthouse/trace), reálné zařízení neotestováno (PR #73, sekce Neověřeno).
- Kritéria přijetí 3.2: v repu nejsou.

## Autorita

Produktová rozhodnutí se zde neopisují. Autorita je stránka HANDOFF — MEZI VÁMI: https://app.notion.com/p/3d40ae49f507817db496c4e823996bc4 (při rozporu s tímto souborem vyhrává HANDOFF; kufřík je index, ne zdroj pravdy).
