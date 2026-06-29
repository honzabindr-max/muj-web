import { Callout } from './Callout';
import { Section } from './Section';

export function LogisticsSection() {
  return (
    <Section id="logistika" title="Praktická logistika">
      <div className="space-y-5">
        {/* Jídlo a nákupy */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">🛒 Jídlo a nákupy</h3>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex gap-2">
              <span className="flex-shrink-0 font-medium text-slate-600 w-24">SPAR Bovec</span>
              <span>Po–So 7:30–20:00, Ne 8:00–12:00 — nejspolehlivější, blízko centra</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 font-medium text-slate-600 w-24">Mercator</span>
              <span>Po–So 7:00–21:00</span>
            </div>
          </div>

          <Callout variant="danger" className="mt-3">
            <strong>NEDĚLE: Mercator ZAVŘENÝ!</strong> SPAR otevřen jen do 12:00. Nákupy na celý
            den (nebo víc dní) zařídit v sobotu večer nebo neděli dopoledne.
          </Callout>

          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Restaurace:</p>
            <ul className="space-y-1 ml-3">
              {[
                'Gostilna Sovdat — tradiční slovinská kuchyně, center',
                'Bovška kuhn\'ca (Hotel Dobra Vila) — nejlepší v okolí, prémiové',
                'Pizzeria Šport — pizza + burgery, levnější volba',
                'Thirsty River Brewing — lokální craft pivo večer (viz Tipy)',
              ].map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-slate-400">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Peníze */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
          <h3 className="mb-2 font-semibold text-amber-900">💶 Peníze a platby</h3>
          <ul className="space-y-1.5 text-sm text-amber-800">
            <li className="flex gap-2">
              <span className="text-amber-500 flex-shrink-0">!</span>
              <strong>Přines min. 400–500 € v hotovosti</strong> — Camp Bovec POUZE hotovost
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 flex-shrink-0">!</span>
              Bankomat NLB — u TIC Bovec (Trg golobarskih žrtev). Záložní: pošta/SPAR.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 flex-shrink-0">·</span>
              Restaurace a obchody: karta většinou OK, ale mít zálohu v hotovosti
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 flex-shrink-0">·</span>
              Turistická taxa ~ 2 €/os/noc — platí se v kempu
            </li>
          </ul>
        </div>

        {/* Zdraví */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">🏥 Zdraví a bezpečnost</h3>

          <Callout variant="danger">
            <strong>EHIC (modrý průkaz) nestačí!</strong> Kryje jen zákonné minimum — žádné
            letecké záchrany, záchranné helikoptéry ani repatriace. Každý člen musí mít{' '}
            <strong>komerční pojistku</strong> s krytem: rafting WW3, canyoning, zipline, ferrata.
            Ověřit podmínky pro každého zvlášť.
          </Callout>

          <Callout variant="danger" className="mt-3">
            <strong>Klíšťová encefalitida — KRITICKÉ!</strong> Gorenjska / Julské Alpy = jedna
            z nejvíce endemických oblastí v EU. Repelent DEET/ikaridin PŘED KAŽDOU chůzí,
            prohlídka těla každý večer. Kleštičky s sebou.
          </Callout>

          <div className="mt-3 text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">Zdravotní zdroje:</p>
            <ul className="space-y-1">
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                Lékárna Bovec: Kot 86 (centrum)
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                Zdravstvena postaja Bovec: +386 5 620 33 22
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                Záchrana: 112 · Policie: 113 · GRZS (horská záchrana): 1987
              </li>
              <li className="flex gap-2">
                <span className="text-slate-400">·</span>
                TIC Bovec: +386 5 302 96 47 (Trg golobarskih žrtev 47)
              </li>
            </ul>
          </div>
        </div>

        {/* Počasí */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">⛅ Počasí v Julských Alpách</h3>
          <Callout variant="warning">
            <strong>Odpolední bouřky jsou normál</strong> — v Julských Alpách prakticky každý
            den v červenci. Aktivity plánuj na dopoledne a buď v Bovci do ~13:00 při mracích.
          </Callout>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            {[
              { label: 'Ráno (6–11h)', desc: 'Typicky jasno · ideální na výlety a aktivity', color: 'emerald' },
              { label: 'Poledne (11–14h)', desc: 'Budování mraků · čas na návrat', color: 'amber' },
              { label: 'Odpoledne (14+)', desc: 'Bouřky možné · základna, pláž v kempu', color: 'red' },
            ].map((w) => (
              <div key={w.label} className={`rounded-lg bg-${w.color}-50 border border-${w.color}-100 p-3`}>
                <div className={`font-medium text-${w.color}-800 text-xs mb-1`}>{w.label}</div>
                <div className={`text-xs text-${w.color}-700`}>{w.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Konektivita */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">📱 Konektivita</h3>
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="text-slate-400">·</span>
              <strong>EU roaming</strong> — Slovinsko v EU, data bez příplatku (ověřit u operátora)
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400">·</span>
              Signál na Soča Trail, Vršič a v Trentě <strong>slabý nebo žádný</strong>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400 flex-shrink-0">!</span>
              <strong>Offline mapy stáhnout doma</strong> přes WiFi — Mapy.com Slovinsko ~300–500 MB.
              V kempu nebo na trase nestahovat (pomalé / bez signálu).
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400">·</span>
              Kemp má WiFi — slabé, nespolehlivé
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
