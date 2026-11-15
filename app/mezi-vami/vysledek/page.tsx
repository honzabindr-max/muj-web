import { Dual } from "../_lib/Dual";
import { resolveProps, type PropsMeta, type SearchParams } from "../_lib/dc";
import VysledekD from "../_v/VysledekD";
import VysledekM from "../_v/VysledekM";

// Výsledek = stránka V (V-01 mobil 1:1, desktop ODVOZEN z mřížky D-05 + bloky V-01).
// Nahrazuje dřívější D-05 / Mobil-03..05, kde se překrývají. Data jen z fixtures (_data/fixtures.ts).
// ?vzorek=s0|s1|s2 (výchozí s0): odkaz na vzorový report u nabídky je jen při S1/S2.
const propsMeta: PropsMeta = {
  vzorek: {
    editor: "enum",
    options: ["S0 — vzorek není", "S1 — provizorní ukázka", "S2 — schválený vzorek"],
    default: "S0 — vzorek není",
  },
};

export default async function MeziVamiVysledek({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  const sample = !String(props.vzorek).startsWith("S0");
  return (
    <Dual
      bg="#0E070F"
      landmark
      desktop={<VysledekD sample={sample} />}
      mobile={<VysledekM sample={sample} />}
    />
  );
}
