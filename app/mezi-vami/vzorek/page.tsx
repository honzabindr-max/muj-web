import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import VzorekD, { propsMeta } from "../_dc/VzorekD";
import VzorekM from "../_dc/VzorekM";

// Vzorový report (jen S1/S2). ?vzorek=s1|s2 (výchozí s1).
export default async function MeziVamiVzorek({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return (
    <Dual
      bg="#120A12"
      landmark
      desktop={<VzorekD props={props} />}
      mobile={<VzorekM props={props} />}
    />
  );
}
