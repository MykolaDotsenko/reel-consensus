import { describe, expect, it } from "vitest";
import {
  deriveMoods,
  normalizeAvailability,
  normalizeTmdbMovie,
} from "./tmdb";
import type { PlaybackContext } from "../../domain/types";

const playback: PlaybackContext = {
  region: "FI",
  providerIds: [8],
  monetization: ["flatrate", "free"],
  requireAvailability: true,
};

describe("TMDB normalization", () => {
  it("keeps only selected providers and monetization types", () => {
    const availability = normalizeAvailability(
      {
        results: {
          FI: {
            link: "https://www.themoviedb.org/movie/1/watch?locale=FI",
            flatrate: [
              { provider_id: 8, provider_name: "Netflix" },
              { provider_id: 337, provider_name: "Disney Plus" },
            ],
            rent: [{ provider_id: 8, provider_name: "Netflix" }],
          },
        },
      },
      playback,
    );

    expect(availability).toEqual([
      expect.objectContaining({
        providerId: 8,
        providerName: "Netflix",
        monetization: "flatrate",
        region: "FI",
      }),
    ]);
  });

  it("derives stable moods from genres and keywords", () => {
    expect(
      deriveMoods(["sci-fi", "comedy"], [{ id: 1, name: "time loop" }]),
    ).toEqual(expect.arrayContaining(["mind-bending", "thoughtful", "funny", "easy"]));
  });

  it("drops unavailable movies when availability is required", () => {
    expect(
      normalizeTmdbMovie(
        {
          id: 42,
          title: "Unavailable Movie",
          runtime: 100,
          vote_average: 8,
          genres: [{ id: 35, name: "Comedy" }],
          keywords: { keywords: [] },
          "watch/providers": { results: {} },
        },
        playback,
      ),
    ).toBeNull();
  });
});
