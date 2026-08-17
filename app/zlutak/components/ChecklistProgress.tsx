'use client';

import { ALL_CHECKLIST_IDS, TOTAL_CHECKLIST_ITEMS } from '../lib/checklist-data';
import { useChecklist } from './ChecklistProvider';

export function ChecklistProgress() {
  const { checked, reset } = useChecklist();

  const done = ALL_CHECKLIST_IDS.reduce((n, id) => (checked[id] ? n + 1 : n), 0);
  const pct = TOTAL_CHECKLIST_ITEMS === 0 ? 0 : Math.round((done / TOTAL_CHECKLIST_ITEMS) * 100);

  function handleReset() {
    if (window.confirm('Opravdu resetovat celý checklist? Všechny zaškrtnuté položky se vrátí do výchozího stavu.')) {
      reset();
    }
  }

  return (
    <div className="z-progress">
      <div className="z-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="z-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="z-progress-row">
        <span className="z-progress-count">
          hotovo {done} / {TOTAL_CHECKLIST_ITEMS}
        </span>
        <button type="button" className="z-reset-btn" onClick={handleReset}>
          Resetovat vše
        </button>
      </div>
    </div>
  );
}
