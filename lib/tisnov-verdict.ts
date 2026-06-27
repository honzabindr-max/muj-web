import type { OpenState } from "./tisnov-config";

export type WeatherInput = {
  temperature: number;
  weathercode: number;
  precipitation: number;
  windspeed: number;
};

export type Verdict = {
  label: "BĚŽ TEĎ" | "SPÍŠ JO" | "NE";
  color: "green" | "orange" | "gray";
  reason: string;
};

const THUNDERSTORM = [95, 96, 99];
const HEAVY_RAIN = [65, 67, 82];
const OVERCAST = [3];

export function getVerdict(openState: OpenState, weather: WeatherInput | null): Verdict {
  if (openState.kind === "off_season") {
    return {
      label: "NE",
      color: "gray",
      reason: "Mimo sezónu. Otevírá se zase v červnu.",
    };
  }

  if (openState.kind === "closed") {
    return {
      label: "NE",
      color: "gray",
      reason: "Koupaliště je teď zavřené.",
    };
  }

  // Pool is open
  if (!weather) {
    return {
      label: "SPÍŠ JO",
      color: "orange",
      reason: "Data o počasí nejsou dostupná – ověř předpověď před odjezdem.",
    };
  }

  const { temperature, weathercode, precipitation } = weather;
  const { minutesLeft, closeHour } = openState;
  const hoursLeft = minutesLeft / 60;

  if (THUNDERSTORM.includes(weathercode)) {
    return {
      label: "NE",
      color: "gray",
      reason: "Hrozí bouřka – koupaliště může být uzavřeno.",
    };
  }

  if (HEAVY_RAIN.includes(weathercode) || precipitation > 2) {
    return {
      label: "NE",
      color: "gray",
      reason: `Silný déšť (${precipitation.toFixed(1)} mm/h) – nevyplatí se.`,
    };
  }

  if (temperature < 18) {
    return {
      label: "NE",
      color: "gray",
      reason: `Jen ${Math.round(temperature)}°C – pod 18°C nemá cenu tam jet.`,
    };
  }

  const isOvercast = OVERCAST.includes(weathercode);
  const isWarm = temperature >= 22;
  const hasTime = hoursLeft >= 2;

  if (isWarm && !isOvercast && hasTime) {
    return {
      label: "BĚŽ TEĎ",
      color: "green",
      reason: `${Math.round(temperature)}°C, jasno a do ${closeHour}:00 zbývají víc než 2 hodiny.`,
    };
  }

  // SPÍŠ JO — identify the limiting factor
  if (!hasTime) {
    const h = Math.floor(hoursLeft);
    const m = Math.round((hoursLeft % 1) * 60);
    const tStr = h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ""}` : `${minutesLeft} min`;
    return {
      label: "SPÍŠ JO",
      color: "orange",
      reason: `Zavírá v ${closeHour}:00, zbývá jen ${tStr} – nestihneš moc.`,
    };
  }

  if (temperature < 22) {
    return {
      label: "SPÍŠ JO",
      color: "orange",
      reason: `${Math.round(temperature)}°C – trochu chladnější, ale plavat se dá.`,
    };
  }

  if (isOvercast) {
    return {
      label: "SPÍŠ JO",
      color: "orange",
      reason: `Zataženo při ${Math.round(temperature)}°C – záleží na tobě.`,
    };
  }

  return {
    label: "SPÍŠ JO",
    color: "orange",
    reason: "Podmínky jsou ok, ale ne ideální.",
  };
}
