import { Section } from './Section';

export function AccommodationSection() {
  return (
    <Section id="ubytovani" title="Ubytování v Bovci">
      <p className="mb-4 text-xs text-slate-500">
        Rezervuj 4–6 týdnů předem (červenec = hlavní sezóna).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            name: 'Camp Bovec ⭐',
            type: 'Stan / chatka',
            price: 'Stan ~15 €/os/noc · Chatka 4 os. ~120 €/noc',
            notes: [
              'Rupa 14 (u Bovec Rafting Team)',
              'Platba hotově',
              'Výhledy na hory',
              'Rezervace: campbovec.com',
            ],
            highlight: true,
          },
          {
            name: 'Adrenaline-Check Eco Place',
            type: 'Glamping',
            price: 'Prémiové ceny (ověřit)',
            notes: [
              'TripAdvisor #1 Bovec',
              '„Narnia beach\" u řeky',
              '~1 km od Boky, 4 km centrum',
              'Organizují aktivity',
            ],
          },
          {
            name: 'Camp Vodenca / Polovnik / Liza',
            type: 'Kemp',
            price: 'Podobně jako Camp Bovec',
            notes: ['U řeky nebo blízko busu', 'Záloha pokud Camp Bovec plný'],
          },
          {
            name: 'Hotel Dobra Vila',
            type: 'Boutique hotel',
            price: 'Prémiové',
            notes: ['Nejlepší restaurace v Bovci', 'Pro „pohodlnější\" variantu rozpočtu'],
          },
        ].map((place) => (
          <div
            key={place.name}
            className={`rounded-xl border p-4 shadow-sm ${
              place.highlight
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-white'
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
    </Section>
  );
}
