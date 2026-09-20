import { GENRES, MOODS, type Genre, type Mood, type Participant } from "../domain/types";
import { ChipGroup } from "./ChipGroup";

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

const moodLabel: Record<Mood, string> = {
  easy: "😌 Easy",
  emotional: "❤️ Emotional",
  fast: "⚡ Fast",
  "feel-good": "☀️ Feel-good",
  funny: "😂 Funny",
  "mind-bending": "🌀 Mind-bending",
  tense: "😬 Tense",
  thoughtful: "💭 Thoughtful",
};

type ParticipantCardProps = {
  participant: Participant;
  index: number;
  canRemove: boolean;
  onChange: (participant: Participant) => void;
  onRemove: () => void;
  readOnly?: boolean;
};

export function ParticipantCard({ participant, index, canRemove, onChange, onRemove, readOnly = false }: ParticipantCardProps) {
  const updateLikedGenre = (genre: Genre) => {
    const likedGenres = toggle(participant.likedGenres, genre);
    const avoidedGenres = likedGenres.includes(genre)
      ? participant.avoidedGenres.filter((item) => item !== genre)
      : participant.avoidedGenres;
    onChange({ ...participant, likedGenres, avoidedGenres });
  };

  const updateAvoidedGenre = (genre: Genre) => {
    const avoidedGenres = toggle(participant.avoidedGenres, genre);
    const likedGenres = avoidedGenres.includes(genre)
      ? participant.likedGenres.filter((item) => item !== genre)
      : participant.likedGenres;
    onChange({ ...participant, likedGenres, avoidedGenres });
  };

  return (
    <article className="participant-card">
      <div className="participant-card__header">
        <div className="person-index" aria-hidden="true">{index + 1}</div>
        <label className="person-name">
          <span>Name</span>
          <input
            value={participant.name}
            maxLength={24}
            aria-label={`Participant ${index + 1} name`}
            disabled={readOnly}
            onChange={(event) => onChange({ ...participant, name: event.target.value })}
          />
        </label>
        {canRemove ? (
          <button className="icon-button" type="button" aria-label={`Remove ${participant.name || `participant ${index + 1}`}`} onClick={onRemove}>
            ×
          </button>
        ) : null}
      </div>

      <ChipGroup
        label="Would enjoy"
        values={GENRES}
        selected={participant.likedGenres}
        onToggle={updateLikedGenre}
        disabled={readOnly}
      />
      <ChipGroup
        label="Mood"
        values={MOODS}
        selected={participant.moods}
        onToggle={(mood) => onChange({ ...participant, moods: toggle(participant.moods, mood) })}
        format={(mood) => moodLabel[mood]}
        disabled={readOnly}
      />
      <ChipGroup
        label="Hard no"
        values={GENRES}
        selected={participant.avoidedGenres}
        onToggle={updateAvoidedGenre}
        tone="danger"
        disabled={readOnly}
      />
    </article>
  );
}
