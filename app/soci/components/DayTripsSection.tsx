import { Callout } from './Callout';
import { Section } from './Section';

function TripCard({
  title,
  tags,
  children,
}: {
  title: string;
  tags: { label: string; color: string }[];
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 select-none">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{title}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t.label}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: t.color }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <svg
          className="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-700 space-y-3">
        {children}
      </div>
    </details>
  );
}

export function DayTripsSection() {
  return (
    <Section id="vylety" title="Denní výlety z Bovce">
      <p className="mb-4 text-sm text-slate-600">
        Vše bez auta — busem nebo pěšky. Pořadí libovolné, přizpůsob počasí.
      </p>
      <div className="flex flex-col gap-3">
        <TripCard
          title="Slap Virje + Slap Boka (vodopády)"
          tags={[
            { label: 'vodopád', color: '#8b5cf6' },
            { label: 'bus B3', color: '#64748b' },
            { label: 'zdarma', color: '#10b981' },
          ]}
        >
          <p>
            Bus B3 (3 €/jízda) zvládne oba ve stejný den — na každé zastávce ~1 h.{' '}
            <strong>Slap Virje</strong> (~3,5 km od Bovce): laguna pod vodopádem ke koupání,
            nebo pěšky 45–50 min přes Plužnu. V červenci nižší průtok, stále hezké.
          </p>
          <p>
            <strong>Slap Boka</strong> (~6 km): nejvodnatější vodopád Slovinska (~106 m), vidět ze
            silnice zdarma. Vyhlídka 20 min výstup, horní vyhlídka 45 min. Výstup k prameni Boky
            (1,5–3 h, technické, lana) — jen pro zdatné.
          </p>
        </TripCard>

        <TripCard
          title="Soča Trail — Trenta → Velika korita"
          tags={[
            { label: 'řeka', color: '#0ea5e9' },
            { label: 'bezplatný bus', color: '#10b981' },
            { label: '~13–15 km', color: '#64748b' },
          ]}
        >
          <p>
            Pot ob Soči — 25 km Trenta→Bovec, visuté mosty, průzory na smaragdovou řeku.{' '}
            <strong>Doporučený úsek:</strong> busem do Trenty, pěšky ~13–15 km kolem Mala+Velika korit.
            Konec Velika korita — koupání v tůních (ledová voda, pro odvážné).{' '}
            <strong>Kratší varianta:</strong> jen Bovec→Velika korita (~10 km, ~2,5 h).
          </p>
          <Callout variant="warning">
            Zastávka <strong>Soča</strong> (nejblíže Velika korita, bezplatný bus) aktivní od
            1. 7. 2026. Před cestou ověřit na TIC nebo{' '}
            <a href="https://www.komunala-kg.si" target="_blank" rel="noreferrer" className="underline">
              komunala-kg.si
            </a>
            .
          </Callout>
        </TripCard>

        <TripCard
          title="Vršič (1611 m) + Ruská kaple"
          tags={[
            { label: 'hory', color: '#f97316' },
            { label: 'bezplatný bus', color: '#10b981' },
            { label: 'výhledy', color: '#64748b' },
          ]}
        >
          <p>
            Bezplatný bus Vršič: Bovec → Trenta → sedlo Vršič (1611 m). 22 serpentin s výhledy na
            Julské Alpy. Erjavčeva koča na sedle. <strong>Ruská kaple</strong> (dřevěná, 1917) —
            zastávka „Ruski križ\" aktivní od 1. 8., do té doby krátký pěší přístup z okolní zastávky.
          </p>
        </TripCard>

        <TripCard
          title="Pramen Soče (Izvir Soče) — volitelný vrchol"
          tags={[
            { label: 'hory', color: '#f97316' },
            { label: 'ferrata A/B', color: '#ef4444' },
          ]}
        >
          <Callout variant="danger" className="mb-3">
            <strong>Jediné technicky náročné místo celého výletu.</strong> Zajištěná ferrata A/B:
            exponovaná skalní římsa šíře jedné boty, negativní úhel, závěrečný nezajištěný sestup
            k tůni. <strong>16letý: jen pokud nemá strach z výšek.</strong> U lan smí couvnout —
            počká ~20 min u chaty. Mokrý vápenec klouže. Ranní start (stín), pevná obuv, ferrata
            set půjčit u Alpi Center nebo Hydromania.
          </Callout>
          <p>
            Od zastávky ~30 min po asfaltce k chatě, ~15 min lesem nahoru, pak ferrata k tůni s
            pramenem Soče. Smaragdová voda tryskající ze skály. Návrat stejnou cestou.
          </p>
          <p className="text-slate-500 text-xs">
            YT vyhledání: <em>„pramen Soče ferrata vlog\"</em>
          </p>
        </TripCard>

        <TripCard
          title="Koupání v Soče"
          tags={[
            { label: 'řeka', color: '#0ea5e9' },
            { label: 'bus B3', color: '#64748b' },
          ]}
        >
          <p>
            Horská řeka: studená (6–12 °C i v létě), průzračná hloubka klame, proud silný.
            V soutěskách koupání zakázáno.
          </p>
          <ul className="space-y-1.5 mt-2">
            <li>
              <strong>Čezsoča (Plaža Čezsoča)</strong> — písčitá pláž, pozvolný vstup, vhodné pro
              rodiny. Bus B3. Nejbezpečnější varianta.
            </li>
            <li>
              <strong>Pod Virje</strong> — laguna, bus B3 nebo pěšky ~45 min.
            </li>
            <li>
              <strong>Konec Velika korit</strong> — tůně pro odvážné, ledová voda.
            </li>
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            Pozor: „Plaža Soča\" pod mostem (46.3225, 13.5384) — recenze varují před silnějším
            proudem. Pro rodinu volit raději Čezsoču.
          </p>
        </TripCard>

        <TripCard
          title="Canyoning Sušec (Srpenica)"
          tags={[
            { label: 'řeka', color: '#0ea5e9' },
            { label: 'adrenalin', color: '#ef4444' },
            { label: '~60–65 €', color: '#64748b' },
          ]}
        >
          <p>
            ~7 km od Bovce (Srpenica). Začátečnické: skoky 4–7 m (dobrovolné), tobogán ~12 m,
            2–3 h. Min. věk 8–10 let → 16letý OK. Firma dodá výstroj. Permit netřeba.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            YT vyhledání: <em>„canyoning Sušec Bovec vlog\"</em>
          </p>
        </TripCard>

        <TripCard
          title="Kayak + Mala korita (Den 7 volno)"
          tags={[
            { label: 'řeka', color: '#0ea5e9' },
            { label: 'volitelné', color: '#64748b' },
          ]}
        >
          <p>
            <strong>Kayak:</strong> ~60–65 €/os, min. věk obvykle 10+, permit v ceně kurzu.
            Spíš pro zdatnější. <strong>Mala korita:</strong> ~100 m dlouhá soutěska, 6 m hloubka,
            ~12 km od Bovce, parkoviště zdarma (bez auta busem). Vstup zdarma.
          </p>
          <p>
            <strong>Lanovka Kanin:</strong> výhledy na Julské Alpy a jadranské pobřeží. Julian Alps
            Card dává slevu.
          </p>
        </TripCard>
      </div>
    </Section>
  );
}
