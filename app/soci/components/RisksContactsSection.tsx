import { RISKS } from '../data';
import { Section } from './Section';

export function RisksContactsSection() {
  return (
    <Section id="rizika" title="Rizika & nouzové kontakty">
      <div className="space-y-4">
        {/* Tabulka rizik */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Riziko</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Prevence</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RISKS.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.risk}</td>
                    <td className="px-4 py-3 text-slate-600">{r.prevention}</td>
                    <td className="px-4 py-3 text-amber-700">{r.fallback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 sm:hidden">
            {RISKS.map((r, i) => (
              <div key={i} className="bg-white p-4">
                <div className="mb-1.5 font-medium text-slate-800">{r.risk}</div>
                <div className="mb-1 text-xs text-slate-600">
                  <span className="font-medium">Prevence:</span> {r.prevention}
                </div>
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Fallback:</span> {r.fallback}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nouzové kontakty */}
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <h3 className="mb-3 font-semibold text-red-900">Nouzové kontakty</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: '112', desc: 'Záchrana + horská služba Slovinsko' },
              { label: '113', desc: 'Policie Slovinsko' },
              { label: '+386 70 982 301', desc: 'TIC Bovec/Kobarid/Tolmin (permit, rafting)' },
              { label: 'Velvyslanectví ČR v Lublani', desc: 'Konzulární pomoc' },
            ].map((c) => (
              <div key={c.label} className="rounded-lg bg-white/60 px-3 py-2">
                <div className="font-semibold text-red-800">{c.label}</div>
                <div className="text-xs text-red-700">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
