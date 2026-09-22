/**
 * Origin/Referer kontrola proti CSRF na mutacích (next-auth-style same-site
 * cookie by mělo stačit, ale zadání výslovně chce CSRF/Origin kontrolu u
 * každé mutace — obrana do hloubky). Prohlížeč posílá Origin na
 * cross-origin i same-origin POST/PATCH fetch z JS, takže jeho absence je
 * podezřelá a request se odmítne.
 */
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (origin) {
    try {
      return new URL(origin).host === requestUrl.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === requestUrl.host;
    } catch {
      return false;
    }
  }
  return false;
}
