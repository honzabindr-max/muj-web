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
            chci tě u toho mít vedle sebe.
          </h2>
        </ScrollReveal>

        <ScrollReveal delay={80}>
          <div className="h2-prose h2-prose--dark">
            <p>Ne proto, abys mě hlídala.</p>
            <p>Ne proto, abys rozhodovala, jestli Honzík 2.0 funguje.</p>
            <p>A už vůbec ne proto, abys za mě něco opravovala.</p>
            <p>
              <strong>Tohle je moje odpovědnost.</strong>
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={160}>
          <div className="h2-prose h2-prose--dark">
            <p>Ale ty mě vidíš z místa, ze kterého se já nikdy neuvidím.</p>
            <p>Někdy poznáš dřív než já, že už jedu přes limit.</p>
            <p>Poznáš, kdy jsem opravdu ve svém živlu.</p>
            <p>
              A občas vidíš úplně jasně něco, co já ještě dalších třicet minut analyzuju ze všech
              stran.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={240}>
          <p className="h2-feature-statement">
            Takže po tobě nechci práci.
            <br />
            Chci něco mnohem jednoduššího.
            <br />
            Abys mi občas řekla, co vidíš.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <div className="h2-prose h2-prose--dark">
            <p>
              A moje část práce je naučit se to slyšet —
              <br />
              aniž bych ti nejdřív dvacet minut vysvětloval, proč se vlastně mýlíš.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={360}>
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

        <ScrollReveal delay={420}>
          <div className="h2-prose h2-prose--dark h2-feature-closing">
            <p>Protože jeden z důvodů, proč tohle celé dělám, jsme my dva.</p>
            <p>Nechci, aby moje hlava a práce zabíraly víc prostoru, než si zaslouží.</p>
            <p>Chci, aby nám zůstalo dost místa na to, kvůli čemu spolu vlastně chceme být.</p>
            <p>Na blízkost.</p>
            <p>Na smích.</p>
            <p>Na sex.</p>
            <p>Na výlety a spontánní kraviny.</p>
            <p>Na dobrodružství.</p>
            <p className="h2-feature-final-line">
              A taky na úplně obyčejné chvíle, kdy nám spolu prostě dobře je.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
