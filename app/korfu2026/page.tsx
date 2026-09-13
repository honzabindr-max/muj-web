import { PlaceCard } from './_components/PlaceCard';
import { MUST_SEE } from './_data/places';

export const metadata = {
  title: 'Korfu 2026 — katalog možností',
  description:
    'Explorer možností pro Korfu 14.–21. 9. 2026: pláže, místa, aktivity a praktické info. ' +
    'Žádný hotový program — jen možnosti k porovnání.',
};

export default function Korfu2026Page() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          14.–21. 9. 2026 · Silver Beach Hotel, Roda
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Korfu 2026
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Katalog možností, ne hotový plán. Web ukazuje, co se dá na Korfu podniknout, a nechává
          rozvržení na vás. Nic tu není přidělené ke konkrétnímu dni.
        </p>
      </header>

      <section aria-labelledby="must-see-heading" className="mt-10">
        <h2 id="must-see-heading" className="text-xl font-bold text-slate-900">
          Must-see místa
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {MUST_SEE.length} míst z ručního seznamu — každé jako vlastní karta.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4">
          {MUST_SEE.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-600">
        <p>
          Rozpracovaná verze. Mapa, filtry, Můj výběr a zbytek katalogu přibudou v dalších krocích.
        </p>
        <p className="mt-2">
          Dynamické údaje (ceny, otevírací doby, sezonní provoz) jsou označené štítkem „ověřit
          aktuálně“ — před použitím je potvrďte u provozovatele.
        </p>
      </footer>
    </main>
  );
}
