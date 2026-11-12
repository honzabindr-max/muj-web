import { Dual } from "../_lib/Dual";
import { OsobaD, OsobaM } from "../_parts/OsobaForm";

// První a druhá osoba: funkční formulář, údaje v sessionStorage (viz _lib/persons-store.ts).
export default function MeziVamiOsoba() {
  return <Dual bg="#120A12" desktop={<OsobaD />} mobile={<OsobaM />} />;
}
