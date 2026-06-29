'use client';

import { useState } from 'react';
import { GEAR_GROUPS } from '../data';
import { Section } from './Section';

export function GearChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const allItems = GEAR_GROUPS.flatMap((g) => g.items);
  const doneCount = allItems.filter((item) => checked[item.id]).length;
  const total = allItems.length;

  return (
    <Section id="vybava" title="Výbava">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{doneCount}/{total}</span> zabaleno
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {GEAR_GROUPS.map((group) => (
          <details key={group.id} className="rounded-xl border border-slate-200 bg-white shadow-sm" open>
            <summary className="cursor-pointer list-none px-5 py-3.5 font-semibold text-slate-800 select-none">
              {group.group}{' '}
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({group.items.filter((i) => checked[i.id]).length}/{group.items.length})
              </span>
            </summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {group.items.map((item) => (
                <li key={item.id} className="px-5 py-2.5">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={() => toggle(item.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                    />
                    <span
                      className={`text-sm ${checked[item.id] ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                    >
                      {item.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </Section>
  );
}
