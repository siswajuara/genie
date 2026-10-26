import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";
import { PickerPopover } from "./popover";
import { Icon } from "./icon";

export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const color = value === "transparent" ? "#00000000" : value;
  const [draft, setDraft] = useState(color);
  useEffect(() => setDraft(color), [color]);
  return (
    <PickerPopover
      label={`${label} picker`}
      trigger={
        <Button type="button" className="color-trigger" aria-label={label}>
          <span className="color-swatch">
            <span style={{ background: color }} />
          </span>
          <span>{value.toUpperCase()}</span>
          <Icon name="down" size={14} />
        </Button>
      }
    >
      <div className="color-picker">
        <HexAlphaColorPicker color={color} onChange={onChange} />
        <Label className="color-hex">
          Hex
          <Input
            aria-label={`${label} hex`}
            spellCheck={false}
            value={draft}
            onChange={(ev) => {
              const raw = ev.target.value;
              setDraft(raw);
              if (/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(raw)) onChange(raw);
            }}
            onBlur={() => {
              if (
                /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(
                  draft,
                )
              )
                onChange(draft);
              else setDraft(color);
            }}
          />
        </Label>
        <div className="color-presets">
          {[
            "#ffffff",
            "#14226e",
            "#2f4bd8",
            "#f7c600",
            "#e85060",
            "#00000000",
          ].map((c) => (
            <Button
              type="button"
              key={c}
              aria-label={`Use ${c}`}
              className="color-swatch"
              onClick={() => onChange(c)}
            >
              <span style={{ background: c }} />
            </Button>
          ))}
        </div>
      </div>
    </PickerPopover>
  );
}
