'use client';

import { useEffect, useState } from 'react';
import { GEAR_GROUPS } from '../data';

const STORAGE_KEY = 'soci-gear';

function ChevronSvg() {
  return (
    <svg className="atlas-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function GearChecklist() {
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

  const allItems = GEAR_GROUPS.flatMap((g) => g.items);
  const doneCount = mounted ? allItems.filter((item) => checked[item.id]).length : 0;
  const total = allItems.length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <section id="vybava" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Balení · Co s sebou</div>
        <h2 className="atlas-h2">Výbava</h2>
      </div>

      <div className="atlas-panel">
        {/* Progress */}
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
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{doneCount}/{total}</span> zabaleno
          </span>
          <div className="atlas-progress" style={{ flex: 1 }}>
            <div className="atlas-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Skupiny */}
        <div className="atlas-panel-inner" style={{ padding: '6px 20px 16px' }}>
          {GEAR_GROUPS.map((group, gi) => {
            const groupDone = mounted ? group.items.filter((i) => checked[i.id]).length : 0;
            return (
              <details
                key={group.id}
                open
                style={{
                  borderTop: gi === 0 ? 'none' : '1px solid var(--hairline)',
                  paddingTop: gi === 0 ? 8 : 0,
                }}
              >
                <summary
                  style={{
                    listStyle: 'none',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '12px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div className="atlas-gear-count">
                    {groupDone}/{group.items.length}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {group.group}
                  </span>
                  <ChevronSvg />
                </summary>
                <ul
                  style={{
                    margin: 0,
                    padding: '0 0 10px 40px',
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                  }}
                >
                  {group.items.map((item, ii) => {
                    const isDone = mounted ? !!checked[item.id] : false;
                    return (
                      <li
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 0',
                          borderTop: ii === 0 ? 'none' : '1px solid var(--hairline)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={`atlas-checkbox${isDone ? ' atlas-checkbox--checked' : ''}`}
                          style={{ width: 18, height: 18, minWidth: 18, borderRadius: 5 }}
                          aria-label={isDone ? `Odznačit: ${item.label}` : `Označit: ${item.label}`}
                        >
                          {isDone && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </button>
                        <span
                          style={{
                            fontSize: 13,
                            color: isDone ? 'var(--faint)' : 'var(--muted)',
                            textDecoration: isDone ? 'line-through' : 'none',
                            lineHeight: 1.4,
                          }}
                        >
                          {item.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
