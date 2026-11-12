import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import VysledekD, { propsMeta } from "../_dc/VysledekD";
import VysledekM1 from "../_dc/VysledekM1";
import VysledekM2 from "../_dc/VysledekM2";
import VysledekM3 from "../_dc/VysledekM3";

// Výsledek: sbalená opora → Vztahová DNA → most → nabídka.
// Desktop = jeden artboard, mobil = tři artboardy (opora, DNA, nabídka) jako jedna stránka.
// ?vzorek=s0|s1|s2
export default async function MeziVamiVysledek({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return (
    <Dual
      bg="#0E070F"
      landmark
      desktop={<VysledekD props={props} />}
      mobile={
        <>
          <VysledekM1 />
          <VysledekM2 />
          <VysledekM3 props={props} />
        </>
      }
    />
  );
}
