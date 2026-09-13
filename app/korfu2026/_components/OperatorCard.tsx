"use client";

import { useState } from "react";
import type { Operator } from "../_data/types";
import { FRESHNESS_LABEL } from "../_data/types";

const ROLE_LABEL: Record<Operator["role"], string> = {
  "prvni-volba": "První volba",
  alternativa: "Alternativa",
  lead: "Lead — ověřit",
};

const ROLE_COLOR: Record<Operator["role"], string> = {
  "prvni-volba": "bg-teal-800 text-white",
  alternativa: "bg-sky-700 text-white",
  lead: "bg-slate-400 text-white",
};

export function OperatorCard({ op }: { op: Operator }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function handleCopy(phone: string, idx: number) {
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold text-slate-900">{op.name}</h4>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLOR[op.role]}`}
        >
          {ROLE_LABEL[op.role]}
        </span>
      </header>

      {op.base && <p className="mt-1 text-xs text-slate-500">{op.base}</p>}

      {/* Offers */}
      {op.offers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {op.offers.map((offer) => (
            <li
              key={offer.label}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-slate-900">
                {offer.label}
              </span>
              {offer.source ? (
                <>
                  {" · "}
                  <span className="text-slate-700">{offer.value}</span>{" "}
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800">
                    {FRESHNESS_LABEL[offer.freshness]}
                  </span>{" "}
                  <a
                    className="text-teal-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    href={offer.source.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {offer.source.label}
                  </a>
                </>
              ) : (
                <>
                  {" · "}
                  <span className="text-slate-500 italic">
                    {offer.value}
                  </span>{" "}
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-800">
                    {FRESHNESS_LABEL[offer.freshness]}
                  </span>
                </>
              )}
              {offer.note && (
                <p className="mt-0.5 text-xs text-slate-500">{offer.note}</p>
              )}
              <span className="ml-1 text-xs text-slate-400">{offer.sp}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Warnings */}
      {op.warnings.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <h5 className="text-xs font-bold tracking-wide text-amber-900 uppercase">
            Upozornění
          </h5>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-950">
            {op.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Volat — only when phones exist */}
        {op.phones.map((phone, i) => (
          <a
            key={phone}
            aria-label={`Zavolat na ${phone}`}
            className="inline-flex items-center rounded-xl bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            href={`tel:${phone.replace(/\s/g, "")}`}
          >
            Volat{op.phones.length > 1 ? ` (${i + 1})` : ""}
          </a>
        ))}

        {/* Kopírovat číslo — only when phones exist */}
        {op.phones.map((phone, i) => (
          <button
            key={`copy-${phone}`}
            aria-label={`Kopírovat číslo ${phone}`}
            className="inline-flex items-center rounded-xl border border-teal-700 px-3 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            onClick={() => handleCopy(phone, i)}
            type="button"
          >
            {copiedIdx === i
              ? "Zkopírováno!"
              : `Kopírovat číslo${op.phones.length > 1 ? ` (${i + 1})` : ""}`}
          </button>
        ))}

        {/* Otevřít zdroj — only when sources exist */}
        {op.sources.map((src) => (
          <a
            key={src.url}
            aria-label={`Otevřít zdroj ${src.label} (nové okno)`}
            className="inline-flex items-center rounded-xl border border-slate-400 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            href={src.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            Otevřít zdroj
          </a>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-400">{op.sp}</p>
    </div>
  );
}
