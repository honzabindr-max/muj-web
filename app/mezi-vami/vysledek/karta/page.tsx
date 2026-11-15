import type { Metadata } from "next";
import { A } from "../../_lib/A";
import Karta from "../../_v/Karta";

export const metadata: Metadata = {
  title: "Sdílecí karta",
  robots: { index: false, follow: false },
};

// V-02: sdílecí karta 9:16 jako ukázka obrázku. Obrázek se na serveru negeneruje (hranice
// prototypu) — karta je statická ukázka, odkaz „Poslat obrázek / Uložit do telefonu“ sem vede.
export default function MeziVamiSdileciKarta() {
  return (
    <div className="mvp" style={{ background: "#0E070F" }}>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "32px 16px",
        }}
      >
        <Karta />
        <A href="/mezi-vami/vysledek" style={{ fontSize: 15 }}>
          Zpět na výsledek
        </A>
      </main>
    </div>
  );
}
