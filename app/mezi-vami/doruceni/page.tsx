import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import DoruceniD, { propsMeta } from "../_dc/DoruceniD";
import DoruceniM from "../_dc/DoruceniM";

// Objednávka a doručení.
// ?stav=platba-potvrzena|analyza-se-pripravuje|analyza-pripravena|odkaz-vyprsel, ?podpora=0|1
export default async function MeziVamiDoruceni({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return (
    <Dual
      bg="#120A12"
      desktop={<DoruceniD props={props} />}
      mobile={<DoruceniM props={props} />}
    />
  );
}
