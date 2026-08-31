'use client';

import { useState } from 'react';
import { DOMAINS } from '../lib/content-data';

export function AreaMap() {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [openTile, setOpenTile] = useState<string | null>(null);

  return (
    <div className="h2-domains">
      {DOMAINS.map((domain) => {
        const isDomainOpen = openDomain === domain.id;
        return (
          <div className="h2-domain" key={domain.id}>
            <button
              type="button"
              className="h2-domain-toggle"
              onClick={() => setOpenDomain(isDomainOpen ? null : domain.id)}
              aria-expanded={isDomainOpen}
              aria-controls={`h2-domain-panel-${domain.id}`}
            >
              <span className="h2-domain-toggle-text">
                <span className="h2-domain-title">{domain.title}</span>
                <span className="h2-domain-count">{domain.areas.length} oblasti</span>
              </span>
              <span className="h2-domain-toggle-icon" data-open={isDomainOpen} aria-hidden="true" />
            </button>
            <div
              className="h2-domain-panel"
              data-open={isDomainOpen}
              id={`h2-domain-panel-${domain.id}`}
            >
              <div className="h2-domain-panel-inner">
                <div className="h2-tile-grid">
                  {domain.areas.map((area) => {
                    const isTileOpen = openTile === area.id;
                    return (
                      <button
                        type="button"
                        key={area.id}
                        className="h2-tile"
                        data-open={isTileOpen}
                        onClick={() => setOpenTile(isTileOpen ? null : area.id)}
                        aria-expanded={isTileOpen}
                      >
                        <span className="h2-tile-head">
                          <span className="h2-tile-num">{area.id}</span>
                          <span className="h2-tile-title">{area.title}</span>
                        </span>
                        <div
                          className="h2-tile-detail"
                          data-open={isTileOpen}
                          aria-hidden={!isTileOpen}
                        >
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
