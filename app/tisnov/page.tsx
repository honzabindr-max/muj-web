import type { Metadata } from "next";
import { getPragueTime, getOpenState, formatTimeLeft } from "@/lib/tisnov-config";
import { getVerdict } from "@/lib/tisnov-verdict";
import { CausticsCanvas } from "./components/CausticsCanvas";
import { TempCounter } from "./components/TempCounter";
import { ShareButton } from "./ShareButton";
import "./tisnov.css";

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

// Caustic light colors + water base — keyed by verdict + time of day
function getCausticsTheme(
  color: "green" | "orange" | "gray",
  hour: number,
): { base: string; c1: string; c2: string; c3: string } {
  const isGolden = (hour >= 6 && hour < 10) || (hour >= 17 && hour < 21);
  const isNight = hour >= 22 || hour < 5;

  if (color === "green") {
    if (isNight)
      return {
        base: "#010e1a",
        c1: "rgba(0,140,200,0.65)",
        c2: "rgba(30,170,180,0.45)",
        c3: "rgba(60,160,220,0.50)",
      };
    if (isGolden)
      return {
        base: "#021a2c",
        c1: "rgba(0,210,255,0.70)",
        c2: "rgba(255,200,60,0.38)",
        c3: "rgba(80,230,210,0.52)",
      };
    return {
      base: "#021d30",
      c1: "rgba(0,210,255,0.72)",
      c2: "rgba(50,245,215,0.50)",
      c3: "rgba(100,225,255,0.55)",
    };
  }

  if (color === "orange") {
    if (isNight)
      return {
        base: "#050e18",
        c1: "rgba(0,110,170,0.60)",
        c2: "rgba(20,140,160,0.42)",
        c3: "rgba(30,130,190,0.48)",
      };
    if (isGolden)
      return {
        base: "#061520",
        c1: "rgba(0,165,210,0.62)",
        c2: "rgba(255,170,50,0.33)",
        c3: "rgba(30,175,190,0.48)",
      };
    return {
      base: "#051a28",
      c1: "rgba(0,170,215,0.63)",
      c2: "rgba(25,190,178,0.46)",
      c3: "rgba(45,178,215,0.51)",
    };
  }

  // gray (NE)
  return {
    base: isNight ? "#04090f" : "#080e17",
    c1: "rgba(30,90,145,0.55)",
    c2: "rgba(20,72,125,0.45)",
    c3: "rgba(42,82,135,0.40)",
  };
}

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

  const theme = getCausticsTheme(verdict.color, t.hour);
  const updatedAt = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;

  return (
    <div className="t-page" style={{ background: theme.base } as React.CSSProperties}>
      {/* Animated caustics background */}
      <CausticsCanvas c1={theme.c1} c2={theme.c2} c3={theme.c3} />

      {/* Content */}
      <div className="t-content">
        {/* Header */}
        <div className="t-header">
          <span className="t-label">Koupák Tišnov</span>
          <span className="t-badge">
            {openState.kind === "open" && (
              <span className="t-badge-dot t-badge-dot--open" aria-hidden />
            )}
            {openState.kind === "closed" && (
              <span className="t-badge-dot t-badge-dot--closed" aria-hidden />
            )}
            {openState.kind === "off_season" && (
              <span className="t-badge-dot t-badge-dot--off" aria-hidden />
            )}
            {openState.kind === "open" && `Otevřeno do ${openState.closeHour}:00`}
            {openState.kind === "closed" && "Dnes zavřeno"}
            {openState.kind === "off_season" && "Mimo sezónu"}
          </span>
        </div>

        {/* Verdict */}
        <div className="t-verdict-section">
          <h1 className="t-verdict-label">{verdict.label}</h1>
          <p className="t-verdict-reason">{verdict.reason}</p>
        </div>

        {/* Spacer — caustics show through */}
        <div className="t-spacer" />

        {/* Bottom section */}
        <div className="t-bottom">
          {/* Time remaining pill */}
          {openState.kind === "open" && (
            <div className="t-open-pill">
              <span className="t-open-pill-dot" aria-hidden />
              {formatTimeLeft(openState.minutesLeft)}
            </div>
          )}

          {/* Weather chips */}
          {weather ? (
            <div className="t-chips">
              <div className="t-chip">
                <span className="t-chip-icon" aria-hidden>🌡️</span>
                <span className="t-chip-value">
                  <TempCounter target={Math.round(weather.temperature)} />°
                </span>
                <span className="t-chip-label">teď</span>
              </div>
              <div className="t-chip">
                <span className="t-chip-icon" aria-hidden>📈</span>
                <span className="t-chip-value">{Math.round(weather.tempMax)}°</span>
                <span className="t-chip-label">max</span>
              </div>
              <div className="t-chip">
                <span className="t-chip-icon" aria-hidden>🌧️</span>
                <span className="t-chip-value">{weather.rainProbability}%</span>
                <span className="t-chip-label">déšť</span>
              </div>
              <div className="t-chip">
                <span className="t-chip-icon" aria-hidden>💨</span>
                <span className="t-chip-value">{Math.round(weather.windspeed)}</span>
                <span className="t-chip-label">km/h</span>
              </div>
              <div className="t-chip">
                <span className="t-chip-icon" aria-hidden>🔆</span>
                <span className="t-chip-value">{Math.round(weather.uvIndex)}</span>
                <span className="t-chip-label">UV</span>
              </div>
            </div>
          ) : (
            <div className="t-stale">
              ⚠️ Data ze záznamu – počasí není k dispozici
            </div>
          )}

          {/* Buttons */}
          <div className="t-actions">
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=49.3487,16.4258"
              target="_blank"
              rel="noopener noreferrer"
              className="t-btn-nav"
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
          <div className="t-footer">
            <a
              href="https://www.tisnov.cz/koupaliste"
              target="_blank"
              rel="noopener noreferrer"
              className="t-footer-camera"
            >
              📷 Mrknout na kameru
            </a>
            <span className="t-footer-time">Aktualizováno {updatedAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
