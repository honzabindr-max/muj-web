import { Callout } from './Callout';
import { Section } from './Section';

const CAMPS = [
  {
    name: 'Camp Bovec / Alpi Center ⭐',
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
  },
  {
    name: 'Adrenaline-Check Eco Place',
    type: 'Glamping / eko-chatky',
    price: 'Prémiové (ověřit)',
    notes: [
      'TripAdvisor #1 Bovec',
      '~4,2 km od centra Bovce — BEZ AUTA náročné',
      '"Narnia beach" u řeky Soče',
      'Blízko Slap Boka',
    ],
    highlight: false,
  },
  {
    name: 'Camp Vodenca / Polovnik',
    type: 'Kemp',
    price: 'Podobně jako Camp Bovec',
    notes: ['U řeky nebo blízko busu', 'Záloha pokud Camp Bovec/Alpi Center plný'],
    highlight: false,
  },
  {
    name: 'Hotel Dobra Vila',
    type: 'Boutique hotel',
    price: 'Prémiové',
    notes: ['Nejlepší restaurace v Bovci (Bovška kuhn\'ca)', 'Pro "pohodlnější" variantu'],
    highlight: false,
  },
];

export function AccommodationSection() {
  return (
    <Section id="ubytovani" title="Ubytování — Camp Bovec = Alpi Center">
      <Callout variant="warning">
        <strong>Camp Bovec = Rafting Slovinsko = Alpi Center</strong> — to je JEDEN subjekt!
        Alpi Center d.o.o. (Rupa 14) provozuje od roku 2003 kemp i agenturní aktivity.
        Výhoda: kemp + rafting + canyoning na jednom místě, česky.{' '}
        <strong>PLATÍ SE JEN HOTOVOST</strong> — přines min. 400–500 € v EUR.
      </Callout>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CAMPS.map((place) => (
          <div
            key={place.name}
            className={`rounded-xl border p-4 shadow-sm ${
              place.highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="mb-1 font-semibold text-slate-900">{place.name}</div>
            <div className="mb-1 text-xs font-medium text-slate-500">{place.type}</div>
            <div className="mb-2 text-sm font-medium text-slate-700">{place.price}</div>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {place.notes.map((n) => (
                <li key={n} className="flex gap-1.5">
                  <span className="text-slate-400">·</span>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-800">Odhad ubytování 7 nocí (3 osoby)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Varianta</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-700">EUR</th>
                <th className="px-3 py-2.5 text-right font-semibold text-slate-700">Kč</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Poznámka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                {
                  v: 'Stan (3 stany, 1 os.)',
                  eur: '~315 €',
                  czk: '~7 875 Kč',
                  note: '15 €/noc × 3 os. × 7 dní, bez daně',
                },
                {
                  v: 'Stan + taxa ubytování',
                  eur: '~357 €',
                  czk: '~8 925 Kč',
                  note: '~2 €/os/noc, celkem +42 €',
                },
                {
                  v: 'Se slevou −10 % (balíček aktivit)',
                  eur: '~321 €',
                  czk: '~8 025 Kč',
                  note: 'Jen pokud rezervuješ aktivity u Alpi Center',
                },
                {
                  v: 'Chatka 4 os. (7 nocí)',
                  eur: '~840 €',
                  czk: '~21 000 Kč',
                  note: '~120 €/noc, větší soukromí',
                },
              ].map((r) => (
                <tr key={r.v} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-800">{r.v}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{r.eur}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.czk}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Kurz orientačně 1 € = 25 Kč. Ceny z rešerše 2026, ověřit aktuální na{' '}
          <a
            href="https://www.campbovec.com"
            target="_blank"
            rel="noreferrer"
            className="text-sky-600 underline"
          >
            campbovec.com
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
