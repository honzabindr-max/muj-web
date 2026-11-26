// Karta párového roastu: "story" 1080×1920 a "og" 1200×630. Jen dvě znamení a fiktivní kompatibilita.
import type { CoupleRoast } from "@/astroroast/types";
import { BurnBar, Footer, SignDisc, Sticker, Wordmark } from "./parts";
import { Stars } from "./Stars";
import { CARD_SIZE, type CardFormat } from "./RoastCard";
import { C, FONT, GRAIN_BG, SIGN_NAME, bold, clamp, fit } from "./theme";

export function CoupleCard({ couple, format }: { couple: CoupleRoast; format: CardFormat }) {
  return format === "story" ? <Story couple={couple} /> : <Og couple={couple} />;
}

function Pair({ a, b, d, fs }: { a: string; b: string; d: number; fs: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: d * 0.12 }}>
      <SignDisc name={a} d={d} accent={C.pink} />
      <div style={{ display: "flex", fontSize: fs, color: C.lime, textShadow: bold(C.lime, fs * 0.03) }}>×</div>
      <SignDisc name={b} d={d} accent={C.violet} />
    </div>
  );
}

function Story({ couple }: { couple: CoupleRoast }) {
  const { width: W, height: H } = CARD_SIZE.story;
  const A = SIGN_NAME[couple.a];
  const B = SIGN_NAME[couple.b];
  const title = clamp(couple.title, 80);
  const ts = fit(title.length, [[28, 84], [50, 70]], 58);
  const scene = couple.scene.slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: "64px 64px 52px", gap: 20, background: GRAIN_BG, fontFamily: FONT, color: C.cream }}>
      <Stars W={W} H={H} scale={1.6} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={58} />
        <Sticker bg={C.pink} color={C.cream} size={34} pad={12} rotate={3}>Astro Battle</Sticker>
      </div>

      <Pair a={A} b={B} d={290} fs={110} />

      <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontSize: ts, lineHeight: 1.06, textShadow: bold(C.cream, ts * 0.018, `${ts * 0.07}px ${ts * 0.07}px 0 ${C.pink}`) }}>
        {title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14, overflow: "hidden" }}>
        {scene.map((l, i) => {
          const isNarr = l.who === "narrator";
          const isA = l.who === "a";
          const label = isNarr ? "Vypravěč hvězd" : isA ? A : B;
          return (
            <div key={i} style={{ display: "flex", flexShrink: 0, justifyContent: isNarr ? "center" : isA ? "flex-start" : "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  maxWidth: isNarr ? 900 : 780,
                  padding: "12px 24px",
                  borderRadius: 24,
                  border: `4px solid ${C.space}`,
                  background: isNarr ? "rgba(255,246,233,0.14)" : isA ? C.pink : C.cream,
                  color: isNarr ? C.cream : C.space,
                  boxShadow: isNarr ? "none" : `7px 7px 0 ${isA ? C.violet : C.lime}`,
                  fontSize: 31,
                  lineHeight: 1.18,
                }}
              >
                <div style={{ display: "flex", fontSize: 22, textTransform: "uppercase", letterSpacing: 2, opacity: 0.75 }}>{label}</div>
                <div style={{ display: "flex" }}>{clamp(l.text, 120)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 120, lineHeight: 1, color: C.lime, textShadow: bold(C.lime, 2.5) }}>{`${couple.compatibility} %`}</div>
          <div style={{ display: "flex", fontSize: 24, textTransform: "uppercase", letterSpacing: 2 }}>kosmická kompatibilita</div>
        </div>
        <BurnBar burn={couple.compatibility} width={W - 128 - 380} height={30} label="Shoda hvězd" showValue={false} />
      </div>

      <div style={{ display: "flex" }}>
        <Sticker bg={C.lime} size={36} pad={14} rotate={-1.5} shadow={C.pink}>
          <div style={{ display: "flex", textTransform: "none", letterSpacing: 0, fontSize: 36, lineHeight: 1.15 }}>{clamp(couple.verdict, 110)}</div>
        </Sticker>
      </div>

      <Footer size={25} />
    </div>
  );
}

function Og({ couple }: { couple: CoupleRoast }) {
  const { width: W, height: H } = CARD_SIZE.og;
  const A = SIGN_NAME[couple.a];
  const B = SIGN_NAME[couple.b];
  const title = clamp(couple.title, 80);
  const ts = fit(title.length, [[28, 60], [55, 50]], 42);

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative", width: W, height: H, padding: 40, gap: 18, background: GRAIN_BG, fontFamily: FONT, color: C.cream }}>
      <Stars W={W} H={H} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={44} />
        <Sticker bg={C.pink} color={C.cream} size={26} pad={8} rotate={2}>Astro Battle</Sticker>
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 36 }}>
        <Pair a={A} b={B} d={210} fs={70} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
          <div style={{ display: "flex", fontSize: ts, lineHeight: 1.06, textShadow: bold(C.cream, ts * 0.018, `${ts * 0.06}px ${ts * 0.06}px 0 ${C.pink}`) }}>{title}</div>
          <BurnBar burn={couple.compatibility} width={430} height={24} label="Kompatibilita" />
        </div>
      </div>

      <Footer size={20} />
    </div>
  );
}
