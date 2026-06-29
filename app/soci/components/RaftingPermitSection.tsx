import { Section } from './Section';

export function RaftingPermitSection() {
  return (
    <Section id="rafting" title="Rafting & permit">
      <div className="space-y-4">
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <h3 className="mb-3 font-semibold text-red-900">Permit workflow (ověřeno, hlavní sezóna)</h3>
          <ul className="space-y-2 text-sm text-red-800">
            <li className="flex gap-2">
              <span className="font-bold">€</span>
              <span>
                <strong>21 €/dospělý</strong> — Sektor Bovec 6 € + Sektor Kobarid 15 €.
                Oba synové (16 i 20 let) platí plnou cenu — sleva jen do 14/15 let.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">≤5</span>
              <span>Jeden permit může krýt až 5 osob → pro 3 možná 1 permit, ne 3. Ověřit u firmy.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">⏱</span>
              <span>
                <strong>Nekupovat dřív než 24 h předem</strong> — non-refundable. V 2026 možný chaos:
                dva oddělené permity na dva účty.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">🔗</span>
              <span>
                Portál:{' '}
                <a
                  href="https://gosoca.si/portal"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-red-900"
                >
                  gosoca.si/portal
                </a>
                {' '}— při výpadku TIC Bovec/Kobarid/Tolmin, tel.{' '}
                <a href="tel:+38670982301" className="underline">
                  +386 70 982 301
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">!</span>
              <span>Permit jen pro rafting/kayak — NE canyoning/zipline.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Dotaz pro rafting firmy (zkopírovat)</h3>
          <pre className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">
{`Is the river permit included, or do we buy it separately?
What is the total final price for 3 persons including
permits, equipment and transfer?`}
          </pre>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Doporučené firmy</h3>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {[
              { name: 'Soča Splash', url: 'https://www.socasplash.com' },
              { name: 'Bovec Sport', url: 'https://www.bovecsport.com' },
              { name: 'HydroMania', url: 'https://www.hydromania.si' },
              { name: 'Bovec Rafting Team', url: null },
            ].map((firm) => (
              <li key={firm.name} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {firm.url ? (
                  <a href={firm.url} target="_blank" rel="noreferrer" className="text-sky-600 underline hover:text-sky-800">
                    {firm.name}
                  </a>
                ) : (
                  <span>{firm.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
