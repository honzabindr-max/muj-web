"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

// Desktopový a mobilní artboard. Server vykreslí OBA (HTML funguje bez JS a bez skoku
// rozvržení; mezi nimi přepíná CSS, breakpoint 768 px, viz mezi-vami.css). Po hydrataci
// zůstane v DOM jen ta větev, která odpovídá šířce okna — díky tomu jsou id a formulářová
// pole unikátní (kotvy #nabidka, #t01…), je jen jeden <main> a jeden <h1> a hydratace
// nemá dvojí stav. Při změně šířky (otočení telefonu) se větev přepne.
// Mobilní sloupec se pod 768 px natahuje na šířku okna (max 560 px).
// `landmark`: artboard nemá vlastní <main> → obalí ho stránka.

const QUERY = "(max-width: 767.98px)";
type Mode = "both" | "m" | "d";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getMode = (): Mode => (window.matchMedia(QUERY).matches ? "m" : "d");
// server i první hydratační průchod: obě větve (shoduje se se server HTML)
const getServerMode = (): Mode => "both";

/** Po přepnutí větve doskroluje na kotvu z URL (prohlížeč při načtení skočil na skrytý duplikát). */
function useScrollToHash(mode: Mode) {
  const last = useRef<Mode>("both");
  useEffect(() => {
    if (mode === "both" || last.current === mode) return;
    const first = last.current === "both";
    last.current = mode;
    if (!first) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash));
    el?.scrollIntoView();
  }, [mode]);
}

export function Dual({
  desktop,
  mobile,
  bg,
  landmark = false,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
  bg: string;
  landmark?: boolean;
}) {
  const mode = useSyncExternalStore(subscribe, getMode, getServerMode);
  useScrollToHash(mode);
  const Wrap = landmark ? "main" : "div";
  return (
    <div className="mvp" style={{ background: bg }}>
      {mode !== "m" && <Wrap className="mv-d">{desktop}</Wrap>}
      {mode !== "d" && (
        <Wrap className="mv-m">
          <div className="mv-mcol">{mobile}</div>
        </Wrap>
      )}
    </div>
  );
}
