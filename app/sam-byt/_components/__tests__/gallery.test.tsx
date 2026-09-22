// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Gallery } from "../gallery";

describe("Gallery — lightbox jen u bytů s víc fotkami (zadání bod 2.3)", () => {
  afterEach(() => cleanup());

  it("s jedinou fotkou nezobrazí lightbox ovládání, jen jednu fotku", () => {
    render(<Gallery images={["https://d18-a.sdn.cz/a.jpg"]} alt="Opálkova" fallbackHref={null} />);
    expect(screen.getByRole("img", { name: "Opálkova" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("s víc fotkami (sam-01 má 12) zobrazí náhledovou lištu se všemi fotkami", () => {
    const images = Array.from({ length: 12 }, (_, i) => `https://d18-a.sdn.cz/${i}.jpg`);
    render(<Gallery images={images} alt="Foltýnova" fallbackHref={null} />);
    // hlavní fotka (button) + 12 náhledů = 13 tlačítek
    expect(screen.getAllByRole("button")).toHaveLength(13);
  });
});
