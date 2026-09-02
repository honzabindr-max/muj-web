import { z } from "zod";

import { H2ConfigError } from "@/h2/config/errors";
import { requireEnv } from "@/h2/config/schema";

/**
 * Key registry pro AES-256-GCM envelope (Technical Architecture v1.2 §24,
 * §31.6). Klíče se čtou z env (deployment secret store), nikdy z DB ani
 * repozitáře. Každý klíč je 32 bajtů (AES-256), base64 v env proměnné
 * H2_ENCRYPTION_KEY_V{n}. Aktivní verze (pro NOVÉ zápisy) je
 * H2_ENCRYPTION_ACTIVE_KEY_VERSION — staré verze zůstávají v registru
 * dostupné pro čtení, dokud probíhá rotace (§24: "mixed key versions jsou
 * čitelné").
 */
export type EncryptionKeyRegistry = {
  activeVersion: number;
  keys: ReadonlyMap<number, Buffer>;
};

const MAX_KEY_VERSION_SCAN = 20;
const KEY_LENGTH_BYTES = 32;

function parseBase64Key(raw: string, envVarName: string): Buffer {
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH_BYTES) {
    throw new H2ConfigError([envVarName]);
  }
  return buf;
}

export function loadEncryptionKeyRegistry(
  source: Record<string, string | undefined> = process.env,
): EncryptionKeyRegistry {
  const { H2_ENCRYPTION_ACTIVE_KEY_VERSION } = requireEnv(
    { H2_ENCRYPTION_ACTIVE_KEY_VERSION: z.string().regex(/^\d+$/) },
    source,
  );
  const activeVersion = Number(H2_ENCRYPTION_ACTIVE_KEY_VERSION);

  const keys = new Map<number, Buffer>();
  for (let version = 1; version <= MAX_KEY_VERSION_SCAN; version += 1) {
    const envVarName = `H2_ENCRYPTION_KEY_V${version}`;
    const raw = source[envVarName];
    if (!raw) continue;
    keys.set(version, parseBase64Key(raw, envVarName));
  }

  if (!keys.has(activeVersion)) {
    throw new H2ConfigError([`H2_ENCRYPTION_KEY_V${activeVersion}`]);
  }

  return { activeVersion, keys };
}
