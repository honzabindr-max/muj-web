import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import PlatbaD, { propsMeta } from "../_dc/PlatbaD";
import PlatbaM from "../_dc/PlatbaM";

// Návrat z platby. ?stav=ceka-na-potvrzeni|nepodarilo-se-overit|zruseno|neuspesna-platba, ?podpora=0|1
export default async function MeziVamiPlatba({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return (
    <Dual
      bg="#120A12"
      desktop={<PlatbaD props={props} />}
      mobile={<PlatbaM props={props} />}
    />
  );
}
