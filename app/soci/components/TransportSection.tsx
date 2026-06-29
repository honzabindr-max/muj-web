import { Section } from './Section';

export function TransportSection() {
  return (
    <Section id="doprava" title="Doprava">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* TAM */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
              TAM
            </span>
            <span className="text-sm font-semibold text-slate-800">Brno → Ljubljana → KG</span>
          </div>
          <ol className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">1</span>
              <span>
                <strong>Brno → Vídeň</strong> — přímý vlak ~1,5 h (RegioJet/ČD, ~14 spojů/den),
                od ~6 €
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">2</span>
              <span>
                <strong>Vídeň → Ljubljana</strong> — přímý EuroCity (ÖBB+SŽ), reálně 5,5–6 h.
                Kupuj průběžnou jízdenku Wien→Ljubljana u ÖBB — garance přípoje při zpoždění.
                Sparschiene od ~19 € (kupuj měsíc předem).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">3</span>
              <span>
                <strong>Noc v Lublani</strong> — celkem 11–13 h cesty je moc na jeden den
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">4</span>
              <span>
                <strong>Ljubljana → Kranjska Gora</strong> — bus ~2 h (Arriva/Nomago)
              </span>
            </li>
          </ol>
          <div className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Bezplatný bus Vršič 2026: 1. 6.–30. 9., 20 spojů denně (od 26. 6.), trasa KG–Vršič–Trenta–Bovec.
            Parkování na sedle 2026 zrušeno — bus je páteř.
            Jízdní řád:{' '}
            <a
              href="https://www.kranjska-gora.si"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              kranjska-gora.si
            </a>
          </div>
        </div>

        {/* ZPĚT */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              ZPĚT
            </span>
            <span className="text-sm font-semibold text-slate-800">Bovec → Brno</span>
          </div>
          <ol className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">1</span>
              <span>
                <strong>Bovec → Ljubljana</strong> — bus (ověřit poslední rozumný spoj předem)
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">2</span>
              <span>
                <strong>Ljubljana → Vídeň</strong> — přímý EC
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-slate-100 text-center text-xs leading-5 font-medium">3</span>
              <span>
                <strong>Vídeň → Brno</strong> — vlak
              </span>
            </li>
          </ol>
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nejbezpečnější varianta: noc v Lublani (Den 7) a domů ráno — bez stresu z přípojů.
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a
              href="https://www.regiojet.cz"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 underline hover:text-sky-800"
            >
              regiojet.cz
            </a>
            <a
              href="https://www.oebb.at"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 underline hover:text-sky-800"
            >
              oebb.at
            </a>
            <a
              href="https://www.ap-ljubljana.si"
              target="_blank"
              rel="noreferrer"
              className="text-sky-600 underline hover:text-sky-800"
            >
              ap-ljubljana.si
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
