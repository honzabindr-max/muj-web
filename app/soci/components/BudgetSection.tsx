import { BUDGET_ROWS } from '../data';

const SCENARIOS = [
  {
    key: 'low',
    label: 'Úsporný',
    total: '~34 000–46 000 Kč',
    desc: 'FlixBus, stan 3 os., jen rafting, vaříme v kempu',
    featured: false,
  },
  {
    key: 'mid',
    label: 'Standard',
    total: '~47 000–64 000 Kč',
    desc: 'Vlak/FlixBus, stan, rafting + canyoning, restaurace ob den',
    featured: true,
  },
  {
    key: 'high',
    label: 'Komfort',
    total: '~65 000–80 000 Kč',
    desc: 'Vlak komfort, chatka, rafting + canyoning + zipline, restaurace',
    featured: false,
  },
];

export function BudgetSection() {
  return (
    <section id="rozpocet" className="atlas-section">
      <div className="atlas-section-head">
        <h2 className="atlas-h2">Rozpočet</h2>
      </div>

      <div className="atlas-panel">
        <div className="atlas-panel-inner">
          <p className="atlas-muted" style={{ marginBottom: 16 }}>
            3 osoby · 7 dní · kurz 1 € ≈ 25 Kč · Sam + Denny plná cena
          </p>

          {/* 3 tier karty */}
          <div className="atlas-tiers" style={{ marginBottom: 20 }}>
            {SCENARIOS.map((s) => (
              <div key={s.key} className={`atlas-tier${s.featured ? ' atlas-tier--featured' : ''}`}>
                <div className="atlas-tier-label">{s.label}</div>
                <div className="atlas-tier-price">{s.total}</div>
                <div className="atlas-tier-desc">{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Rozpad položek */}
          <div className="atlas-divider" style={{ marginBottom: 12 }} />
          <div className="atlas-kicker" style={{ marginBottom: 10 }}>Rozpad položek</div>
          <div>
            {BUDGET_ROWS.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--hairline)', alignItems: 'baseline' }}>
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>{row.item}</div>
                <div style={{ fontFamily: 'var(--f-heading)', fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>{row.low}</div>
                <div style={{ fontFamily: 'var(--f-heading)', fontSize: 13, color: 'var(--emerald)', textAlign: 'right' }}>{row.mid}</div>
                <div style={{ fontFamily: 'var(--f-heading)', fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>{row.high}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '10px 0 0', borderTop: '1.5px solid var(--border)', marginTop: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Celkem 3 os.</div>
            <div style={{ fontFamily: 'var(--f-heading)', fontSize: 14, color: 'var(--muted)', textAlign: 'right' }}>~34–46k</div>
            <div style={{ fontFamily: 'var(--f-heading)', fontSize: 14, fontWeight: 600, color: 'var(--emerald)', textAlign: 'right' }}>~47–64k</div>
            <div style={{ fontFamily: 'var(--f-heading)', fontSize: 14, color: 'var(--muted)', textAlign: 'right' }}>~65–80k</div>
          </div>
        </div>
      </div>
    </section>
  );
}
