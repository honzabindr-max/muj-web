import { DAYS } from '../data';
import { DayCard } from './DayCard';
import { Section } from './Section';

export function ItinerarySection() {
  return (
    <Section id="itinerar" title="Itinerář — 7 dní">
      <div className="flex flex-col gap-3">
        {DAYS.map((day) => (
          <DayCard key={day.day} day={day} />
        ))}
      </div>
    </Section>
  );
}
