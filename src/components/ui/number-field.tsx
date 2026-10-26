import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Icon } from "./icon";

export function NumberField({
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(Math.round(value * 1000) / 1000)), [value]);
  const clamp = (n: number) =>
    Math.min(
      max ?? Infinity,
      Math.max(min ?? -Infinity, Math.round(n * 1e6) / 1e6),
    );
  function commit(raw: string) {
    if (raw.trim() && Number.isFinite(Number(raw))) {
      const n = clamp(Number(raw));
      setDraft(String(n));
      onChange(n);
    } else setDraft(String(value));
  }
  function change(delta: number) {
    const n = clamp(value + delta);
    setDraft(String(n));
    onChange(n);
  }
  return (
    <div className="number-field">
      <Button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={min !== undefined && value <= min}
        onClick={() => change(-step)}
      >
        <Icon name="minus" size={13} />
      </Button>
      <Input
        aria-label={label}
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        inputMode="decimal"
        value={draft}
        onChange={(ev) => {
          const raw = ev.target.value;
          if (!/^-?\d*\.?\d*$/.test(raw)) return;
          setDraft(raw);
          if (
            raw !== "" &&
            raw !== "-" &&
            Number.isFinite(Number(raw)) &&
            Number(raw) === clamp(Number(raw))
          )
            onChange(Number(raw));
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
            ev.preventDefault();
            change(
              (ev.key === "ArrowUp" ? 1 : -1) * step * (ev.shiftKey ? 10 : 1),
            );
          }
          if (ev.key === "Enter") {
            commit(draft);
            ev.currentTarget.blur();
          }
        }}
      />
      <Button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={max !== undefined && value >= max}
        onClick={() => change(step)}
      >
        <Icon name="add" size={13} />
      </Button>
    </div>
  );
}
