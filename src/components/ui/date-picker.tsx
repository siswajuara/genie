import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Calendar } from "./calendar";
import { PickerPopover } from "./popover";
import { Icon } from "./icon";

const dateLabel = (d: Date) =>
  d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
        <Button type="button" className="date-trigger" aria-label={label}>
          <Icon name="calendar" />
          <span>{value ? dateLabel(value) : "Choose date"}</span>
          <Icon name="down" size={14} />
        </Button>
      }
    >
      <Calendar
        mode="single"
        selected={value}
        defaultMonth={value}
        autoFocus
        onSelect={(d) => {
          onChange(d);
          setOpen(false);
        }}
      />
      <div className="picker-actions">
        <Button
          type="button"
          onClick={() => {
            onChange(new Date());
            setOpen(false);
          }}
        >
          Today
        </Button>
        <Button
          type="button"
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
        >
          Clear
        </Button>
      </div>
    </PickerPopover>
  );
}
