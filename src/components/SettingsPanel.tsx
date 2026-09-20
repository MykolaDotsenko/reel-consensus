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

const FAIRNESS: Array<{ value: FairnessMode; label: string; description: string }> = [
  { value: "balanced", label: "Balanced", description: "Rewards fit and penalizes disagreement." },
  { value: "no-one-hates-it", label: "No one hates it", description: "Protects the least-satisfied person." },
  { value: "democratic", label: "Democratic", description: "Prioritizes the group's average score." },
];

type SettingsPanelProps = {
  settings: DecisionSettings;
  onChange: (settings: DecisionSettings) => void;
};

const toggleGenre = (values: Genre[], genre: Genre) =>
  values.includes(genre) ? values.filter((item) => item !== genre) : [...values, genre];

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <section className="settings-card" aria-labelledby="settings-heading">
      <div className="section-kicker">Hard constraints</div>
      <div className="settings-card__heading">
        <div>
          <h2 id="settings-heading">Define the edges.</h2>
          <p>Hard constraints filter first. Preference scoring only happens after a movie is eligible.</p>
        </div>
      </div>

      <div className="settings-grid">
        <fieldset className="segmented-fieldset">
          <legend>Maximum runtime</legend>
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
      </div>

      <ChipGroup
        label="Exclude for everyone"
        values={GENRES}
        selected={settings.excludedGenres}
        onToggle={(genre) => onChange({ ...settings, excludedGenres: toggleGenre(settings.excludedGenres, genre) })}
        tone="danger"
      />

      <fieldset className="fairness-fieldset">
        <legend>How should compromise work?</legend>
        <div className="fairness-grid">
          {FAIRNESS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={settings.fairnessMode === option.value ? "fairness-option fairness-option--active" : "fairness-option"}
              aria-pressed={settings.fairnessMode === option.value}
              onClick={() => onChange({ ...settings, fairnessMode: option.value })}
            >
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
