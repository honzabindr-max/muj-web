import { DAY_PLANS } from '../data';
import { Callout } from './Callout';
import { Section } from './Section';

const TAG_COLORS: Record<string, string> = {
  'rafting': 'bg-sky-100 text-sky-700',
  'canyoning': 'bg-purple-100 text-purple-700',
  'adrenalin': 'bg-red-100 text-red-700',
  'vodopády': 'bg-violet-100 text-violet-700',
  'hory': 'bg-orange-100 text-orange-700',
  'bezplatný bus': 'bg-emerald-100 text-emerald-700',
  'trek': 'bg-teal-100 text-teal-700',
  'řeka': 'bg-cyan-100 text-cyan-700',
  'lehký výlet': 'bg-green-100 text-green-700',
  'organizace': 'bg-slate-100 text-slate-600',
  'příjezd': 'bg-slate-100 text-slate-600',
  'pláž': 'bg-amber-100 text-amber-700',
  'volno': 'bg-slate-100 text-slate-600',
  'odjezd': 'bg-slate-100 text-slate-600',
};

export function BasecampPlanSection() {
  return (
    <Section id="plan" title="Rámcový plán 7 dní">
      <p className="mb-4 text-sm text-slate-600">
        Základna Bovec. Dny jsou orientační — přehazuj dle počasí a nálady.
        Bez horského dne (Den 4) roztáhni řeku nebo přidej kayak.
      </p>

      <div className="flex flex-col gap-3">
        {DAY_PLANS.map((day) => (
          <details
            key={day.day}
            id={`den-${day.day}`}
            className="group scroll-mt-20 rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 select-none">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                {day.day}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{day.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {day.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <svg
                className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-700">
              <p className="mb-3 leading-relaxed">{day.description}</p>
              {day.tip && (
                <Callout variant="tip">{day.tip}</Callout>
              )}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}
