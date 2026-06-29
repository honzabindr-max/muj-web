import { Callout } from './Callout';
import { Section } from './Section';

const FERRATA_GATE = [
  { condition: 'Předchozí zkušenost s via ferratou nebo lezením', required: true },
  { condition: 'Žádný strach z výšek (pramen je expozice A/B v mokrém vápenci)', required: true },
  { condition: 'Ferrata set půjčený/vlastní (helma + sedák + set)', required: true },
  { condition: 'Suché počasí v posledních 6 h (mokrý vápenec klouže extrémně)', required: true },
  { condition: 'Denny (16) souhlasí a chce — ne jako skupinový závazek', required: true },
  { condition: 'Znáte zkratku zpět (otočit = vítězství, ne selhání)', required: false },
];

export function SafetyExtrasSection() {
  return (
    <Section id="tipy" title="Tipy & bezpečnostní brány">
      <div className="space-y-5">
        {/* Ferrata brána */}
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
          <h3 className="mb-1 font-semibold text-orange-900">⛏️ Ferrata brána — Pramen Soče</h3>
          <p className="mb-3 text-sm text-orange-800">
            Pramen je zajištěná ferrata A/B v mokrém vápenci. Splnit <strong>všechna povinná</strong>{' '}
            kritéria před nástupem:
          </p>
          <ul className="space-y-2">
            {FERRATA_GATE.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span
                  className={`flex-shrink-0 font-bold ${
                    item.required ? 'text-red-600' : 'text-amber-600'
                  }`}
                >
                  {item.required ? '⬛' : '△'}
                </span>
                <span className={item.required ? 'text-orange-900' : 'text-orange-700'}>
                  {item.condition}
                  {item.required && (
                    <span className="ml-2 text-xs font-semibold text-red-600">POVINNÉ</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <Callout variant="danger" className="mt-3">
            Mokrý vápenec + bez zkušenosti = reálné nebezpečí. Kdo nesplní kritéria, počká u chaty
            Dom pri izviru Soče (~20 min níže). Otočit se je vítězství.
          </Callout>
        </div>

        {/* Kluže / WW1 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 font-semibold text-slate-800">🏰 Pevnost Kluže — buffer a deštivý den</h3>
          <p className="mb-2 text-sm text-slate-700">
            ~8 km od Bovce (bus nebo kolo). Austro-uherská pevnost z roku 1882 v soutěsce Učja —
            na místě stál původní fort už z 15. stol. Isonzská fronta (1915–1917): 11 bitev,
            přes 300 000 padlých na Soče. Sam ocení historický kontext, Denny vizuální WOW
            efekt soutěsky.
          </p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li className="flex gap-2"><span>·</span> Vstup ~5 € dospělý, expozice WW1</li>
            <li className="flex gap-2"><span>·</span> Ideální na deštivé dopoledne nebo buffer den (Den 7)</li>
            <li className="flex gap-2"><span>·</span> Na kole Bovec→Kluže: lesní silnice, ~30 min</li>
          </ul>
        </div>

        {/* Taxi */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 font-semibold text-slate-800">🚕 Taxi — pojistka na zmeškaný bus</h3>
          <p className="mb-2 text-sm text-slate-700">
            Místní taxi = klíčová záloha při bouřce, zmeškání busu nebo únavě. Číslo si zjistit
            první den v TIC nebo kempu — zapsat do kontaktů.
          </p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li className="flex gap-2"><span>·</span> TIC Bovec: +386 5 302 96 47 (zeptej se na taxi kontakt)</li>
            <li className="flex gap-2"><span>·</span> VisitSoča nebo Bovec Rafting Team občas doporučují lokální taxi</li>
            <li className="flex gap-2"><span>·</span> Trasy: Bovec→Trenta, Bovec→Virje, Bovec→Kluže (~10–20 €)</li>
          </ul>
        </div>

        {/* Večerní tipy */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 font-semibold text-slate-800">🍺 Večerní tipy — Bovec</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              {
                name: 'Thirsty River Brewing',
                desc: 'Mikropivovar s výhledem na hory — lokální piva, relaxovaná atmosféra po náročném dnu',
              },
              {
                name: 'Bovška kuhn\'ca (Hotel Dobra Vila)',
                desc: 'Nejlepší restaurace v Bovci — pro slavnostní večeři, prémiové ceny',
              },
              {
                name: 'Pizzeria Šport',
                desc: 'Oblíbené u místních, pizza + grilované maso, přátelské ceny',
              },
              {
                name: 'Koupání večer — Čezsoča',
                desc: 'Písčitá pláž do západu slunce — nejklidnější hodina, Soča v pozdním světle',
              },
            ].map((t) => (
              <li key={t.name} className="flex gap-2">
                <span className="text-slate-400 flex-shrink-0">·</span>
                <span>
                  <span className="font-medium">{t.name}</span> — {t.desc}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pravidla koupání */}
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-5">
          <h3 className="mb-2 font-semibold text-sky-900">🏊 Pravidla koupání v Soče</h3>
          <ul className="space-y-1.5 text-sm text-sky-800">
            <li className="flex gap-2">
              <span className="text-sky-500 flex-shrink-0">!</span>
              Soča je <strong>ledová</strong> (9–12 °C) — vstupovat postupně, nikdy rovnou skokem
            </li>
            <li className="flex gap-2">
              <span className="text-sky-500 flex-shrink-0">!</span>
              Proudy v soutěskách (Velika korita, Mala korita) jsou silné —{' '}
              <strong>koupání v označených místech</strong>, ne v soutěskách mimo plážičky
            </li>
            <li className="flex gap-2">
              <span className="text-sky-500 flex-shrink-0">·</span>
              Bezpečná místa: Čezsoča (plaža, písek, pozvolný vstup), Velika korita (tůně za soutěskou)
            </li>
            <li className="flex gap-2">
              <span className="text-sky-500 flex-shrink-0">·</span>
              Vodní boty nutné — ostré oblázky a kluzké kameny
            </li>
            <li className="flex gap-2">
              <span className="text-sky-500 flex-shrink-0">·</span>
              Děti / méně zdatní plavci: jen plaža Čezsoča nebo s neoprenem (v ceně raftingu)
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
