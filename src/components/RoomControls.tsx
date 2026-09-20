import { useState } from "react";
import type { RoomInvite, SharedRoom, SharedRoomParticipant } from "../domain/room";
import { trackProductEvent } from "../lib/productEvents";

type Props = {
  roomsEnabled: boolean;
  status: "idle" | "creating" | "joining" | "active" | "error";
  room: SharedRoom | null;
  selfParticipant: SharedRoomParticipant | undefined;
  pendingInvite: RoomInvite | null;
  inviteUrl: string | null;
  error: string | null;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (displayName: string) => Promise<void>;
  onSetReady: (ready: boolean) => Promise<void>;
};

export function RoomControls({
  roomsEnabled,
  status,
  room,
  selfParticipant,
  pendingInvite,
  inviteUrl,
  error,
  onCreateRoom,
  onJoinRoom,
  onSetReady,
}: Props) {
  const [joinName, setJoinName] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const shareRoom = async () => {
    if (!inviteUrl || !room) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join our Reel Consensus movie night",
          text: "Help us agree on one movie.",
          url: inviteUrl,
        });
        trackProductEvent({
          name: "invite_shared",
          roomId: room.id,
          participantCount: room.participants.length,
          source: "share-sheet",
        });
        setShareStatus("Invite shared");
        return;
      }

      await navigator.clipboard.writeText(inviteUrl);
      trackProductEvent({
        name: "invite_shared",
        roomId: room.id,
        participantCount: room.participants.length,
        source: "clipboard",
      });
      setShareStatus("Invite copied");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setShareStatus("Could not share the invite");
    }
  };

  if (!roomsEnabled) {
    return (
      <aside className="room-controls room-controls--disabled" aria-label="Shared rooms status">
        <div>
          <span className="room-controls__eyebrow">Shared rooms</span>
          <strong>Backend-ready, not configured</strong>
          <small>Add Supabase public env variables to activate live invite rooms.</small>
        </div>
      </aside>
    );
  }

  if (pendingInvite && !room) {
    return (
      <aside className="room-controls room-controls--join" aria-label="Join movie night">
        <div>
          <span className="room-controls__eyebrow">You were invited</span>
          <strong>Join this movie night</strong>
          <small>No account. Just a name, then your preferences.</small>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onJoinRoom(joinName);
          }}
        >
          <label>
            <span>Your name</span>
            <input
              value={joinName}
              maxLength={40}
              autoComplete="name"
              placeholder="Maya"
              onChange={(event) => setJoinName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={status === "joining"}
          >
            {status === "joining" ? "Joining…" : "Join room"}
          </button>
        </form>
        {error ? <p className="room-controls__error" role="alert">{error}</p> : null}
      </aside>
    );
  }

  if (room) {
    const readyCount = room.participants.filter((participant) => participant.ready).length;
    const isReady = selfParticipant?.ready ?? false;

    return (
      <aside className="room-controls room-controls--active" aria-label="Live shared room">
        <div>
          <span className="room-controls__eyebrow">
            <i aria-hidden="true" /> Live room
          </span>
          <strong>{room.participants.length} people · {readyCount} ready</strong>
          <small>Preferences and room rules sync across joined devices.</small>
        </div>
        <div className="room-controls__actions">
          {inviteUrl ? (
            <button type="button" className="ghost-button" onClick={() => void shareRoom()}>
              Invite people
            </button>
          ) : null}
          <button
            type="button"
            className={isReady ? "secondary-button" : "primary-button"}
            onClick={() => void onSetReady(!isReady)}
          >
            {isReady ? "I'm not ready" : "I'm ready"}
          </button>
        </div>
        {shareStatus ? <span className="room-controls__notice" role="status">{shareStatus}</span> : null}
        {error ? <p className="room-controls__error" role="alert">{error}</p> : null}
      </aside>
    );
  }

  return (
    <aside className="room-controls" aria-label="Start shared movie night">
      <div>
        <span className="room-controls__eyebrow">Watching together?</span>
        <strong>Give everyone their own vote.</strong>
        <small>Create a live room, then share one private invite link.</small>
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={status === "creating"}
        onClick={() => void onCreateRoom()}
      >
        {status === "creating" ? "Creating…" : "Start shared room"}
      </button>
      {error ? <p className="room-controls__error" role="alert">{error}</p> : null}
    </aside>
  );
}
