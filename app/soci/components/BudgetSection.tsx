import { BUDGET_ROWS } from '../data';
import { Section } from './Section';

export function BudgetSection() {
  return (
    <Section id="rozpocet" title="Rozpočet (3 osoby)">
      <div className="text-xs text-slate-500 mb-3">Kurz orientačně 1 € ≈ 25 Kč.</div>

      {/* Desktop tabulka */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Položka</th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-700">Low-cost</th>
              <th className="px-4 py-3 text-right font-semibold text-sky-700">Rozumná</th>
              <th className="px-4 py-3 text-right font-semibold text-purple-700">Pohodlnější</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {BUDGET_ROWS.map((row, i) => (
              <tr key={i} className={i === BUDGET_ROWS.length - 1 ? 'font-semibold bg-slate-50' : 'hover:bg-slate-50/50'}>
                <td className="px-4 py-2.5 text-slate-800">{row.item}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{row.low}</td>
                <td className="px-4 py-2.5 text-right text-sky-700">{row.mid}</td>
                <td className="px-4 py-2.5 text-right text-purple-700">{row.high}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil karty */}
      <div className="space-y-3 sm:hidden">
        {BUDGET_ROWS.map((row, i) => (
          <div
            key={i}
            className={`rounded-xl border p-4 ${
              i === BUDGET_ROWS.length - 1
                ? 'border-slate-300 bg-slate-50 font-semibold'
                : 'border-slate-200 bg-white'
            } shadow-sm`}
          >
            <div className="mb-2 text-sm font-medium text-slate-900">{row.item}</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-emerald-50 p-2 text-center">
                <div className="mb-0.5 font-medium text-emerald-700">Low-cost</div>
                <div className="text-emerald-800">{row.low}</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-2 text-center">
                <div className="mb-0.5 font-medium text-sky-700">Rozumná</div>
                <div className="text-sky-800">{row.mid}</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-2 text-center">
                <div className="mb-0.5 font-medium text-purple-700">Pohodlnější</div>
                <div className="text-purple-800">{row.high}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
