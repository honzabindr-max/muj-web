import type { Metadata } from 'next';
import { ScrollHint } from './components/ScrollHint';
import { ScrollReveal } from './components/ScrollReveal';
import { PowerSliders } from './components/PowerSliders';
import { VoiceCards } from './components/VoiceCards';
import { VoiceFormula } from './components/VoiceFormula';
import { AreaMap } from './components/AreaMap';
import { Stepper } from './components/Stepper';
import { ArchitectureFlow } from './components/ArchitectureFlow';
import { ClosingLines } from './components/ClosingLines';
import { GUARDRAILS } from './lib/content-data';
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
            Nechci ze sebe udělat jiného člověka.
            <br />
            Chci konečně pochopit, jak funguje ten, který řídí všechno ostatní.
          </p>
          <p className="h2-hero-subsentence">
            Projekt další životní etapy — postavený na realitě, malých experimentech a
            mechanismech, které respektují to, jaký doopravdy jsem.
          </p>
          <ScrollHint />
        </header>

        {/* 02 — Proč teď */}
        <section className="h2-section" data-section="proc-ted" aria-labelledby="proc-ted">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Proč teď</p>
            <h2 className="h2-section-title" id="proc-ted">
              Celý život jsem stavěl věci kolem sebe.
              <br />
              Teď chci stejně dobře pochopit systém, který je staví.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <div className="h2-prose">
              <p>
                Umím se nadchnout. Rozjet věc. Vidět příležitost. Risknout změnu. Přemýšlet ve
                velkém. Začít znovu.
              </p>
              <p>Právě tyhle vlastnosti mě dostaly k velké části toho dobrého, co v životě mám.</p>
              <p>Jenže stejný motor má i druhou stranu.</p>
              <p>
                Když je všeho moc, z velké vize může být deset směrů. Z analýzy overthinking. Ze
                svobody odpor ke struktuře. Z rychlosti impulz. Z citlivosti přetížení.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={160}>
            <p className="h2-quote">
              „Co když moje další úroveň nevznikne tím, že přidám ještě víc výkonu — ale tím, že
              se naučím líp řídit to, co už ve mně je?"
            </p>
          </ScrollReveal>
        </section>

        {/* 03 — Co to není / co to je */}
        <section className="h2-section" aria-labelledby="jedna-dulezita-vec">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Jedna důležitá věc</p>
            <h2 className="h2-section-title" id="jedna-dulezita-vec">
              Neopravovat se.
              <br />
              Poznat se natolik dobře, abych se sebou nemusel pořád bojovat.
            </h2>
          </ScrollReveal>
          <div className="h2-contrast-grid">
            <ScrollReveal delay={0}>
              <div className="h2-contrast-col" data-kind="not">
                <p className="h2-contrast-title">Tohle není</p>
                <ul className="h2-contrast-list">
                  <li>diagnóza mojí osobnosti</li>
                  <li>slib, že budu jiný člověk</li>
                  <li>další systém produktivity</li>
                  <li>omluva „já jsem prostě takový"</li>
                  <li>astrologie vydávaná za pravdu</li>
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <div className="h2-contrast-col" data-kind="is">
                <p className="h2-contrast-title">Tohle je</p>
                <ul className="h2-contrast-list">
                  <li>mapa toho, co mě zapíná a přetěžuje</li>
                  <li>hledání opakujících se vzorců v realitě</li>
                  <li>malé praktické experimenty</li>
                  <li>jednoduchá pravidla, která fungují i bez motivace</li>
                  <li>postupná tvorba vlastního životního OS</li>
                </ul>
              </div>
            </ScrollReveal>
          </div>
          <ScrollReveal delay={150}>
            <p className="h2-bold-line">Realita má přednost před každou teorií.</p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <p className="h2-section-note">
              Astrologie tu zůstává jen jako symbolický jazyk a generátor hypotéz. Pokud nesedí
              životu, zahazuje se hypotéza — ne realita.
            </p>
          </ScrollReveal>
        </section>

        {/* 04 — Jádro: silná stránka -> přetažení */}
        <section className="h2-section" aria-labelledby="jadro-projektu">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Jádro projektu</p>
            <h2 className="h2-section-title" id="jadro-projektu">
              Možná nemám dvě sady vlastností.
              <br />
              Silné a slabé.
            </h2>
            <p className="h2-section-title-accent">
              Možná mám jednu sadu — jen někdy přetaženou příliš daleko.
            </p>
            <p className="h2-section-lead">
              Cílem není ubrat motoru výkon. Cílem je poznat jeho optimální provozní rozsah.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <PowerSliders />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="h2-quote">
              „Nechci tyhle vlastnosti odstranit. Jsou to moje nejlepší nástroje. Chci jen poznat
              okamžik, kdy přestávají pracovat pro mě."
            </p>
          </ScrollReveal>
        </section>

        {/* 05 — Čtyři vnitřní motory */}
        <section className="h2-section" aria-labelledby="symbolicka-mapa">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Symbolická mapa</p>
            <h2 className="h2-section-title" id="symbolicka-mapa">
              Čtyři části stejného motoru.
            </h2>
            <p className="h2-section-lead">
              Astrologie byla překvapivě užitečný způsob, jak některé rozpory pojmenovat. Ne jako
              odpověď. Jako otázku, kterou pak musí potvrdit život.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <VoiceCards />
          </ScrollReveal>
          <VoiceFormula />
        </section>

        {/* 06 — Guardrails */}
        <section className="h2-section" aria-labelledby="guardrails">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Guardrails</p>
            <h2 className="h2-section-title" id="guardrails">
              Aby se z projektu o menším chaosu nestal další zdroj chaosu.
            </h2>
            <p className="h2-section-lead">
              Honzík 2.0 má vlastní pravidla i pro sebe. Jinak bych dokázal z projektu na
              zjednodušení života udělat nádherně propracovaný nový problém.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="h2-guardrails">
              {GUARDRAILS.map((rule) => (
                <div className="h2-guardrail" key={rule.id}>
                  <span className="h2-guardrail-num">{rule.id}</span>
                  <div>
                    <p className="h2-guardrail-title">{rule.title}</p>
                    <p className="h2-guardrail-body">{rule.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="h2-quote">
              „Projekt není úspěšný, když vznikne krásný framework. Je úspěšný, když se něco
              skutečně změní v životě."
            </p>
          </ScrollReveal>
        </section>

        {/* 07 — Jak to opravdu funguje */}
        <section className="h2-section" aria-labelledby="metoda">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Metoda</p>
            <h2 className="h2-section-title" id="metoda">
              Od konkrétní situace.
              <br />
              Ne od teorie o sobě.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <Stepper />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="h2-callout">
              <p>
                Nový nápad → nezakládám projekt → zapíšu ho na jedno místo → vrátím se k němu v
                rozhodovacím okně → teprve tam soupeří s ostatními možnostmi.
              </p>
              <p>Mechanismus, ne zákaz nápadů.</p>
            </div>
          </ScrollReveal>
        </section>

        {/* 08 — Architektura projektu */}
        <section className="h2-section" aria-labelledby="architektura">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Architektura</p>
            <h2 className="h2-section-title" id="architektura">
              Ne všechno, co o sobě zjistím, se stane pravidlem.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <ArchitectureFlow />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <p className="h2-bold-line">
              Nikdy nepřeskakovat rovnou z hezké interpretace do pravidla pro život.
            </p>
          </ScrollReveal>
        </section>

        {/* 09 — 24 oblastí, ale ne 24 projektů */}
        <section className="h2-section" aria-labelledby="mapa-oblasti">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Mapa, ne todo list</p>
            <h2 className="h2-section-title" id="mapa-oblasti">
              24 oblastí života.
              <br />
              Ale vždy jen jedna skutečná otázka v jednu chvíli.
            </h2>
            <p className="h2-section-lead">
              Mapa zajišťuje, že nic důležitého nezůstane slepé. Neznamená to, že budu analyzovat
              všechno najednou.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <AreaMap />
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="h2-priority">
              <p className="h2-priority-label">První oblast</p>
              <p className="h2-priority-title">05 — Výběr, rozhodování a overthinking</p>
              <p className="h2-priority-reason">
                Protože jeden dobrý filtr na výběr může současně ovlivnit práci, projekty, čas,
                stres i náš společný prostor.
              </p>
              <p className="h2-priority-next-label">Další pravděpodobné oblasti:</p>
              <ul className="h2-priority-next-list">
                <li>→ Dotahování</li>
                <li>→ Přetížení a recovery</li>
                <li>→ Hranice a komunikace</li>
                <li>→ Energie</li>
              </ul>
              <p className="h2-priority-caption">
                Priorita není to, co je nejzajímavější analyzovat. Priorita = dopad ×
                ovlivnitelnost × aktuálnost.
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* 10 — Jak poznám, že to funguje */}
        <section className="h2-section" aria-labelledby="dukaz">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Důkaz</p>
            <h2 className="h2-section-title" id="dukaz">
              Výsledek nebude v Notionu.
              <br />
              Musí být vidět v životě.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <ul className="h2-signs-list">
              <li>Méně otevřených směrů současně.</li>
              <li>Více dotažených věcí, které opravdu stojí za to.</li>
              <li>Rychlejší rozhodnutí tam, kde další analýza už nic nepřidává.</li>
              <li>Dřívější rozpoznání přetížení.</li>
              <li>Méně reakcí, kterých je později potřeba litovat.</li>
              <li>Malé „ne" dřív, než je potřeba velké.</li>
              <li>Schopnost skutečně vypnout.</li>
              <li>Víc kvalitní přítomnosti s lidmi, na kterých mi záleží.</li>
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="h2-signs-definition">
              <p>Ne víc sebekontroly.</p>
              <strong>
                Ale méně zbytečného tření mezi tím, jak přirozeně funguju, a tím, jak chci žít.
              </strong>
            </div>
          </ScrollReveal>
        </section>

        {/* 11 — My dva */}
        <section className="h2-section" aria-labelledby="my-dva">
          <ScrollReveal>
            <p className="h2-section-eyebrow">A pak jsme tu my</p>
            <h2 className="h2-section-title" id="my-dva">
              Nechci, abys tenhle projekt řídila.
              <br />
              Chci, abys věděla, proč pro mě existuje.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <div className="h2-prose">
              <p>Člověk sám sebe nikdy neuvidí úplně.</p>
              <p>
                Ty mě někdy poznáš dřív než já sám. Vidíš, kdy jsem ve svém živlu. Kdy už jedu přes
                limit. Kdy zase vidím deset možností místo jedné. A někdy i to, co se snažím
                dokonale vysvětlit, místo abych prostě řekl jednu důležitou větu.
              </p>
              <p>Tvůj pohled pro mě může být cenný.</p>
              <p>Ale odpovědnost zůstává moje.</p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={160}>
            <div className="h2-peak">
              <p className="h2-peak-line">Nechci z tebe terapeutku.</p>
              <p className="h2-peak-line">Ani kontrolorku.</p>
              <p className="h2-peak-line">Ani projektovou manažerku Honzíka 2.0.</p>
              <p className="h2-peak-line h2-peak-line-positive">
                Chci mít vedle sebe člověka, který mě opravdu zná — a jehož pohled dokážu slyšet.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={220}>
            <div className="h2-vision">
              <div className="h2-vision-lines">
                <p className="h2-vision-line" data-tint="teal">
                  Svoboda bez odcizení.
                </p>
                <p className="h2-vision-line">Blízkost bez vlastnictví.</p>
                <p className="h2-vision-line" data-tint="teal">
                  Stabilita bez nudy.
                </p>
                <p className="h2-vision-line" data-final="true">
                  Bezpečná základna pro dobrodružství.
                </p>
              </div>
              <p className="h2-vision-paragraph">
                Protože jedním z důvodů, proč tohle celé dělám, je jednoduchá věc: nechci, aby mi
                moje hlava, práce nebo chaos braly věci, které jsou ve skutečnosti důležitější.
              </p>
              <p className="h2-emphasis-line">A ty mezi ně patříš.</p>
            </div>
          </ScrollReveal>
        </section>

        {/* 12 — Nová etapa */}
        <section className="h2-section h2-closing" aria-labelledby="nova-etapa">
          <ScrollReveal>
            <p className="h2-section-eyebrow">Honzík 2.0</p>
            <h2 className="h2-section-title" id="nova-etapa">
              V první části života jsem hodně zjišťoval,
              <br />
              co všechno dokážu.
            </h2>
            <p className="h2-section-title-accent">
              Teď mě víc zajímá, jak se svými schopnostmi chci žít.
            </p>
          </ScrollReveal>
          <ClosingLines />
        </section>
      </main>
    </div>
  );
}
