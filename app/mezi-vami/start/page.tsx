import { Dual } from "../_lib/Dual";
import StartD from "../_dc/StartD";
import StartM from "../_dc/StartM";

// Start Vztahové DNA.
export default function MeziVamiStart() {
  return <Dual bg="#120A12" desktop={<StartD />} mobile={<StartM />} />;
}
