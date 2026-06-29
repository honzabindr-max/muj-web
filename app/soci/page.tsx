import { AnchorNav } from './components/AnchorNav';
import { BudgetSection } from './components/BudgetSection';
import { GearChecklist } from './components/GearChecklist';
import { GuideMapDynamic } from './components/GuideMapDynamic';
import { Hero } from './components/Hero';
import { ItinerarySection } from './components/ItinerarySection';
import { RaftingPermitSection } from './components/RaftingPermitSection';
import { ReservationChecklist } from './components/ReservationChecklist';
import { RisksContactsSection } from './components/RisksContactsSection';
import { Section } from './components/Section';
import { TransportSection } from './components/TransportSection';

export const metadata = {
  title: 'Soča Classic — průvodce výletem 2026',
  description:
    'Kompletní cestovní průvodce výletem Soča Classic: alpský trek, smaragdová Soča, rafting. 4.–11. 7. 2026, bez auta.',
};

export default function SociPage() {
  return (
    <div className="min-h-screen bg-slate-50" style={{ scrollBehavior: 'smooth' }}>
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <Hero />
        <AnchorNav />

        <div className="mt-8 space-y-12">
          <Section id="mapa" title="Mapa trasy">
            <GuideMapDynamic />
          </Section>

          <ItinerarySection />
          <TransportSection />
          <ReservationChecklist />
          <RaftingPermitSection />
          <BudgetSection />
          <RisksContactsSection />
          <GearChecklist />
        </div>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          Soča Classic · 4.–11. 7. 2026 · good-inventions.work
        </footer>
      </div>
    </div>
  );
}
