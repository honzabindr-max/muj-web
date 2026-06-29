import { Callout } from './Callout';

const CAMPS = [
  {
    name: 'Camp Bovec / Alpi Center',
    badge: '⭐ Doporučeno',
    type: 'Stan · chatka · bungalov',
    price: 'Stan ~15 €/os/noc · Chatka 4 os. ~120 €/noc',
    notes: [
      'Alpi Center d.o.o. od r. 2003 — 1 firma = kemp + rafting + canyoning',
      'Rupa 14, Bovec · max 70 míst',
      'PLATBA JEN HOTOVOST',
      'Česky mluvící tým (Rafting Slovinsko)',
      'Rezervuj 4–6 týdnů předem',
    ],
    highlight: true,
    url: 'https://www.campbovec.com',
  },
  {
    name: 'Adrenaline-Check Eco Place',
    badge: undefined,
    type: 'Glamping / eko-chatky',
    price: 'Prémiové (ověřit)',
    notes: [
      'TripAdvisor #1 Bovec',
      '~4,2 km od centra Bovce — BEZ AUTA náročné',
      '"Narnia beach" u řeky Soče',
      'Blízko Slap Boka',
    ],
    highlight: false,
    url: undefined,
  },
  {
    name: 'Camp Vodenca / Polovnik',
    badge: undefined,
    type: 'Kemp',
    price: 'Podobně jako Camp Bovec',
    notes: ['U řeky nebo blízko busu', 'Záloha pokud Camp Bovec/Alpi Center plný'],
    highlight: false,
    url: undefined,
  },
  {
    name: 'Hotel Dobra Vila',
    badge: undefined,
    type: 'Boutique hotel',
    price: 'Prémiové',
    notes: ["Nejlepší restaurace v Bovci (Bovška kuhn'ca)", 'Pro "pohodlnější" variantu'],
    highlight: false,
    url: undefined,
  },
];

const ACCOM_TABLE = [
  { v: 'Stan (3 stany, 1 os.)', eur: '~315 €', czk: '~7 875 Kč', note: '15 €/noc × 3 os. × 7 dní, bez daně' },
  { v: 'Stan + taxa ubytování', eur: '~357 €', czk: '~8 925 Kč', note: '~2 €/os/noc, celkem +42 €' },
  { v: 'Se slevou −10 % (balíček aktivit)', eur: '~321 €', czk: '~8 025 Kč', note: 'Jen pokud rezervuješ aktivity u Alpi Center' },
  { v: 'Chatka 4 os. (7 nocí)', eur: '~840 €', czk: '~21 000 Kč', note: '~120 €/noc, větší soukromí' },
];

export function AccommodationSection() {
  return (
    <section id="ubytovani" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Camp Bovec · Rupa 14</div>
        <h2 className="atlas-h2">Ubytování — Alpi Center</h2>
      </div>

      <div className="atlas-panel">
        <div className="atlas-panel-inner">
          <Callout variant="warning">
            <strong>Camp Bovec = Rafting Slovinsko = Alpi Center</strong> — to je JEDEN subjekt!
            Alpi Center d.o.o. (Rupa 14) provozuje od roku 2003 kemp i agenturní aktivity.
            Výhoda: kemp + rafting + canyoning na jednom místě, česky.{' '}
            <strong>PLATÍ SE JEN HOTOVOST</strong> — přines min. 400–500 € v EUR.
          </Callout>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginTop: 16,
            }}
          >
            {CAMPS.map((place) => (
              <div
                key={place.name}
                style={{
                  border: `1px solid ${place.highlight ? 'var(--emerald)' : 'var(--hairline)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: place.highlight ? 'rgba(14,140,120,0.04)' : 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                    {place.name}
                  </div>
                  {place.badge && (
                    <span className="atlas-pill atlas-pill--emerald" style={{ flexShrink: 0 }}>{place.badge}</span>
                  )}
                </div>
                <div className="atlas-mono" style={{ marginBottom: 4 }}>{place.type}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: place.highlight ? 'var(--emerald)' : 'var(--muted)', marginBottom: 8 }}>
                  {place.price}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {place.notes.map((n) => (
                    <li key={n} style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 5, lineHeight: 1.4 }}>
                      <span style={{ color: 'var(--faint)', flexShrink: 0 }}>·</span>
                      {n}
                    </li>
                  ))}
                </ul>
                {place.url && (
                  <a
                    href={place.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--emerald)', textDecoration: 'underline', display: 'block', marginTop: 8 }}
                  >
                    {place.url.replace('https://www.', '')}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="atlas-divider" />

        <div className="atlas-panel-inner">
          <div className="atlas-kicker" style={{ marginBottom: 10 }}>Odhad ubytování 7 nocí · 3 osoby</div>
          <table className="atlas-table">
            <thead>
              <tr>
                <th>Varianta</th>
                <th style={{ textAlign: 'right' }}>EUR</th>
                <th style={{ textAlign: 'right' }}>Kč</th>
                <th>Poznámka</th>
              </tr>
            </thead>
            <tbody>
              {ACCOM_TABLE.map((r) => (
                <tr key={r.v}>
                  <td>{r.v}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--f-heading)', color: 'var(--emerald)', fontWeight: 500 }}>{r.eur}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--f-heading)', color: 'var(--muted)' }}>{r.czk}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 11 }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10, marginBottom: 0 }}>
            Kurz orientačně 1 € = 25 Kč. Ceny z rešerše 2026, ověřit aktuální na{' '}
            <a href="https://www.campbovec.com" target="_blank" rel="noreferrer" style={{ color: 'var(--emerald)', textDecoration: 'underline' }}>
              campbovec.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
