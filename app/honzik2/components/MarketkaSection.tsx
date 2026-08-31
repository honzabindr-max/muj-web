import { ScrollReveal } from './ScrollReveal';

export function MarketkaSection() {
  return (
    <section className="h2-feature-dark" aria-labelledby="marketka">
      <div className="h2-inner">
        <ScrollReveal>
          <p className="h2-section-eyebrow h2-section-eyebrow--dark">A teď to nejdůležitější</p>
          <h2 className="h2-feature-title" id="marketka">
            Markétko,
            <br />
            nechci, abys mě opravovala.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="h2-prose h2-prose--dark">
            <p>Ani hlídala. Ani řídila. Ani rozhodovala, jestli Honzík 2.0 funguje.</p>
            <p>Tohle je moje odpovědnost.</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <div className="h2-prose h2-prose--dark">
            <p>Ale jsi člověk, který mě vidí z místa, ze kterého se já nikdy neuvidím.</p>
            <p>Poznáš někdy dřív než já, že jedu přes limit.</p>
            <p>Poznáš, kdy jsem opravdu ve svém živlu.</p>
            <p>A někdy vidíš i to, co já ještě půl hodiny dokonale analyzuju.</p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <p className="h2-feature-statement">
            Takže od tebe vlastně nechci práci.
            <br />
            Chci jen, abys mi občas řekla, co vidíš.
            <br />
            A abych se já učil to opravdu slyšet.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={320}>
          <div className="h2-feature-vision">
            <p className="h2-feature-vision-line">Svoboda bez odcizení.</p>
            <p className="h2-feature-vision-line">Blízkost bez vlastnictví.</p>
            <p className="h2-feature-vision-line">Stabilita bez nudy.</p>
            <p className="h2-feature-vision-line h2-feature-vision-line--final">
              Bezpečná základna
              <br />
              pro dobrodružství.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={380}>
          <div className="h2-prose h2-prose--dark h2-feature-closing">
            <p>Protože jeden z důvodů, proč tohle celé dělám, jsme my dva.</p>
            <p className="h2-feature-final-line">
              Nechci, aby mi hlava, práce nebo vlastní chaos braly člověka a život, na kterých mi
              ve skutečnosti záleží nejvíc.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
