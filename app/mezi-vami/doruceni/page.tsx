import type { Metadata } from "next";
import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import DoruceniD, { propsMeta } from "../_dc/DoruceniD";
import DoruceniM from "../_dc/DoruceniM";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Objednávka a doručení" };

// Objednávka a doručení.
// ?stav=platba-potvrzena|analyza-se-pripravuje|analyza-pripravena|odkaz-vyprsel, ?podpora=0|1
export default async function MeziVamiDoruceni({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // „Kontaktovat podporu“ a věty o podpoře: jen při doloženém funkčním cíli (COPY v3.2, 6.1 bod 10,
  // V31-03; cíl je UNKNOWN) → výchozí je skryto, ?podpora=1 ukáže jen variantu z návrhu.
  const props = resolveProps(propsMeta, { podpora: "0", ...(await searchParams) });
  return (
    <Dual
      bg="#120A12"
      desktop={<DoruceniD props={props} />}
      mobile={<DoruceniM props={props} />}
    />
  );
}
