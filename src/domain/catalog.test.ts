import { describe, expect, it } from "vitest";
import {
  compactCatalogQuery,
  effectiveRatingFloor,
  effectiveRuntimeLimit,
  excludedGenres,
  inferRegionFromLocale,
  requestedGenres,
} from "./catalog";

describe("catalog domain contracts", () => {
  it("extracts a region from BCP 47 locale without using precise location", () => {
    expect(inferRegionFromLocale("fi-FI")).toBe("FI");
    expect(inferRegionFromLocale("en-GB")).toBe("GB");
  });

  it("keeps hard constraints at their strictest values", () => {
    const query = compactCatalogQuery({
      playback: {
        region: "FI",
        providerIds: [8],
        monetization: ["flatrate"],
        requireAvailability: true,
      },
      settings: {
        maxRuntime: 120,
        minRating: 7,
        excludedGenres: ["horror"],
        fairnessMode: "balanced",
      },
      participants: [
        {
          id: "a",
          name: "A",
          likedGenres: ["sci-fi"],
          avoidedGenres: ["thriller"],
          moods: [],
        },
      ],
      intent: {
        likedGenres: ["mystery"],
        avoidedGenres: ["crime"],
        moods: [],
        maxRuntime: 100,
        minRating: 7.5,
        summary: "",
        source: "local",
      },
    });

    expect(effectiveRuntimeLimit(query)).toBe(100);
    expect(effectiveRatingFloor(query)).toBe(7.5);
    expect(requestedGenres(query)).toEqual(["sci-fi", "mystery"]);
    expect(excludedGenres(query)).toEqual(["horror", "thriller", "crime"]);
  });
});
