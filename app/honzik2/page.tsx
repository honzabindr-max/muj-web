import type { Metadata } from 'next';
import { ScrollHint } from './components/ScrollHint';
import { ScrollReveal } from './components/ScrollReveal';
import { PowerSliders } from './components/PowerSliders';
import { VoiceCards } from './components/VoiceCards';
import { VoiceFormula } from './components/VoiceFormula';
import { ProcessTimeline } from './components/ProcessTimeline';
import { DetailsAccordion } from './components/DetailsAccordion';
import { MarketkaSection } from './components/MarketkaSection';
import { ClosingLines } from './components/ClosingLines';
import { RULES } from './lib/content-data';
import './honzik2.css';

export const metadata: Metadata = {
  title: 'Honzík 2.0',
  description: 'Stejný motor. Lepší řízení.',
  robots: { index: false, follow: false },
};

export default function Honzik2Page() {
  return (
    <div className="h2-page">
      <main>
        <header className="h2-hero">
          <p className="h2-hero-eyebrow">Honzík 2.0</p>
          <h1 className="h2-hero-title">Stejný motor.</h1>
          <p className="h2-hero-motto">Lepší řízení.</p>
          <p className="h2-hero-sentence">
            Nechci být někdo jiný.
            <br />
            Chci se naučit líp žít s tím, kým už jsem.
          </p>
          <p className="h2-hero-subsentence">
            A protože jsi člověk, který mě zná opravdu zblízka, chtěl jsem ti ukázat, co tím
            vlastně myslím.
          </p>
          <ScrollHint />
        </header>

        {/* 02 — Osobní úvod */}
        <section className="h2-section" data-section="osobni-uvod" aria-labelledby="osobni-uvod">
          <div className="h2-inner">
            <ScrollReveal>
              <p className="h2-label-small" id="osobni-uvod">
                Markétko,
              </p>
              <div className="h2-prose">
                <p>Možná mě znáš přesně takhle.</p>
                <p>
                  Když mě něco chytne, dokážu se pro to nadchnout naplno. Vidím možnosti,
                  souvislosti, další krok — někdy deset kroků dopředu.
                </p>
                <p>A právě tahle část mě dostala k většině věcí, na které jsem v životě pyšný.</p>
                <p>Jenže asi taky dobře víš, že ten samý motor umí občas přetočit otáčky.</p>
                <p>
                  Pak mám deset směrů místo jednoho. Přemýšlím i ve chvíli, kdy už bych měl
                  rozhodnout. Nebo mám hlavu někde úplně jinde, i když fyzicky sedím vedle tebe.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <p className="h2-emphasis">A právě tohle chci pochopit líp.</p>
            </ScrollReveal>
          </div>
        </section>

        {/* 03 — Proč to dělám */}
        <section className="h2-section" aria-labelledby="proc-to-delam">
          <div className="h2-inner-wide">
            <div className="h2-split">
              <ScrollReveal>
                <h2 className="h2-section-title" id="proc-to-delam">
                  Nechci víc výkonu.
                  <br />
                  Chci míň zbytečného chaosu.
                </h2>
              </ScrollReveal>
              <div>
                <ScrollReveal delay={80}>
                  <div className="h2-prose">
                    <p>
                      Dřív mě hodně zajímalo: „Co ještě dokážu?"
                    </p>
                    <p>Teď mě začíná víc zajímat: „Jak chci se svými schopnostmi vlastně žít?"</p>
                    <p>
                      Nechci se zbavit velkých cílů, spontánnosti, nápadů, dobrodružství,
                      intenzity, svobody.
                    </p>
                    <p>Chci jen líp poznat, kdy mi pomáhají a kdy už začínají řídit ony mě.</p>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={160}>
                  <p className="h2-quote">
                    „Nechci menší motor.
                    <br />
                    Chci lepší cit pro volant."
                  </p>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* 04 — Jeden silný interaktivní moment */}
        <section className="h2-section" aria-labelledby="sila-a-hrana">
          <div className="h2-inner">
            <ScrollReveal>
              <p className="h2-section-eyebrow">Síla a hrana</p>
              <h2 className="h2-section-title" id="sila-a-hrana">
                Moje slabiny možná nejsou jiné vlastnosti.
                <br />
                Možná jsou to moje silné stránky přetažené příliš daleko.
              </h2>
              <p className="h2-section-lead">
                A to je vlastně dobrá zpráva. Nemusím je odstranit. Potřebuju se naučit poznat
                hranici.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <PowerSliders />
            </ScrollReveal>
          </div>
        </section>

        {/* 05 — Čtyři stránky mě */}
        <section className="h2-section" aria-labelledby="ctyri-stranky">
          <div className="h2-inner-wide">
            <ScrollReveal>
              <p className="h2-section-eyebrow">Jeden z jazyků, který mi pomohl</p>
              <h2 className="h2-section-title" id="ctyri-stranky">
                Čtyři části mě, které v sobě docela poznávám.
              </h2>
              <p className="h2-section-lead">
                Astrologii neberu jako návod k životu. Ale překvapilo mě, jak dobře mi některé
                věci pomohla pojmenovat. Takže ji používám jako otázku. Ne jako odpověď.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <VoiceCards />
            </ScrollReveal>
            <VoiceFormula />
          </div>
        </section>

        {/* 06 — Aby se to nezvrhlo */}
        <section className="h2-section" aria-labelledby="nezvrhnout">
          <div className="h2-inner">
            <ScrollReveal>
              <p className="h2-section-eyebrow">Aby se to nezvrhlo</p>
              <h2 className="h2-section-title" id="nezvrhnout">
                Protože znám sám sebe natolik, že i ze seberozvoje bych dokázal udělat nový
                megaprojekt.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="h2-rules">
                {RULES.map((rule) => (
                  <div className="h2-rule" key={rule.id}>
                    <span className="h2-rule-num">{rule.id}</span>
                    <p className="h2-rule-body">{rule.body}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="h2-emphasis">
                Protože cílem není mít dokonale zmapovaného Honzíka.
                <br />
                Cílem je mít lepší život.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 07 — Jak to bude probíhat */}
        <section className="h2-section" aria-labelledby="jak-to-bude-probihat">
          <div className="h2-inner">
            <ScrollReveal>
              <p className="h2-section-eyebrow">Metoda</p>
              <h2 className="h2-section-title" id="jak-to-bude-probihat">
                Jak to bude probíhat.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <ProcessTimeline />
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <div className="h2-example">
                <p className="h2-example-label">Příklad</p>
                <p>Napadne mě nový projekt.</p>
                <p className="h2-example-before">
                  Dřív: „Tohle může být obrovský!" → začnu rozpracovávat.
                </p>
                <p>
                  Nově: „Možná." → zapíšu. → vrátím se k němu v rozhodovacím okně. → musí porazit
                  věci, kterým už jsem řekl ano.
                </p>
                <p className="h2-example-caption">Ne zákaz nápadů. Filtr mezi nápadem a životem.</p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* 08 — Detaily schovat */}
        <section className="h2-section h2-details-section" aria-labelledby="detaily">
          <div className="h2-inner-wide">
            <ScrollReveal>
              <p className="h2-section-eyebrow">Pro zvídavé</p>
              <h2 className="h2-section-title" id="detaily">
                Jestli tě zajímá, jak hluboko jsem to promyslel…
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <DetailsAccordion />
            </ScrollReveal>
          </div>
        </section>

        {/* 09 — Co chci, aby bylo vidět v životě */}
        <section className="h2-section" aria-labelledby="co-chci-videt">
          <div className="h2-inner">
            <ScrollReveal>
              <h2 className="h2-section-title" id="co-chci-videt">
                Nebudu poznávat pokrok podle toho, kolik mám poznámek.
              </h2>
              <p className="h2-section-lead">Pozná se mnohem obyčejněji.</p>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="h2-signals">
                <p className="h2-signal">Míň věcí rozjetých zároveň.</p>
                <p className="h2-signal">Víc důležitých věcí dotažených.</p>
                <p className="h2-signal">
                  Méně času stráveného rozhodnutím, které už mám vlastně rozhodnuté.
                </p>
                <p className="h2-signal">Dřív poznám, že jedu přes limit.</p>
                <p className="h2-signal">Dřív řeknu malou nepříjemnou věc.</p>
              </div>
              <p className="h2-signal-final">
                A když jsem s tebou, budu častěji opravdu s tebou.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 10 — Markétka / emocionální vrchol */}
        <MarketkaSection />

        {/* 11 — Finále */}
        <section className="h2-section" aria-labelledby="finale">
          <div className="h2-inner">
            <ScrollReveal>
              <h2 className="h2-section-title h2-section-title--center" id="finale">
                Pořád chci velké věci.
              </h2>
            </ScrollReveal>
            <ClosingLines />
          </div>
        </section>
      </main>
    </div>
  );
}
