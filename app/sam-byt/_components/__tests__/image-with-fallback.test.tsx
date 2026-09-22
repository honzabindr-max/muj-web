// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ImageWithFallback } from "../image-with-fallback";

describe("ImageWithFallback — 403/404/expirovaný token (zadání bod 4)", () => {
  afterEach(() => cleanup());

  it("zobrazí obrázek, dokud se nenačítání nezhroutí", () => {
    render(<ImageWithFallback src="https://d18-a.sdn.cz/x.jpg" alt="Byt" fallbackHref="https://sreality.cz/x" />);
    expect(screen.getByRole("img", { name: "Byt" })).toBeTruthy();
  });

  it("po onError zobrazí placeholder a odkaz na původní inzerát, komponenta zůstane funkční", () => {
    render(<ImageWithFallback src="https://d18-a.sdn.cz/expired.jpg" alt="Byt Foltýnova" fallbackHref="https://sreality.cz/x" />);
    const img = screen.getByRole("img", { name: "Byt Foltýnova" });
    fireEvent.error(img);

    expect(screen.queryByRole("img")).toBeNull();
    const link = screen.getByRole("link", { name: /fotky v původním inzerátu/i });
    expect(link.getAttribute("href")).toBe("https://sreality.cz/x");
  });

  it("bez fallbackHref nezobrazí rozbitý odkaz, jen placeholder text", () => {
    render(<ImageWithFallback src="https://d18-a.sdn.cz/expired.jpg" alt="Byt" fallbackHref={null} />);
    fireEvent.error(screen.getByRole("img", { name: "Byt" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Byt")).toBeTruthy();
  });
});
