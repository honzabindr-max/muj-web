import { auth } from "@/auth";

/**
 * BUILD-03A: nahrazuje BUILD-01 placeholder (vždy false) skutečnou
 * implementací. `request` zůstává v signatuře pro zpětnou kompatibilitu
 * volajících (health route) — auth() čte session z next/headers uvnitř
 * Next.js request scope, ne z explicitního Request objektu.
 */
export async function isAuthenticatedOwnerRequest(request: Request): Promise<boolean> {
  void request;
  const session = await auth();
  return Boolean(session?.googleSub);
}
