import type { Metadata } from "next";
import Stavy from "../_dc/Stavy";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Hraniční stavy" };

// Hraniční stavy (galerie). Jeden artboard pro desktop i mobil.
export default function MeziVamiStavy() {
  return (
    <div className="mvp" style={{ background: "#0D070D" }}>
      <main>
        <Stavy />
      </main>
    </div>
  );
}
