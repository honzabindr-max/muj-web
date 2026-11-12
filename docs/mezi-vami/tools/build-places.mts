/* eslint-disable */
// @ts-nocheck — dev nástroj spouštěný přes tsx
// Sestaví app/mezi-vami/_data/places.json (obce ČR + SR s okresem) ze zdrojových souborů.
//
//   npx tsx docs/mezi-vami/tools/build-places.mts <obce-cr.csv> <obce-sk.json> <okresy-sk.json>
//
// Zdroje (veřejné číselníky, zpracované mirrorem):
//  - ČR: ČSÚ číselník obcí / RÚIAN, tabulka obce-cr.csv (github.com/sth3no/czech-open-data,
//    mirror czechdatasets.com/otevrena-data, stav 2026) — 6258 obcí
//  - SR: Štatistický úrad SR, zoznam obcí a okresov (github.com/gunsoft/obce-okresy-kraje-slovenska)
// Výstup: { v, src, p: [[obec, okres, "CZ"|"SK"], ...] } seřazeno podle názvu (cs locale).

import fs from "node:fs";

const [csvPath, skPath, skDistrictsPath] = process.argv.slice(2);

function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const csv = parseCsv(fs.readFileSync(csvPath, "utf8"));
const head = csv[0];
const iName = head.indexOf("obec");
const iOkres = head.indexOf("okres");
const places = [];
for (const r of csv.slice(1)) {
  if (!r[iName]) continue;
  places.push([r[iName].trim(), r[iOkres].trim(), "CZ"]);
}
const czCount = places.length;

const districts = new Map(JSON.parse(fs.readFileSync(skDistrictsPath, "utf8")).map((d) => [d.id, d.name]));
for (const v of JSON.parse(fs.readFileSync(skPath, "utf8"))) {
  places.push([v.fullname.trim(), (districts.get(v.district_id) ?? "").trim(), "SK"]);
}

places.sort((a, b) => a[0].localeCompare(b[0], "cs") || a[1].localeCompare(b[1], "cs"));
const out = {
  v: 1,
  src: [
    "ČR: ČSÚ číselník obcí / RÚIAN (obce-cr.csv, czechdatasets.com, 2026)",
    "SR: Štatistický úrad SR, zoznam obcí a okresov",
  ],
  p: places,
};
fs.mkdirSync("app/mezi-vami/_data", { recursive: true });
fs.writeFileSync("app/mezi-vami/_data/places.json", JSON.stringify(out));
console.log(`CZ ${czCount}, SK ${places.length - czCount}, celkem ${places.length}`);
