import { useEffect, useState, type ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import { HexAlphaColorPicker } from "react-colorful";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { Icon } from "./Icon";

const portalContainer = () =>
  document.querySelector<HTMLElement>(".studio") || document.body;
export function PickerPopover({
  trigger,
  children,
  label,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal container={portalContainer()}>
        <Popover.Content
          className="picker-popover"
          aria-label={label}
          sideOffset={6}
          collisionPadding={12}
          onKeyDown={(ev) => ev.stopPropagation()}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function SelectField({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  const empty = "__canvas_empty__";
  return (
    <Select.Root
      value={value || empty}
      onValueChange={(v) => onChange(v === empty ? "" : v)}
      disabled={disabled}
    >
      <Select.Trigger className="select-trigger" aria-label={label}>
        <Select.Value placeholder="Choose" />
        <Select.Icon>
          <Icon name="down" size={15} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={portalContainer()}>
        <Select.Content
          className="select-menu"
          position="popper"
          sideOffset={5}
          collisionPadding={10}
          onKeyDown={(ev) => ev.stopPropagation()}
        >
          <Select.ScrollUpButton className="select-scroll">
            <Icon name="up" />
          </Select.ScrollUpButton>
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                className="select-option"
                key={o.value}
                value={o.value || empty}
                textValue={o.label}
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Icon name="check" size={15} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll">
            <Icon name="down" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
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
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={min !== undefined && value <= min}
        onClick={() => change(-step)}
      >
        <Icon name="minus" size={13} />
      </button>
      <input
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
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={max !== undefined && value >= max}
        onClick={() => change(step)}
      >
        <Icon name="add" size={13} />
      </button>
    </div>
  );
}
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
        <button type="button" className="color-trigger" aria-label={label}>
          <span className="color-swatch">
            <span style={{ background: color }} />
          </span>
          <span>{value.toUpperCase()}</span>
          <Icon name="down" size={14} />
        </button>
      }
    >
      <div className="color-picker">
        <HexAlphaColorPicker color={color} onChange={onChange} />
        <label className="color-hex">
          Hex
          <input
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
        </label>
        <div className="color-presets">
          {[
            "#ffffff",
            "#14226e",
            "#2f4bd8",
            "#f7c600",
            "#e85060",
            "#00000000",
          ].map((c) => (
            <button
              type="button"
              key={c}
              aria-label={`Use ${c}`}
              className="color-swatch"
              onClick={() => onChange(c)}
            >
              <span style={{ background: c }} />
            </button>
          ))}
        </div>
      </div>
    </PickerPopover>
  );
}
const dateLabel = (d: Date) =>
  d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const dateISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s?: string) => {
  if (!s) return undefined;
  const date = new Date(`${s}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : undefined;
};
const calendarComponents = {
  Chevron: ({ orientation }: { orientation?: string }) => (
    <Icon
      name={
        orientation === "left"
          ? "left"
          : orientation === "right"
            ? "right"
            : orientation === "up"
              ? "up"
              : "down"
      }
    />
  ),
};
export function DatePicker({
  value,
  onChange,
  label = "Date",
}: {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button type="button" className="date-trigger" aria-label={label}>
          <Icon name="calendar" />
          <span>{value ? dateLabel(value) : "Choose date"}</span>
          <Icon name="down" size={14} />
        </button>
      }
    >
      <DayPicker
        mode="single"
        selected={value}
        defaultMonth={value}
        autoFocus
        components={calendarComponents}
        onSelect={(d) => {
          onChange(d);
          setOpen(false);
        }}
      />
      <div className="picker-actions">
        <button
          type="button"
          onClick={() => {
            onChange(new Date());
            setOpen(false);
          }}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
        >
          Clear
        </button>
      </div>
    </PickerPopover>
  );
}
export function DateRangePicker({
  value,
  onChange,
  label = "Date range",
}: {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button type="button" className="date-trigger" aria-label={label}>
          <Icon name="calendar" />
          <span>
            {value?.from
              ? `${dateLabel(value.from)} / ${value.to ? dateLabel(value.to) : "End date"}`
              : "Choose date range"}
          </span>
          <Icon name="down" size={14} />
        </button>
      }
    >
      <DayPicker
        mode="range"
        selected={value}
        defaultMonth={value?.from}
        autoFocus
        components={calendarComponents}
        onSelect={onChange}
      />
      <div className="picker-actions">
        <button type="button" onClick={() => onChange(undefined)}>
          Clear
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => setOpen(false)}
        >
          Done
        </button>
      </div>
    </PickerPopover>
  );
}
