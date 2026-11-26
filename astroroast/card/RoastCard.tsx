// Karta roastu: "story" 1080×1920 a "og" 1200×630. Na kartě je jen znamení, úroveň a text (žádné datum).
import type { Roast } from "@/astroroast/types";
import { LEVEL_NAMES } from "@/astroroast/types";
import { BurnBar, Footer, SignDisc, Sticker, SpiceMeter, Wordmark } from "./parts";
import { Stars } from "./Stars";
import { C, FONT, GRAIN_BG, LEVEL_ACCENT, SIGN_NAME, bold, clamp, fit } from "./theme";

export type CardFormat = "story" | "og";
export const CARD_SIZE: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
};

export function RoastCard({ roast, format }: { roast: Roast; format: CardFormat }) {
  return format === "story" ? <Story roast={roast} /> : <Og roast={roast} />;
}

function Story({ roast }: { roast: Roast }) {
  const { width: W, height: H } = CARD_SIZE.story;
  const { level } = roast.input;
  const accent = LEVEL_ACCENT[level];
  const name = SIGN_NAME[roast.input.sign];
  const head = clamp(roast.headline, 95);
  const hs = fit(head.length, [[30, 96], [55, 80], [75, 68]], 58);
  const nLines = head.length > 75 ? 2 : 3;
  const notes = roast.lines.slice(0, nLines);
  const stats = roast.stats.slice(0, 2);
  const lvlLabel = `${level}/5 · ${LEVEL_NAMES[level]}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: 64, gap: 22, background: GRAIN_BG, fontFamily: FONT, color: C.cream }}>
      <Stars W={W} H={H} scale={1.6} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={58} />
        <Sticker bg={accent} size={34} pad={12} rotate={3}>{lvlLabel}</Sticker>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <SignDisc name={name} d={250} accent={accent} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,246,233,0.8)" }}>Pálivost</div>
          <SpiceMeter level={level} size={96} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: hs,
          lineHeight: 1.06,
          color: C.cream,
          textShadow: bold(C.cream, hs * 0.018, `${hs * 0.07}px ${hs * 0.07}px 0 ${C.pink}`),
        }}
      >
        {head}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 18, overflow: "hidden", justifyContent: "center" }}>
        {notes.map((t, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexShrink: 0,
              background: i === 1 ? C.lime : C.cream,
              color: C.space,
              fontSize: 38,
              lineHeight: 1.2,
              padding: "20px 28px",
              borderRadius: 22,
              border: `5px solid ${C.space}`,
              boxShadow: `9px 9px 0 ${i === 1 ? C.pink : C.violet}`,
              transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)`,
            }}
          >
            {clamp(t, 160)}
          </div>
        ))}
      </div>

      {stats.length > 0 && (
        <div style={{ display: "flex", gap: 20 }}>
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "14px 22px",
                borderRadius: 20,
                border: `4px solid ${C.cream}`,
                background: "rgba(123,92,255,0.25)",
              }}
            >
              <div style={{ display: "flex", fontSize: 26, color: "rgba(255,246,233,0.85)" }}>{clamp(s.label, 34)}</div>
              <div style={{ display: "flex", fontSize: 52, color: C.lime, textShadow: bold(C.lime, 1.4) }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <BurnBar burn={roast.burn} width={W - 128} height={34} label="Míra spálení" />

      <div style={{ display: "flex" }}>
        <Sticker bg={C.lime} size={36} pad={16} rotate={-1.5} shadow={C.pink}>
          <div style={{ display: "flex", textTransform: "none", letterSpacing: 0, fontSize: 38, lineHeight: 1.15 }}>{clamp(roast.verdict, 110)}</div>
        </Sticker>
      </div>

      <Footer size={25} />
    </div>
  );
}

function Og({ roast }: { roast: Roast }) {
  const { width: W, height: H } = CARD_SIZE.og;
  const { level } = roast.input;
  const accent = LEVEL_ACCENT[level];
  const name = SIGN_NAME[roast.input.sign];
  const head = clamp(roast.headline, 95);
  const hs = fit(head.length, [[30, 84], [60, 68], [95, 58]], 50);

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: 40, gap: 18, background: GRAIN_BG, fontFamily: FONT, color: C.cream }}>
      <Stars W={W} H={H} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={44} />
        <Sticker bg={accent} size={26} pad={8} rotate={2}>{`${level}/5 · ${LEVEL_NAMES[level]}`}</Sticker>
      </div>

      <div style={{ display: "flex", flex: 1, gap: 44, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: 270 }}>
          <SignDisc name={name} d={250} accent={accent} />
          <SpiceMeter level={level} size={64} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: hs,
              lineHeight: 1.06,
              textShadow: bold(C.cream, hs * 0.018, `${hs * 0.06}px ${hs * 0.06}px 0 ${C.pink}`),
            }}
          >
            {head}
          </div>
          <BurnBar burn={roast.burn} width={700} height={26} label="Míra spálení" />
        </div>
      </div>

      <Footer size={20} />
    </div>
  );
}
