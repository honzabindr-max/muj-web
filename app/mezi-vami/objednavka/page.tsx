import { Pokladna } from "../_parts/Pokladna";

export default function ObjednavkaPage() {
  return (
    <div className="mvp mvp-pokladna">
      <div style={{ position: "relative", maxWidth: "560px", margin: "0 auto", paddingBottom: "56px" }}>
        <Pokladna />
      </div>
    </div>
  );
}
