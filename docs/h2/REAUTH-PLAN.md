# Re-auth stránka pro aktivaci promptu — návrh a implementace

**Status:** implementováno, PR [#37](https://github.com/honzabindr-max/muj-web/pull/37), čeká na CI a Honzíkovo GO k mergi. Tenhle dokument zaznamenává rozhodnutí a rozsah, ne živý stav PR (ten sleduj v BUILD-STATUS.md "Otevřené položky").

## Proč tenhle blok vůbec vznikl

`activatePromptVersion()` (BUILD-07, `h2/prompts/activation.ts`) vyžaduje `requireRecentReauth()` — přihlášení ne starší než 5 minut. Certifikace `BUDDY_RESPONSE` promptu (viz BUILD-10-PLAN.md) dorazila k DRAFT verzi s passing test run (round 6, `id=203ad0e9-66da-4e05-a6c9-f3e84e4f0592`), ale aktivaci nešlo provést, protože Honzíkovo poslední přihlášení bylo víc než 34 hodin staré.

## Zamítnutá varianta

Honzík zamítl skript, který by `markRecentReauth()` zavolal přímo bez skutečného Google přihlášení — obcházel by tím jedinou kontrolu, která u aktivace promptu existuje, a kontrola, která se nikdy nepoužije doopravdy, přestane platit.

## Vlastní chyba nalezená a opravená cestou

Při navrhování řešení jsem nejdřív tvrdil: *"`markRecentReauth()` existuje v kódu, ale nikde v produkci ji nic nevolá"* — na základě `grep -rln "markRecentReauth" --include="*.ts" --include="*.tsx" app/ h2/`, který **hledal jen pod `app/` a `h2/`**. Tohle byla chyba — `auth.ts` na rootu repa (mimo obě prohledávané složky) volá `markRecentReauth()` už od BUILD-03A, a to na **KAŽDÉM** úspěšném Google přihlášení, uvnitř `signIn` callbacku:

```ts
// auth.ts, signIn callback (BUILD-03A, beze změny)
async signIn({ user, account }) {
  // ...
  await markRecentReauth(pool, result.ownerId);
  await withOwnerScope(pool, result.ownerId, (client) =>
    recordIdentityEvent(client, result.ownerId, "LOGIN_SUCCESS"),
  );
  return true;
},
```

Ověřeno živě proti produkční DB (`select recent_reauth_at from owners where google_sub is not null`) — sloupec je vyplněný z posledního reálného přihlášení (2026-09-02T21:31:51Z), přesně jak by mělo být, kdyby mechanismus fungoval. Mechanismus tedy **není chybějící** — chybí jen **explicitní UI, které by Honzíka přimělo znovu projít celým OAuth round-tripem** na požádání, místo čekání na příští přirozené přihlášení do `/honzik2`.

**Poučení pro příště:** grep scoped jen na dvě složky je nedostatečný důkaz "nikde se to nevolá" u repa, kde auth konfigurace žije na rootu (`auth.ts`), ne pod `app/` nebo `h2/`. Než tvrdit "žádný volající", hledat bez omezení adresáře.

## Schválený rozsah (Honzík, 2026-09-04)

- Samostatný PR, mimo BUILD-11 (identity/session mechanismus je BUILD-03A vlastnictví, ne delivery — blokuje aktivaci JAKÉHOKOLIV promptu, ne jen BUDDY_RESPONSE).
- Jedna stránka.
- **Žádná administrace promptů** — `activatePromptVersion()` se pořád spouští ze skriptu/konzole Codem, ne odsud.

## Co stránka dělá

`app/honzik2/reauth/page.tsx` (server component):
1. Čte session přes `auth()` (root `auth.ts`).
2. Přes `requireOwnerSession(pool, session?.googleSub)` (BUILD-03A, `h2/identity/session.ts`, beze změny) zjistí, jestli je Honzík přihlášený a na allowlistu.
3. Přes `requireRecentReauth(pool, ownerId)` (STEJNÁ funkce, kterou volá `activatePromptVersion()` — žádný duplikovaný konstant 5minutového okna) zjistí, jestli je re-auth pořád platný.
4. Vypíše jeden ze čtyř stavů: nepřihlášen / neznámý owner (mimo allowlist) / platné (s časem posledního přihlášení) / expirované (s časem posledního přihlášení, nebo "žádné dřívější" pokud sloupec nikdy nebyl vyplněný).

`app/honzik2/reauth/reauth-button.tsx` (client component):
- Jedno tlačítko, `next-auth/react`'s `signIn("google", { callbackUrl: "/honzik2/reauth" })`.
- **Klíčová vlastnost:** `signIn()` vždy pošle POST na `/api/auth/signin/google` s CSRF tokenem a projde celým OAuth round-tripem — na rozdíl od pouhé návštěvy stránky (což by při platné session cookie `signIn` callback vůbec nespustilo). Tlačítko tedy vynucuje **nové** přihlášení, ne recykluje staré.
- Po dokončení Google OAuth (uživatel v prohlížeči) proběhne existující `signIn` callback v `auth.ts` beze změny — zavolá `markRecentReauth()` a přesměruje zpátky na `/honzik2/reauth`, kde stránka teď ukáže "platné".

## Co stránka NEDĚLÁ (vědomě, podle schváleného rozsahu)

- Neaktivuje žádný prompt.
- Nezobrazuje seznam DRAFT/ACTIVE verzí.
- Nevolá `activatePromptVersion()` ani žádnou jinou zapisovací H2 funkci.
- Nepřidává žádnou novou auth logiku — `markRecentReauth()` volání v `auth.ts` je beze změny, stránka jen dává Honzíkovi tlačítko, které existující mechanismus spustí na požádání.

## Vedlejší nález: `lazy-boot-safety.test.ts` výjimka

Governance test `h2/config/__tests__/lazy-boot-safety.test.ts` kontroluje, že žádný soubor mimo `h2/**` a `app/api/h2/**` neimportuje `h2/*` moduly (chybějící H2 env proměnné nesmí ovlivnit existující stránky muj-web mimo H2 hranici). Testův vlastní komentář předpokládal výjimku i pro `/honzik2/*` Buddy surfaces už od BUILD-01 ("budoucí /honzik2/* Buddy surfaces"), ale kód tuhle výjimku nikdy nekontroloval — nebyla dosud potřeba, protože `app/honzik2/o-projektu` (DEC-002 landing page) žádné H2 moduly needituje. Tahle re-auth stránka je první, co na tu mezeru narazila. Výjimka rozšířena o `app/honzik2/**`.

## Testováno (a co ne)

Lokálně (dev server, `.env.local`):
- Stránka vrací `200`, správně ukazuje "Nejsi přihlášený" bez session cookie.
- `POST /api/auth/signin/google` se správným CSRF tokenem vrací platnou Google OAuth authorization URL (správný `client_id`, `redirect_uri` na `localhost:3000/api/auth/callback/google`, PKCE `code_challenge`).
- 219/219 testů, `tsc`/`build` čisté.

**Neověřeno** — vyžaduje Honzíkův reálný Google účet v prohlížeči: dokončení celého OAuth round-tripu a potvrzení, že stránka po návratu skutečně ukáže "platné" se správným časem.

## Evidence

```
Commit: 7b2db0c (implementace)
Branch: feat/h2-reauth-page (PR #37)
DB: žádná nová migrace, žádný nový credential
Timestamp: 2026-09-04
Verified by: Code — lokálně 219/219 testů, tsc/build čisté, live DB dotaz
    potvrzující recent_reauth_at už je vyplněný z existujícího mechanismu,
    lokální dev server test signIn() flow až po hranici bez reálného
    Google účtu
Remaining risk: skutečné dokončení OAuth round-tripu v prohlížeči
    neověřeno — Honzíkův úkol při prvním použití stránky
```
