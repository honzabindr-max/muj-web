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
            Chci být víc sám sebou — jen s menším chaosem kolem toho.
          </p>
          <p className="h2-hero-subsentence">
            A protože mě znáš opravdu zblízka, chtěl jsem ti ukázat, proč jsem si Honzík 2.0 vůbec
            vymyslel.
            <br />
            A proč si myslím, že z něj můžeme něco mít i my dva.
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
                  Když mě něco chytne, umím se pro to nadchnout úplně naplno. Za chvíli vidím
                  možnosti, varianty, další kroky — a ideálně už přemýšlím, kam by se to celé
                  dalo dostat.
                </p>
                <p>To je na mně asi jedna z věcí, které mám rád.</p>
                <p>A myslím, že ty zároveň velmi dobře znáš i pokračování.</p>
                <p>Někdy je těch možností deset.</p>
                <p>Něco nového mě začne lákat víc než to, co už běží.</p>
                <p>Nebo o něčem přemýšlím tak dlouho, až bych už dávno mohl prostě rozhodnout.</p>
                <p>A někdy sedím vedle tebe, ale moje hlava má právě vlastní pracovní poradu.</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <p className="h2-emphasis">
                Nechci tenhle motor vypnout.
                <br />
                Chci se jen naučit poznat, kdy už jede moc rychle.
              </p>
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
                    <p>Dřív mě hodně zajímalo: „Co ještě dokážu?"</p>
                    <p>Teď mě začíná víc zajímat: „Jak chci se svými schopnostmi vlastně žít?"</p>
                    <p>Nechci se zbavit velkých cílů.</p>
                    <p>Ani spontánnosti.</p>
                    <p>Ani nápadů, dobrodružství, intenzity nebo svobody.</p>
                    <p>
                      Chci jen líp poznat okamžik, kdy mi tyhle věci pomáhají — a kdy už začínají
                      řídit ony mě.
                    </p>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={160}>
                  <p className="h2-quote">
                    „Nechci se brzdit.
                    <br />
                    Jen nechci pokaždé zjistit až v zatáčce, že jsem jel moc rychle."
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
                To nejlepší na mně a to, co mi občas komplikuje život, může být úplně stejná věc.
              </h2>
              <p className="h2-section-lead">
                Rozdíl někdy není v tom, co dělám.
                <br />
                Ale kolik toho právě je.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <PowerSliders />
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="h2-sliders-note">
                A to je vlastně dobrá zpráva.
                <br />
                Nemusím ty vlastnosti odstranit.
                <br />
                Potřebuju se naučit poznat hranici.
              </p>
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
                Astrologii neberu jako návod k životu.
                <br />
                Ale překvapilo mě, jak dobře mi některé věci pomohla pojmenovat.
                <br />
                Takže ji používám jako otázku.
                <br />
                Ne jako odpověď.
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
              <p className="h2-section-eyebrow">Jak to bude fakt fungovat</p>
              <h2 className="h2-section-title" id="jak-to-bude-probihat">
                Nejdřív život.
                <br />
                Pak teorie.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <ProcessTimeline />
            </ScrollReveal>
            <ScrollReveal delay={140}>
              <p className="h2-section-lead">
                Žádné velké předsevzetí.
                <br />
                Žádná revoluce života.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={180}>
              <div className="h2-example">
                <p className="h2-example-label">Příklad</p>
                <p>Napadne mě nový projekt.</p>
                <p className="h2-example-before">
                  Dřív: „Tohle může být obrovský." → začnu ho rozpracovávat.
                </p>
                <p>
                  Nově: „Možná." → zapíšu ho. → vrátím se k němu v rozhodovacím okně. → musí
                  porazit věci, kterým už jsem řekl ano.
                </p>
                <p className="h2-example-caption">
                  Ne zákaz nápadů.
                  <br />
                  Filtr mezi nápadem a životem.
                </p>
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
                Pokud tě fakt zajímá, jak moc jsem se v tom vyřádil…
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <DetailsAccordion />
            </ScrollReveal>
          </div>
        </section>

        {/* 09 — Co nechci ztratit */}
        <section className="h2-section" aria-labelledby="co-nechci-ztratit">
          <div className="h2-inner">
            <ScrollReveal>
              <p className="h2-section-eyebrow">Co se měnit nemá</p>
              <h2 className="h2-section-title" id="co-nechci-ztratit">
                Honzík 2.0 nemá udělat můj život menší.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="h2-signals">
                <p className="h2-signal">Nechci být rozumnější tak, že budu nudnější.</p>
                <p className="h2-signal">Nechci přestat mít velké nápady.</p>
                <p className="h2-signal">Nechci plánovat každý víkend.</p>
                <p className="h2-signal">Nechci přestat dělat spontánní blbosti.</p>
                <p className="h2-signal">Nechci se naučit „správně žít".</p>
                <p className="h2-signal">A už vůbec nechci ze vztahu udělat další projekt.</p>
              </div>
              <p className="h2-signal-final">
                Chci jen, aby věci, které na mně fungují dobře, měly menší daň.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 10 — Co chci, aby bylo vidět v životě */}
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
                A hlavně: když jsme spolu, chci být častěji opravdu tam — s tebou.
                <br />
                Ne jen tělem vedle tebe a hlavou někde v projektu.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* 11 — Markétka / emocionální vrchol */}
        <MarketkaSection />

        {/* 12 — Finále */}
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
