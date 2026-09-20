import { describe, expect, it } from "vitest";
import {
  buildRoomInviteUrl,
  parseRoomInvite,
  sanitizeDisplayName,
} from "./room";

describe("room invite helpers", () => {
  it("round-trips a valid invite", () => {
    const invite = {
      roomId: "f4e9c3b4-0c48-4c6e-8fd1-4e0b3e64279f",
      token: "a".repeat(48),
    };
    const url = buildRoomInviteUrl("https://example.com", "/movie-night", invite);
    expect(parseRoomInvite(new URL(url).search)).toEqual(invite);
  });

  it("rejects malformed invite parameters", () => {
    expect(parseRoomInvite("?room=hello&token=world")).toBeNull();
  });

  it("normalizes and caps display names", () => {
    expect(sanitizeDisplayName("  Maya    Stone  ")).toBe("Maya Stone");
    expect(sanitizeDisplayName("x".repeat(80))).toHaveLength(40);
  });
});
