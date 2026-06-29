import { Callout } from './Callout';
import { Section } from './Section';

const ACTIVITIES = [
  {
    name: 'Rafting Standard',
    sub: 'Boka/Srpenica→Trnovo, WW II–III, ~1,5 h, odjezd 8:45',
    price: '75',
    priceTotal: '225',
    note: 'Permit v ceně!',
    featured: true,
  },
  {
    name: 'Rafting Extended',
    sub: 'Delší úsek, více divoké vody',
    price: '81',
    priceTotal: '243',
    note: 'Permit v ceně!',
    featured: false,
  },
  {
    name: 'Canyoning Sušec',
    sub: 'Skoky 4–7 m, tobogán 12 m, ~2–3 h, odjezd 8:30',
    price: '55',
    priceTotal: '165',
    note: 'Denny (16) OK',
    featured: false,
  },
  {
    name: 'Zipline Kanin',
    sub: 'Lanovka Kanin + zipline, výhledy na Julské Alpy',
    price: '79',
    priceTotal: '237',
    note: 'Volitelné',
    featured: false,
  },
  {
    name: 'Ferrata set půjčení',
    sub: 'Helma + via ferrata set + sedák (1 den)',
    price: '15',
    priceTotal: '45',
    note: 'Jen na pramen Soče',
    featured: false,
  },
];

export function RaftingSection() {
  return (
    <Section id="rafting" title="Rafting & aktivity" kicker="Rafting Slovinsko · Rupa 14">
      {/* Feature card — Rafting Standard */}
      <div className="atlas-feature-card">
        <div className="atlas-feature-card-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/soci/photos/rafting-soca.jpg" alt="Rafting na smaragdové Soče — WW II–III" loading="lazy" decoding="async" />
          <div className="atlas-feature-card-photo-overlay" />
          <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="atlas-pill atlas-pill--solid-emerald">Permit v ceně</span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              foto: malenki, CC BY-SA 3.0, Wikimedia Commons
            </span>
          </div>
        </div>
        <div className="atlas-feature-card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <div>
              <div style={{ fontFamily: 'var(--f-body)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                Rafting Standard — doporučeno
              </div>
              <div className="atlas-mono" style={{ marginTop: 3 }}>
                Boka/Srpenica→Trnovo · WW II–III · ~1,5 h · odjezd 8:45
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="atlas-price" style={{ fontSize: 26 }}>75 €</span>
              <div className="atlas-activity-price-unit">/ os</div>
            </div>
          </div>
          <Callout variant="tip" className="mt-3">
            <strong>Rafting Slovinsko (raftingslovinsko.cz)</strong> — česky, permit v ceně,
            sídlí přímo v Camp Bovec (Rupa 14). Rezervuj 1–2 týdny předem.
          </Callout>
        </div>
      </div>

      {/* Ostatní aktivity */}
      <div style={{ marginTop: 8 }}>
        {ACTIVITIES.filter((a) => !a.featured).map((a) => (
          <div key={a.name} className="atlas-activity-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="atlas-activity-name">{a.name}</div>
              <div className="atlas-activity-sub">{a.sub}</div>
              <div style={{ marginTop: 4 }}>
                <span className="atlas-pill">{a.note}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span className="atlas-activity-price">{a.price} €</span>
              <div className="atlas-activity-price-unit">/ os</div>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>
                {a.priceTotal} € · 3 os.
              </div>
            </div>
          </div>
        ))}

        {/* Combo sleva */}
        <div
          className="atlas-activity-row"
          style={{ background: 'rgba(14,140,120,0.06)', borderRadius: 10, padding: '10px 12px', marginTop: 8, borderTop: 'none' }}
        >
          <div style={{ flex: 1 }}>
            <div className="atlas-activity-name">Rafting + Canyoning</div>
            <div className="atlas-activity-sub">Multi-sleva −10 % · permit v ceně raftingu</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="atlas-activity-price">~117 €</span>
            <div className="atlas-activity-price-unit">/ os</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Callout variant="warning">
          <strong>Rezervuj 1–2 týdny předem.</strong> Písemně potvrdit:{' '}
          <em>„Confirm that the river permit for all 3 persons is included in the price."</em>{' '}
          →{' '}
          <a href="https://www.raftingslovinsko.cz" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontWeight: 600 }}>
            raftingslovinsko.cz
          </a>
        </Callout>
      </div>

      {/* Záloha */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none', userSelect: 'none' }}>
          <span className="atlas-kicker" style={{ cursor: 'pointer' }}>▸ Záloha — jiné firmy (permit 21 €/os extra)</span>
        </summary>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['Hydromania', 'https://www.hydromania.si', '~55–60 €'],
            ['Bovec Rafting Team', 'https://www.bovec-rafting-team.com', '~55–81 €'],
            ['Soča Splash', 'https://www.socasplash.com', '~65–69 €'],
          ].map(([name, url, price]) => (
            <div key={name} className="atlas-activity-row" style={{ padding: '8px 0' }}>
              <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--emerald)', textDecoration: 'underline', fontSize: 13 }}>
                {name}
              </a>
              <span style={{ fontFamily: 'var(--f-heading)', color: 'var(--muted)', fontSize: 14 }}>{price}</span>
            </div>
          ))}
        </div>
      </details>
    </Section>
  );
}
