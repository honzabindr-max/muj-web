import { MISSION } from '../data';

export function Hero() {
  return (
    <div className="relative overflow-hidden" style={{ minHeight: '82vh' }}>
      {/* Full-bleed hero image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/soci/photos/soca-reka.jpg"
        alt="Smaragdová řeka Soča"
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ zIndex: 0 }}
      />
      {/* Gradient overlay — dark bottom */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background:
            'linear-gradient(180deg, rgba(8,18,15,0.30) 0%, rgba(8,18,15,0.08) 35%, rgba(8,18,15,0.82) 75%, rgba(8,18,15,0.95) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full" style={{ zIndex: 2, minHeight: '82vh', padding: '32px 0 36px' }}>
        {/* Top — kicker + coords */}
        <div className="atlas-column">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="atlas-kicker">CLASSIFIED · BOVEC 2026</span>
            <span
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              46°20′N · 13°33′E
            </span>
          </div>
        </div>

        {/* Bottom — poster title */}
        <div className="atlas-column">
          {/* GO badge */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="atlas-pill atlas-pill--go">Podmíněné GO</span>
            <span
              style={{
                fontFamily: 'var(--f-mono)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Potvrdit: Camp Bovec + rafting firma
            </span>
          </div>

          {/* Poster title */}
          <h1 className="atlas-h1" style={{ marginBottom: 8 }}>
            {MISSION.codename}
          </h1>

          {/* Crew */}
          <p
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 14,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.70)',
              marginBottom: 20,
            }}
          >
            TÁTA · SAM 20 · DENNY 16
          </p>

          {/* Meta chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              '4.–11. 7. 2026',
              '7 dní',
              'bez auta',
              'rafting + canyoning',
              'Bovec basecamp',
            ].map((label) => (
              <span
                key={label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 99,
                  border: '1px solid rgba(255,255,255,0.22)',
                  fontFamily: 'var(--f-mono)',
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.65)',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Rafting Slovinsko note */}
          <p
            style={{
              marginTop: 16,
              fontFamily: 'var(--f-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--emerald-br)',
            }}
          >
            Rafting Slovinsko (Rupa 14) · Czech-speaking · permit v ceně
          </p>
        </div>
      </div>
    </div>
  );
}
