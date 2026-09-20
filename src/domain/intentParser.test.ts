import { describe, expect, it } from "vitest";
import { parseIntentLocally } from "./intentParser";

describe("parseIntentLocally", () => {
  it("extracts positive, negative, mood and runtime signals", () => {
    const intent = parseIntentLocally("Something funny and clever, no horror, under 2 hours");
    expect(intent.likedGenres).toContain("comedy");
    expect(intent.avoidedGenres).toContain("horror");
    expect(intent.moods).toContain("thoughtful");
    expect(intent.maxRuntime).toBe(120);
  });

  it("recognizes quality intent", () => {
    const intent = parseIntentLocally("A highly rated mystery");
    expect(intent.likedGenres).toContain("mystery");
    expect(intent.minRating).toBe(7.5);
  });
});
