import type { DayData } from '../types';

interface DayCardProps {
  day: DayData;
}

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'Lehká',
  2: 'Mírná',
  3: 'Střední',
  4: 'Náročná',
  5: 'Velmi náročná',
};

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ opacity: i < level ? 1 : 0.2, backgroundColor: 'currentColor' }}
        />
      ))}
      <span className="ml-1 text-xs">{DIFFICULTY_LABEL[level]}</span>
    </div>
  );
}

export function DayCard({ day }: DayCardProps) {
  return (
    <details id={`den-${day.day}`} className="group scroll-mt-20 rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 select-none">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: day.color }}
        >
          {day.day}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 truncate">{day.title}</div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500" style={{ color: day.color }}>
            <DifficultyDots level={day.difficulty} />
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
        <div className="mb-3 rounded-lg px-3 py-2.5 text-sm font-medium" style={{ backgroundColor: day.color + '18', color: day.color }}>
          ✦ {day.highlights}
        </div>
        <p className="mb-4 leading-relaxed">{day.description}</p>
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Plán B: </span>
          {day.planB}
        </div>
      </div>
    </details>
  );
}
