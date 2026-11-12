import { Dual } from "./_lib/Dual";
import { resolveProps, type SearchParams } from "./_lib/dc";
import LandingD, { propsMeta } from "./_dc/LandingD";
import LandingM from "./_dc/LandingM";

// Landing. ?vzorek=s0|s1|s2 (výchozí s0 — vzorek není).
export default async function MeziVamiLanding({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return (
    <Dual
      bg="#0D090E"
      landmark
      desktop={<LandingD props={props} />}
      mobile={<LandingM props={props} />}
    />
  );
}
