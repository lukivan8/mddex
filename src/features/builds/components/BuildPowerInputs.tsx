import { useEffect, useState } from "react";
import {
  BUILD_SLOTS,
  MAX_ITEM_POWER,
  supportsItemPower,
  type Build,
  type BuildSlot,
} from "../build.types";
import { slotRules } from "../build.compatibility";

function SlotPowerInput({
  slot,
  power,
  disabled,
  onChange,
}: {
  slot: BuildSlot;
  power: number;
  disabled: boolean;
  onChange: (power: number) => void;
}) {
  const [draft, setDraft] = useState(String(power));
  useEffect(() => setDraft(String(power)), [power]);
  const commit = (value: number) => {
    if (
      Number.isInteger(value) &&
      value >= 1 &&
      value <= MAX_ITEM_POWER &&
      value !== power
    )
      onChange(value);
  };
  return (
    <label>
      <span>{slotRules[slot].label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_ITEM_POWER}
        step={1}
        aria-label={`${slotRules[slot].label} power`}
        disabled={disabled}
        value={draft}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          if (next.trim()) commit(Number(next));
        }}
        onBlur={() => {
          const number = Number(draft);
          if (draft.trim() && Number.isInteger(number)) {
            const clamped = Math.min(MAX_ITEM_POWER, Math.max(1, number));
            setDraft(String(clamped));
            commit(clamped);
          } else setDraft(String(power));
        }}
      />
    </label>
  );
}
export function BuildPowerInputs({
  build,
  disabled,
  onChange,
}: {
  build: Build;
  disabled?: boolean;
  onChange: (slot: BuildSlot, power: number) => void;
}) {
  return (
    <details className="build-power-controls">
      <summary>Set item power</summary>
      <div className="build-power-grid">
        {BUILD_SLOTS.filter(supportsItemPower).map((slot) => (
          <SlotPowerInput
            key={slot}
            slot={slot}
            power={build.slots[slot]?.power ?? 1}
            disabled={Boolean(disabled || !build.slots[slot])}
            onChange={(power) => onChange(slot, power)}
          />
        ))}
      </div>
    </details>
  );
}
