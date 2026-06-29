import { Callout } from './Callout';

const FERRATA_GATE = [
  { condition: 'Předchozí zkušenost s via ferratou nebo lezením', required: true },
  { condition: 'Žádný strach z výšek (pramen je expozice A/B v mokrém vápenci)', required: true },
  { condition: 'Ferrata set půjčený/vlastní (helma + sedák + set)', required: true },
  { condition: 'Suché počasí v posledních 6 h (mokrý vápenec klouže extrémně)', required: true },
  { condition: 'Denny (16) souhlasí a chce — ne jako skupinový závazek', required: true },
  { condition: 'Víte, kde je zkratka zpět (otočit = vítězství, ne selhání)', required: false },
];

const EVENING_TIPS = [
  {
    name: 'Thirsty River Brewing',
    desc: 'Mikropivovar s výhledem na hory — lokální piva, relaxovaná atmosféra po náročném dnu',
  },
  {
    name: "Bovška kuhn'ca (Hotel Dobra Vila)",
    desc: 'Nejlepší restaurace v Bovci — pro slavnostní večeři, prémiové ceny',
  },
  {
    name: 'Pizzeria Šport',
    desc: 'Oblíbené u místních, pizza + grilované maso, přátelské ceny',
  },
  {
    name: 'Koupání večer — Čezsoča',
    desc: 'Písčitá pláž do západu slunce — nejklidnější hodina, Soča v pozdním světle',
  },
];

export function SafetyExtrasSection() {
  return (
    <section id="tipy" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Bezpečnost & tipy</div>
        <h2 className="atlas-h2">Tipy & bezpečnostní brány</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Ferrata brána */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 6, color: 'var(--amber)' }}>
              ⛏️ Ferrata brána — Pramen Soče
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.5 }}>
              Pramen je zajištěná ferrata A/B v mokrém vápenci. Splnit <strong>všechna povinná</strong>{' '}
              kritéria před nástupem:
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FERRATA_GATE.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 14,
                      color: item.required ? '#b91c1c' : 'var(--amber)',
                    }}
                  >
                    {item.required ? '■' : '△'}
                  </span>
                  <span style={{ color: item.required ? 'var(--ink)' : 'var(--muted)' }}>
                    {item.condition}
                    {item.required && (
                      <span style={{ marginLeft: 6, fontFamily: 'var(--f-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b91c1c' }}>
                        POVINNÉ
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 12 }}>
              <Callout variant="danger">
                Mokrý vápenec + bez zkušenosti = reálné nebezpečí. Kdo nesplní kritéria, počká u chaty
                Dom pri izviru Soče (~20 min níže). Otočit se je vítězství.
              </Callout>
            </div>
          </div>
        </div>

        {/* Kluže / WW1 */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 6 }}>🏰 Pevnost Kluže — buffer a deštivý den</div>
            <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.55 }}>
              ~8 km od Bovce (bus nebo kolo). Austro-uherská pevnost z roku 1882 v soutěsce Učja —
              na místě stál původní fort už z 15. stol. Isonzská fronta (1915–1917): 11 bitev,
              přes 300 000 padlých na Soče. Sam ocení historický kontext, Denny vizuální WOW efekt soutěsky.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'Vstup ~5 € dospělý, expozice WW1',
                'Ideální na deštivé dopoledne nebo buffer den (Den 7)',
                'Na kole Bovec→Kluže: lesní silnice, ~30 min',
              ].map((item) => (
                <li key={item} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--faint)', flexShrink: 0 }}>·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Taxi */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 6 }}>🚕 Taxi — pojistka na zmeškaný bus</div>
            <p style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.55 }}>
              Místní taxi = klíčová záloha při bouřce, zmeškání busu nebo únavě. Číslo si zjistit
              první den v TIC nebo kempu — zapsat do kontaktů.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'TIC Bovec: +386 5 302 96 47 (zeptej se na taxi kontakt)',
                'VisitSoča nebo Bovec Rafting Team občas doporučují lokální taxi',
                'Trasy: Bovec→Trenta, Bovec→Virje, Bovec→Kluže (~10–20 €)',
              ].map((item) => (
                <li key={item} style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--faint)', flexShrink: 0 }}>·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Večerní tipy */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10 }}>🍺 Večerní tipy — Bovec</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {EVENING_TIPS.map((t, i) => (
                <li
                  key={t.name}
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ color: 'var(--faint)', flexShrink: 0 }}>·</span>
                  <span>
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{t.name}</span>
                    {' — '}
                    <span style={{ color: 'var(--muted)' }}>{t.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pravidla koupání */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10, color: 'var(--emerald-br)' }}>
              🏊 Pravidla koupání v Soče
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '!', text: <>Soča je <strong>ledová</strong> (9–12 °C) — vstupovat postupně, nikdy rovnou skokem</>, warn: true },
                { icon: '!', text: <>Proudy v soutěskách jsou silné — <strong>koupání v označených místech</strong>, ne v soutěskách mimo plážičky</>, warn: true },
                { icon: '·', text: 'Bezpečná místa: Čezsoča (plaža, písek, pozvolný vstup), Velika korita (tůně za soutěskou)', warn: false },
                { icon: '·', text: 'Vodní boty nutné — ostré oblázky a kluzké kameny', warn: false },
                { icon: '·', text: 'Děti / méně zdatní plavci: jen plaža Čezsoča nebo s neoprenem (v ceně raftingu)', warn: false },
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: item.warn ? 'var(--emerald-dp)' : 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ flexShrink: 0, fontWeight: 700, color: item.warn ? 'var(--emerald)' : 'var(--faint)' }}>{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </section>
  );
}
