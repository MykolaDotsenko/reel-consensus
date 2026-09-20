import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildRoomInviteUrl,
  parseRoomInvite,
  participantFromSharedRoom,
  sanitizeDisplayName,
  stripInviteTokenFromUrl,
  type RoomInvite,
  type SharedRoom,
} from "../domain/room";
import type { DecisionSettings, Participant } from "../domain/types";
import { getRuntimeConfig } from "../lib/runtimeConfig";
import { roomGateway } from "../lib/roomGateway";
import { trackProductEvent } from "../lib/productEvents";

type Status = "idle" | "creating" | "joining" | "active" | "error";

type UseSharedRoomArgs = {
  participant: Participant;
  settings: DecisionSettings;
  brief: string;
  onRemoteParticipants: (participants: Participant[]) => void;
  onRemoteSettings: (settings: DecisionSettings) => void;
  onRemoteBrief: (brief: string) => void;
};

export const useSharedRoom = ({
  participant,
  settings,
  brief,
  onRemoteParticipants,
  onRemoteSettings,
  onRemoteBrief,
}: UseSharedRoomArgs) => {
  const config = useMemo(() => getRuntimeConfig(), []);
  const [status, setStatus] = useState<Status>("idle");
  const [room, setRoom] = useState<SharedRoom | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [invite, setInvite] = useState<RoomInvite | null>(() =>
    typeof window === "undefined" ? null : parseRoomInvite(window.location.search),
  );
  const [shareInvite, setShareInvite] = useState<RoomInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<SharedRoom | null>(null);
  const selfUserIdRef = useRef<string | null>(null);

  const applyRoom = useCallback(
    (nextRoom: SharedRoom) => {
      roomRef.current = nextRoom;
      setRoom(nextRoom);
      onRemoteParticipants(nextRoom.participants.map(participantFromSharedRoom));
      onRemoteSettings(nextRoom.settings);
      onRemoteBrief(nextRoom.brief);
    },
    [onRemoteBrief, onRemoteParticipants, onRemoteSettings],
  );

  const refreshRoom = useCallback(async (roomId: string) => {
    const nextRoom = await roomGateway.fetchRoom(roomId);
    applyRoom(nextRoom);
  }, [applyRoom]);

  useEffect(() => {
    if (!config.roomsEnabled || !room?.id) return undefined;

    const unsubscribe = roomGateway.subscribe(room.id, () => {
      void refreshRoom(room.id).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Room sync failed.");
      });
    });

    return unsubscribe;
  }, [config.roomsEnabled, refreshRoom, room?.id]);

  const createRoom = useCallback(async () => {
    if (!config.roomsEnabled) return;

    const displayName = sanitizeDisplayName(participant.name) || "You";
    setStatus("creating");
    setError(null);

    try {
      const userId = await roomGateway.currentUserId();
      selfUserIdRef.current = userId;
      setSelfUserId(userId);
      const created = await roomGateway.createRoom({
        displayName,
        participant,
        settings,
        brief,
      });
      setShareInvite(created.invite);
      setInvite(null);
      applyRoom(created.room);
      setStatus("active");
      trackProductEvent({
        name: "room_created",
        roomId: created.room.id,
        participantCount: created.room.participants.length,
        source: "button",
      });
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not create the room.");
    }
  }, [applyRoom, brief, config.roomsEnabled, participant, settings]);

  const joinRoom = useCallback(async (displayName: string) => {
    if (!config.roomsEnabled || !invite) return;

    const safeName = sanitizeDisplayName(displayName);
    if (!safeName) {
      setError("Add your name before joining.");
      return;
    }

    setStatus("joining");
    setError(null);

    try {
      const userId = await roomGateway.currentUserId();
      selfUserIdRef.current = userId;
      setSelfUserId(userId);
      const joined = await roomGateway.joinRoom(invite, safeName);
      applyRoom(joined);
      setStatus("active");
      setInvite(null);
      window.history.replaceState({}, "", stripInviteTokenFromUrl(window.location));
      trackProductEvent({
        name: "invite_joined",
        roomId: joined.id,
        participantCount: joined.participants.length,
        source: "invite-link",
      });
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not join the room.");
    }
  }, [applyRoom, config.roomsEnabled, invite]);

  const syncSelfParticipant = useCallback(async (nextParticipant: Participant) => {
    const activeRoom = roomRef.current;
    const userId = selfUserIdRef.current;
    if (!activeRoom || !userId || nextParticipant.id !== userId) return;

    try {
      await roomGateway.updateParticipant(activeRoom.id, nextParticipant);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sync your preferences.");
    }
  }, []);

  const syncRoomConfig = useCallback(async (nextSettings: DecisionSettings, nextBrief: string) => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    try {
      await roomGateway.updateRoomConfig(activeRoom.id, nextSettings, nextBrief);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sync room settings.");
    }
  }, []);

  const setReady = useCallback(async (ready: boolean) => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    try {
      await roomGateway.setReady(activeRoom.id, ready);
      await refreshRoom(activeRoom.id);
      if (ready) {
        trackProductEvent({
          name: "participant_ready",
          roomId: activeRoom.id,
          participantCount: activeRoom.participants.length,
          source: "button",
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update ready state.");
    }
  }, [refreshRoom]);

  const inviteUrl =
    shareInvite && typeof window !== "undefined"
      ? buildRoomInviteUrl(window.location.origin, window.location.pathname, shareInvite)
      : null;

  const selfParticipant = room?.participants.find(
    (candidate) => candidate.userId === selfUserId,
  );

  return {
    roomsEnabled: config.roomsEnabled,
    status,
    room,
    selfUserId,
    selfParticipant,
    pendingInvite: invite,
    inviteUrl,
    error,
    createRoom,
    joinRoom,
    syncSelfParticipant,
    syncRoomConfig,
    setReady,
  };
};
