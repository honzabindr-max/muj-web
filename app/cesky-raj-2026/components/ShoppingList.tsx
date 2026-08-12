'use client';

import { useEffect, useState } from 'react';
import { SHOPPING_LIST, SHOPPING_NEVOZIT } from '../data';

const STORAGE_KEY = 'cesky-raj-2026-shopping';

export function ShoppingList() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // ignore
    }
  }, [checked, loaded]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section className="raj-shopping">
      <h2 className="raj-shopping__title">Nákup před odjezdem</h2>
      <p className="raj-shopping__sub">3 osoby · stav se ukládá jen v tomto telefonu</p>
      <ul className="raj-shopping__list">
        {SHOPPING_LIST.map((item) => (
          <li
            key={item.id}
            className="raj-shopping__item"
            data-checked={!!checked[item.id]}
            role="checkbox"
            aria-checked={!!checked[item.id]}
            tabIndex={0}
            onClick={() => toggle(item.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(item.id);
              }
            }}
          >
            <span className="raj-shopping__checkbox" aria-hidden="true">
              {checked[item.id] ? '✓' : ''}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="raj-shopping__nevozit">{SHOPPING_NEVOZIT}</p>
    </section>
  );
}
