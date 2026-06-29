import { AccommodationSection } from './components/AccommodationSection';
import { AnchorNav } from './components/AnchorNav';
import { BasecampPlanSection } from './components/BasecampPlanSection';
import { BudgetSection } from './components/BudgetSection';
import { ContactsSection } from './components/ContactsSection';
import { DayTripsSection } from './components/DayTripsSection';
import { GearChecklist } from './components/GearChecklist';
import { GuideMapDynamic } from './components/GuideMapDynamic';
import { Hero } from './components/Hero';
import { HowItWorksSection } from './components/HowItWorksSection';
import { LogisticsSection } from './components/LogisticsSection';
import { RaftingSection } from './components/RaftingSection';
import { ReservationChecklist } from './components/ReservationChecklist';
import { SafetyExtrasSection } from './components/SafetyExtrasSection';
import { Section } from './components/Section';
import { PhotoStrip, SectionPhoto } from './components/SectionPhoto';
import { TransportSection } from './components/TransportSection';

export const metadata = {
  title: 'OPERATION SOČA — Bovec basecamp 4.–11. 7. 2026',
  description:
    'Průvodce pro OPERATION SOČA: táta + Sam (20) + Denny (16). ' +
    'Bovec basecamp, denní výlety nalehko — rafting (Rafting Slovinsko, permit v ceně), ' +
    'canyoning, vodopády, Vršič, Soča Trail. Bez auta, 7 dní.',
};

// Fotky s atribucí — všechny CC BY / CC BY-SA, Wikimedia Commons, ověřeno 29.6.2026
const PHOTOS = {
  soca: {
    src: '/soci/photos/soca-reka.jpg',
    alt: 'Smaragdová řeka Soča v Julských Alpách',
    author: 'Lars Plougmann',
    license: 'CC BY-SA 2.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:So%C4%8Da,_the_emerald_river_(185851175).jpg',
  },
  rafting: {
    src: '/soci/photos/rafting-soca.jpg',
    alt: 'Rafting na smaragdové Soče — WW II–III',
    author: 'malenki',
    license: 'CC BY-SA 3.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Rafting_river_So%C4%8Da_3.jpg',
  },
  velikaKorita: {
    src: '/soci/photos/velika-korita.jpg',
    alt: 'Velika korita Soče — úzká soutěska na Soča Trailu',
    author: 'Krzysztof Golik',
    license: 'CC BY-SA 4.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Velika_korita_Soce_(1).jpg',
  },
  boka: {
    src: '/soci/photos/boka-vodopad.jpg',
    alt: 'Vodopád Boka — nejvodnatější vodopád Slovinska (~106 m)',
    author: 'Leon Yaakov',
    license: 'CC BY 2.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Boka_Waterfall,_Slovenia_(15996635505).jpg',
  },
  virje: {
    src: '/soci/photos/virje-vodopad.jpg',
    alt: 'Vodopád Virje u Bovce — laguna pod vodopádem',
    author: 'Tiia Monto',
    license: 'CC BY-SA 3.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Slap_Virje.jpg',
  },
  vrsic: {
    src: '/soci/photos/vrsic-pass.jpg',
    alt: 'Průsmyk Vršič (1611 m) — výhledy na Julské Alpy',
    author: 'Krzysztof Golik',
    license: 'CC BY-SA 4.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Julian_Alps_from_Vrsic_Pass_(3).jpg',
  },
  pramen: {
    src: '/soci/photos/pramen-soce.jpg',
    alt: 'Pramen Soče (Izvir Soče) — horská tůň u ferráty',
    author: 'Igor Pečovnik',
    license: 'CC BY 2.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Izvir_So%C4%8De_(5958629406).jpg',
  },
  ruskaKaple: {
    src: '/soci/photos/ruska-kaple.jpg',
    alt: 'Ruská kaple na Vršiči — dřevěná kaple z roku 1917',
    author: 'Dage – Looking For Europe',
    license: 'CC BY 2.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Ruska_Cesta_-_Ruska_Kapelica_-_Ruska_Kapela_(41627950121).jpg',
  },
  kluzhe: {
    src: '/soci/photos/kluzhe.jpg',
    alt: 'Pevnost Kluže — austro-uherská pevnost v soutěsce Učja',
    author: 'Johann Jaritz',
    license: 'CC BY-SA 4.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Bovec_Klu%C5%BEe_Flitscher_Klause_West-Seite_10032015_0609.jpg',
  },
  bovec: {
    src: '/soci/photos/bovec.jpg',
    alt: 'Bovec v údolí Soče — základna výpravy',
    author: 'Tiia Monto',
    license: 'CC BY-SA 3.0',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_panorama_in_Bovec.jpg',
  },
};

export default function SociPage() {
  return (
    <>
      {/* Hero — full-bleed, bez atlas-column */}
      <Hero />

      {/* Sticky nav */}
      <AnchorNav />

      {/* Hlavní čtecí sloupec */}
      <div className="atlas-column" style={{ paddingTop: 32, paddingBottom: 64 }}>

        {/* Foto Soča hned pod navem */}
        <SectionPhoto {...PHOTOS.soca} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 48, marginTop: 40 }}>

          <TransportSection />
          <HowItWorksSection />

          {/* Bovec panorama */}
          <SectionPhoto {...PHOTOS.bovec} />

          {/* Mapa */}
          <Section id="mapa" title="Mapa — Bovec a okolí" kicker="GPS · Všechny body výpravy">
            <GuideMapDynamic />
          </Section>

          <BasecampPlanSection />

          {/* Vršič galerie */}
          <PhotoStrip
            photos={[
              { src: PHOTOS.vrsic.src, alt: PHOTOS.vrsic.alt, title: 'Vršič 1611 m', sub: 'Julské Alpy' },
              { src: PHOTOS.pramen.src, alt: PHOTOS.pramen.alt, title: 'Pramen Soče', sub: 'Ferrata A/B' },
              { src: PHOTOS.ruskaKaple.src, alt: PHOTOS.ruskaKaple.alt, title: 'Ruská kaple', sub: '1917' },
              { src: PHOTOS.kluzhe.src, alt: PHOTOS.kluzhe.alt, title: 'Pevnost Kluže', sub: 'WW1 Isonzo' },
            ]}
          />

          <RaftingSection />

          <DayTripsSection />

          {/* Vodopády galerie */}
          <PhotoStrip
            photos={[
              { src: PHOTOS.boka.src, alt: PHOTOS.boka.alt, title: 'Slap Boka', sub: '~106 m' },
              { src: PHOTOS.virje.src, alt: PHOTOS.virje.alt, title: 'Slap Virje', sub: 'Laguna' },
              { src: PHOTOS.velikaKorita.src, alt: PHOTOS.velikaKorita.alt, title: 'Velika korita', sub: 'Soča Trail' },
              { src: PHOTOS.rafting.src, alt: PHOTOS.rafting.alt, title: 'Rafting Soča', sub: 'WW II–III' },
            ]}
          />

          <AccommodationSection />
          <BudgetSection />
          <LogisticsSection />
          <ReservationChecklist />
          <GearChecklist />
          <SafetyExtrasSection />
          <ContactsSection />

        </div>

        <footer className="atlas-footer">
          OPERATION SOČA · Bovec basecamp · 4.–11. 7. 2026 · good-inventions.work
        </footer>
      </div>
    </>
  );
}
