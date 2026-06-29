import { TRANSPORT_VARIANTS } from '../data';

export function TransportSection() {
  return (
    <section id="cesta" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Brno → Bovec · bez auta</div>
        <h2 className="atlas-h2">Cesta tam a zpět</h2>
      </div>

      <div className="atlas-panel">
        {/* Texture panel + route pins */}
        <div className="atlas-panel-inner atlas-texture" style={{ paddingBottom: 16 }}>
          <div className="atlas-route">
            <div className="atlas-route-pin">
              <div className="atlas-route-pin-dot" />
              <div className="atlas-route-pin-label">Brno</div>
            </div>
            <div className="atlas-route-line" />
            <div className="atlas-route-pin">
              <div className="atlas-route-pin-dot" />
              <div className="atlas-route-pin-label">Ljubljana</div>
            </div>
            <div className="atlas-route-line" />
            <div className="atlas-route-pin">
              <div className="atlas-route-pin-dot atlas-route-pin-dot--full" />
              <div className="atlas-route-pin-label" style={{ color: 'var(--emerald)' }}>Bovec</div>
            </div>
          </div>
          <div className="atlas-mono">
            Bus/vlak → přestup Ljubljana → Arriva/Nomago → Bovec (~11–12 h celkem)
          </div>
        </div>

        <div className="atlas-divider" />

        {/* Varianty */}
        <div style={{ padding: '4px 20px 16px' }}>
          {TRANSPORT_VARIANTS.map((v, idx) => (
            <div
              key={v.id}
              style={{
                padding: '14px 0',
                borderTop: idx === 0 ? 'none' : '1px solid var(--hairline)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{v.icon}</span>
                    <span style={{ fontFamily: 'var(--f-body)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                      {v.label}
                    </span>
                    {v.highlight && (
                      <span className="atlas-pill atlas-pill--emerald">{v.highlight}</span>
                    )}
                  </div>
                  <div className="atlas-mono">{v.duration}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className="atlas-price" style={{ fontSize: 20 }}>{v.price}</span>
                </div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {v.steps.map((step, i) => (
                  <li
                    key={i}
                    style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}
                  >
                    <span style={{ color: 'var(--emerald)', flexShrink: 0 }}>→</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <div className="atlas-amber-block">
            <div className="atlas-amber-block-title">⚠️ Arriva — NEDĚLE NEJEDE!</div>
            <p style={{ fontSize: 13, color: 'var(--amber)', lineHeight: 1.5, margin: 0 }}>
              Linka Arriva Ljubljana↔Bovec jede jen pondělí–sobota (do 31.8.).
              Neplánuj příjezd ani odjezd přes Arrivu v neděli — Nomago jako záloha.
              V Lublani nech <strong>90+ min</strong> na přípoj.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
