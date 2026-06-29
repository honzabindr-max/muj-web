import { Callout } from './Callout';

const RESTAURANTS = [
  "Gostilna Sovdat — tradiční slovinská kuchyně, center",
  "Bovška kuhn'ca (Hotel Dobra Vila) — nejlepší v okolí, prémiové",
  "Pizzeria Šport — pizza + burgery, levnější volba",
  "Thirsty River Brewing — lokální craft pivo večer",
];

const WEATHER_SLOTS = [
  { label: 'Ráno (6–11h)', desc: 'Typicky jasno · ideální na výlety a aktivity', color: 'var(--emerald)' },
  { label: 'Poledne (11–14h)', desc: 'Budování mraků · čas na návrat', color: 'var(--amber)' },
  { label: 'Odpoledne (14+)', desc: 'Bouřky možné · základna, pláž v kempu', color: '#b91c1c' },
];

export function LogisticsSection() {
  return (
    <section id="logistika" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Bovec · Provoz</div>
        <h2 className="atlas-h2">Praktická logistika</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Jídlo */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10 }}>🛒 Jídlo a nákupy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 12 }}>
              {[
                { name: 'SPAR Bovec', hours: 'Po–So 7:30–20:00, Ne 8:00–12:00 — nejspolehlivější, blízko centra' },
                { name: 'Mercator', hours: 'Po–So 7:00–21:00' },
              ].map((s, i) => (
                <div
                  key={s.name}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '9px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', flexShrink: 0, minWidth: 80 }}>{s.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.hours}</span>
                </div>
              ))}
            </div>

            <Callout variant="danger">
              <strong>NEDĚLE: Mercator ZAVŘENÝ!</strong> SPAR otevřen jen do 12:00. Nákupy na celý
              den (nebo víc dní) zařídit v sobotu večer nebo neděli dopoledne.
            </Callout>

            <div style={{ marginTop: 14 }}>
              <div className="atlas-mono" style={{ marginBottom: 8 }}>Restaurace</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {RESTAURANTS.map((r) => (
                  <li key={r} style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--emerald)', flexShrink: 0 }}>·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Peníze */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-amber-block">
              <div className="atlas-amber-block-title">💶 Peníze a platby</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: '!', text: <><strong>Přines min. 400–500 € v hotovosti</strong> — Camp Bovec POUZE hotovost</>, bold: true },
                  { icon: '!', text: 'Bankomat NLB — u TIC Bovec (Trg golobarskih žrtev). Záložní: pošta/SPAR.', bold: false },
                  { icon: '·', text: 'Restaurace a obchody: karta většinou OK, ale mít zálohu v hotovosti', bold: false },
                  { icon: '·', text: 'Turistická taxa ~ 2 €/os/noc — platí se v kempu', bold: false },
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6, fontSize: 13, color: 'var(--amber)', lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, fontWeight: 700 }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Zdraví */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10 }}>🏥 Zdraví a bezpečnost</div>
            <Callout variant="danger">
              <strong>EHIC (modrý průkaz) nestačí!</strong> Kryje jen zákonné minimum — žádné
              letecké záchrany, záchranné helikoptéry ani repatriace. Každý člen musí mít{' '}
              <strong>komerční pojistku</strong> s krytem: rafting WW3, canyoning, zipline, ferrata.
            </Callout>
            <div style={{ marginTop: 10 }}>
              <Callout variant="danger">
                <strong>Klíšťová encefalitida — KRITICKÉ!</strong> Gorenjska / Julské Alpy = jedna
                z nejvíce endemických oblastí v EU. Repelent DEET/ikaridin PŘED KAŽDOU chůzí,
                prohlídka těla každý večer. Kleštičky s sebou.
              </Callout>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="atlas-mono" style={{ marginBottom: 8 }}>Zdravotní zdroje</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'Lékárna Bovec: Kot 86 (centrum)',
                  'Zdravstvena postaja Bovec: +386 5 620 33 22',
                  'Záchrana: 112 · Policie: 113 · GRZS (horská záchrana): 1987',
                  'TIC Bovec: +386 5 302 96 47 (Trg golobarskih žrtev 47)',
                ].map((item) => (
                  <li key={item} style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--faint)', flexShrink: 0 }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Počasí */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 8 }}>⛅ Počasí v Julských Alpách</div>
            <Callout variant="warning">
              <strong>Odpolední bouřky jsou normál</strong> — v Julských Alpách prakticky každý
              den v červenci. Aktivity plánuj na dopoledne a buď v Bovci do ~13:00 při mracích.
            </Callout>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                marginTop: 12,
              }}
            >
              {WEATHER_SLOTS.map((w) => (
                <div
                  key={w.label}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${w.color}30`,
                    background: `${w.color}0a`,
                    padding: '10px 10px',
                  }}
                >
                  <div style={{ fontFamily: 'var(--f-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: w.color, marginBottom: 4 }}>
                    {w.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{w.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Konektivita */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10 }}>📱 Konektivita</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '·', text: <><strong>EU roaming</strong> — Slovinsko v EU, data bez příplatku (ověřit u operátora)</> },
                { icon: '·', text: <>Signál na Soča Trail, Vršič a v Trentě <strong>slabý nebo žádný</strong></> },
                { icon: '!', text: <><strong>Offline mapy stáhnout doma</strong> přes WiFi — Mapy.com Slovinsko ~300–500 MB. V kempu nebo na trase nestahovat.</> },
                { icon: '·', text: 'Kemp má WiFi — slabé, nespolehlivé' },
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ color: item.icon === '!' ? 'var(--amber)' : 'var(--faint)', flexShrink: 0, fontWeight: 700 }}>{item.icon}</span>
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
