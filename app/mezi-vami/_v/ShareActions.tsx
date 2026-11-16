"use client";

// Sdílení Vztahové DNA: „Poslat obrázek“ = systémové sdílení s PNG karty (Web Share API se soubory),
// jinde stažení; „Uložit do telefonu“ = stažení PNG. Karta se generuje na serveru z uloženého
// výsledku; oslovení posílá jen tento prohlížeč v těle požadavku (neukládá se).

import { useState, type CSSProperties } from "react";
import { loadNames } from "../_lib/persons-store";
import { track } from "../_lib/track";
import { useDna } from "./view";

async function cardBlob(id: string | null): Promise<Blob> {
  const names = id ? loadNames(id) : null;
  const res = await fetch("/api/mezi-vami/karta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: id ?? "demo", a: names?.a ?? [], b: names?.b ?? [] }),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.blob();
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function ShareActions({ labels, style }: { labels: readonly string[]; style: CSSProperties }) {
  const { id, pair } = useDna();
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const name = "vztahova-dna-mezi-vami.png";

  const run = async (i: number) => {
    setBusy(i);
    setMsg("");
    track(i === 0 ? "share_click" : "save_click");
    try {
      const blob = await cardBlob(id);
      const file = new File([blob], name, { type: "image/png" });
      if (i === 0 && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Vztahová DNA", text: pair.mainTheme.title });
      } else {
        download(blob, name);
        setMsg("Obrázek je stažený.");
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setMsg("Obrázek se nepodařilo připravit. Zkuste to znovu.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {labels.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => run(i)}
          disabled={busy !== null}
          aria-busy={busy === i}
          style={{ ...style, cursor: "pointer", fontFamily: "inherit", opacity: busy !== null && busy !== i ? 0.6 : 1 }}
        >
          {busy === i ? "Připravuji…" : l}
        </button>
      ))}
      <span role="status" aria-live="polite" style={{ flexBasis: "100%", fontSize: 14, color: "#C2ACB7" }}>
        {msg}
      </span>
    </>
  );
}
