import { GENRES, type DecisionSettings, type FairnessMode, type Genre } from "../domain/types";
import { ChipGroup } from "./ChipGroup";

const RUNTIMES: Array<{ label: string; value: number | null }> = [
  { label: "90 min", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "2.5 hours", value: 150 },
  { label: "Any", value: null },
];

const RATINGS: Array<{ label: string; value: number | null }> = [
  { label: "7.5+", value: 7.5 },
  { label: "7.0+", value: 7 },
  { label: "6.5+", value: 6.5 },
  { label: "Any", value: null },
];

const FAIRNESS: Array<{
  value: FairnessMode;
  label: string;
  short: string;
  description: string;
}> = [
  {
    value: "balanced",
    label: "Balanced",
    short: "Best default",
    description: "Rewards strong fit while keeping disagreement low.",
  },
  {
    value: "no-one-hates-it",
    label: "Protect everyone",
    short: "Safest compromise",
    description: "Gives extra weight to the least-satisfied person.",
  },
  {
    value: "democratic",
    label: "Majority wins",
    short: "Average first",
    description: "Prioritizes the group's average preference score.",
  },
];

type SettingsPanelProps = {
  settings: DecisionSettings;
  onChange: (settings: DecisionSettings) => void;
};

const toggleGenre = (values: Genre[], genre: Genre) =>
  values.includes(genre)
    ? values.filter((item) => item !== genre)
    : [...values, genre];

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <section className="settings-card" aria-labelledby="settings-heading">
      <div className="card-eyebrow">
        <span className="eyebrow-icon" aria-hidden="true">⌁</span>
        Shared rules
      </div>

      <div className="settings-card__heading">
        <div>
          <h2 id="settings-heading">How should tonight work?</h2>
          <p>
            Keep the important constraints visible. Secondary limits stay out of the
            way until you need them.
          </p>
        </div>
      </div>

      <fieldset className="segmented-fieldset">
        <legend>How much time do you have?</legend>
        <div className="segmented-control">
          {RUNTIMES.map((option) => (
            <button
              key={option.label}
              type="button"
              className={settings.maxRuntime === option.value ? "segment segment--active" : "segment"}
              aria-pressed={settings.maxRuntime === option.value}
              onClick={() => onChange({ ...settings, maxRuntime: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fairness-fieldset">
        <legend>How should compromise work?</legend>
        <div className="fairness-grid">
          {FAIRNESS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                settings.fairnessMode === option.value
                  ? "fairness-option fairness-option--active"
                  : "fairness-option"
              }
              aria-pressed={settings.fairnessMode === option.value}
              onClick={() => onChange({ ...settings, fairnessMode: option.value })}
            >
              <span className="fairness-option__check" aria-hidden="true">
                {settings.fairnessMode === option.value ? "✓" : ""}
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.short}</small>
              </span>
              <p>{option.description}</p>
            </button>
          ))}
        </div>
      </fieldset>

      <details className="advanced-limits">
        <summary>
          <span>More hard limits</span>
          <small>Minimum rating + group-wide genre vetoes</small>
        </summary>
        <div className="advanced-limits__body">
          <fieldset className="segmented-fieldset">
            <legend>Minimum rating</legend>
            <div className="segmented-control">
              {RATINGS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={settings.minRating === option.value ? "segment segment--active" : "segment"}
                  aria-pressed={settings.minRating === option.value}
                  onClick={() => onChange({ ...settings, minRating: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <ChipGroup
            label="Exclude for everyone"
            values={GENRES}
            selected={settings.excludedGenres}
            onToggle={(genre) =>
              onChange({
                ...settings,
                excludedGenres: toggleGenre(settings.excludedGenres, genre),
              })
            }
            tone="danger"
          />
        </div>
      </details>
    </section>
  );
}
