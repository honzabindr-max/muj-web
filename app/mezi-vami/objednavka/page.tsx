import { Dual } from "../_lib/Dual";
import ObjednavkaD from "../_dc/ObjednavkaD";
import ObjednavkaM from "../_dc/ObjednavkaM";

// Dokončení objednávky (bez plateb — prototyp).
export default function MeziVamiObjednavka() {
  return (
    <Dual bg="#120A12" desktop={<ObjednavkaD />} mobile={<ObjednavkaM />} />
  );
}
