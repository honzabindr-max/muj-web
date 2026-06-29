import { Callout } from './Callout';
import { Section } from './Section';

const ACTIVITIES = [
  {
    name: 'Rafting Standard',
    desc: 'Boka/Srpenica→Trnovo, WW II–III, ~1,5 h, odjezd 8:45',
    priceOs: '75 €',
    priceSkupina: '225 €',
    note: 'Permit v ceně!',
    highlight: true,
  },
  {
    name: 'Rafting Extended',
    desc: 'Delší úsek, více divoké vody',
    priceOs: '81 €',
    priceSkupina: '243 €',
    note: 'Permit v ceně!',
    highlight: false,
  },
  {
    name: 'Canyoning Sušec',
    desc: 'Začátečnické, skoky 4–7 m, tobogán 12 m, ~2–3 h, odjezd 8:30',
    priceOs: '55 €',
    priceSkupina: '165 €',
    note: 'Denny (16) OK',
    highlight: false,
  },
  {
    name: 'Zipline Kanin',
    desc: 'Lanovka Kanin + zipline, výhledy na Julské Alpy',
    priceOs: '79 €',
    priceSkupina: '237 €',
    note: 'Volitelné',
    highlight: false,
  },
  {
    name: 'Ferrata set půjčení',
    desc: 'Helma + via ferrata set + sedák (den)',
    priceOs: '15 €',
    priceSkupina: '45 €',
    note: 'Jen na pramen Soče',
    highlight: false,
  },
];

export function RaftingSection() {
  return (
    <Section id="rafting" title="Rafting & aktivity — Rafting Slovinsko">
      <div className="space-y-4">
        <Callout variant="tip">
          <strong>Rafting Slovinsko (raftingslovinsko.cz)</strong> — česky mluvící průvodci,
          sídlí přímo v Camp Bovec (Rupa 14). <strong>Permit v ceně raftingu</strong> — neřešíš
          gosoca.si portál ani TIC. Záloha −10 % při kombinaci rafting + canyoning.
        </Callout>

        {/* Tabulka aktivit */}
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Aktivita</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Popis</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">€/os</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">3 os.</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Poznámka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ACTIVITIES.map((a) => (
                  <tr
                    key={a.name}
                    className={a.highlight ? 'bg-emerald-50' : 'hover:bg-slate-50/50'}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {a.name}
                      {a.highlight && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          doporučeno
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{a.desc}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-sky-700">
                      {a.priceOs}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{a.priceSkupina}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{a.note}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-emerald-200 bg-emerald-50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-slate-900">
                    Rafting + Canyoning (se slevou −10 %)
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">~117 €</td>
                  <td className="px-4 py-3 text-right text-emerald-700">~351 €</td>
                  <td className="px-4 py-3 text-xs text-slate-600">Permit v ceně raftingu</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobil */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {ACTIVITIES.map((a) => (
              <div
                key={a.name}
                className={`p-4 ${a.highlight ? 'bg-emerald-50' : 'bg-white'}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{a.name}</span>
                  {a.highlight && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      doporučeno
                    </span>
                  )}
                </div>
                <p className="mb-2 text-xs text-slate-600">{a.desc}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-sky-700">{a.priceOs}/os</span>
                  <span className="text-slate-600">{a.priceSkupina} za 3 os.</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{a.note}</p>
              </div>
            ))}
            <div className="bg-emerald-50 p-4">
              <div className="font-semibold text-emerald-800">Rafting + Canyoning (−10 %)</div>
              <div className="text-sm text-emerald-700">~117 €/os · ~351 € za 3 os.</div>
            </div>
          </div>
        </div>

        <Callout variant="warning">
          <strong>Rezervuj 1–2 týdny předem.</strong> Písemně potvrdit:{' '}
          <em>
            „Confirm that the river permit for all 3 persons is included in the price of rafting."
          </em>{' '}
          Zpráva na{' '}
          <a
            href="https://www.raftingslovinsko.cz"
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
          >
            raftingslovinsko.cz
          </a>
          .
        </Callout>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Co čekat na raftingu</h3>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {[
                'WW II–III, vhodné pro začátečníky i rodiny',
                'Neopren, plovací vesta, helma — vše v ceně',
                'Sam (20) i Denny (16) bez omezení',
                'Smaragdová barva vody — celodenní zážitek',
                'Průvodce v ceně, česky mluvící tým',
                'Odjezd 8:45 — dopolední slot (odpoledne bouřky)',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-sky-500 flex-shrink-0">~</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Záloha — jiné firmy</h3>
            <p className="mb-3 text-xs text-slate-500">
              Pokud Rafting Slovinsko nestíhá / je plný. Permit 21 €/os extra (gosoca.si portál).
            </p>
            <ul className="space-y-1.5 text-sm">
              {[
                ['Hydromania', 'https://www.hydromania.si', '~55–60 €'],
                ['Bovec Rafting Team', 'https://www.bovec-rafting-team.com', '~55–81 €'],
                ['Soča Splash', 'https://www.socasplash.com', '~65–69 €'],
              ].map(([name, url, price]) => (
                <li key={name} className="flex items-center justify-between gap-2">
                  <a
                    href={url as string}
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
      </div>
    </Section>
  );
}
