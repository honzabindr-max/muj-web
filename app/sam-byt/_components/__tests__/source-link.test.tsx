// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getAllListings } from "@/sam-byt/data/listings";
import type { ListingState } from "@/sam-byt/types";

import { DetailView } from "../detail-view";
import { ListingCard } from "../listing-card";

const noopState: ListingState = {
  userId: "",
  username: "sam",
  listingId: "sam-01",
  favorite: false,
  decision: "unreviewed",
  notes: "",
  ratingPrice: null,
  ratingPet: null,
  ratingLocation: null,
  ratingBalcony: null,
  ratingFurnishing: null,
  version: 0,
  updatedAt: new Date(0).toISOString(),
};

describe("odkaz na původní inzerát — všech 11 karet a detailů (zadání)", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("no network in test"))));
  });
  afterEach(() => cleanup());

  it.each(getAllListings())("karta $id má odkaz Zobrazit inzerát na source_url", (listing) => {
    render(
      <ListingCard
        listing={listing}
        state={{ ...noopState, listingId: listing.id }}
        onMutate={async () => "ok"}
        onToggleCompare={() => {}}
        compareChecked={false}
        compareDisabled={false}
      />,
    );
    const link = screen.getByRole("link", { name: /zobrazit inzerát/i });
    expect(link.getAttribute("href")).toBe(listing.source_url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it.each(getAllListings())("detail $id má odkaz Zobrazit inzerát na source_url", (listing) => {
    render(<DetailView listing={listing} username="sam" />);
    const links = screen.getAllByRole("link", { name: /zobrazit inzerát/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.getAttribute("href") === listing.source_url)).toBe(true);
    for (const l of links) {
      expect(l.getAttribute("target")).toBe("_blank");
      expect(l.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("sam-10 detail má navíc odkaz na Bazoš z alternative_urls", () => {
    const sam10 = getAllListings().find((l) => l.id === "sam-10")!;
    expect(sam10.alternative_urls.length).toBeGreaterThan(0);
    render(<DetailView listing={sam10} username="sam" />);
    const bazosLinks = screen.getAllByRole("link", { name: /zobrazit na bazoši/i });
    expect(bazosLinks.length).toBeGreaterThan(0);
    expect(bazosLinks.some((l) => l.getAttribute("href") === sam10.alternative_urls[0])).toBe(true);
  });
});
