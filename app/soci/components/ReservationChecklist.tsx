'use client';

import { useState } from 'react';
import { RESERVATION_CHECKLIST } from '../data';
import { Section } from './Section';

export function ReservationChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const doneCount = Object.values(checked).filter(Boolean).length;
  const total = RESERVATION_CHECKLIST.length;

  return (
    <Section id="checklist" title="Rezervační checklist">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{doneCount}/{total}</span> hotovo
          </span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {RESERVATION_CHECKLIST.map((item) => (
            <li key={item.id} className="px-5 py-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!checked[item.id]}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 accent-emerald-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-medium ${checked[item.id] ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                    >
                      {item.label}
                    </span>
                    {item.critical && !checked[item.id] && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        kritické
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <p className="mt-0.5 text-xs text-slate-500">{item.note}</p>
                  )}
                </div>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
