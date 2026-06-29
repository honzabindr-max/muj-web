import { Callout } from './Callout';
import { Section } from './Section';

export function RaftingSection() {
  return (
    <Section id="rafting" title="Rafting na Soče">
      <div className="space-y-4">
        <Callout variant="danger">
          <strong>Permit 2026 — systém v přechodu.</strong> Aktuální cena{' '}
          <strong>21 €/os</strong> (Bovec 6 € + Kobarid 15 €). Oba synové (16 i 20) platí{' '}
          <strong>plnou cenu</strong> — sleva jen do ~14–15 let. Nakupuj max. 24 h předem
          (nevratné). Portál:{' '}
          <a
            href="https://gosoca.si/portal"
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
          >
            gosoca.si/portal
          </a>{' '}
          nebo TIC Bovec. Systém se 2026 mohl změnit na ~15 €/den — potvrdit na TIC.
        </Callout>

        <Callout variant="warning">
          <strong>Rezervuj 1–2 týdny předem.</strong> Firmy se rychle zaplní v hlavní sezóně.
          Nejlepší dotaz:{' '}
          <em>„Is the river permit included, or do we buy it separately? Total final price for 3 persons
          including permits, equipment and transfer?"</em>
        </Callout>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Co čekat</h3>
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="text-sky-500">~</span>
                WW II–III, vhodné pro začátečníky/rodiny
              </li>
              <li className="flex gap-2">
                <span className="text-sky-500">~</span>
                Firma dodá neopren, plovací vestu, helmu
              </li>
              <li className="flex gap-2">
                <span className="text-sky-500">~</span>
                Odjezdy typicky 8:45 / 12:45 / 16:00
              </li>
              <li className="flex gap-2">
                <span className="text-sky-500">~</span>
                16letý vhodný bez omezení (standardní úsek)
              </li>
              <li className="flex gap-2">
                <span className="text-sky-500">~</span>
                Smaragdová barva vody — celodenní zážitek
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Firmy a orientační ceny</h3>
            <p className="mb-3 text-xs text-slate-500">
              Ceny orientační (rešerše si protiřečí o 15–20 €) — vždy ověřit finál na webu firmy.
              Permit 21 €/os většinou extra.
            </p>
            <ul className="space-y-1.5 text-sm">
              {[
                ['Hydromania', 'https://www.hydromania.si', '~55–60 €'],
                ['Bovec Rafting Team', 'https://www.bovec-rafting-team.com', '~55–81 €'],
                ['Soča Splash', 'https://www.socasplash.com', '~65–69 €'],
                ['Alpi Center (CZ)', 'https://www.alpicenter.cz', '~60 €'],
                ['Rafting Slovinsko (CZ)', 'https://www.raftingslovinsko.cz', '~60–75 €'],
              ].map(([name, url, price]) => (
                <li key={name} className="flex items-center justify-between gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-600 underline hover:text-sky-800"
                  >
                    {name}
                  </a>
                  <span className="text-xs text-slate-500">{price}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold mb-1">Canyoning jako alternativa nebo doplněk</div>
          Canyoning Sušec (Srpenica) — ~60–65 €/os, začátečnické, 16letý OK.
          Balíček rafting + canyoning ~110 €/os — zeptej se firmy.
          Permit na canyoning <strong>není potřeba</strong>.
        </div>
      </div>
    </Section>
  );
}
