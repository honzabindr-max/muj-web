import { LandingDesktop } from "./_parts/LandingDesktop";
import { LandingMobileTop } from "./_parts/LandingMobileTop";

export default function MeziVamiLanding() {
  return (
    <div className="mvp mvp-landing">
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
      <div className="mv-m">
        <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto" }}>
          <LandingMobileTop />
        </div>
      </div>
      <LandingDesktop />
    </div>
  );
}
