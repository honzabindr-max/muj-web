import { DAY_PLANS } from '../data';
import { Callout } from './Callout';

const TAG_VARIANTS: Record<string, string> = {
  rafting: 'atlas-pill--amber',
  canyoning: 'atlas-pill--amber',
  adrenalin: 'atlas-pill--amber',
  vodopády: 'atlas-pill--emerald',
  hory: 'atlas-pill--emerald',
  'bezplatný bus': 'atlas-pill--emerald',
  trek: 'atlas-pill--emerald',
  řeka: 'atlas-pill--emerald',
  'lehký výlet': 'atlas-pill--emerald',
  buffer: '',
  volno: '',
  příjezd: '',
  lehce: 'atlas-pill--emerald',
};

function ChevronSvg() {
  return (
    <svg className="atlas-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function BasecampPlanSection() {
  return (
    <section id="plan" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>OPERATION SOČA</div>
        <h2 className="atlas-h2">Plán 7 dní</h2>
      </div>

      <div className="atlas-panel">
        <div className="atlas-panel-inner" style={{ padding: '14px 20px' }}>
          <Callout variant="info">
            <strong>Princip:</strong> lehké → těžké. Aktivity ráno — odpolední bouřky jsou normál.
            Dny jsou orientační. Poslední bezpečný spoj zpět ověřit večer předem.
          </Callout>
        </div>

        <div className="atlas-divider" />

        <div style={{ padding: '0 20px' }}>
          {DAY_PLANS.map((day) => (
            <details key={day.day} className="atlas-timeline-details" id={`den-${day.day}`}>
              <summary>
                <div className="atlas-timeline-item" style={{ paddingTop: 14, paddingBottom: 14 }}>
                  <div className="atlas-timeline-num">{day.day}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="atlas-timeline-title">{day.title}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                          {day.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`atlas-pill ${TAG_VARIANTS[tag] ?? ''}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="atlas-timeline-meta" style={{ marginTop: 5 }}>
                          {day.transport} · {day.lastBus.startsWith('🔴') ? (
                            <span style={{ color: 'var(--amber)' }}>{day.lastBus}</span>
                          ) : day.lastBus}
                        </div>
                      </div>
                      <ChevronSvg />
                    </div>
                  </div>
                </div>
              </summary>
              <div className="atlas-timeline-body" style={{ padding: '0 0 14px 56px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
                  {day.description}
                </p>
                {day.tip && <Callout variant="tip">{day.tip}</Callout>}
              </div>
              <div className="atlas-divider" />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
