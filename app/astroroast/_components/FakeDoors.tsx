"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/astroroast/analytics";

const OFFERS = [
  {
    id: "year",
    emoji: "📜",
    title: "Rozšířený roast",
    sub: "Celý rok, 12 kapitol. Každý měsíc nová porce hvězdné hanby.",
    price: "49 Kč",
    cta: "Chci celý rok",
    short: "Celý rok roastů?",
  },
  {
    id: "birthday_pdf",
    emoji: "🎂",
    title: "Narozeninové PDF pro kámoše",
    sub: "Vytištěný roast do rámečku. Dárek, po kterém se bude mluvit (a nebudou to chvály).",
    price: "149 Kč",
    cta: "Chci pro kámoše",
    short: "Narozeninové PDF pro kámoše?",
  },
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
            {OFFERS[0].short} <b>{OFFERS[0].price}</b>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      ) : (
        <ul className="ar-doors-list">
          {OFFERS.map((o, i) => (
            <li key={o.id} className="ar-door" style={{ ["--r" as string]: i === 0 ? "-1.2deg" : "1deg" }}>
              <span className="ar-door-emoji" aria-hidden="true">
                {o.emoji}
              </span>
              <h3>{o.title}</h3>
              <p>{o.sub}</p>
              <button type="button" className="ar-btn ar-btn-lime" onClick={() => open(o)}>
                {o.cta} · {o.price}
              </button>
            </li>
          ))}
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
          <p className="ar-sticker ar-sticker-level ar-sheet-tag">Pokladna se ještě nenarodila</p>
          <h2 id={`ar-sheet-title-${placement}`}>Brzy! Zatím zdarma tohle 👇</h2>
          <p id={`ar-sheet-desc-${placement}`}>
            <b>{offer.title}</b> ještě vyrábíme. Tvůj zájem jsme si započítali, čím víc vás klikne, tím dřív to
            dostane Merkur schváleno.
          </p>
          <p>Mezitím je tu pořád to nejlepší: nekonečné roasty zdarma a navíc ten, který pošleš kámošovi.</p>
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
              Roastnout kámoše zdarma <span aria-hidden="true">🎁</span>
            </Link>
            <button type="button" className="ar-btn ar-btn-ghost" onClick={close}>
              Zavřít
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
