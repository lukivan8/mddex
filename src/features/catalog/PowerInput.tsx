import { useEffect, useState } from "react";
import { MAX_POWER, parsePower } from "./power";
import "./power.css";

export function PowerInput({
  power,
  onChange,
}: {
  power: number;
  onChange: (power: number) => void;
}) {
  const [draft, setDraft] = useState(String(power));
  useEffect(() => setDraft(String(power)), [power]);
  return (
    <label className="catalog-power">
      <span>Power</span>
      <input
        type="number"
        min={1}
        max={MAX_POWER}
        step={1}
        inputMode="numeric"
        value={draft}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(next);
          if (/^\d+$/.test(next)) {
            const parsed = parsePower(next);
            if (String(parsed) === next && parsed !== power) onChange(parsed);
          }
        }}
        onBlur={() => setDraft(String(power))}
      />
    </label>
  );
}
