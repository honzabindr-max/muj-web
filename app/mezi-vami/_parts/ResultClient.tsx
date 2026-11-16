"use client";

// Pomocné klientské části výsledku: měření zobrazení a dopsání textů, když výpočet je uložený,
// ale texty ještě ne (výpadek pisatele, zavřené okno během výpočtu).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureText } from "../_lib/engine-client";
import { track, type FunnelEvent } from "../_lib/track";

export function TrackOnce({ event }: { event: FunnelEvent }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    track(event);
  }, [event]);
  return null;
}

export function ResultRecovery({ id, failed = false }: { id: string; failed?: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState(failed);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (failed && n === 0) return;
    setErr(false);
    ensureText(id)
      .then(() => router.refresh())
      .catch(() => setErr(true));
  }, [id, n, failed, router]);
  return (
    <div className="mvp" style={{ background: "#0E070F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <main role="status" aria-live="polite" style={{ maxWidth: 460, textAlign: "center", color: "#F4E9E4", fontFamily: "var(--font-mv-jost), system-ui, sans-serif" }}>
        <h1 style={{ fontFamily: "var(--font-mv-garamond), serif", fontWeight: 400, fontSize: 34, margin: 0 }}>
          {err ? "Výsledek se teď nepodařilo načíst." : "Dokončujeme vaši Vztahovou DNA…"}
        </h1>
        {err ? (
          <button
            type="button"
            onClick={() => setN((x) => x + 1)}
            style={{ marginTop: 20, minHeight: 44, padding: "0 20px", borderRadius: 999, border: "1px solid #EDB894", background: "rgba(237,184,148,0.14)", color: "#F4E9E4", fontFamily: "inherit", fontSize: 15, cursor: "pointer" }}
          >
            Zkusit znovu
          </button>
        ) : null}
      </main>
    </div>
  );
}
