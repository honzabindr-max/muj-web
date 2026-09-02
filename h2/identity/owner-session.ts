/**
 * Placeholder ownerské session gate.
 *
 * Skutečnou identity boundary (Auth.js + Google OAuth, owner allowlist,
 * typovaný `requireOwnerSession()`) vlastní BUILD-03A a Build Specification
 * u BUILD-03A výslovně říká, že tuto hranici "Code nemůže domyslet ad hoc" —
 * proto tento soubor NEIMPLEMENTUJE žádnou skutečnou autentizaci předčasně.
 *
 * Dokud BUILD-03A neexistuje, žádný request není authenticated owner —
 * návratová hodnota je vždy `false`. Endpointy, které mají vracet víc dat
 * jen přihlášenému ownerovi (např. /api/h2/health build info), volají tuto
 * funkci už teď, takže BUILD-03A jen nahradí implementaci a nemusí sahat
 * do jejich volajících.
 */
export function isAuthenticatedOwnerRequest(request: Request): boolean {
  void request;
  return false;
}
