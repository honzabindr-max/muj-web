import { LandingDesktop2 } from "./_parts/LandingDesktop2";
import { LandingMobileTop2 } from "./_parts/LandingMobileTop2";
import { StickyCta2 } from "./_parts/StickyCta2";

export default function MeziVami2Landing() {
  return (
    <div className="mvp mvp-landing">
      <a className="mv2-skip" href="#obsah">
        Přeskočit na obsah
      </a>
      {/* jemná švestková viněta */}
      <svg aria-hidden="true" viewBox="0 0 1440 4700" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <filter id="pgPool" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="110"></feGaussianBlur></filter>
        </defs>
        <ellipse cx="1150" cy="280" rx="520" ry="360" fill="#3A1838" opacity="0.55" filter="url(#pgPool)"></ellipse>
        <ellipse cx="160" cy="900" rx="420" ry="260" fill="#2A1230" opacity="0.5" filter="url(#pgPool)"></ellipse>
        <ellipse cx="1000" cy="1650" rx="480" ry="300" fill="#341533" opacity="0.45" filter="url(#pgPool)"></ellipse>
        <ellipse cx="1100" cy="2600" rx="460" ry="300" fill="#311431" opacity="0.4" filter="url(#pgPool)"></ellipse>
        <ellipse cx="300" cy="3800" rx="420" ry="260" fill="#2A1230" opacity="0.4" filter="url(#pgPool)"></ellipse>
      </svg>
      <main id="obsah">
        <div className="mv-m">
          <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
            <LandingMobileTop2 />
          </div>
        </div>
        <LandingDesktop2 />
      </main>
      <StickyCta2 />
    </div>
  );
}
