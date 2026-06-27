// TODO produkce: tahat z webu
export const TISNOV_COORDS = { lat: 49.3487, lon: 16.4258 };

const SEASON = { startMonth: 6, endMonth: 8 }; // June–August

// 0=Sun, 1=Mon, ..., 6=Sat
const HOURS: Record<number, { open: number; close: number }> = {
  0: { open: 9, close: 20 }, // Sunday
  1: { open: 9, close: 20 }, // Monday
  2: { open: 9, close: 20 }, // Tuesday
  3: { open: 9, close: 20 }, // Wednesday
  4: { open: 9, close: 20 }, // Thursday
  5: { open: 9, close: 21 }, // Friday
  6: { open: 9, close: 21 }, // Saturday
};

export type PragueTime = {
  month: number;   // 1–12
  day: number;
  hour: number;    // 0–23
  minute: number;
  weekday: number; // 0=Sun, 1=Mon, …, 6=Sat
};

export function getPragueTime(now: Date): PragueTime {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "0";
  const hour = parseInt(p("hour"));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    month: parseInt(p("month")),
    day: parseInt(p("day")),
    hour: hour === 24 ? 0 : hour,
    minute: parseInt(p("minute")),
    weekday: weekdayMap[p("weekday")] ?? 0,
  };
}

export type OpenState =
  | { kind: "off_season" }
  | { kind: "closed" }
  | { kind: "open"; closeHour: number; minutesLeft: number };

export function getOpenState(t: PragueTime): OpenState {
  if (t.month < SEASON.startMonth || t.month > SEASON.endMonth) {
    return { kind: "off_season" };
  }
  const hours = HOURS[t.weekday];
  const currentMin = t.hour * 60 + t.minute;
  const openMin = hours.open * 60;
  const closeMin = hours.close * 60;
  if (currentMin < openMin || currentMin >= closeMin) {
    return { kind: "closed" };
  }
  return {
    kind: "open",
    closeHour: hours.close,
    minutesLeft: closeMin - currentMin,
  };
}

export function formatTimeLeft(minutesLeft: number): string {
  if (minutesLeft <= 0) return "právě zavírá";
  if (minutesLeft < 60) return `zbývá ${minutesLeft} min`;
  const hours = minutesLeft / 60;
  if (Number.isInteger(hours)) return `zbývá ${hours} h`;
  return `zbývá ${hours.toFixed(1).replace(".", ",")} h`;
}
