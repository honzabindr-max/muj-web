import { Callout } from './Callout';

const PILLARS = [
  {
    icon: '⛺',
    title: 'Jedna základna',
    text: 'Camp Bovec — 7 nocí. Žádné stěhování ubytka, žádný těžký batoh na výletech.',
  },
  {
    icon: '🚌',
    title: 'Dva busové systémy',
    text: 'Bezplatný bus Vršič (Bovec↔Trenta↔Izvir↔Vršič) + Hop-on-hop-off Bovec (B1/B2/B3, 3 €/jízda).',
  },
  {
    icon: '🎯',
    title: 'Rafting Slovinsko = Camp',
    text: 'Rupa 14 — jedna firma, kemp + rafting + canyoning, permit v ceně raftingu. Česky.',
  },
];

const BUS_ROWS = [
  {
    label: 'Bezplatný bus Vršič 2026',
    color: 'var(--emerald)',
    text: 'Provoz 1. 6.–30. 9., hodinový takt 26. 6.–31. 8. Z Bovce 04:30–21:30. 14 zastávek vč. Trenty a pramene Soče.',
  },
  {
    label: 'Hop-on-hop-off Bovec',
    color: 'var(--faint)',
    text: 'B3 je klíčová linka: Bovec–Slap Virje–Slap Boka–Čezsoča. 3 €/jízda (děti 6–15 let 50 %). Data z 2025 — potvrdit 2026 na TIC.',
  },
  {
    label: 'Julian Alps Card',
    color: 'var(--muted)',
    text: '~25 €/dosp, ~15 €/dítě 7–14 let, platná ~15 dní. Hop-on-hop-off zdarma + slevy (lanovka Kanin). Spočítat na TIC, zda se vyplatí.',
  },
  {
    label: 'Pěší dosah z Bovce',
    color: 'var(--ink)',
    text: 'Virje ~3,5 km (45–50 min), Boka ~6–10 km (2–2,5 h), Velika korita ~10 km (~2,5 h po Soča Trail).',
  },
];

export function HowItWorksSection() {
  return (
    <section id="funguje" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>OPERATION SOČA · Koncept</div>
        <h2 className="atlas-h2">Jak to celé funguje</h2>
      </div>

      <div className="atlas-panel" style={{ marginBottom: 12 }}>
        <div className="atlas-panel-inner" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {PILLARS.map((p) => (
              <div
                key={p.title}
                style={{
                  padding: '14px 12px',
                  border: '1px solid var(--hairline)',
                  borderRadius: 12,
                  background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>
                  {p.title}
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45, margin: 0 }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="atlas-panel">
        <div className="atlas-panel-inner">
          <div className="atlas-kicker" style={{ marginBottom: 12 }}>Doprava bez auta — přehled</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {BUS_ROWS.map((row, i) => (
              <div
                key={row.label}
                style={{
                  padding: '11px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: row.color,
                    flexShrink: 0,
                    minWidth: 140,
                    lineHeight: 1.35,
                  }}
                >
                  {row.label}
                </span>
                <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{row.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="atlas-divider" />
        <div className="atlas-panel-inner" style={{ padding: '14px 20px' }}>
          <Callout variant="warning">
            <strong>Zastávka Soča</strong> (nejblíže Velika korita, bezplatný bus Vršič) aktivní teprve
            od 1. 7. 2026. Zastávka „Ruski križ" (Ruská kaple) od 1. 8. Ověřit aktuální stav na TIC
            Bovec nebo{' '}
            <a href="https://www.komunala-kg.si" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontWeight: 600 }}>
              komunala-kg.si
            </a>
            .
          </Callout>
        </div>
      </div>
    </section>
  );
}
