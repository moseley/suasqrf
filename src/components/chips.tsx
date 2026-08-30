"use client";

/**
 * Tap-to-toggle pill chips, shared by the meal request and the profile so a
 * value looks and behaves the same in both. The parent owns selection, so the
 * same control serves multi-select (dietary) and single-select (cuisine).
 */
export function ChipGroup({
  options,
  isSelected,
  onToggle,
}: {
  options: readonly string[];
  isSelected: (option: string) => boolean;
  onToggle: (option: string) => void;
}) {
  return (
    <div className="chip-row">
      {options.map((option) => {
        const on = isSelected(option);
        return (
          <button
            key={option}
            type="button"
            className={on ? "chip chip-on" : "chip"}
            aria-pressed={on}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
