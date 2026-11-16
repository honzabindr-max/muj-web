import type { Metadata } from "next";
import { Dual } from "../_lib/Dual";
import StartD from "../_dc/StartD";
import StartM from "../_dc/StartM";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Vztahová DNA – start" };

// Start Vztahové DNA.
export default function MeziVamiStart() {
  return <Dual bg="#120A12" desktop={<StartD />} mobile={<StartM />} />;
}
