import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import VypocetD, { propsMeta } from "../_dc/VypocetD";
import VypocetM from "../_dc/VypocetM";
import VypocetLive from "../_parts/VypocetLive";

// Výpočet. Výchozí = skutečný výpočet (volá API a čeká na odpověď, CTE-08).
// Statická ukázka z návrhu zůstává pro ?stav=vypocet|prepocet-po-uprave a ?prodleva=1.
export default async function MeziVamiVypocet({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  if (sp.stav === undefined && sp.prodleva === undefined) {
    return <VypocetLive />;
  }
  const props = resolveProps(propsMeta, sp);
  return (
    <Dual
      bg="#120A12"
      desktop={<VypocetD props={props} />}
      mobile={<VypocetM props={props} />}
    />
  );
}
