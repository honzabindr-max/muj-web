import { Callout } from './Callout';

interface TripCardProps {
  title: string;
  pills: { label: string; variant?: string }[];
  children: React.ReactNode;
}

function ChevronSvg() {
  return (
    <svg className="atlas-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function TripCard({ title, pills, children }: TripCardProps) {
  return (
    <details
      style={{
        borderTop: '1px solid var(--hairline)',
      }}
    >
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '13px 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 5 }}>
            {title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {pills.map((p) => (
              <span key={p.label} className={`atlas-pill ${p.variant ?? ''}`}>{p.label}</span>
            ))}
          </div>
        </div>
        <ChevronSvg />
      </summary>
      <div style={{ padding: '0 0 14px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>
        {children}
      </div>
    </details>
  );
}

export function DayTripsSection() {
  return (
    <section id="vylety" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Bovec basecamp · bez auta</div>
        <h2 className="atlas-h2">Denní výlety z Bovce</h2>
      </div>

      <div className="atlas-panel">
        <div className="atlas-panel-inner" style={{ padding: '10px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 6px' }}>
            Vše busem nebo pěšky. Pořadí libovolné, přizpůsob počasí.
          </p>

          <TripCard
            title="Slap Virje + Slap Boka"
            pills={[
              { label: 'vodopád', variant: 'atlas-pill--emerald' },
              { label: 'bus B3' },
              { label: 'zdarma' },
            ]}
          >
            <p style={{ margin: '0 0 8px' }}>
              Bus B3 (3 €/jízda) zvládne oba ve stejný den — na každé zastávce ~1 h.{' '}
              <strong>Slap Virje</strong> (~3,5 km od Bovce): laguna pod vodopádem ke koupání,
              nebo pěšky 45–50 min přes Plužnu. V červenci nižší průtok, stále hezké.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Slap Boka</strong> (~6 km): nejvodnatější vodopád Slovinska (~106 m), vidět ze
              silnice zdarma. Vyhlídka 20 min výstup, horní vyhlídka 45 min. Výstup k prameni Boky
              (1,5–3 h, technické, lana) — jen pro zdatné.
            </p>
          </TripCard>

          <TripCard
            title="Soča Trail — Trenta → Velika korita"
            pills={[
              { label: 'řeka', variant: 'atlas-pill--emerald' },
              { label: 'bezplatný bus', variant: 'atlas-pill--emerald' },
              { label: '~13–15 km' },
            ]}
          >
            <p style={{ margin: '0 0 8px' }}>
              Pot ob Soči — 25 km Trenta→Bovec, visuté mosty, průzory na smaragdovou řeku.{' '}
              <strong>Doporučený úsek:</strong> busem do Trenty, pěšky ~13–15 km kolem Mala+Velika korit.
              Konec Velika korita — koupání v tůních (ledová voda, pro odvážné).{' '}
              <strong>Kratší varianta:</strong> jen Bovec→Velika korita (~10 km, ~2,5 h).
            </p>
            <Callout variant="warning">
              Zastávka <strong>Soča</strong> (nejblíže Velika korita, bezplatný bus) aktivní od
              1. 7. 2026. Před cestou ověřit na TIC nebo{' '}
              <a href="https://www.komunala-kg.si" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                komunala-kg.si
              </a>
              .
            </Callout>
          </TripCard>

          <TripCard
            title="Vršič (1611 m) + Ruská kaple"
            pills={[
              { label: 'hory', variant: 'atlas-pill--amber' },
              { label: 'bezplatný bus', variant: 'atlas-pill--emerald' },
              { label: 'výhledy' },
            ]}
          >
            <p style={{ margin: 0 }}>
              Bezplatný bus Vršič: Bovec → Trenta → sedlo Vršič (1611 m). 22 serpentin s výhledy na
              Julské Alpy. Erjavčeva koča na sedle. <strong>Ruská kaple</strong> (dřevěná, 1917) —
              zastávka „Ruski križ" aktivní od 1. 8., do té doby krátký pěší přístup z okolní zastávky.
            </p>
          </TripCard>

          <TripCard
            title="Pramen Soče (Izvir Soče) — volitelný vrchol"
            pills={[
              { label: 'hory', variant: 'atlas-pill--amber' },
              { label: 'ferrata A/B', variant: 'atlas-pill--amber' },
            ]}
          >
            <div style={{ marginBottom: 10 }}><Callout variant="danger">
              <strong>Jediné technicky náročné místo celého výletu.</strong> Zajištěná ferrata A/B:
              exponovaná skalní římsa šíře jedné boty, negativní úhel, závěrečný nezajištěný sestup
              k tůni. <strong>16letý: jen pokud nemá strach z výšek.</strong> U lan smí couvnout —
              počká ~20 min u chaty. Mokrý vápenec klouže. Ranní start (stín), pevná obuv, ferrata
              set půjčit u Rafting Slovinsko nebo Hydromania.
            </Callout></div>
            <p style={{ margin: '10px 0 4px', fontSize: 13 }}>
              Od zastávky ~30 min po asfaltce k chatě, ~15 min lesem nahoru, pak ferrata k tůni s
              pramenem Soče. Smaragdová voda tryskající ze skály. Návrat stejnou cestou.
            </p>
            <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0 }}>
              YT: <em>„pramen Soče ferrata vlog"</em>
            </p>
          </TripCard>

          <TripCard
            title="Koupání v Soče"
            pills={[
              { label: 'řeka', variant: 'atlas-pill--emerald' },
              { label: 'bus B3' },
            ]}
          >
            <p style={{ margin: '0 0 8px' }}>
              Horská řeka: studená (6–12 °C i v létě), průzračná hloubka klame, proud silný.
              V soutěskách koupání zakázáno.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { loc: 'Čezsoča (Plaža Čezsoča)', desc: 'písčitá pláž, pozvolný vstup, vhodné pro rodiny. Bus B3. Nejbezpečnější varianta.' },
                { loc: 'Pod Virje', desc: 'laguna, bus B3 nebo pěšky ~45 min.' },
                { loc: 'Konec Velika korit', desc: 'tůně pro odvážné, ledová voda.' },
              ].map((item) => (
                <li key={item.loc} style={{ fontSize: 12, display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--emerald)', flexShrink: 0 }}>→</span>
                  <span><strong>{item.loc}</strong> — {item.desc}</span>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 11, color: 'var(--faint)', margin: '8px 0 0' }}>
              „Plaža Soča" pod mostem (46.3225, 13.5384) — recenze varují před silnějším proudem; pro rodinu volit Čezsoču.
            </p>
          </TripCard>

          <TripCard
            title="Canyoning Sušec (Srpenica)"
            pills={[
              { label: 'adrenalin', variant: 'atlas-pill--amber' },
              { label: '~60–65 €' },
            ]}
          >
            <p style={{ margin: '0 0 4px' }}>
              ~7 km od Bovce (Srpenica). Začátečnické: skoky 4–7 m (dobrovolné), tobogán ~12 m,
              2–3 h. Min. věk 8–10 let → Denny (16) OK. Firma dodá výstroj. Permit netřeba.
            </p>
            <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0 }}>
              YT: <em>„canyoning Sušec Bovec vlog"</em>
            </p>
          </TripCard>

          <TripCard
            title="Kayak + Mala korita (Den 7 volno)"
            pills={[
              { label: 'řeka', variant: 'atlas-pill--emerald' },
              { label: 'volitelné' },
            ]}
          >
            <p style={{ margin: 0 }}>
              <strong>Kayak:</strong> ~60–65 €/os, min. věk obvykle 10+, permit v ceně kurzu.
              Spíš pro zdatnější. <strong>Mala korita:</strong> ~100 m dlouhá soutěska, 6 m hloubka,
              ~12 km od Bovce, vstup zdarma.{' '}
              <strong>Lanovka Kanin:</strong> výhledy na Julské Alpy a jadranské pobřeží. Julian Alps
              Card dává slevu.
            </p>
          </TripCard>

          <div style={{ height: 4 }} />
        </div>
      </div>
    </section>
  );
}
