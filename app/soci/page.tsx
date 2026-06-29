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
import { RaftingSection } from './components/RaftingSection';
import { ReservationChecklist } from './components/ReservationChecklist';
import { Section } from './components/Section';
import { TransportSection } from './components/TransportSection';

export const metadata = {
  title: 'Soča Classic — Bovec basecamp 2026',
  description:
    'Kompletní průvodce: jedna základna v Bovci, denní výlety nalehko — rafting, canyoning, vodopády, Vršič, Soča Trail. 4.–11. 7. 2026, bez auta.',
};

export default function SociPage() {
  return (
    <div className="min-h-screen bg-slate-50" style={{ scrollBehavior: 'smooth' }}>
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <Hero />
        <AnchorNav />

        <div className="mt-8 space-y-12">
          <TransportSection />
          <HowItWorksSection />

          <Section id="mapa" title="Mapa — Bovec a okolí">
            <GuideMapDynamic />
          </Section>

          <BasecampPlanSection />
          <RaftingSection />
          <DayTripsSection />
          <AccommodationSection />
          <BudgetSection />
          <ReservationChecklist />
          <GearChecklist />
          <ContactsSection />
        </div>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          Soča Classic · Bovec basecamp · 4.–11. 7. 2026 · good-inventions.work
        </footer>
      </div>
    </div>
  );
}
