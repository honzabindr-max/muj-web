// Převedeno skriptem z design/mezi-vami/Mobil-05-Nabidka.dc.html (řádky 77–88), pak ručně upraveno.
export function ReportMockMobile() {
  return (
    <>
    <div aria-hidden="true" style={{ position: "relative", height: "290px", marginTop: "20px", perspective: "1000px" }}>
      <div style={{ position: "absolute", left: "50%", top: "18px", width: "170px", height: "240px", marginLeft: "-70px", borderRadius: "6px", background: "linear-gradient(170deg, #E9DCE6, #CBB8C8)", transform: "rotateY(-6deg) rotateZ(8deg) translateX(46px)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)" }}>
      </div>
      <div style={{ position: "absolute", left: "50%", top: "18px", width: "170px", height: "240px", marginLeft: "-78px", borderRadius: "6px", background: "linear-gradient(170deg, #F3E8EE, #D9C8D5)", transform: "rotateY(-6deg) rotateZ(4.5deg) translateX(30px)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)" }}>
      </div>
      <div style={{ position: "absolute", left: "50%", top: "18px", width: "170px", height: "240px", marginLeft: "-86px", borderRadius: "6px", background: "linear-gradient(170deg, #FBF3F4, #E6D6DF)", transform: "rotateY(-6deg) rotateZ(1.5deg) translateX(14px)", boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)" }}>
      </div>
      <div className="mv-float-m5" style={{ position: "absolute", left: "50%", top: "18px", width: "170px", height: "240px", marginLeft: "-94px", transform: "rotateY(-6deg) rotateZ(-2deg)" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "6px", background: "linear-gradient(165deg, #2C1630, #140912)", overflow: "hidden", boxShadow: "0 30px 70px rgba(0, 0, 0, 0.7), 0 0 60px rgba(220, 130, 150, 0.3), inset 0 0 0 1px rgba(255, 214, 190, 0.25)" }}>
          <svg viewBox="0 0 170 240" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
            <defs>
              <filter id="m5R" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5">
                </feGaussianBlur>
              </filter>
            </defs>
            <path d="M -10 220 C 50 150, 110 130, 185 60" fill="none" stroke="#F2B9A6" strokeWidth="8" opacity="0.5" filter="url(#m5R)">
            </path>
            <path d="M -10 220 C 50 150, 110 130, 185 60" fill="none" stroke="#FFE9DA" strokeWidth="1">
            </path>
          </svg>
          <p style={{ position: "absolute", left: "0", right: "0", top: "20px", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "9px", letterSpacing: "0.28em", color: "#EADCE2" }}>
            MEZI VÁMI
          </p>
          <p style={{ position: "absolute", left: "14px", right: "14px", top: "60px", margin: "0", textAlign: "center", fontFamily: "var(--font-mv-garamond), serif", fontSize: "24px", fontWeight: "300", lineHeight: "1", background: "linear-gradient(100deg, #FFE7D6, #E9AFC0)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Hloubková
            <br />
            analýza
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
