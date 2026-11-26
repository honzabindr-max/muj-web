// Statická značková karta 1200×630 pro /astroroast (a jako záloha při neplatném kódu).
import { Footer, Pepper, Sticker, Wordmark } from "./parts";
import { Stars } from "./Stars";
import { CARD_SIZE } from "./RoastCard";
import { C, FONT, GRAIN_BG, LEVEL_ACCENT, bold } from "./theme";
import type { Level } from "@/astroroast/types";

export function BrandCard() {
  const { width: W, height: H } = CARD_SIZE.og;
  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: 44, gap: 14, background: GRAIN_BG, fontFamily: FONT, color: C.cream }}>
      <Stars W={W} H={H} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={54} />
        <Sticker bg={C.lime} size={26} pad={9} rotate={3} shadow={C.pink}>Zdarma · bez registrace</Sticker>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 26 }}>
        <div style={{ display: "flex", fontSize: 124, lineHeight: 1.02, textShadow: bold(C.cream, 2.4, `8px 8px 0 ${C.pink}`) }}>
          Hvězdy tě nešetří.
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            {([1, 2, 3, 4, 5] as Level[]).map((i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Pepper size={64 + i * 9} on accent={LEVEL_ACCENT[i]} />
                <div style={{ display: "flex", fontSize: 24, color: LEVEL_ACCENT[i] }}>{String(i)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
            <div style={{ display: "flex", fontSize: 40, color: C.lime, textShadow: bold(C.lime, 1) }}>Roast tvého znamení.</div>
            <div style={{ display: "flex", fontSize: 28, color: "rgba(255,246,233,0.8)" }}>The stars have jokes.</div>
          </div>
        </div>
      </div>

      <Footer size={20} />
    </div>
  );
}
