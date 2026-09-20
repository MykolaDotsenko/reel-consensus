import { GENRES, MOODS, type DecisionSettings, type Genre, type Mood, type Participant } from "../domain/types";
import type { RoomInvite, RoomLifecycleState, RoomRole, SharedRoom, SharedRoomParticipant } from "../domain/room";
import { ensureAnonymousIdentity, getSupabaseClient } from "./supabaseClient";

type RoomRow = {
  id: string;
  host_user_id: string;
  state: RoomLifecycleState;
  shared_brief: string | null;
  max_runtime: number | null;
  min_rating: number | null;
  excluded_genres: string[] | null;
  fairness_mode: DecisionSettings["fairnessMode"];
  expires_at: string;
};

type MemberRow = {
  room_id: string;
  user_id: string;
  display_name: string;
  role: RoomRole;
  ready: boolean;
  liked_genres: string[] | null;
  avoided_genres: string[] | null;
  moods: string[] | null;
  last_seen_at: string;
};

const asGenres = (values: string[] | null): Genre[] =>
  (values ?? []).filter((value): value is Genre => GENRES.includes(value as Genre));

const asMoods = (values: string[] | null): Mood[] =>
  (values ?? []).filter((value): value is Mood => MOODS.includes(value as Mood));

const requireClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error("Shared rooms are not configured.");
  return client;
};

const mapRoom = (room: RoomRow, members: MemberRow[]): SharedRoom => ({
  id: room.id,
  hostUserId: room.host_user_id,
  state: room.state,
  brief: room.shared_brief ?? "",
  settings: {
    maxRuntime: room.max_runtime,
    minRating: room.min_rating,
    excludedGenres: asGenres(room.excluded_genres),
    fairnessMode: room.fairness_mode,
  },
  participants: members
    .map<SharedRoomParticipant>((member) => ({
      id: member.user_id,
      userId: member.user_id,
      name: member.display_name,
      role: member.role,
      ready: member.ready,
      likedGenres: asGenres(member.liked_genres),
      avoidedGenres: asGenres(member.avoided_genres),
      moods: asMoods(member.moods),
      lastSeenAt: member.last_seen_at,
    }))
    .sort((left, right) => {
      if (left.role !== right.role) return left.role === "host" ? -1 : 1;
      return left.name.localeCompare(right.name);
    }),
  expiresAt: room.expires_at,
});

export type CreateRoomInput = {
  displayName: string;
  participant: Participant;
  settings: DecisionSettings;
  brief: string;
};

export class SupabaseRoomGateway {
  async currentUserId() {
    return ensureAnonymousIdentity();
  }

  async createRoom(input: CreateRoomInput): Promise<{ room: SharedRoom; invite: RoomInvite }> {
    const client = requireClient();
    const userId = await ensureAnonymousIdentity();

    const { data, error } = await client.rpc("create_movie_night", {
      p_display_name: input.displayName,
      p_shared_brief: input.brief,
      p_max_runtime: input.settings.maxRuntime,
      p_min_rating: input.settings.minRating,
      p_excluded_genres: input.settings.excludedGenres,
      p_fairness_mode: input.settings.fairnessMode,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const roomId = row?.room_id;
    const token = row?.invite_token;
    if (typeof roomId !== "string" || typeof token !== "string") {
      throw new Error("Room creation returned an invalid response.");
    }

    await this.updateParticipant(roomId, {
      ...input.participant,
      id: userId,
      name: input.displayName,
    });

    return {
      room: await this.fetchRoom(roomId),
      invite: { roomId, token },
    };
  }

  async joinRoom(invite: RoomInvite, displayName: string) {
    const client = requireClient();
    await ensureAnonymousIdentity();

    const { data, error } = await client.rpc("join_movie_night", {
      p_invite_token: invite.token,
      p_display_name: displayName,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.room_id !== invite.roomId) {
      throw new Error("Invite does not match this movie night.");
    }

    return this.fetchRoom(invite.roomId);
  }

  async fetchRoom(roomId: string) {
    const client = requireClient();
    await ensureAnonymousIdentity();

    const [{ data: room, error: roomError }, { data: members, error: memberError }] =
      await Promise.all([
        client.from("rooms").select("*").eq("id", roomId).single(),
        client.from("room_members").select("*").eq("room_id", roomId),
      ]);

    if (roomError) throw roomError;
    if (memberError) throw memberError;

    return mapRoom(room as RoomRow, (members ?? []) as MemberRow[]);
  }

  async updateParticipant(roomId: string, participant: Participant) {
    const client = requireClient();
    const userId = await ensureAnonymousIdentity();

    const { error } = await client
      .from("room_members")
      .update({
        display_name: participant.name.trim().slice(0, 40) || "Guest",
        liked_genres: participant.likedGenres,
        avoided_genres: participant.avoidedGenres,
        moods: participant.moods,
        last_seen_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  async updateRoomConfig(roomId: string, settings: DecisionSettings, brief: string) {
    const client = requireClient();
    await ensureAnonymousIdentity();

    const { error } = await client
      .from("rooms")
      .update({
        shared_brief: brief.slice(0, 800),
        max_runtime: settings.maxRuntime,
        min_rating: settings.minRating,
        excluded_genres: settings.excludedGenres,
        fairness_mode: settings.fairnessMode,
      })
      .eq("id", roomId);

    if (error) throw error;
  }

  async setReady(roomId: string, ready: boolean) {
    const client = requireClient();
    const userId = await ensureAnonymousIdentity();

    const { error } = await client
      .from("room_members")
      .update({
        ready,
        last_seen_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (error) throw error;
  }

  subscribe(roomId: string, onChange: () => void) {
    const client = requireClient();
    const channel = client
      .channel(`room-db:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        onChange,
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }
}

export const roomGateway = new SupabaseRoomGateway();
