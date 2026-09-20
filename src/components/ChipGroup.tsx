import type { ReactNode } from "react";

type ChipGroupProps<T extends string> = {
  label: string;
  values: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  format?: (value: T) => ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
};

const titleCase = (value: string) =>
  value
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

export function ChipGroup<T extends string>({
  label,
  values,
  selected,
  onToggle,
  format,
  tone = "default",
  disabled = false,
}: ChipGroupProps<T>) {
  return (
    <fieldset className="chip-fieldset">
      <legend>{label}</legend>
      <div className="chip-row">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              className={`preference-chip${active ? " preference-chip--active" : ""}${tone === "danger" ? " preference-chip--danger" : ""}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onToggle(value)}
            >
              {format ? format(value) : titleCase(value)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
