// Převedeno skriptem z design/mezi-vami/Mobil-01-Landing.dc.html (řádky 84–99), pak ručně upraveno.
export function DnaCardsMobile() {
  return (
    <>
    <div style={{ position: "relative", marginTop: "24px", height: "300px" }}>
      <svg aria-hidden="true" viewBox="0 0 335 300" preserveAspectRatio="none" style={{ position: "absolute", left: "-20px", right: "-20px", bottom: "0", width: "375px", height: "300px", pointerEvents: "none" }}>
        <defs>
          <filter id="m1F" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="4">
            </feGaussianBlur>
          </filter>
        </defs>
        <path d="M -10 280 C 100 240, 220 240, 345 200" fill="none" stroke="#F6C2A4" strokeWidth="4" opacity="0.5" filter="url(#m1F)">
        </path>
        <path d="M -10 280 C 100 240, 220 240, 345 200" fill="none" stroke="#F3C9AD" strokeWidth="1">
        </path>
      </svg>
      <div style={{ position: "absolute", left: "150px", top: "18px", width: "170px", height: "240px", transform: "perspective(1000px) rotateY(-16deg) rotateZ(1.5deg)", borderRadius: "10px", border: "1px solid rgba(236, 212, 200, 0.2)", background: "linear-gradient(170deg, #281D2B, #160F18)", padding: "20px 16px", boxSizing: "border-box", boxShadow: "0 24px 50px rgba(0, 0, 0, 0.6)" }}>
        <p style={{ margin: "0", fontFamily: "var(--font-mv-garamond), serif", fontSize: "17px", lineHeight: "1.12", color: "#EAD9CF" }}>
          Hlavní témata
          <br />
          vašeho vztahu
        </p>
        <p style={{ margin: "14px 0 0", paddingTop: "8px", borderTop: "1px solid rgba(236, 212, 200, 0.12)", fontSize: "11px", color: "#C9B9C3" }}>
          Hlavní vzorec
        </p>
        <p style={{ margin: "8px 0 0", paddingTop: "8px", borderTop: "1px solid rgba(236, 212, 200, 0.12)", fontSize: "11px", color: "#C9B9C3" }}>
          Rytmus rozhodování
        </p>
        <p style={{ margin: "8px 0 0", paddingTop: "8px", borderTop: "1px solid rgba(236, 212, 200, 0.12)", fontSize: "11px", color: "#C9B9C3" }}>
          Co vás drží
        </p>
      </div>
      <div style={{ position: "absolute", left: "0", top: "0", width: "190px", height: "270px", transform: "perspective(1000px) rotateY(-16deg) rotateZ(-2.5deg)", borderRadius: "10px", border: "1px solid rgba(236, 212, 200, 0.3)", background: "linear-gradient(165deg, #2B1E2F, #120C14)", overflow: "hidden", boxShadow: "0 30px 60px rgba(0, 0, 0, 0.7)" }}>
        <svg aria-hidden="true" viewBox="0 0 190 270" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
          <defs>
            <filter id="m1C1" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3">
              </feGaussianBlur>
            </filter>
            <filter id="m1C2" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="9">
              </feGaussianBlur>
            </filter>
          </defs>
          <path d="M -10 210 C 50 160, 120 150, 205 110" fill="none" stroke="#E9A08C" strokeWidth="16" opacity="0.25" filter="url(#m1C2)">
          </path>
          <path d="M -10 210 C 50 160, 120 150, 205 110" fill="none" stroke="#F6C2A4" strokeWidth="4" opacity="0.7" filter="url(#m1C1)">
          </path>
          <path d="M -10 210 C 50 160, 120 150, 205 110" fill="none" stroke="#FFE6D4" strokeWidth="1.1">
          </path>
        </svg>
        <p style={{ position: "absolute", left: "0", right: "0", top: "20px", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "10px", letterSpacing: "0.26em", color: "#E2D6DC" }}>
          MEZI VÁMI
        </p>
        <p style={{ position: "absolute", left: "0", right: "0", top: "64px", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "25px", color: "#F2DDD0" }}>
          Vztahová DNA
        </p>
        <p style={{ position: "absolute", left: "14px", right: "14px", bottom: "16px", margin: "0", display: "flex", justifyContent: "space-between", fontSize: "10px", lineHeight: "1.4", color: "#B9A8B5" }}>
          <span>
            První osoba
            <br />
            14. 5. 1990
          </span>
          <span style={{ textAlign: "right" }}>
            Druhá osoba
            <br />
            23. 8. 1988
          </span>
        </p>
      </div>
    </div>
    <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#7E6E7A" }}>
      Ukázkový obsah
    </p>
    </>
  );
}
