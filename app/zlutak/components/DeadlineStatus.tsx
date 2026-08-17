'use client';

import { useEffect, useState, type ReactElement } from 'react';

const DEADLINE = new Date(2026, 7, 25); // 25. 8. 2026

function formatCzechDate(d: Date): string {
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function DeadlineStatus() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) {
    return <span className="z-deadline-status">Načítám dnešní datum…</span>;
  }

  const daysLeft = Math.round(
    (startOfDay(DEADLINE).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24),
  );

  let countdown: ReactElement;
  if (daysLeft > 7) {
    countdown = <span>zbývá {daysLeft} dní</span>;
  } else if (daysLeft >= 0) {
    countdown = <span className="z-deadline-urgent">zbývá {daysLeft} dní</span>;
  } else {
    countdown = <span className="z-deadline-urgent">termín prošel</span>;
  }

  return (
    <span className="z-deadline-status">
      Dnes je {formatCzechDate(now)} — {countdown}.
    </span>
  );
}
