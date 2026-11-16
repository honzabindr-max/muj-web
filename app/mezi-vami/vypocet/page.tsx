import type { Metadata } from "next";
import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import VypocetD, { propsMeta } from "../_dc/VypocetD";
import VypocetM from "../_dc/VypocetM";
import { AutoAdvance } from "../_lib/AutoAdvance";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Výpočet" };

// Výpočet. ?stav=vypocet|prepocet-po-uprave, ?prodleva=1 (dlouhý výpočet).
export default async function MeziVamiVypocet({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  const re = props.stav === "Přepočet po úpravě";
  const href = re ? "/mezi-vami/objednavka" : "/mezi-vami/vysledek";
  return (
    <>
      <AutoAdvance href={href} delayMs={props.prodleva ? 9000 : 4500} />
      <Dual
      bg="#120A12"
      desktop={<VypocetD props={props} />}
      mobile={<VypocetM props={props} />}
      />
    </>
  );
}
