"use client";

import { useState } from "react";
import type { Operator } from "../_data/types";
import { FRESHNESS_LABEL, isRenderableFact } from "../_data/types";
import { stripSpNote } from "../_lib/format";

const ROLE_LABEL: Record<Operator["role"], string> = {
  "prvni-volba": "První volba",
  alternativa: "Alternativa",
  lead: "Lead — ověřit",
};

const ROLE_STYLE: Record<Operator["role"], string> = {
  "prvni-volba": "bg-[var(--acc)] text-white",
  alternativa: "bg-[var(--acc2)] text-white",
  lead: "bg-[var(--muted)] text-white",
};

export function OperatorCard({
  op,
  showSources,
}: {
  op: Operator;
  showSources: boolean;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const renderableOffers = op.offers.filter(isRenderableFact);

  async function handleCopy(phone: string, idx: number) {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch {
      // Clipboard může být v omezeném režimu prohlížeče nedostupný.
    }
  }

  return (
    <div className="kf-card flex flex-col gap-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-bold" style={{ color: "var(--ink)" }}>
          {op.name}
        </h4>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLE[op.role]}`}>
          {ROLE_LABEL[op.role]}
        </span>
      </div>

      {op.base && (
        <p className="-mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
          {op.base}
        </p>
      )}

      {/* Offers — cena/nabídka + kompaktní štítek ověření, žádný SP v textu */}
      {renderableOffers.length > 0 && (
        <ul className="space-y-1.5">
          {renderableOffers.map((offer) => (
            <li key={offer.label} className="kf-pill flex flex-wrap items-baseline gap-x-2 gap-y-0.5 !py-1.5">
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {offer.label}
              </span>
              <span>{offer.value}</span>
              <span className="kf-verify-chip">{FRESHNESS_LABEL[offer.freshness]}</span>
              <a
                className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                href={offer.source.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {offer.source.label}
              </a>
              {offer.note && (
                <span className="basis-full text-xs" style={{ color: "var(--muted)" }}>
                  {offer.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Warnings */}
      {op.warnings.length > 0 && (
        <div className="kf-warn">
          <b>Upozornění</b>
          <ul className="mt-1 list-disc pl-4">
            {op.warnings.map((w) => (
              <li key={w}>{stripSpNote(w)}</li>
            ))}
          </ul>
        </div>
      )}

      {showSources && <p className="kf-sp">{op.sp}</p>}

      {/* Action buttons */}
      <div className="mt-1 flex flex-wrap gap-2">
        {op.phones.map((phone, i) => (
          <a
            key={phone}
            aria-label={`Zavolat na ${phone}`}
            className="kf-btn"
            href={`tel:${phone.replace(/\s/g, "")}`}
          >
            Volat{op.phones.length > 1 ? ` (${i + 1})` : ""}
          </a>
        ))}

        {op.phones.map((phone, i) => (
          <button
            key={`copy-${phone}`}
            aria-label={`Kopírovat číslo ${phone}`}
            className="kf-btn kf-btn-ghost"
            onClick={() => handleCopy(phone, i)}
            type="button"
          >
            {copiedIdx === i
              ? "Zkopírováno!"
              : `Kopírovat číslo${op.phones.length > 1 ? ` (${i + 1})` : ""}`}
          </button>
        ))}

        {op.sources.map((src) => (
          <a
            key={src.url}
            aria-label={`Otevřít zdroj ${src.label} (nové okno)`}
            className="kf-btn kf-btn-ghost"
            href={src.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Otevřít zdroj
          </a>
        ))}
      </div>
    </div>
  );
}
