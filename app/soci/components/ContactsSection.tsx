import { RISKS } from '../data';
import { Callout } from './Callout';

const CRITICAL_CHECKS = [
  {
    text: 'Rafting Slovinsko — permit v ceně (75 €/os)? Potvrdit písemně',
    link: 'https://www.raftingslovinsko.cz',
    linkLabel: 'raftingslovinsko.cz',
  },
  {
    text: 'Arriva letní linka Ljubljana↔Bovec — Po–So (ne neděle!), do 31.8.; návaznost na FlixBus',
    link: 'https://www.ap-ljubljana.si',
    linkLabel: 'ap-ljubljana.si',
  },
  {
    text: 'Bezplatný bus Vršič — staví zastávka Soča (Velika korita) v termínu?',
    link: undefined,
    linkLabel: undefined,
  },
  {
    text: 'Camp Bovec / Alpi Center — rezervace potvrdit e-mailem, hotovost připravit',
    link: 'https://www.campbovec.com',
    linkLabel: 'campbovec.com',
  },
  {
    text: 'Pojistka — krytí rafting WW3, canyoning, zipline, ferrata pro každého',
    link: undefined,
    linkLabel: undefined,
  },
];

const VERIFY_ITEMS = [
  'Hop-on-hop-off B3 jízdní řád a ceny 2026',
  'Vodní stav Soče (ovlivní rafting a koupání)',
  'Canyoning Sušec — aktuální dostupnost u Rafting Slovinsko',
  'Číslo lokálního taxi (zjistit první den na TIC)',
];

const EMERGENCY_CONTACTS = [
  { label: '112', desc: 'Záchrana + horská záchrana (GRZS) — Slovinsko' },
  { label: '113', desc: 'Policie Slovinsko' },
  { label: '1987', desc: 'GRZS — Gorska reševalna zveza Slovenija' },
  { label: 'TIC Bovec', desc: '+386 5 302 96 47 · Aktivity, jízdní řády, taxi' },
  { label: 'ZS Bovec', desc: '+386 5 620 33 22 · Zdravstvena postaja' },
  { label: 'Velvyslanectví ČR', desc: 'Ljubljana · Konzulární pomoc (zjistit číslo předem)' },
];

const USEFUL_LINKS = [
  ['Camp Bovec / Alpi Center', 'https://www.campbovec.com'],
  ['Rafting Slovinsko (CZ)', 'https://www.raftingslovinsko.cz'],
  ['Nomago (bus)', 'https://www.nomago.si'],
  ['FlixBus', 'https://www.flixbus.cz'],
  ['Hydromania (záloha)', 'https://www.hydromania.si'],
  ['Bovec Rafting Team (záloha)', 'https://www.bovec-rafting-team.com'],
];

export function ContactsSection() {
  return (
    <section id="kontakty" className="atlas-section">
      <div className="atlas-section-head">
        <div className="atlas-kicker" style={{ marginBottom: 6 }}>Ověřit před cestou</div>
        <h2 className="atlas-h2">Kontakty & ověření</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Kritické ověření */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10, color: '#b91c1c' }}>
              🔴 Kritické — ověřit před odjezdem
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {CRITICAL_CHECKS.map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#b91c1c', flexShrink: 0, fontSize: 10, paddingTop: 4 }}>●</span>
                  <span>
                    {item.text}
                    {item.link && (
                      <>
                        {' '}(
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--emerald)', textDecoration: 'underline' }}
                        >
                          {item.linkLabel}
                        </a>
                        )
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Méně kritické */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-amber-block">
              <div className="atlas-amber-block-title">🟡 Ověřit, méně kritické</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {VERIFY_ITEMS.map((item) => (
                  <li key={item} style={{ fontSize: 13, color: 'var(--amber)', display: 'flex', gap: 6 }}>
                    <span style={{ flexShrink: 0 }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Rizika */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10 }}>Rizika & zálohy</div>
            <table className="atlas-table">
              <thead>
                <tr>
                  <th>Riziko</th>
                  <th>Prevence</th>
                  <th>Fallback</th>
                </tr>
              </thead>
              <tbody>
                {RISKS.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.risk}</td>
                    <td style={{ color: 'var(--muted)' }}>{r.prevention}</td>
                    <td style={{ color: 'var(--amber)' }}>{r.fallback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nouzové kontakty */}
        <div
          className="atlas-panel"
          style={{ borderColor: 'rgba(185,28,28,0.25)', background: '#fef2f2' }}
        >
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10, color: '#b91c1c' }}>
              🆘 Nouzové kontakty
            </div>
            <div className="atlas-contacts-grid">
              {EMERGENCY_CONTACTS.map((c) => (
                <div key={c.label} className="atlas-contact-card">
                  <div className="atlas-contact-label">{c.label}</div>
                  <div className="atlas-contact-desc">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Užitečné linky */}
        <div className="atlas-panel">
          <div className="atlas-panel-inner">
            <div className="atlas-kicker" style={{ marginBottom: 10 }}>Užitečné kontakty</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px 8px',
              }}
            >
              {USEFUL_LINKS.map(([name, url]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--faint)', flexShrink: 0 }} />
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: 'var(--emerald)', textDecoration: 'underline' }}
                  >
                    {name}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Callout variant="info">
          Videa na YouTube si najdi vlastním vyhledáváním:{' '}
          <em>„rafting Soča Bovec vlog"</em> nebo{' '}
          <em>„pramen Soče ferrata vlog"</em> nebo{' '}
          <em>„Bovec canyoning Sušec vlog"</em>.
        </Callout>

      </div>
    </section>
  );
}
