import type { Metadata } from "next";
import { Dual } from "../_lib/Dual";
import { resolveProps, type SearchParams } from "../_lib/dc";
import PlatbaD, { propsMeta } from "../_dc/PlatbaD";
import PlatbaM from "../_dc/PlatbaM";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Návrat z platby" };

// Návrat z platby. ?stav=ceka-na-potvrzeni|nepodarilo-se-overit|zruseno|neuspesna-platba, ?podpora=0|1
export default async function MeziVamiPlatba({
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
      desktop={<PlatbaD props={props} />}
      mobile={<PlatbaM props={props} />}
    />
  );
}
