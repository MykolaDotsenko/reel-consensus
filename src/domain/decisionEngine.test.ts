import { describe, expect, it } from "vitest";
import { rankMovies } from "./decisionEngine";
import type { DecisionSettings, Movie, Participant } from "./types";

const movies: Movie[] = [
  {
    id: "polarizing",
    title: "Polarizing",
    year: 2026,
    runtime: 100,
    rating: 8,
    genres: ["action"],
    moods: ["fast"],
    summary: "",
    glyph: "A",
    accent: "#fff",
  },
  {
    id: "consensus",
    title: "Consensus",
    year: 2026,
    runtime: 100,
    rating: 8,
    genres: ["mystery", "comedy"],
    moods: ["easy", "funny"],
    summary: "",
    glyph: "B",
    accent: "#fff",
  },
];

const participants: Participant[] = [
  {
    id: "a",
    name: "A",
    likedGenres: ["action", "mystery"],
    avoidedGenres: [],
    moods: ["fast", "easy"],
  },
  {
    id: "b",
    name: "B",
    likedGenres: ["comedy"],
    avoidedGenres: [],
    moods: ["funny"],
  },
];

const settings: DecisionSettings = {
  maxRuntime: null,
  minRating: null,
  excludedGenres: [],
  fairnessMode: "balanced",
};

describe("rankMovies", () => {
  it("rewards a consensus fit over a polarizing one", () => {
    const ranked = rankMovies({ movies, participants, settings, intent: null });
    expect(ranked[0]?.movie.id).toBe("consensus");
    expect(ranked[0]!.minimumScore).toBeGreaterThan(ranked[1]!.minimumScore);
  });

  it("treats participant avoided genres as hard vetoes", () => {
    const withVeto: Participant[] = [
      participants[0]!,
      { ...participants[1]!, avoidedGenres: ["action"] },
    ];
    const ranked = rankMovies({ movies, participants: withVeto, settings, intent: null });
    expect(ranked.map((item) => item.movie.id)).not.toContain("polarizing");
  });

  it("applies runtime and rating constraints before scoring", () => {
    const constrained = rankMovies({
      movies,
      participants,
      settings: { ...settings, maxRuntime: 90, minRating: 8.5 },
      intent: null,
    });
    expect(constrained).toEqual([]);
  });
});
