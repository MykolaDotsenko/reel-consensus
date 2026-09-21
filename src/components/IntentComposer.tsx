import type { SharedIntent } from "../domain/types";

const EXAMPLES = [
  {
    label: "Clever + funny",
    value: "Something clever and funny, no horror, under 2 hours.",
  },
  {
    label: "Fast sci-fi",
    value: "Fast sci-fi, but not too heavy. We want a fun night.",
  },
  {
    label: "Light mystery",
    value: "A highly rated mystery that still feels light.",
  },
];

type IntentComposerProps = {
  value: string;
  intent: SharedIntent | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onInterpret: () => void;
  readOnly?: boolean;
};

export function IntentComposer({
  value,
  intent,
  isLoading,
  onChange,
  onInterpret,
  readOnly = false,
}: IntentComposerProps) {
  return (
    <section className="intent-card" aria-labelledby="intent-heading">
      <div className="card-eyebrow">
        <span className="eyebrow-icon" aria-hidden="true">✦</span>
        Tonight in one sentence
      </div>

      <div className="intent-card__heading">
        <div>
          <h2 id="intent-heading">What kind of night is this?</h2>
          <p>
            Say it naturally. Reel Consensus turns the brief into structured signals,
            then the decision engine does the ranking.
          </p>
        </div>
        <span className="signal-pill">AI assisted</span>
      </div>

      <label className="prompt-label" htmlFor="night-brief">
        Shared brief
      </label>
      <div className="prompt-shell">
        <textarea
          id="night-brief"
          value={value}
          maxLength={800}
          rows={4}
          placeholder="Something clever and funny, no horror, under 2 hours."
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="prompt-count">{value.length}/800</span>
      </div>

      <div className="example-row" aria-label="Example prompts">
        <span>Try</span>
        {EXAMPLES.map((example) => (
          <button
            type="button"
            key={example.label}
            className="example-chip"
            disabled={readOnly}
            onClick={() => onChange(example.value)}
          >
            {example.label}
          </button>
        ))}
      </div>

      <div className="intent-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={readOnly || !value.trim() || isLoading}
          onClick={onInterpret}
        >
          {isLoading ? "Understanding…" : "Use this brief"}
        </button>

        {intent ? (
          <div className="intent-summary" role="status">
            <span className={`source-dot source-dot--${intent.source}`} aria-hidden="true" />
            <div>
              <strong>{intent.source === "ai" ? "AI understood the brief" : "Local parser understood the brief"}</strong>
              <span>{intent.summary}</span>
            </div>
          </div>
        ) : (
          <p className="intent-hint">Optional — you can decide without AI.</p>
        )}
      </div>
    </section>
  );
}
