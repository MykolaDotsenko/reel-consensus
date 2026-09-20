export type ProductEventName =
  | "room_created"
  | "invite_shared"
  | "invite_joined"
  | "participant_ready"
  | "decision_requested"
  | "candidate_dismissed"
  | "group_saved"
  | "group_returned"
  | "availability_mismatch_reported";

export type ProductEvent = {
  name: ProductEventName;
  roomId?: string;
  participantCount?: number;
  movieId?: string;
  source?: "button" | "share-sheet" | "clipboard" | "invite-link";
};

export const trackProductEvent = (event: ProductEvent) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ProductEvent>("reel-consensus:product-event", {
      detail: event,
    }),
  );

  if (import.meta.env.DEV) {
    console.debug("[product-event]", event);
  }
};
