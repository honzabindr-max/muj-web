import { Dual } from "../_lib/Dual";
import OsobaD from "../_dc/OsobaD";
import OsobaM from "../_dc/OsobaM";

// První a druhá osoba (krok A → B ve stavu komponenty).
export default function MeziVamiOsoba() {
  return <Dual bg="#120A12" desktop={<OsobaD />} mobile={<OsobaM />} />;
}
