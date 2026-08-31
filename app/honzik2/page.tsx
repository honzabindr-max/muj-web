import type { Metadata } from 'next';
import { ScrollHint } from './components/ScrollHint';
import { ScrollReveal } from './components/ScrollReveal';
import { PowerSliders } from './components/PowerSliders';
import { VoiceCards } from './components/VoiceCards';
import { AreaMap } from './components/AreaMap';
import { Stepper } from './components/Stepper';
import { ClosingLines } from './components/ClosingLines';
import './honzik2.css';

export const metadata: Metadata = {
  title: 'Honzík 2.0',
  description: 'Stejný motor. Lepší řízení.',
  robots: { index: false, follow: false },
};

export default function Honzik2Page() {
  return (
    <div className="h2-page">
      <main className="h2-content">
        <header className="h2-hero">
          <p className="h2-hero-eyebrow">Honzík 2.0</p>
          <h1 className="h2-hero-title">Stejný motor.</h1>
          <p className="h2-hero-motto">Lepší řízení.</p>
          <p className="h2-hero-sentence">
            Systém pravidel a návyků, které respektují to, jaký doopravdy jsem — místo aby se mnou
            bojovaly.
          </p>
          <ScrollHint />
        </header>

        <section className="h2-section" data-section="co-to-neni" aria-labelledby="co-to-neni">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Než začneme</p>
            <h2 className="h2-section-title" id="co-to-neni">
              Co to není
            </h2>
          </ScrollReveal>
          <div className="h2-not-grid">
            <ScrollReveal delay={0}>
              <div className="h2-not-card">
                <h3>Není to slib, že budu jiný člověk.</h3>
                <p>Cílem není nový Honzík. Cílem je vědomější Honzík — ten samý, jen s lepším přehledem sám o sobě.</p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="h2-not-card">
                <h3>Není to další projekt navíc.</h3>
                <p>
                  Nový framework může být stejně stimulující jako nový projekt. Tenhle nemá
                  přibývat — má pomoct vybírat mezi těmi, co už běží.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div className="h2-not-card">
                <h3>Není to sebeoptimalizace ani produktivita.</h3>
                <p>
                  Není to projekt maximální disciplíny nebo výkonu. Je to snaha pochopit, jak už
                  teď fungovat.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="h2-section" aria-labelledby="sila-a-pretazeni">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Jádro projektu</p>
            <h2 className="h2-section-title" id="sila-a-pretazeni">
              Problém není slabá stránka.
              <br />
              Je to příliš mnoho silné.
            </h2>
            <p className="h2-section-lead">
              Cílem není ubrat energii. Cílem je najít polohu. Zkus si pohybem posuvníku sáhnout
              na to, co se stane, když se stejná vlastnost přetáhne příliš daleko.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <PowerSliders />
          </ScrollReveal>
        </section>

        <section className="h2-section" aria-labelledby="ctyri-hlasy">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Vnitřní hlasy</p>
            <h2 className="h2-section-title" id="ctyri-hlasy">
              Čtyři hlasy
            </h2>
            <p className="h2-section-lead">
              Čtyři síly, které spolu obvykle dobře spolupracují — ale dokážou taky vytvořit
              vnitřní napětí. Klikni na kartu.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <VoiceCards />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="h2-section-note">
              „To mám v horoskopu" není vysvětlení ani omluva. Tenhle symbolický jazyk tu slouží
              jako generátor hypotéz, ne jako osud.
            </p>
          </ScrollReveal>
        </section>

        <section className="h2-section" aria-labelledby="mapa-oblasti">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Životní mapa</p>
            <h2 className="h2-section-title" id="mapa-oblasti">
              24 oblastí
            </h2>
            <p className="h2-section-lead">
              Nejsou to nezávislá témata — stejná vlastnost přetéká napříč. Klikni na dlaždici pro
              otázky, které si v té oblasti klademe.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <AreaMap />
          </ScrollReveal>
        </section>

        <section className="h2-section" aria-labelledby="jak-to-bude-probihat">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Metoda</p>
            <h2 className="h2-section-title" id="jak-to-bude-probihat">
              Jak to bude probíhat
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <Stepper />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="h2-mechanism">
              <p>
                Příklad: nový nápad se nerozpracovává hned. Zapíše se na jedno místo a vyhodnotí
                se ve vyhrazeném rozhodovacím okně.
              </p>
              <p>Výstupem není manuál, ale pár takových pravidel.</p>
            </div>
          </ScrollReveal>
        </section>

        <section className="h2-section h2-vision" aria-labelledby="pro-nas">
          <ScrollReveal>
            <p className="h2-section-eyebrow">To hlavní</p>
            <h2 className="h2-section-title" id="pro-nas">
              Co to znamená pro nás
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="h2-vision-lines">
              <p className="h2-vision-line">Svoboda bez odcizení.</p>
              <p className="h2-vision-line">Blízkost bez vlastnictví.</p>
              <p className="h2-vision-line">Stabilita bez nudy.</p>
              <p className="h2-vision-line">Bezpečná základna pro dobrodružství.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <p className="h2-vision-paragraph">
              Potřeba hluboké blízkosti a potřeba svobody nejsou protiklad. Cílem není jednu z
              nich porazit tou druhou — cílem je vytvořit prostředí, které podporuje obě.
            </p>
          </ScrollReveal>
        </section>

        <section className="h2-section" aria-labelledby="co-potrebuju">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Tvoje role</p>
            <h2 className="h2-section-title" id="co-potrebuju">
              Co od tebe potřebuju
            </h2>
          </ScrollReveal>
          <div className="h2-need-grid">
            <ScrollReveal delay={0}>
              <div className="h2-need-col" data-kind="help">
                <h3 className="h2-need-title">Co pomůže</h3>
                <ul className="h2-need-list">
                  <li>„Tady tě poznávám."</li>
                  <li>„Tohle už jsem u tebe viděla víckrát."</li>
                  <li>„Teď působíš přetíženě."</li>
                  <li>Externí pozorování je data point.</li>
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="h2-need-col" data-kind="not">
                <h3 className="h2-need-title">Co nechci</h3>
                <ul className="h2-need-list">
                  <li>Nejsi odpovědná za můj rozvoj.</li>
                  <li>Není to tvůj úkol.</li>
                  <li>Není to rozsudek.</li>
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="h2-section" aria-labelledby="podle-ceho">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Měřítko</p>
            <h2 className="h2-section-title" id="podle-ceho">
              Podle čeho to poznáme
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <ul className="h2-signs-list">
              <li>Méně otevřených projektů.</li>
              <li>Víc dotažených důležitých věcí.</li>
              <li>Dřívější rozpoznání přetížení.</li>
              <li>Míň impulzivních reakcí.</li>
              <li>Dřívější „ne".</li>
              <li>Víc skutečného odpočinku.</li>
              <li>Kvalitnější přítomnost s blízkými.</li>
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="h2-signs-definition">
              <p>Ne víc sebekontroly.</p>
              <strong>
                Ale méně zbytečného tření mezi tím, jak přirozeně funguji, a tím, jak chci žít.
              </strong>
            </div>
          </ScrollReveal>
        </section>

        <section className="h2-section h2-closing" aria-labelledby="zaver">
          <h2 className="h2-visually-hidden" id="zaver">
            Závěr
          </h2>
          <ClosingLines />
        </section>
      </main>
    </div>
  );
}
