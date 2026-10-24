import { Dna } from "../_parts/Dna";
import { Nabidka } from "../_parts/Nabidka";
import { StickyBar } from "../_parts/StickyBar";
import { Vypocet } from "../_parts/Vypocet";

function Pools({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 375 ${height}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {children}
    </svg>
  );
}

export default function VysledekPage() {
  return (
    <main className="mvp mvp-vysledek">
      {/* 03 · výpočet a jeho opora */}
      <section style={{ position: "relative" }}>
        <div style={{ position: "relative", maxWidth: "720px", margin: "0 auto", paddingBottom: "56px" }}>
          <Vypocet />
        </div>
      </section>

      {/* 04 · Vztahová DNA */}
      <section id="dna" style={{ position: "relative", overflow: "hidden" }}>
        <Pools height={2480}>
          <defs>
            <filter id="m4Pool" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="50"></feGaussianBlur></filter>
          </defs>
          <ellipse cx="300" cy="620" rx="170" ry="200" fill="#341533" opacity="0.5" filter="url(#m4Pool)"></ellipse>
          <ellipse cx="60" cy="1250" rx="160" ry="200" fill="#2A1230" opacity="0.5" filter="url(#m4Pool)"></ellipse>
          <ellipse cx="320" cy="1800" rx="160" ry="180" fill="#311431" opacity="0.45" filter="url(#m4Pool)"></ellipse>
          <ellipse cx="188" cy="2260" rx="200" ry="140" fill="#3A1838" opacity="0.5" filter="url(#m4Pool)"></ellipse>
        </Pools>
        <div style={{ position: "relative", paddingBottom: "24px" }}>
          <Dna />
        </div>
      </section>

      {/* 05 · most a nabídka */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <Pools height={2520}>
          <defs>
            <filter id="m5Pool" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="50"></feGaussianBlur></filter>
          </defs>
          <ellipse cx="80" cy="200" rx="160" ry="160" fill="#2A1230" opacity="0.5" filter="url(#m5Pool)"></ellipse>
          <ellipse cx="300" cy="800" rx="180" ry="220" fill="#3A1838" opacity="0.55" filter="url(#m5Pool)"></ellipse>
          <ellipse cx="60" cy="1500" rx="160" ry="200" fill="#2A1230" opacity="0.45" filter="url(#m5Pool)"></ellipse>
          <ellipse cx="290" cy="2150" rx="170" ry="160" fill="#311431" opacity="0.45" filter="url(#m5Pool)"></ellipse>
        </Pools>
        <div style={{ position: "relative", paddingBottom: "130px" }}>
          <Nabidka />
        </div>
      </section>

      <StickyBar targetId="nabidka" />
    </main>
  );
}
