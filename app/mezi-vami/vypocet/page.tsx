import type { Metadata } from "next";
import { resolveProps, type SearchParams } from "../_lib/dc";
import { propsMeta } from "../_dc/VypocetD";
import { ComputeScreen } from "../_parts/ComputeScreen";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Výpočet" };

// Výpočet: skutečný běh (API výpočtu + textů). ?stav=prepocet-po-uprave → po výpočtu na objednávku.
export default async function MeziVamiVypocet({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const props = resolveProps(propsMeta, await searchParams);
  return <ComputeScreen re={props.stav === "Přepočet po úpravě"} />;
}
