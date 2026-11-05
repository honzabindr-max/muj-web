// Etapa 4 PR 5 (NAVRH-v6 §9): zámky konfliktních zdrojů `runs/resources/<zdroj>.lock`.
//
// Stejný formát a stejná pravidla převzetí jako tick lease (`holderStatus`, store.ts): zámek se vytvoří atomicky
// (hard link, EEXIST = obsazeno), převezme se jen po DŮKAZU, že držitel neběží (PID neexistuje nebo má jiný čas
// startu), nikdy podle stáří. Nejistota (nečitelný zámek, `ps` selhal) = HOLD. Zdroje: `notion-effect:<rodič>`,
// `repo-git`, `worktree:<cesta>`, `browser-profile:TARS-agent` (`panel-row` má vlastní `.panel.lock`).
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  holderStatus,
  mkdirDurable,
  parseLease,
  pidExists,
  processStartTime,
  type TickLease,
} from "./store";

export interface ResourceLease extends Omit<
  TickLease,
  "fence" | "heartbeat_at"
> {
  resource: string;
  /** fence tick lease, pod kterým zámek vznikl */
  fence: number;
}

export type ResourceAcquire =
  | { ok: true; lease: ResourceLease; release: () => void }
  | { ok: false; reason: "HELD" | "UNKNOWN"; holder?: Partial<ResourceLease> };

export interface ResourceProbe {
  pidExists: typeof pidExists;
  processStartTime: typeof processStartTime;
}

/** Bezpečné jméno souboru zámku: čitelný prefix + otisk celého názvu zdroje (cesty, ID stránek). */
export function resourceFile(runsDir: string, resource: string): string {
  const head = resource.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 48);
  const h = createHash("sha256").update(resource).digest("hex").slice(0, 16);
  return path.join(runsDir, "resources", `${head}-${h}.lock`);
}

export class ResourceLocks {
  private ownStart: string | undefined;
  constructor(
    private runsDir: string,
    private probe: ResourceProbe = { pidExists, processStartTime },
    private now: () => string = () => new Date().toISOString(),
  ) {}

  /** Stav zdroje bez zásahu (pro `cli.ts status`). */
  inspect(resource: string):
    | { held: false }
    | {
        held: true;
        status: ReturnType<typeof holderStatus>;
        holder?: Partial<ResourceLease>;
      } {
    const f = resourceFile(this.runsDir, resource);
    let text: string;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { held: false };
      return { held: true, status: "unknown" };
    }
    const holder = parseLease(text) as Partial<ResourceLease> | undefined;
    return { held: true, status: holderStatus(holder, this.probe), holder };
  }

  /**
   * Zámek zdroje pro tento proces. Volný → udělen. Obsazený živým držitelem → `HELD`. Držitel prokazatelně neběží →
   * převzetí (jen když soubor pořád nese stejný token). Cokoli nejistého → `UNKNOWN` (HOLD).
   */
  acquire(resource: string, fence: number): ResourceAcquire {
    const f = resourceFile(this.runsDir, resource);
    mkdirDurable(path.dirname(f));
    // vlastní čas startu se nemění: přečte se jednou za instanci (žádné `ps` při každém efektu)
    this.ownStart ??= this.probe.processStartTime(process.pid);
    const started = this.ownStart;
    if (!started) return { ok: false, reason: "UNKNOWN" };
    const lease: ResourceLease = {
      resource,
      token: randomUUID(),
      fence,
      pid: process.pid,
      started,
      acquired_at: this.now(),
    };
    const tmp = `${f}.${process.pid}.${lease.token}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(lease) + "\n");
    try {
      for (let i = 0; i < 2; i++) {
        try {
          fs.linkSync(tmp, f);
          return { ok: true, lease, release: () => this.release(lease) };
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST")
            return { ok: false, reason: "UNKNOWN" };
        }
        const st = this.inspect(resource);
        if (!st.held) continue;
        if (st.status === "alive")
          return { ok: false, reason: "HELD", holder: st.holder };
        if (st.status !== "dead" || !st.holder?.token)
          return { ok: false, reason: "UNKNOWN", holder: st.holder };
        // Převzetí jen po důkazu konce: přejmenuj mrtvý zámek stranou (atomicky), jen když pořád nese jeho token.
        const again = this.inspect(resource);
        if (
          !again.held ||
          again.holder?.token !== st.holder.token ||
          again.status !== "dead"
        )
          return {
            ok: false,
            reason: "UNKNOWN",
            holder: again.held ? again.holder : undefined,
          };
        const grave = `${f}.dead-${st.holder.token}`;
        try {
          fs.renameSync(f, grave);
        } catch {
          return { ok: false, reason: "UNKNOWN" };
        }
      }
      return { ok: false, reason: "UNKNOWN" };
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }

  /** Uvolní jen vlastní zámek (soubor nese náš token); cizí zámek se nikdy nesmaže. */
  release(lease: ResourceLease): void {
    const f = resourceFile(this.runsDir, lease.resource);
    try {
      const cur = parseLease(fs.readFileSync(f, "utf8")) as
        | Partial<ResourceLease>
        | undefined;
      if (cur?.token === lease.token) fs.rmSync(f, { force: true });
    } catch {
      /* zámek už neexistuje */
    }
  }

  /** Spustí `fn` pod zámkem zdroje; obsazený nebo nejistý zdroj = `undefined` + důvod, `fn` se nezavolá. */
  async with<T>(
    resource: string,
    fence: number,
    fn: () => Promise<T>,
  ): Promise<
    { ok: true; value: T } | { ok: false; reason: "HELD" | "UNKNOWN" }
  > {
    const a = this.acquire(resource, fence);
    if (!a.ok) return { ok: false, reason: a.reason };
    try {
      return { ok: true, value: await fn() };
    } finally {
      a.release();
    }
  }
}
