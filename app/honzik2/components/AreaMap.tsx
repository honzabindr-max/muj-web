'use client';

import { useState } from 'react';
import { DOMAINS } from '../lib/content-data';

export function AreaMap() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="h2-domains">
      {DOMAINS.map((domain) => (
        <div className="h2-domain" key={domain.id}>
          <h3 className="h2-domain-title">{domain.title}</h3>
          <div className="h2-tile-grid">
            {domain.areas.map((area) => {
              const isOpen = openId === area.id;
              return (
                <button
                  type="button"
                  key={area.id}
                  className="h2-tile"
                  data-open={isOpen}
                  onClick={() => setOpenId(isOpen ? null : area.id)}
                  aria-expanded={isOpen}
                >
                  <span className="h2-tile-head">
                    <span className="h2-tile-num">{area.id}</span>
                    <span className="h2-tile-title">{area.title}</span>
                  </span>
                  <div className="h2-tile-detail" data-open={isOpen} aria-hidden={!isOpen}>
                    <ul className="h2-tile-questions">
                      {area.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
