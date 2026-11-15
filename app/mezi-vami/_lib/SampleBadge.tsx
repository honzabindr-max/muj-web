// Štítek „Ukázkový obsah · prototyp“ z plátna (D-05 hlavička, Mobil-04 pilulka): čárkovaný rámeček,
// velká písmena. Jediný zdroj štítku pro hlavičky všech obrazovek /mezi-vami (desktop i mobil).
// Text ani tokeny se nemění; mobil = velikost z Mobil-04 (13 px, padding 6/12) v samostatném
// řádku hlavičky (hlavička má flex-wrap), aby se vešel na 390 px.

export const SAMPLE_BADGE_TEXT = "Ukázkový obsah · prototyp";

export function SampleBadge({ mobile = false }: { mobile?: boolean }) {
  const pill = (
    <p
      data-sample-badge=""
      style={{
        margin: 0,
        padding: mobile ? "6px 12px" : "6px 14px",
        border: "1px dashed #6E5566",
        borderRadius: 999,
        fontSize: mobile ? 13 : 15,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#C9B0BE",
      }}
    >
      {SAMPLE_BADGE_TEXT}
    </p>
  );
  if (!mobile) return pill;
  return (
    <div style={{ flexBasis: "100%", display: "flex", justifyContent: "center", paddingTop: 4 }}>
      {pill}
    </div>
  );
}
