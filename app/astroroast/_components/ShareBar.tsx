"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/astroroast/analytics";
import { CARD_VERSION } from "@/astroroast/card/version";

const ORIGIN = "https://www.good-inventions.work";

type Props = { kind: "roast" | "couple"; code: string; headline: string; target?: "self" | "friend" };

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareBar({ kind, code, headline, target = "self" }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const path = kind === "couple" ? "p" : "r";
  const url = `${ORIGIN}/astroroast/${path}/${encodeURIComponent(code)}`;
  const text =
    kind === "couple"
      ? `„${headline}“ — hvězdy nás právě roastnuly 🌶️ Zkus to na vás dva:`
      : target === "friend"
        ? `„${headline}“ — tohle hvězdy napsaly o tobě 🌶️ Zkus to na sebe a pošli to dál:`
        : `„${headline}“ — hvězdy mě právě roastnuly 🌶️ Zkus to na sebe:`;
  const cardUrl = `/astroroast/api/karta?c=${encodeURIComponent(code)}&k=${kind}&f=story&v=${CARD_VERSION}`;
  const fileName = `astroroast-${code}.png`;

  async function onShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url });
        track("share", { kind, channel: "native" });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    if (await copyText(`${text} ${url}`)) {
      track("share", { kind, channel: "copy" });
      say("Zkopírováno ✓");
    } else {
      say("Sdílení se nepovedlo");
    }
  }

  async function onCopy() {
    if (await copyText(url)) {
      track("share", { kind, channel: "link" });
      say("Zkopírováno ✓");
    } else {
      say("Kopírování se nepovedlo");
    }
  }

  async function onDownload() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(cardUrl);
      if (!res.ok) throw new Error("card");
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      if (isIos() && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, url });
          track("download", { kind, channel: "share-file" });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      track("download", { kind, channel: "png" });
      say("Karta stažena ✓");
    } catch {
      say("Kartu se nepodařilo stáhnout");
    } finally {
      setBusy(false);
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="ar-share" role="group" aria-label="Sdílení">
      <style>{CSS}</style>
      <div className="ar-share__row">
        <button type="button" className="ar-share__btn ar-share__btn--main" onClick={onShare}>
          Sdílet
        </button>
        <button type="button" className="ar-share__btn" onClick={onCopy}>
          Kopírovat odkaz
        </button>
        <button type="button" className="ar-share__btn ar-share__btn--lime" onClick={onDownload} disabled={busy} aria-busy={busy}>
          {busy ? "Kreslím…" : "Stáhnout kartu"}
        </button>
      </div>
      <div className="ar-share__row ar-share__row--quick">
        <a
          className="ar-share__quick"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("share", { kind, channel: "whatsapp" })}
        >
          WhatsApp
        </a>
        <a
          className="ar-share__quick"
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("share", { kind, channel: "x" })}
        >
          X / Twitter
        </a>
      </div>
      <div className="ar-share__toast" role="status" aria-live="polite" data-show={toast ? "1" : "0"}>
        {toast ?? ""}
      </div>
    </div>
  );
}

const CSS = `
.ar-share{--ars-pink:#FF2E88;--ars-lime:#C6FF3D;--ars-violet:#7B5CFF;--ars-cream:#FFF6E9;--ars-space:#0B0420;
  position:relative;display:flex;flex-direction:column;gap:12px;width:100%;max-width:560px;margin:0 auto;font-family:inherit}
.ar-share__row{display:flex;flex-wrap:wrap;gap:10px}
.ar-share__btn{flex:1 1 150px;min-height:48px;padding:10px 16px;cursor:pointer;
  font:inherit;font-weight:800;font-size:16px;letter-spacing:.02em;text-transform:uppercase;line-height:1.1;
  color:var(--ars-space);background:var(--ars-cream);border:3px solid var(--ars-space);border-radius:14px;
  box-shadow:4px 4px 0 var(--ars-violet);transition:transform .12s ease,box-shadow .12s ease;
  -webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ar-share__btn--main{background:var(--ars-pink);color:var(--ars-cream);box-shadow:4px 4px 0 var(--ars-lime)}
.ar-share__btn--lime{background:var(--ars-lime);box-shadow:4px 4px 0 var(--ars-pink)}
.ar-share__btn:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 var(--ars-violet)}
.ar-share__btn--main:hover{box-shadow:6px 6px 0 var(--ars-lime)}
.ar-share__btn--lime:hover{box-shadow:6px 6px 0 var(--ars-pink)}
.ar-share__btn:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--ars-space)}
.ar-share__btn:disabled{opacity:.7;cursor:progress}
.ar-share__btn:focus-visible,.ar-share__quick:focus-visible{outline:3px solid var(--ars-lime);outline-offset:3px}
.ar-share__row--quick{gap:8px}
.ar-share__quick{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;
  font-weight:700;font-size:15px;text-decoration:none;color:var(--ars-cream);background:rgba(255,246,233,.08);
  border:2px dashed rgba(255,246,233,.6);border-radius:999px;-webkit-tap-highlight-color:transparent}
.ar-share__quick:hover{background:rgba(255,246,233,.18);border-style:solid}
.ar-share__toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);z-index:50;pointer-events:none;
  padding:12px 20px;min-height:44px;display:flex;align-items:center;font-weight:800;font-size:16px;
  color:var(--ars-space);background:var(--ars-lime);border:3px solid var(--ars-space);border-radius:14px;
  box-shadow:4px 4px 0 var(--ars-pink);opacity:0;transition:opacity .18s ease,transform .18s ease}
.ar-share__toast[data-show="1"]{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){.ar-share__btn,.ar-share__toast{transition:none}}
`;
