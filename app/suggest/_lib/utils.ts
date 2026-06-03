// formatNumber is imported by primitives.tsx — keep signature stable
export function formatNumber(value: number): string {
  return value.toLocaleString("cs-CZ");
}

const COUNTRY_NAMES: Record<string, string> = {
  cz: "Česká republika", sk: "Slovensko", de: "Německo", at: "Rakousko",
  pl: "Polsko", hu: "Maďarsko", us: "Spojené státy", gb: "Velká Británie",
  uk: "Velká Británie", fr: "Francie", es: "Španělsko", it: "Itálie",
  ru: "Rusko", cn: "Čína", jp: "Japonsko", br: "Brazílie", au: "Austrálie",
  ca: "Kanada", in: "Indie", mx: "Mexiko", kr: "Jižní Korea", tr: "Turecko",
  sa: "Saúdská Arábie", nl: "Nizozemsko", ch: "Švýcarsko", se: "Švédsko",
  no: "Norsko", dk: "Dánsko", fi: "Finsko", be: "Belgie", pt: "Portugalsko",
  ro: "Rumunsko", ua: "Ukrajina", bg: "Bulharsko", hr: "Chorvatsko",
  rs: "Srbsko", si: "Slovinsko", gr: "Řecko", lt: "Litva", lv: "Lotyšsko",
  ee: "Estonsko", ie: "Irsko", nz: "Nový Zéland", za: "Jižní Afrika",
  ar: "Argentina", cl: "Chile", co: "Kolumbie", pe: "Peru", ve: "Venezuela",
  eg: "Egypt", ng: "Nigérie", ke: "Keňa", ma: "Maroko", gh: "Ghana",
  id: "Indonésie", my: "Malajsie", ph: "Filipíny", sg: "Singapur",
  th: "Thajsko", vn: "Vietnam", bd: "Bangladéš", pk: "Pákistán",
  ae: "Spoj. arab. emiráty", il: "Izrael", iq: "Irák", ir: "Írán",
  kz: "Kazachstán", uz: "Uzbekistán", az: "Ázerbájdžán", ge: "Gruzie",
  by: "Bělorusko", md: "Moldavsko", mk: "Severní Makedonie", ba: "Bosna a Hercegovina",
  al: "Albánie", me: "Černá Hora", xk: "Kosovo", cy: "Kypr", mt: "Malta",
  is: "Island", lu: "Lucembursko", li: "Liechtenstein", mc: "Monako",
  sm: "San Marino", ad: "Andorra",
};

export function countryName(gl: string): string {
  return COUNTRY_NAMES[gl.toLowerCase()] ?? gl.toUpperCase();
}

export function flagEmoji(gl: string): string {
  return Array.from(gl.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}
