import { H2CsrfError } from "./errors";

/**
 * CSRF/origin ochrana write/admin endpointů (§31.1). Standardní Origin
 * header check — spolehlivý pro moderní prohlížeče (Origin se posílá na
 * všech cross-site POST/PUT/DELETE/PATCH requestech a nejde JS zfalšovat).
 */
export function assertSameOrigin(request: Request, allowedOrigins: readonly string[]): void {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    throw new H2CsrfError();
  }
}
