'use client';

import { useEffect, useMemo, useState } from 'react';
import { DAYS } from '../data';
import type { DayPlan } from '../types';
import { StepRow } from './StepRow';
import { HeroBox } from './PhotoBox';

function parseStepMinutes(time: string): number | null {
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SectionList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant?: 'planb';
}) {
  if (items.length === 0) return null;
  return (
    <div className={`raj-section${variant === 'planb' ? ' raj-section--planb' : ''}`}>
      <h3 className="raj-section__title">{title}</h3>
      <ul className="raj-section__list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function DayApp() {
  const [selectedId, setSelectedId] = useState<DayPlan['id']>(DAYS[0].id);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const [hasAutoDetected, setHasAutoDetected] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
      if (!hasAutoDetected) {
        const todayStr = localDateString(now);
        const match = DAYS.find((d) => d.date === todayStr);
        if (match) setSelectedId(match.id);
        setHasAutoDetected(true);
      }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const day = useMemo(() => DAYS.find((d) => d.id === selectedId) ?? DAYS[0], [selectedId]);
  const isToday = day.date === (nowMinutes !== null ? localDateString(new Date()) : '');

  const stepStatus = useMemo(() => {
    if (nowMinutes === null || !isToday) {
      return { pastIds: new Set<string>(), nextId: null as string | null };
    }
    const pastIds = new Set<string>();
    let nextId: string | null = null;
    for (const step of day.steps) {
      const mins = parseStepMinutes(step.time);
      if (mins === null) continue;
      if (mins < nowMinutes) {
        pastIds.add(step.id);
      } else if (nextId === null) {
        nextId = step.id;
      }
    }
    return { pastIds, nextId };
  }, [day, nowMinutes, isToday]);

  const nextStep = day.steps.find((s) => s.id === stepStatus.nextId) ?? null;

  function scrollToNext() {
    if (!nextStep) return;
    document.getElementById(nextStep.id)?.scrollIntoView({ block: 'center' });
  }

  return (
    <>
      <nav className="raj-switcher" aria-label="Výběr dne">
        {DAYS.map((d) => (
          <button
            key={d.id}
            type="button"
            className="raj-switcher__btn"
            data-active={d.id === selectedId}
            onClick={() => setSelectedId(d.id)}
          >
            {d.shortLabel}
            {d.date === (nowMinutes !== null ? localDateString(new Date()) : '') && (
              <span className="raj-switcher__today">dnes</span>
            )}
          </button>
        ))}
      </nav>

      <div className="raj-day-head">
        <h1 className="raj-day-head__title">{day.title}</h1>
        <div className="raj-day-head__meta">{day.stats}</div>
        <span className="raj-day-head__badge">{day.difficulty}</span>
      </div>

      <HeroBox photo={day.heroPhoto} name={day.title} eager={isToday} />

      <a className="raj-quicklink" href="#kdyz-se-neco-pokazi">
        🚨 Když se něco pokazí
      </a>

      <div className="raj-timeline">
        {day.steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            isPast={stepStatus.pastIds.has(step.id)}
            isNext={stepStatus.nextId === step.id}
          />
        ))}
      </div>

      <SectionList title="Doprava" items={day.doprava} />
      <SectionList title="Trek" items={day.trek} />
      <SectionList title="Jídlo" items={day.jidlo} />
      <SectionList title="Voda" items={day.voda} />
      <SectionList title="Ubytování" items={day.ubytovani} />
      <SectionList title="Plan B" items={day.planB} variant="planb" />

      {isToday && nextStep && (
        <button type="button" className="raj-sticky" onClick={scrollToNext}>
          <span>
            <span className="raj-sticky__label">Další krok</span>
            <div className="raj-sticky__place">{nextStep.place}</div>
          </span>
          <span className="raj-sticky__time">{nextStep.time}</span>
        </button>
      )}
    </>
  );
}
