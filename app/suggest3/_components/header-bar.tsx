import { MONO } from "./glass";

const p2 = (x: number) => String(x).padStart(2, "0");

export function HeaderBar({
  now,
  runningCount,
  countdown,
  countdownMax,
}: {
  now: Date;
  runningCount: number;
  countdown: number;
  countdownMax: number;
}) {
  const timeStr = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  const ringLen = 2 * Math.PI * 9;
  const ringOff = ringLen * (1 - countdown / countdownMax);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "rgba(255,255,255,.55)",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        borderBottom: "1px solid rgba(255,255,255,.6)",
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          margin: "0 auto",
          padding: "13px 24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#16a34a",
              animation: "s3livepulse 1.6s infinite",
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em" }}>Sběr dat</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "#16a34a",
              background: "rgba(22,163,74,.10)",
              padding: "3px 7px",
              borderRadius: 5,
            }}
          >
            LIVE
          </span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6c716e" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
          Běží · {runningCount} trhů
        </div>
        <div style={{ width: 1, height: 18, background: "#e4e6e4" }} />
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          {timeStr}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 22, height: 22 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="11" cy="11" r="9" fill="none" stroke="#e4e6e4" strokeWidth="2.5" />
              <circle
                cx="11"
                cy="11"
                r="9"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={ringLen.toFixed(1)}
                strokeDashoffset={ringOff.toFixed(1)}
              />
            </svg>
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              {countdown}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#9aa09c" }}>do obnovy</span>
        </div>
      </div>
    </header>
  );
}
