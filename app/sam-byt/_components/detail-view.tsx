"use client";

import Link from "next/link";
import { useMemo } from "react";

import { formatCzk, formatPricePerM2, formatRent, formatTotalCostsLabel, priceCompletenessNote } from "@/sam-byt/data/price";
import { defaultState } from "@/sam-byt/state/default-state";
import type { Listing, Username } from "@/sam-byt/types";

import { useSamBytState } from "@/app/sam-byt/_lib/use-sam-byt-state";

import { DecisionControls } from "./decision-controls";
import { Gallery } from "./gallery";
import { PetBadge } from "./pet-badge";

function Money({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between border-b border-zinc-100 py-1.5 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-900">{value == null ? "Neznámé" : formatCzk(value)}</span>
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:underline"
    >
      {label} ↗
    </a>
  );
}

export function DetailView({ listing, username }: { listing: Listing; username: Username }) {
  const { data, mutate } = useSamBytState();
  const state = useMemo(
    () => data?.own[listing.id] ?? defaultState("", username, listing.id),
    [data, username, listing.id],
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <Link href="/sam-byt" className="text-sm font-medium text-zinc-600 hover:underline">
        ← Zpět na přehled
      </Link>

      <Gallery images={listing.image_urls} alt={listing.card_title} fallbackHref={listing.image_fallback_url ?? listing.source_url} />

      <div>
        <h1 className="text-3xl font-extrabold text-zinc-950">{listing.street ?? listing.district}</h1>
        <p className="font-medium text-zinc-600">
          {listing.district} · {listing.disposition} · {listing.area_m2 != null ? `${listing.area_m2} m²` : "Plocha neuvedena"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <SourceLink href={listing.source_url} label="Zobrazit inzerát" />
          {listing.alternative_urls.map((url) => (
            <SourceLink key={url} href={url} label="Zobrazit na Bazoši" />
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-3xl font-extrabold tabular-nums text-zinc-950">{formatRent(listing)}</p>
        <p className="text-base font-semibold tabular-nums text-zinc-700">{formatTotalCostsLabel(listing)}</p>
        <p className="text-sm font-medium text-amber-800">{priceCompletenessNote(listing)}</p>
        <p className="text-sm font-medium tabular-nums text-zinc-600">{formatPricePerM2(listing)}</p>
        <div className="mt-3">
          <Money label="Nájem" value={listing.rent_czk} />
          <Money label="Služby" value={listing.services_czk} />
          <Money label="Elektřina" value={listing.electricity_czk} />
          <Money label="Plyn" value={listing.gas_czk} />
          <Money label="Další povinné platby" value={listing.other_mandatory_czk} />
        </div>
        <div className="mt-3">
          <Money label="Kauce (jednorázově)" value={listing.deposit_czk} />
          <Money label="Provize RK (jednorázově)" value={listing.agency_fee_czk} />
          <Money label="Další jednorázové platby" value={listing.other_one_time_fees_czk} />
        </div>
        {listing.missing_monthly_costs.length > 0 && (
          <p className="mt-2 text-xs font-medium text-zinc-600">Chybí ověřit: {listing.missing_monthly_costs.join(", ")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-xl font-bold text-zinc-950">Detaily</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="font-medium text-zinc-600">Patro</dt>
            <dd>{listing.floor ?? "Neuvedeno"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">Výtah</dt>
            <dd>{listing.elevator === null ? "Neuvedeno" : listing.elevator ? "Ano" : "Ne"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">Balkón/lodžie</dt>
            <dd>{listing.display_balcony_status === "ano" ? listing.balcony_type ?? "Ano" : "Ne"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-600">Sklep</dt>
            <dd>{listing.cellar ?? "Neuvedeno"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-medium text-zinc-600">Vybavení a předávané spotřebiče</dt>
            <dd>{listing.display_furnished_status}</dd>
            {listing.other_equipment.length > 0 && <dd className="font-medium text-zinc-600">{listing.other_equipment.join(", ")}</dd>}
          </div>
          <div className="col-span-2">
            <dt className="font-medium text-zinc-600">Dostupnost dle inzerátu</dt>
            <dd>{listing.available_from ?? "Neuvedeno"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="font-medium text-zinc-600">Data ověřena</dt>
            <dd>{listing.checked_at}</dd>
          </div>
        </dl>
        {listing.area_m2 != null && listing.discrepancies.some((d) => /m²|plocha|výměr/i.test(d)) && (
          <p className="mt-2 text-xs text-amber-800">
            ⚠ Rozpor v ploše: {listing.discrepancies.find((d) => /m²|plocha|výměr/i.test(d))}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-xl font-bold text-zinc-950">A co pes?</h2>
        <div className="mt-2">
          <PetBadge listing={listing} />
        </div>
        {listing.pets_exact_quote && (
          <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-700">
            „{listing.pets_exact_quote}“
          </blockquote>
        )}
        {listing.pets_conditions && <p className="mt-2 text-sm text-zinc-600">{listing.pets_conditions}</p>}
        <p className="mt-2 text-xs font-medium text-zinc-600">
          Souhlas se psem nelze potvrdit bez kontaktu s majitelem — žádný z 11 bytů dnes nemá konkrétního
          australského ovčáka výslovně schváleného.
        </p>
      </section>

      {(listing.benefits.length > 0 || listing.compromises.length > 0) && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          {listing.benefits.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-zinc-950">Proč nás zaujal</h2>
              <ul className="mt-2 list-inside list-disc text-sm text-emerald-800">
                {listing.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>
          )}
          {(listing.compromises.length > 0 || listing.facts_to_verify.length > 0 || listing.discrepancies.length > 0) && (
            <>
              <h2 className="mt-4 text-xl font-bold text-zinc-950">Co zvážit a ověřit</h2>
              <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
                {listing.compromises.map((c) => (
                  <li key={c}>{c}</li>
                ))}
                {listing.facts_to_verify.map((f) => (
                  <li key={f}>Ověřit: {f}</li>
                ))}
                {listing.discrepancies.map((d) => (
                  <li key={d}>Rozpor: {d}</li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-zinc-600">
            Marketingový text inzerátu není nezávislá garance — jde o formulace z nabídky.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-xl font-bold text-zinc-950">Zdroj</h2>
        <p className="mt-1 text-sm font-medium text-zinc-600">{listing.source_name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <SourceLink href={listing.source_url} label="Zobrazit inzerát" />
          {listing.alternative_urls.map((url) => (
            <SourceLink key={url} href={url} label="Zobrazit na Bazoši" />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-xl font-bold text-zinc-950">Moje rozhodnutí</h2>
        <div className="mt-3">
          <DecisionControls listingId={listing.id} state={state} onMutate={mutate} />
        </div>
      </section>
    </div>
  );
}
