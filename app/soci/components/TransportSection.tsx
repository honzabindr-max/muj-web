import { TRANSPORT_VARIANTS } from '../data';
import { Callout } from './Callout';
import { Section } from './Section';

export function TransportSection() {
  return (
    <Section id="cesta" title="Cesta tam a zpět">
      <Callout variant="danger" className="mb-5">
        <strong>Arriva letní linka Ljubljana → Bovec jede jen Po–So (neděle NEJEDE!)</strong> a pouze do
        konce srpna. Ověřit návaznost a aktuální jízdní řád:{' '}
        <a href="https://www.ap-ljubljana.si" target="_blank" rel="noreferrer" className="underline">
          ap-ljubljana.si
        </a>{' '}
        /{' '}
        <a href="https://www.arriva.si" target="_blank" rel="noreferrer" className="underline">
          arriva.si
        </a>
        . Neděle = Nomago jako záloha.
      </Callout>

      <div className="grid gap-4 sm:grid-cols-3">
        {TRANSPORT_VARIANTS.map((v) => (
          <div
            key={v.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <span className="mr-2 text-xl">{v.icon}</span>
                <span className="font-semibold text-slate-900">{v.label}</span>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div className="font-semibold text-slate-800">{v.price}</div>
                <div>{v.duration}</div>
              </div>
            </div>
            {v.highlight && (
              <div className="mb-3 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                {v.highlight}
              </div>
            )}
            <ol className="flex-1 space-y-1.5 text-sm text-slate-700">
              {v.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-4 font-medium text-slate-500">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-800">Etapa Ljubljana → Bovec (vždy bus)</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <div className="mb-1 font-medium text-slate-700">
              Arriva ⭐ (letní sezónní linka, doporučeno)
            </div>
            <p className="text-slate-600">
              Ljubljana 07:30 → Bovec 11:18 · Zpět: Bovec 14:45 → Ljubljana 18:17. Přes Lago del
              Predil, scenic. <strong>Jen Po–So, do 31.8.</strong>
            </p>
          </div>
          <div>
            <div className="mb-1 font-medium text-slate-700">Nomago (záloha + neděle)</div>
            <p className="text-slate-600">
              Ljubljana AP → Bovec, ~2–2,5 h, ~15–25 €. Jede i v neděli. Rezervovat předem:{' '}
              <a
                href="https://www.nomago.si"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 underline"
              >
                nomago.si
              </a>
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            ['FlixBus', 'https://www.flixbus.cz'],
            ['RegioJet', 'https://www.regiojet.cz'],
            ['ÖBB', 'https://www.oebb.at'],
            ['ap-ljubljana.si', 'https://www.ap-ljubljana.si'],
          ].map(([label, url]) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 underline hover:text-sky-800"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </Section>
  );
}
