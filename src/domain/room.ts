import type { DecisionSettings, Participant } from "./types";

export type RoomLifecycleState = "setup" | "ready" | "deciding" | "decided" | "closed";
export type RoomRole = "host" | "member";

export type SharedRoomParticipant = Participant & {
  userId: string;
  role: RoomRole;
  ready: boolean;
  lastSeenAt: string;
};

export type SharedRoom = {
  id: string;
  hostUserId: string;
  state: RoomLifecycleState;
  brief: string;
  settings: DecisionSettings;
  participants: SharedRoomParticipant[];
  expiresAt: string;
};

export type RoomInvite = {
  roomId: string;
  token: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[0-9a-f]{32,128}$/i;

export const sanitizeDisplayName = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 40);

export const parseRoomInvite = (search: string): RoomInvite | null => {
  const params = new URLSearchParams(search);
  const roomId = params.get("room") ?? "";
  const token = params.get("token") ?? "";

  if (!UUID_PATTERN.test(roomId) || !TOKEN_PATTERN.test(token)) return null;
  return { roomId, token };
};

export const buildRoomInviteUrl = (
  origin: string,
  pathname: string,
  invite: RoomInvite,
) => {
  const url = new URL(pathname, origin);
  url.searchParams.set("room", invite.roomId);
  url.searchParams.set("token", invite.token);
  return url.toString();
};

export const stripInviteTokenFromUrl = (location: Location) => {
  const url = new URL(location.href);
  url.searchParams.delete("token");
  return `${url.pathname}${url.search}${url.hash}`;
};

export const participantFromSharedRoom = (
  participant: SharedRoomParticipant,
): Participant => ({
  id: participant.userId,
  name: participant.name,
  likedGenres: participant.likedGenres,
  avoidedGenres: participant.avoidedGenres,
  moods: participant.moods,
});
