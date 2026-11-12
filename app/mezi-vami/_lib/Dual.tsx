import type { ReactNode } from "react";

// Desktopový a mobilní artboard se vykreslují oba a mezi nimi přepíná CSS (breakpoint 768 px,
// viz mezi-vami.css). Mobilní sloupec se pod 768 px natahuje na šířku okna (max 560 px).
// `landmark`: artboard nemá vlastní <main> → obalí ho stránka (jeden <main> na stránku,
// druhá varianta je display: none).
export function Dual({
  desktop,
  mobile,
  bg,
  landmark = false,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
  bg: string;
  landmark?: boolean;
}) {
  const Wrap = landmark ? "main" : "div";
  return (
    <div className="mvp" style={{ background: bg }}>
      <Wrap className="mv-d">{desktop}</Wrap>
      <Wrap className="mv-m">
        <div className="mv-mcol">{mobile}</div>
      </Wrap>
    </div>
  );
}
