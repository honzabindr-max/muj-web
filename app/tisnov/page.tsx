import type { Metadata } from "next";
import { getPragueTime, getOpenState, formatTimeLeft } from "@/lib/tisnov-config";
import { getVerdict } from "@/lib/tisnov-verdict";
import { ShareButton } from "./ShareButton";

export const metadata: Metadata = {
  title: "Koupák Tišnov dnes",
  description: "Má cenu jet na koupaliště v Tišnově? Jedním pohledem.",
};

export const revalidate = 600;

type WeatherData = {
  temperature: number;
  precipitation: number;
  windspeed: number;
  weathercode: number;
  uvIndex: number;
  tempMax: number;
  rainProbability: number;
};

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast" +
        "?latitude=49.3487&longitude=16.4258" +
        "&current=temperature_2m,precipitation,windspeed_10m,weathercode,uv_index" +
        "&daily=temperature_2m_max,precipitation_probability_max" +
        "&timezone=Europe%2FPrague&forecast_days=1",
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      temperature: d.current.temperature_2m,
      precipitation: d.current.precipitation,
      windspeed: d.current.windspeed_10m,
      weathercode: d.current.weathercode,
      uvIndex: d.current.uv_index,
      tempMax: d.daily.temperature_2m_max[0],
      rainProbability: d.daily.precipitation_probability_max[0],
    };
  } catch {
    return null;
  }
}

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 65) return "🌧️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

const BG: Record<"green" | "orange" | "gray", string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  gray: "bg-zinc-600",
};

export default async function TisnovPage() {
  const weather = await fetchWeather();
  const now = new Date();
  const t = getPragueTime(now);
  const openState = getOpenState(t);
  const verdict = getVerdict(
    openState,
    weather
      ? {
          temperature: weather.temperature,
          weathercode: weather.weathercode,
          precipitation: weather.precipitation,
          windspeed: weather.windspeed,
        }
      : null,
  );

  const updatedAt = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;

  return (
    <main
      className={`${BG[verdict.color]} min-h-screen flex flex-col px-5 pt-10 pb-8 select-none`}
    >
      {/* Label */}
      <p className="text-white/60 text-xs font-semibold tracking-widest uppercase">
        Koupák Tišnov
      </p>

      {/* Verdict */}
      <div className="mt-6 flex-1">
        <div className="flex items-center gap-3">
          {weather && (
            <span className="text-5xl leading-none" aria-hidden>
              {weatherEmoji(weather.weathercode)}
            </span>
          )}
          <h1 className="text-white font-black text-6xl leading-none tracking-tight">
            {verdict.label}
          </h1>
        </div>
        <p className="text-white/90 text-lg mt-3 leading-snug">
          {verdict.reason}
        </p>
      </div>

      {/* Open status */}
      <div className="mt-5">
        {openState.kind === "open" && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full">
              Otevřeno do {openState.closeHour}:00
            </span>
            <span className="text-white/80 text-sm font-medium">
              {formatTimeLeft(openState.minutesLeft)}
            </span>
          </div>
        )}
        {openState.kind === "closed" && (
          <span className="bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full">
            Dnes zavřeno
          </span>
        )}
        {openState.kind === "off_season" && (
          <span className="bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full">
            Mimo sezónu · otevírá v červnu
          </span>
        )}
      </div>

      {/* Weather card */}
      <div className="mt-5">
        {weather ? (
          <div className="bg-white/15 rounded-2xl p-4">
            <div className="grid grid-cols-5 gap-1 text-center">
              <WeatherStat
                icon="🌡️"
                value={`${Math.round(weather.temperature)}°`}
                label="teď"
              />
              <WeatherStat
                icon="📈"
                value={`${Math.round(weather.tempMax)}°`}
                label="max"
              />
              <WeatherStat
                icon="🌧️"
                value={`${weather.rainProbability}%`}
                label="déšť"
              />
              <WeatherStat
                icon="💨"
                value={`${Math.round(weather.windspeed)}`}
                label="km/h"
              />
              <WeatherStat
                icon="🔆"
                value={`${Math.round(weather.uvIndex)}`}
                label="UV"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-white/60 text-sm">
              ⚠️ Data ze záznamu – počasí není k dispozici
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex gap-3">
        <a
          href="https://www.google.com/maps/dir/?api=1&destination=49.3487,16.4258"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-white text-zinc-900 font-semibold py-4 rounded-2xl text-base text-center active:scale-95 transition-transform"
        >
          Navigovat
        </a>
        <ShareButton
          title="Koupák Tišnov dnes"
          text={`${verdict.label} – ${verdict.reason}`}
          url="https://good-inventions.work/tisnov"
        />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <a
          href="https://www.tisnov.cz/koupaliste"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/60 text-sm underline underline-offset-2"
        >
          📷 Mrknout na kameru
        </a>
        <span className="text-white/50 text-xs">Aktualizováno {updatedAt}</span>
      </div>
    </main>
  );
}

function WeatherStat({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <span className="text-white font-bold text-base leading-tight">{value}</span>
      <span className="text-white/50 text-xs">{label}</span>
    </div>
  );
}
