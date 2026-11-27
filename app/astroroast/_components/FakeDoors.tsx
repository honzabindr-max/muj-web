"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/astroroast/analytics";
import { useCopy } from "./ModelProvider";

// Texty nabídek jsou v UiCopy.doors.offers, tady jen id a ikona.
const OFFERS = [
  { id: "year", emoji: "📜" },
  { id: "birthday_pdf", emoji: "🎂" },
] as const;

type Offer = (typeof OFFERS)[number];
export type DoorPlacement = "landing" | "result" | "share";

interface FakeDoorsProps {
  /** Kde se nabídka zobrazuje (měří se, aby šlo srovnat zájem na úvodu a u výsledku). */
  placement?: DoorPlacement;
  /** "list" = dvě velké karty, "inline" = jeden řádek pod výsledkem. */
  variant?: "list" | "inline";
}

export function FakeDoors({ placement = "landing", variant = "list" }: FakeDoorsProps) {
  const c = useCopy().doors;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const toFree = useRef(false);
  // Nabídka zůstává ve stavu i po zavření, aby při animaci zavírání neprobliklo „Tohle“.
  const [offer, setOffer] = useState<Offer>(OFFERS[0]);

  function open(o: Offer) {
    track("fake_door", { offer: o.id, placement });
    toFree.current = false;
    setOffer(o);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function onBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target !== e.currentTarget) return;
    const r = innerRef.current?.getBoundingClientRect();
    const outside = !r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) close();
  }

  return (
    <div className={variant === "inline" ? "ar-doors ar-doors-inline" : "ar-doors"}>
      {variant === "inline" ? (
        <button type="button" className="ar-offer-line" onClick={() => open(OFFERS[0])}>
          <span aria-hidden="true">{OFFERS[0].emoji}</span>
          <span>
            {c.offers[OFFERS[0].id].short} <b>{c.offers[OFFERS[0].id].price}</b>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      ) : (
        <ul className="ar-doors-list">
          {OFFERS.map((o, i) => {
            const t = c.offers[o.id];
            return (
            <li key={o.id} className="ar-door" style={{ ["--r" as string]: i === 0 ? "-1.2deg" : "1deg" }}>
              <span className="ar-door-emoji" aria-hidden="true">
                {o.emoji}
              </span>
              <h3>{t.title}</h3>
              <p>{t.sub}</p>
              <button type="button" className="ar-btn ar-btn-lime" onClick={() => open(o)}>
                {t.cta} · {t.price}
              </button>
            </li>
            );
          })}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        className="ar-sheet"
        aria-labelledby={`ar-sheet-title-${placement}`}
        aria-describedby={`ar-sheet-desc-${placement}`}
        onClose={() => {
          if (!toFree.current) track("fake_door_dismiss", { offer: offer.id, placement });
        }}
        onClick={onBackdrop}
      >
        <div ref={innerRef} className="ar-sheet-in">
          <div className="ar-sheet-grip" aria-hidden="true" />
          <p className="ar-sticker ar-sticker-level ar-sheet-tag">{c.sheetTag}</p>
          <h2 id={`ar-sheet-title-${placement}`}>{c.sheetTitle}</h2>
          <p id={`ar-sheet-desc-${placement}`}>
            <b>{c.offers[offer.id].title}</b>
            {c.sheetDescAfter}
          </p>
          <p>{c.sheetMore}</p>
          <div className="ar-sheet-actions">
            <Link
              href="/astroroast#roast"
              className="ar-btn ar-btn-hot"
              onClick={() => {
                toFree.current = true;
                track("fake_door_to_free", { offer: offer.id, placement });
                close();
              }}
            >
              {c.toFree} <span aria-hidden="true">🎁</span>
            </Link>
            <button type="button" className="ar-btn ar-btn-ghost" onClick={close}>
              {c.close}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
