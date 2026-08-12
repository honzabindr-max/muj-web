import { DayApp } from './components/DayApp';
import { EmergencySection } from './components/EmergencySection';
import { ShoppingList } from './components/ShoppingList';
import { PhotoCredits } from './components/PhotoCredits';
import { OpeningHero } from './components/OpeningHero';
import { WifiBanner } from './components/WifiBanner';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import { LightboxProvider } from './components/LightboxProvider';
import { MISSION, PHOTOS } from './data';

export const metadata = {
  title: 'Český ráj 13.–15. 8. 2026 — operační dashboard',
  description:
    'Třídenní trek Český ráj: Hruboskalsko → Trosky → Věžák → Prachov. ' +
    'Časy, spoje, přestupy, trasa a plán B — funguje bez signálu.',
};

export default function CeskyRaj2026Page() {
  return (
    <LightboxProvider>
      <ServiceWorkerRegister />
      <WifiBanner />

      <OpeningHero
        photo={PHOTOS.masthead}
        title={MISSION.title}
        dates={MISSION.dates}
        summary={MISSION.summary}
        route={MISSION.route}
      />

      <header className="raj-header">
        <div className="raj-header__title">
          {MISSION.title} · {MISSION.dates} · {MISSION.summary}
        </div>
        <div className="raj-header__route">{MISSION.route}</div>
      </header>

      <DayApp />

      <EmergencySection />
      <ShoppingList />
      <PhotoCredits />
    </LightboxProvider>
  );
}
