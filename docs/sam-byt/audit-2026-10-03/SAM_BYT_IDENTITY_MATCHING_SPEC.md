# SAM-BYT — specifikace identity fyzického bytu

Stav: **specifikace, neimplementováno.** Cíl: při refreshi trhu přiřadit nový inzerát k existujícímu `sam-NN`, aby zůstal Samův a Honzíkův stav (navázaný na `listing_id`).

## Princip
1. `internal_id` (`sam-NN`) je identita **fyzického bytu**, ne inzerátu. Nikdy se nerecykluje ani nepřečísluje.
2. Inzerát (portál + listing ID + URL) je atribut bytu; byt může mít víc inzerátů v čase i současně.
3. Matcher nikdy neslučuje sám nejistý případ — nejistota jde na ruční potvrzení. Falešné sloučení (stav Sama na cizím bytě) je horší než falešné „nový".

## Normalizace (před porovnáním)
- URL: lowercase host, bez `www.`, bez query/fragmentu (kromě nosných parametrů), bez koncového `/`.
- Portálové ID z URL:
  - Sreality `…/detail/pronajem/byt/{disp}/{lokalita}/{ID}` → numerické ID (sam-01, 05, 07, 08, 09, 10)
  - Bezrealitky `…/nemovitosti-byty-domy/{ID}-nabidka-…` (sam-02, 04)
  - Bazoš `…/inzerat/{ID}/…` (sam-10 alt, sam-11)
  - Real Brno / Reality Veselý: koncové číslo URL (sam-03, 06) — slabší, web RK může přečíslovat
- ID zakázky RK ze `source_name` / textu: `N8188`, `N6943`, `07736`, `BACC-AIC-D23`, `HON 2608`.
- Adresa: ulice bez diakritiky a mezer, č.p./č.o. pokud je; městská část `Brno-X`.
- Dispozice `2+1`/`2+kk` beze změny (2+1 ≠ 2+kk). Plocha jako číslo. Patro jako číslo NP (`zvýšené přízemí` = 1? → neurčovat automaticky, nechat raw).

## Hierarchie shody

| Úroveň | Pravidlo | Výsledek |
|---|---|---|
| L1 | Stejný portál + stejné portálové listing ID | `MATCH_CERTAIN` |
| L2 | Normalizovaná URL = `source_url` nebo ∈ `alternative_urls` | `MATCH_CERTAIN` |
| L3 | Stejné ID zakázky RK (stejná RK) na jiném portálu / nové URL | `MATCH_CERTAIN` pokud sedí i dispozice + plocha ±1 m²; jinak `MATCH_PROBABLE` |
| L4 | Ulice + č.p. + dispozice + plocha ±1 m² + patro | `MATCH_PROBABLE` (ruční potvrzení) |
| L5 | Ulice + dispozice + plocha ±2 m² + patro **nebo** shodná fotka (perceptual hash) **nebo** stejný kontakt/RK + PENB | `MATCH_PROBABLE`, nízká jistota |
| — | Nic z výše | `NEW` → nové ID `sam-12+` |
| — | Existující `sam-NN` bez kandidáta v novém sběru | `GONE` → archivovat (nikdy nemazat) |

Konflikty:
- Dva existující byty kandidují na jeden inzerát → `AMBIGUOUS`, ručně.
- Jeden existující byt má víc kandidátů → nejvyšší úroveň vyhrává, ostatní do `alternative_urls` jen po ručním potvrzení.
- Cena, dostupnost, popis, fotky **nejsou** identita — mění se bez změny bytu.

## Výstup matcheru (návrh)
Diff report před zápisem, nic se neaplikuje bez GO:
```
{ internal_id | null, candidate_url, level: L1..L5, verdict: MATCH_CERTAIN|MATCH_PROBABLE|AMBIGUOUS|NEW|GONE,
  evidence: [...], field_changes: { rent_czk: [old,new], ... }, user_state_present: {sam: bool, honzik: bool} }
```
`user_state_present=true` + `MATCH_PROBABLE/AMBIGUOUS` = vždy ruční kontrola.

## Rizika (s konkrétními případy z katalogu)

| Riziko | Dopad | Ošetření |
|---|---|---|
| **Změna portálu** (byt přejde ze Sreality na Bazoš / web RK) | L1/L2 selže | L3 (ID zakázky RK), jinak L4 ruční. sam-10 už dnes existuje ve dvou portálech (Sreality + Bazoš, N8188). |
| **Změna ceny** | žádný vliv na identitu | Cena se aktualizuje jako atribut; uložit předchozí hodnotu do historie katalogu. Samovo hodnocení ceny (`rating_price`) může být zastaralé → v UI označit „cena se změnila". |
| **Nová URL stejného inzerátu** (Sreality mění slug, ne ID) | URL match selže | Porovnávat ID, ne celou URL (L1 před L2). |
| **Repost** (stažený a znovu vložený inzerát s novým ID) | L1/L2 selže | L3/L4; RK často zachová ID zakázky. Soukromý inzerent (sam-11, sam-02, sam-04) nemá ID zakázky → L4/L5 ruční. |
| **Dvě jednotky ve stejné ulici se stejnou dispozicí** | falešné sloučení | Nikdy nesloučit jen podle ulice + dispozice. **Vondrákova:** sam-06 (60 m², 6. NP, Reality Veselý) vs sam-10 (50 m², 1. NP). **Jasanová:** sam-08 (58 m², 8. NP, 22 800 Kč, ID 07736) vs sam-09 (58 m², 1. NP, 22 900 Kč, N6943) — shodná plocha i dispozice, rozliší jen patro / ID zakázky. **Habřinova:** v extrakci 22. 9. byla záměrně vyřazena 777/2 59 m² (Real Brno) vs sam-05 60 m² — rozdíl 1 m² je v toleranci L4, proto L4 jen ruční. |
| **Neúplná data** | match nemožný | sam-11 nemá ulici, plochu ani patro → jen L1/L2 (Bazoš ID 223982512) nebo ruční. |
| **Rozporná plocha** v inzerátu | plochy se neshodují | sam-04: užitná 61 vs čistá 56 m² → porovnávat proti oběma, tolerance. |
| **Fotky s expirujícím tokenem** (`t.rmcl.cz`, sam-03/06) | pHash nelze spočítat | fotky jako L5 jen doplňkový důkaz. |

## Mimo rozsah této specifikace
Implementace, scraping, aktualizace dat z portálů, přidání Žabovřesk.
