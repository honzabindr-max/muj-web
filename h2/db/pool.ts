import { Pool } from "pg";
import { z } from "zod";

import { requireEnv } from "@/h2/config/schema";

/**
 * Lazy H2_RUNTIME_DATABASE_URL pool getter (stejný kontrakt jako
 * h2/config — validace až při skutečném použití, ne při importu).
 * Sdílený Pool napříč requesty v rámci jednoho serverless invocation.
 */
let cachedPool: Pool | null = null;

export function getH2Pool(source: Record<string, string | undefined> = process.env): Pool {
  if (cachedPool) return cachedPool;
  const { H2_RUNTIME_DATABASE_URL } = requireEnv({ H2_RUNTIME_DATABASE_URL: z.string().min(1) }, source);
  cachedPool = new Pool({ connectionString: H2_RUNTIME_DATABASE_URL });
  return cachedPool;
}

export function resetH2PoolForTests(): void {
  cachedPool = null;
}
