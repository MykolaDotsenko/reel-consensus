import type { SharedIntent } from "../domain/types";

const EXAMPLES = [
  "Something clever and funny, no horror, under 2 hours.",
  "Fast sci-fi, but not too heavy. We want a fun night.",
  "A highly rated mystery that still feels light.",
];

type IntentComposerProps = {
  value: string;
  intent: SharedIntent | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onInterpret: () => void;
};

export function IntentComposer({ value, intent, isLoading, onChange, onInterpret }: IntentComposerProps) {
  return (
    <section className="intent-card" aria-labelledby="intent-heading">
      <div className="section-kicker">AI brief</div>
      <div className="intent-card__heading">
        <div>
          <h2 id="intent-heading">Describe tonight like a human.</h2>
          <p>AI turns fuzzy language into structured preferences. The ranking itself stays deterministic.</p>
        </div>
        <span className="signal-pill">Optional AI</span>
      </div>

      <label className="prompt-label" htmlFor="night-brief">What are you in the mood for?</label>
      <textarea
        id="night-brief"
        value={value}
        maxLength={800}
        rows={4}
        placeholder="Something clever and funny, no horror, under 2 hours."
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="example-row" aria-label="Example prompts">
        {EXAMPLES.map((example) => (
          <button type="button" key={example} className="example-chip" onClick={() => onChange(example)}>
            {example}
          </button>
        ))}
      </div>

      <div className="intent-actions">
        <button className="secondary-button" type="button" disabled={!value.trim() || isLoading} onClick={onInterpret}>
          {isLoading ? "Understanding…" : "Understand our mood"}
        </button>
        {intent ? (
          <div className="intent-summary" role="status">
            <span className={`source-dot source-dot--${intent.source}`} aria-hidden="true" />
            <div>
              <strong>{intent.source === "ai" ? "AI interpreted" : "Smart fallback"}</strong>
              <span>{intent.summary}</span>
            </div>
          </div>
        ) : null}
      </div>
      <p className="privacy-note">If AI is configured, only this brief is sent to the configured model provider. Participant controls stay local to the app.</p>
    </section>
  );
}
