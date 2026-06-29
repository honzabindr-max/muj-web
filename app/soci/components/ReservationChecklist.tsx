'use client';

import { useEffect, useState } from 'react';
import { RESERVATION_CHECKLIST } from '../data';

const STORAGE_KEY = 'soci-checklist';

export function ReservationChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setChecked(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const doneCount = Object.values(checked).filter(Boolean).length;
  const total = RESERVATION_CHECKLIST.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <section id="rezervace" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Akce · Před odjezdem</div>
        <h2 className="atlas-h2">Rezervační checklist</h2>
      </div>

      <div className="atlas-panel">
        {/* Progress header */}
        <div
          className="atlas-panel-inner"
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
              {mounted ? doneCount : 0}/{total}
            </span>{' '}
            hotovo
          </span>
          <div className="atlas-progress" style={{ flex: 1 }}>
            <div
              className="atlas-progress-fill"
              style={{ width: `${mounted ? pct : 0}%` }}
            />
          </div>
        </div>

        <div className="atlas-panel-inner" style={{ padding: '6px 20px 16px' }}>
          <ul className="atlas-checklist">
            {RESERVATION_CHECKLIST.map((item) => {
              const isDone = mounted ? !!checked[item.id] : false;
              return (
                <li key={item.id} className="atlas-check-item">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`atlas-checkbox${isDone ? ' atlas-checkbox--checked' : ''}`}
                    aria-label={isDone ? `Odznačit: ${item.label}` : `Označit: ${item.label}`}
                  >
                    {isDone && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`atlas-check-label${isDone ? ' atlas-check-label--done' : ''}`}>
                        {item.label}
                      </span>
                      {item.critical && !isDone && (
                        <span className="atlas-pill atlas-pill--amber" style={{ flexShrink: 0, marginTop: 1 }}>
                          nutné
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <div className="atlas-check-note">{item.note}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
