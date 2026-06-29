import { Callout } from './Callout';
import { Section } from './Section';

export function HowItWorksSection() {
  return (
    <Section id="funguje" title="Jak to celé funguje">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: '⛺',
              title: 'Jedna základna',
              text: 'Camp Bovec — 5 nocí. Žádné stěhování ubytka, žádný těžký batoh na výletech.',
            },
            {
              icon: '🚌',
              title: 'Dva busové systémy',
              text: 'Bezplatný bus Vršič (Bovec↔Trenta↔Izvir↔Vršič↔KG) + Hop-on-hop-off Bovec (B1/B2/B3, 3 €/jízda).',
            },
            {
              icon: '🎯',
              title: 'Permit hned první den',
              text: 'TIC Bovec, Trg golobarskih žrtev 47 — permit na rafting, jízdní řády, Julian Alps Card.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 text-2xl">{item.icon}</div>
              <div className="mb-1 font-semibold text-slate-800">{item.title}</div>
              <p className="text-sm text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-800">Doprava bez auta — přehled</h3>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <span className="font-medium text-emerald-700">Bezplatný bus Vršič 2026</span> — provoz
              1. 6.–30. 9., hlavní sezóna (hodinový takt) 26. 6.–31. 8. Z Bovce 04:30–21:30. 14
              zastávek vč. Trenty a pramene Soče.
            </div>
            <div>
              <span className="font-medium text-sky-700">Hop-on-hop-off Bovec</span> — B3 je
              klíčová linka: Bovec–Slap Virje–Slap Boka–Čezsoča. 3 €/jízda (děti 6–15 let 50 %).
              Data z 2025 — potvrdit 2026 na TIC.
            </div>
            <div>
              <span className="font-medium text-purple-700">Julian Alps Card</span> — ~25 €/dosp,
              ~15 €/dítě 7–14 let, platná ~15 dní. Hop-on-hop-off zdarma + slevy (lanovka Kanin).
              Spočítat na TIC, zda se vyplatí.
            </div>
            <div>
              <span className="font-medium text-slate-700">Pěší dosah z Bovce</span> — Virje ~3,5 km
              (45–50 min), Boka ~6–10 km (2–2,5 h), Velika korita ~10 km (~2,5 h po Soča Trail).
            </div>
          </div>
        </div>

        <Callout variant="warning">
          <strong>Zastávka Soča</strong> (nejblíže Velika korita, bezplatný bus Vršič) aktivní teprve
          od 1. 7. 2026. Zastávka „Ruski križ\" (Ruská kaple) od 1. 8. Ověřit aktuální stav na TIC
          Bovec nebo{' '}
          <a
            href="https://www.komunala-kg.si"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            komunala-kg.si
          </a>
          .
        </Callout>
      </div>
    </Section>
  );
}
