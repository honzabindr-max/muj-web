import type { Metadata } from "next";
import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import VypocetD, { propsMeta } from "../_dc/VypocetD";
import VypocetM from "../_dc/VypocetM";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Výpočet" };

// Výpočet. ?stav=vypocet|prepocet-po-uprave, ?prodleva=1 (dlouhý výpočet).
export default async function MeziVamiVypocet({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return (
    <Dual
      bg="#120A12"
      desktop={<VypocetD props={props} />}
      mobile={<VypocetM props={props} />}
    />
  );
}
