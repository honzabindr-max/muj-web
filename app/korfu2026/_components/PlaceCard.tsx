import type { Place } from '../_data/types';
import { AREA_LABEL, TIER_LABEL, mapsUrl } from '../_data/types';

/**
 * Karta jednoho místa. Vykresluje POUZE pole, která jsou v datech vyplněná —
 * `null` / prázdné pole se nezobrazí vůbec (kontrakt bod 16, forma (b)).
 */
export function PlaceCard({ place }: { place: Place }) {
  const headingId = `place-${place.id}-title`;

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="text-lg font-semibold text-slate-900">
          {place.canonicalName}
        </h3>
        <span className="rounded-full bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white">
          {TIER_LABEL[place.tier]}
        </span>
      </header>

      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-600">
        {AREA_LABEL[place.area]}
        {place.subcategory ? ` · ${place.subcategory}` : ''}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-slate-800">{place.why}</p>

      {place.userPriority && (
        <p className="mt-2 text-sm font-medium text-teal-900">★ {place.userPriority}</p>
      )}

      <dl className="mt-3 space-y-1.5 text-sm text-slate-800">
        {place.transport.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Doprava:</dt>
            <dd>{place.transport.join(' ')}</dd>
          </div>
        )}
        {place.accessDifficulty && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Náročnost přístupu:</dt>
            <dd>{place.accessDifficulty}</dd>
          </div>
        )}
        {place.weather && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Vhodné počasí:</dt>
            <dd>{place.weather}</dd>
          </div>
        )}
        {place.combinesWith.length > 0 && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-semibold text-slate-600">Lze spojit:</dt>
            <dd>{place.combinesWith.join(' · ')}</dd>
          </div>
        )}
      </dl>

      {place.warnings.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-amber-900">
            Upozornění
          </h4>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-950">
            {place.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {place.verify.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-100 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">
            Ověřit aktuálně
          </h4>
          <ul className="mt-1 list-disc pl-4 text-sm text-slate-800">
            {place.verify.map((v) => (
              <li key={v.what}>
                {v.what}
                {v.source && (
                  <>
                    {' '}
                    <a
                      className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      href={v.source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {v.source.label}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {place.coordsStatus !== 'overene' && place.coordsNote && (
        <p className="mt-3 text-xs text-slate-600">
          <span className="font-semibold">Mapový bod: </span>
          {place.coordsStatus === 'orientacni' ? 'orientační. ' : 've zdroji neuveden. '}
          {place.coordsNote}
        </p>
      )}

      <div className="mt-4">
        <a
          className="inline-flex items-center rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          href={mapsUrl(place)}
          rel="noopener noreferrer"
          target="_blank"
        >
          Navigovat
          <span className="sr-only"> — {place.canonicalName} v Google Maps (nové okno)</span>
        </a>
      </div>
    </article>
  );
}
