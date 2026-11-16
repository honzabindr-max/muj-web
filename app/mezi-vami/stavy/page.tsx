import type { Metadata } from "next";
import Stavy from "../_dc/Stavy";
import { SampleBadge } from "../_lib/SampleBadge";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Hraniční stavy" };

// Hraniční stavy (galerie). Jeden artboard pro desktop i mobil.
export default function MeziVamiStavy() {
  return (
    <div className="mvp" style={{ background: "#0D070D" }}>
      <main>
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 16px 0" }}>
          <SampleBadge />
        </div>
        <Stavy />
      </main>
    </div>
  );
}
