import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dual } from "../_lib/Dual";
import { optionSlug, resolveProps, type SearchParams } from "../_lib/dc";
import VzorekD, { propsMeta } from "../_dc/VzorekD";
import VzorekM from "../_dc/VzorekM";

// Titulek = název obrazovky z plátna (šablona „%s — MEZI VÁMI“ v layoutu).
export const metadata: Metadata = { title: "Vzorový report" };

// Vzorový report (jen S1/S2). ?vzorek=s1|s2 (výchozí s1).
// Stav S0 (vzorek není): COPY v3.2, 3.SMP-M — „větev se neotevírá“, žádný čekací ani jiný nový
// text → přímé otevření s ?vzorek=s0 přesměruje na landing (ten ve stavu S0 sekci vzorku nemá).
export default async function MeziVamiVzorek({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const search = await searchParams;
  const raw = Array.isArray(search.vzorek) ? search.vzorek[0] : search.vzorek;
  if (raw && optionSlug(raw) === "s0") redirect("/mezi-vami");
  const props = resolveProps(propsMeta, search);
  return (
    <Dual
      bg="#120A12"
      landmark
      desktop={<VzorekD props={props} />}
      mobile={<VzorekM props={props} />}
    />
  );
}
