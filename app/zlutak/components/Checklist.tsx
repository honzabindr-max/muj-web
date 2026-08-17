'use client';

import type { ChecklistSectionData } from '../lib/checklist-data';
import { useChecklist } from './ChecklistProvider';

export function Checklist({ section }: { section: ChecklistSectionData }) {
  const { checked, toggle } = useChecklist();

  return (
    <ul className="z-checklist">
      {section.items.map((item) => {
        const isChecked = !!checked[item.id];
        return (
          <li key={item.id} className="z-check-item" data-checked={isChecked}>
            <label className="z-check-label-wrap">
              <input
                type="checkbox"
                className="z-check-input"
                checked={isChecked}
                onChange={() => toggle(item.id)}
              />
              <span className="z-check-box" aria-hidden="true" />
              <span className="z-check-text">{item.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
