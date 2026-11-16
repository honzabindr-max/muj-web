import type { Metadata } from "next";
import { Dual } from "../_lib/Dual";
import ObjednavkaD from "../_dc/ObjednavkaD";
import ObjednavkaM from "../_dc/ObjednavkaM";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Dokončení objednávky" };

// Dokončení objednávky (bez plateb — prototyp).
export default function MeziVamiObjednavka() {
  return (
    <Dual bg="#120A12" desktop={<ObjednavkaD />} mobile={<ObjednavkaM />} />
  );
}
